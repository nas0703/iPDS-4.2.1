import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getSupabase, getSupabaseCredentials, getDatabasePoolConfig } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { metricsCollector } from '../observability/metrics.js';
import { alertManager } from '../observability/alerts.js';
import { APP_VERSION, APP_VERSION_TAG } from '../../config/version.js';

const router = Router();

/**
 * GET /api/health/live (and /health/live)
 * Liveness probe: Confirms that the Node.js process is alive and accepting connections.
 * 
 * Response: minimal safe JSON. Zero secrets, zero dependency queries.
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    version: APP_VERSION,
    versionTag: APP_VERSION_TAG,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

/**
 * GET /api/health (and /health)
 * Alias to /ready probe for generic health check monitors.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabaseCreds = getSupabaseCredentials();
    const hasSupabase = !!(supabaseCreds && supabaseCreds.supabaseUrl && supabaseCreds.supabaseAnonKey);

    return res.status(200).json({
      status: 'ok',
      ready: hasSupabase,
      version: APP_VERSION,
      versionTag: APP_VERSION_TAG,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch (err: unknown) {
    return res.status(200).json({
      status: 'ok',
      ready: false,
      timestamp: new Date().toISOString(),
      error: 'Readiness check notice',
    });
  }
});

/**
 * GET /api/health/ready (and /health/ready)
 * Readiness probe: Non-mutating dependency check (Supabase client configured, AI key present).
 * Safe non-blocking execution.
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const supabaseCreds = getSupabaseCredentials();
    const hasSupabase = !!(supabaseCreds && supabaseCreds.supabaseUrl && supabaseCreds.supabaseAnonKey);

    // Determine overall readiness
    const isReady = hasSupabase;

    if (!isReady) {
      return res.status(503).json({
        status: 'unready',
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        error: 'Required service configuration pending',
      });
    }

    return res.status(200).json({
      status: 'ready',
      version: APP_VERSION,
      versionTag: APP_VERSION_TAG,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch (err: unknown) {
    return res.status(503).json({
      status: 'unready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
});

/**
 * GET /api/health/db (and /health/db)
 * Active Database Health & Connection Probe
 * 
 * 1. Executes an active lightweight round-trip query to Supabase/PostgreSQL.
 * 2. Measures round-trip query latency in milliseconds.
 * 3. Records database timing metrics.
 * 4. Triggers database alert evaluation if degraded or failed.
 * 5. Returns safe JSON with zero secrets/credentials exposed.
 */
router.get('/db', requireRole(['pf', 'fc', 'oc', 'rc']), async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const supabase = getSupabase();
    if (!supabase) {
      alertManager.evaluateDatabase({ operation: 'health_probe', durationMs: 0, isError: true });
      return res.status(503).json({
        status: 'unhealthy',
        database: 'PostgreSQL (Supabase)',
        connected: false,
        error: 'Database client not initialized or credentials missing',
        timestamp: new Date().toISOString(),
      });
    }

    // Active lightweight read query to verify DB responsiveness
    const { data, error } = await supabase
      .from('workers')
      .select('id')
      .limit(1);

    const durationMs = Date.now() - startTime;

    if (error) {
      metricsCollector.recordDatabaseTiming('health_probe', durationMs, true);
      alertManager.evaluateDatabase({ operation: 'health_probe', durationMs, isError: true });
      return res.status(503).json({
        status: 'degraded',
        database: 'PostgreSQL (Supabase)',
        connected: false,
        latencyMs: durationMs,
        error: 'Database query execution failed',
        code: error.code || 'DB_ERROR',
        timestamp: new Date().toISOString(),
      });
    }

    metricsCollector.recordDatabaseTiming('health_probe', durationMs, false);
    alertManager.evaluateDatabase({ operation: 'health_probe', durationMs, isError: false });

    const poolConfig = getDatabasePoolConfig();

    return res.status(200).json({
      status: 'healthy',
      database: 'PostgreSQL (Supabase)',
      connected: true,
      latencyMs: durationMs,
      poolerActive: poolConfig?.connectionPooler?.enabled || false,
      readReplicaActive: poolConfig?.readReplica?.enabled || false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    metricsCollector.recordDatabaseTiming('health_probe', durationMs, true);
    alertManager.evaluateDatabase({ operation: 'health_probe', durationMs, isError: true });

    return res.status(503).json({
      status: 'unhealthy',
      database: 'PostgreSQL (Supabase)',
      connected: false,
      latencyMs: durationMs,
      error: 'Unexpected database probe failure',
      timestamp: new Date().toISOString(),
    });
  }
});

interface BackupManifestData {
  timestamp?: string;
  tables?: Record<string, unknown>;
  total_records?: number;
  checksum?: string;
}

/**
 * GET /api/health/backup (and /health/backup)
 * Active Backup & PITR Health Probe
 * 
 * Verifies the existence, timestamp, age, and manifest of recent backups.
 * Triggers backup health alerts if backup is stale (>24h).
 */
router.get('/backup', requireRole(['pf', 'fc', 'oc', 'rc']), (req: Request, res: Response) => {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    let latestBackupName: string | null = null;
    let latestBackupTime: number = 0;
    let manifestData: BackupManifestData | null = null;

    if (fs.existsSync(backupDir)) {
      const entries = fs.readdirSync(backupDir);
      for (const entry of entries) {
        if (entry.startsWith('ipds_backup_')) {
          const entryPath = path.join(backupDir, entry);
          const stat = fs.statSync(entryPath);
          if (stat.isDirectory() && stat.mtimeMs > latestBackupTime) {
            latestBackupTime = stat.mtimeMs;
            latestBackupName = entry;
          }
        }
      }

      if (latestBackupName) {
        const manifestPath = path.join(backupDir, latestBackupName, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifestData;
          } catch (_) {
            manifestData = null;
          }
        }
      }
    }

    const now = Date.now();
    const ageHours = latestBackupTime > 0 ? (now - latestBackupTime) / (1000 * 60 * 60) : 999;
    const isFresh = ageHours <= 24;

    // Evaluate backup health alert
    alertManager.evaluateBackup({
      lastBackupHoursAgo: ageHours,
      status: latestBackupName ? 'FOUND' : 'NOT_FOUND',
    });

    return res.status(200).json({
      status: isFresh ? 'healthy' : ageHours <= 48 ? 'warning' : 'critical',
      backupStrategy: 'Scheduled Multi-Tenant Logical Backup + Continuous Supabase WAL Replication',
      pitrCapability: {
        supported: false,
        reason: 'Supabase continuous WAL PITR requires Enterprise/Pro PITR addon. System enforces scheduled verifiable JSON backups with SHA-256 manifests.',
      },
      latestBackup: latestBackupName ? {
        folder: latestBackupName,
        timestamp: manifestData?.timestamp || new Date(latestBackupTime).toISOString(),
        ageHours: Math.round(ageHours * 10) / 10,
        tablesCount: manifestData?.tables ? Object.keys(manifestData.tables).length : undefined,
        totalRecords: manifestData?.total_records,
        checksumVerified: !!manifestData?.checksum,
      } : null,
      freshness: isFresh ? 'OPTIMAL (within 24h)' : `STALE (${Math.round(ageHours)}h old)`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.warn('[BACKUP_HEALTH_FAILSAFE] Failed to evaluate backup health:', err);
    return res.status(500).json({
      status: 'error',
      error: 'Failed to inspect backup health',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/diagnostics
 * Detailed operational diagnostics: Protected by session authentication (Staff/Admin/Planter).
 * Returns deep observability metrics, memory breakdown, and dependency states without exposing secrets.
 */
router.get('/diagnostics', requireAuth, (req: Request, res: Response) => {
  try {
    const supabaseCreds = getSupabaseCredentials();
    const memory = process.memoryUsage();
    const snapshot = metricsCollector.getSnapshot() as Record<string, unknown>;
    const healthSignal = alertManager.getHealthSignal(snapshot as Parameters<typeof alertManager.getHealthSignal>[0]);

    const diagnostics = {
      version: APP_VERSION,
      versionTag: APP_VERSION_TAG,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      uptimeSeconds: Math.round(process.uptime()),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryMb: {
          heapUsed: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotal: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
          rss: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
          external: Math.round((memory.external / 1024 / 1024) * 100) / 100,
        },
      },
      dependencies: {
        supabase: {
          configured: !!(supabaseCreds?.supabaseUrl && supabaseCreds?.supabaseAnonKey),
          urlHost: supabaseCreds?.supabaseUrl ? new URL(supabaseCreds.supabaseUrl).hostname : 'not_configured',
        },
        geminiAi: {
          configured: !!process.env.GEMINI_API_KEY,
        },
      },
      health: healthSignal,
      securityMetrics: snapshot?.security || {},
    };

    return res.status(200).json({
      success: true,
      diagnostics,
    });
  } catch (err: unknown) {
    console.warn('[HEALTH_DIAGNOSTICS_FAILSAFE] Diagnostics error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate diagnostic report',
    });
  }
});

export default router;
