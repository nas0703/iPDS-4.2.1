/**
 * Observability Persistent History Writer (Step 4C)
 * 
 * STRICT ZERO-DISRUPTION COMPLIANCE:
 * 1. Asynchronous & fully non-blocking (Never blocks HTTP request/response cycle).
 * 2. Complete Transaction & Failure Isolation (Never interacts with or disrupts plantation DB transactions).
 * 3. Bounded Execution Guard (Prevents concurrent overlapping snapshot writes).
 * 4. Data Safety (Zero PII, passwords, PINs, tokens, full prompts, or payload bodies).
 * 5. Startup & Shutdown Safety (Failsafe initialization and bounded-time shutdown flush).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { metricsCollector } from './metrics.js';
import { isMissingTableError } from '../db.js';

export interface MetricSnapshotPayload {
  window_start: string;
  window_end: string;
  environment: string;
  total_requests: number;
  success_requests: number;
  client_errors: number;
  server_errors: number;
  error_rate: number;
  latency_min_ms: number;
  latency_avg_ms: number;
  latency_max_ms: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  heap_used_mb: number;
  heap_total_mb: number;
  rss_mb: number;
  uptime_seconds: number;
  active_alert_state: string;
}

export interface SnapshotWriteResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
  snapshot?: Partial<MetricSnapshotPayload>;
}

class BackgroundSnapshotWriter {
  private isWriting: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private lastWindowStart: Date = new Date();
  private lastSuccessfulSnapshotAt: Date | null = null;
  private intervalMs: number = 60 * 60 * 1000; // 60 minutes default
  private cachedClient: SupabaseClient | null = null;

  /**
   * Safe Supabase client retrieval with service_role priority for RLS compliance.
   * Completely isolated from application user sessions.
   */
  private getClient(): SupabaseClient | null {
    if (this.cachedClient) {
      return this.cachedClient;
    }

    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                         process.env.VITE_SUPABASE_ANON_KEY || 
                         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                         process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !serviceKey) {
        return null;
      }

      this.cachedClient = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      return this.cachedClient;
    } catch (err) {
      console.warn('[SNAPSHOT_WRITER_FAILSAFE] Failed to create Supabase client for metrics persistence:', err);
      return null;
    }
  }

  /**
   * Aggregate in-memory metrics safely into database snapshot payload.
   * Zero raw request data or PII is captured.
   */
  public buildSnapshotPayload(windowStart: Date, windowEnd: Date): MetricSnapshotPayload {
    const rawSnapshot = metricsCollector.getSnapshot() as any;
    const env = process.env.NODE_ENV || 'production';

    let totalRequests = 0;
    let successRequests = 0;
    let clientErrors = 0;
    let serverErrors = 0;
    let minLatency = Number.MAX_SAFE_INTEGER;
    let maxLatency = 0;
    let weightedLatencySum = 0;
    let maxP50 = 0;
    let maxP95 = 0;
    let maxP99 = 0;

    if (rawSnapshot && Array.isArray(rawSnapshot.endpoints)) {
      for (const ep of rawSnapshot.endpoints) {
        const reqs = ep.requests || 0;
        totalRequests += reqs;
        successRequests += ep.success || 0;
        clientErrors += ep.clientErrors || 0;
        serverErrors += ep.serverErrors || 0;

        if (ep.latency) {
          if (reqs > 0 && ep.latency.min !== undefined && ep.latency.min < minLatency) {
            minLatency = ep.latency.min;
          }
          if (ep.latency.max !== undefined && ep.latency.max > maxLatency) {
            maxLatency = ep.latency.max;
          }
          if (ep.latency.avg !== undefined) {
            weightedLatencySum += ep.latency.avg * reqs;
          }
          if (ep.latency.p50 !== undefined && ep.latency.p50 > maxP50) {
            maxP50 = ep.latency.p50;
          }
          if (ep.latency.p95 !== undefined && ep.latency.p95 > maxP95) {
            maxP95 = ep.latency.p95;
          }
          if (ep.latency.p99 !== undefined && ep.latency.p99 > maxP99) {
            maxP99 = ep.latency.p99;
          }
        }
      }
    }

    const avgLatency = totalRequests > 0 ? weightedLatencySum / totalRequests : 0;
    const errorRate = totalRequests > 0 ? (clientErrors + serverErrors) / totalRequests : 0;
    const heapUsedMb = rawSnapshot?.process?.memory?.heapUsedMb || Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100;
    const heapTotalMb = rawSnapshot?.process?.memory?.heapTotalMb || Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100;
    const rssMb = rawSnapshot?.process?.memory?.rssMb || Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100;
    const uptimeSeconds = rawSnapshot?.process?.uptimeSeconds || Math.round(process.uptime());
    const activeAlertState = rawSnapshot?.health?.overallState || 'NORMAL';

    return {
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      environment: env,
      total_requests: totalRequests,
      success_requests: successRequests,
      client_errors: clientErrors,
      server_errors: serverErrors,
      error_rate: Math.round(errorRate * 10000) / 10000,
      latency_min_ms: minLatency === Number.MAX_SAFE_INTEGER ? 0 : Math.round(minLatency * 100) / 100,
      latency_avg_ms: Math.round(avgLatency * 100) / 100,
      latency_max_ms: Math.round(maxLatency * 100) / 100,
      latency_p50_ms: Math.round(maxP50 * 100) / 100,
      latency_p95_ms: Math.round(maxP95 * 100) / 100,
      latency_p99_ms: Math.round(maxP99 * 100) / 100,
      heap_used_mb: heapUsedMb,
      heap_total_mb: heapTotalMb,
      rss_mb: rssMb,
      uptime_seconds: uptimeSeconds,
      active_alert_state: activeAlertState,
    };
  }

  /**
   * Asynchronously writes an aggregated metric snapshot to Supabase database.
   * STRICT FAILSAFE: Errors are caught, logged, and will never throw or bubble up.
   */
  public async writeSnapshot(trigger: 'scheduled' | 'shutdown' | 'manual' = 'scheduled'): Promise<SnapshotWriteResult> {
    const now = new Date();

    // Strict frequency guard: Do not write more than once in any intervalMs window
    if (this.lastSuccessfulSnapshotAt !== null) {
      const elapsedMs = now.getTime() - this.lastSuccessfulSnapshotAt.getTime();
      if (elapsedMs < this.intervalMs) {
        console.warn(`[SNAPSHOT_WRITER] Skipping ${trigger} snapshot: Minimum interval of ${Math.round(this.intervalMs / 1000)}s not elapsed (${Math.round(elapsedMs / 1000)}s elapsed since last successful write).`);
        return {
          success: false,
          skipped: true,
          error: '60-minute minimum frequency threshold not elapsed',
        };
      }
    }

    // Bounded concurrency guard: prevent overlapping writes
    if (this.isWriting) {
      console.warn(`[SNAPSHOT_WRITER] Skipping ${trigger} snapshot: Previous write operation is still in progress.`);
      return { success: false, skipped: true, error: 'Overlapping snapshot write prevented' };
    }

    this.isWriting = true;
    const windowStart = new Date(this.lastWindowStart);
    const windowEnd = now;

    try {
      const payload = this.buildSnapshotPayload(windowStart, windowEnd);
      const client = this.getClient();

      if (!client) {
        // Safe degrade: Database credentials missing or not configured
        return {
          success: false,
          error: 'Supabase client unavailable for observability persistence',
          snapshot: payload,
        };
      }

      // Perform non-blocking insert/upsert with idempotency constraint handling
      const { error } = await client
        .from('observability_metric_snapshots')
        .upsert(payload, {
          onConflict: 'window_start,window_end,environment',
          ignoreDuplicates: true,
        });

      if (error) {
        if (isMissingTableError(error)) {
          console.warn('[SNAPSHOT_WRITER_NOTICE] Table observability_metric_snapshots not yet migrated or accessible on remote Supabase instance.');
        } else {
          console.warn('[SNAPSHOT_WRITER_FAILSAFE] Error writing metric snapshot to database:', error.message || error);
        }
        return {
          success: false,
          error: error.message || 'Database error during snapshot write',
          snapshot: payload,
        };
      }

      // Update last successful snapshot timestamp and advance window start on successful persistence ONLY
      this.lastSuccessfulSnapshotAt = now;
      this.lastWindowStart = now;

      return {
        success: true,
        snapshot: payload,
      };

    } catch (err: any) {
      // Total failure isolation: never re-throw
      console.warn('[SNAPSHOT_WRITER_FAILSAFE] Unexpected failure in writeSnapshot:', err?.message || err);
      return {
        success: false,
        error: err?.message || 'Unexpected error in writeSnapshot',
      };
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Start the periodic background writer.
   * Defaults to once every 60 minutes.
   */
  public start(intervalMs: number = 60 * 60 * 1000): void {
    try {
      this.intervalMs = Math.max(intervalMs, 10000); // Minimum 10 seconds for testing/sanity

      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }

      this.lastWindowStart = new Date();

      // Use unref() so the background timer does not block node process exit
      this.timer = setInterval(() => {
        this.writeSnapshot('scheduled').catch(err => {
          console.warn('[SNAPSHOT_WRITER_FAILSAFE] Background timer error caught:', err);
        });
      }, this.intervalMs);

      if (typeof this.timer.unref === 'function') {
        this.timer.unref();
      }

      console.log(`[SNAPSHOT_WRITER] Background snapshot writer initialized (interval: ${Math.round(this.intervalMs / 1000)}s).`);
    } catch (err) {
      console.warn('[SNAPSHOT_WRITER_FAILSAFE] Failed to start snapshot writer timer:', err);
    }
  }

  /**
   * Stop the periodic timer cleanly.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Flush metrics snapshot on application shutdown with a bounded timeout (max 1500ms).
   */
  public async flushOnShutdown(timeoutMs: number = 1500): Promise<void> {
    this.stop();
    try {
      const flushPromise = this.writeSnapshot('shutdown');
      const timeoutPromise = new Promise<SnapshotWriteResult>((resolve) => {
        setTimeout(() => resolve({ success: false, error: 'Shutdown flush timeout reached' }), timeoutMs);
      });

      await Promise.race([flushPromise, timeoutPromise]);
    } catch (err) {
      console.warn('[SNAPSHOT_WRITER_FAILSAFE] Error during shutdown flush:', err);
    }
  }

  /**
   * Diagnostic helper for health check / status inspection
   */
  public getStatus() {
    return {
      active: this.timer !== null,
      intervalMs: this.intervalMs,
      lastWindowStart: this.lastWindowStart.toISOString(),
      lastSuccessfulSnapshotAt: this.lastSuccessfulSnapshotAt ? this.lastSuccessfulSnapshotAt.toISOString() : null,
      isWriting: this.isWriting,
    };
  }
}

export const snapshotWriter = new BackgroundSnapshotWriter();
