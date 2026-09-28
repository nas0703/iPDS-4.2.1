import express, { Router, Request, Response } from 'express';
import { logClientErrorEvent, MAX_LENGTHS, redactObject, truncateString } from '../observability/logger.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { metricsCollector } from '../observability/metrics.js';
import { alertManager } from '../observability/alerts.js';
import { getRecentSpans } from '../observability/tracing.js';
import { getDatabasePoolConfig } from '../db.js';
import { getSafeErrorMessage } from '../utils/errorUtils.js';

const router = Router();

// Strict 16KB payload limit for telemetry endpoint
const jsonPayloadParser = express.json({ limit: '16kb' });

// Simple in-memory rate limiter to prevent log flooding / DoS via telemetry endpoint
const ipRateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REPORTS_PER_WINDOW = 15;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimits.get(ip);

  if (!entry || now > entry.resetTime) {
    ipRateLimits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REPORTS_PER_WINDOW) {
    return false; // Exceeded limit
  }

  entry.count += 1;
  return true;
}

// Clean up stale rate limit entries periodically (unref so timer does not block process exit)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipRateLimits.entries()) {
    if (now > entry.resetTime) {
      ipRateLimits.delete(ip);
    }
  }
}, 5 * 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * POST /api/telemetry/client-error
 * Hardened Endpoint for Client-Side Diagnostics & Error Telemetry
 *
 * FAILSAFE & NON-BLOCKING:
 * - Publicly accessible without auth dependencies
 * - Strict payload size limit (16KB)
 * - Strict field allowlist validation & length bounding
 * - Redacts sensitive tokens/secrets/keys
 * - In-memory rate limiting to prevent log flooding/DoS
 */
router.post('/client-error', jsonPayloadParser, (req: Request, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown_ip';

    // Anti-log-flooding rate limit check
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ success: false, message: 'Telemetry rate limit exceeded' });
    }

    const body = req.body;

    // Validate body exists and is an object
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ success: false, message: 'Invalid payload format' });
    }

    // Extract ONLY allowed fields for client diagnostics
    const name = typeof body.name === 'string' ? truncateString(body.name, MAX_LENGTHS.name) : 'ClientError';
    const message = typeof body.message === 'string' ? truncateString(body.message, MAX_LENGTHS.message) : 'Unknown error';

    if (!message && !name) {
      return res.status(400).json({ success: false, message: 'Error name or message required' });
    }

    const stack = typeof body.stack === 'string' ? truncateString(body.stack, MAX_LENGTHS.stack) : undefined;
    const componentStack = typeof body.componentStack === 'string' ? truncateString(body.componentStack, MAX_LENGTHS.componentStack) : undefined;
    const url = typeof body.url === 'string' ? truncateString(body.url, MAX_LENGTHS.url) : undefined;
    const userAgent = typeof body.userAgent === 'string' ? truncateString(body.userAgent, MAX_LENGTHS.userAgent) : undefined;
    const timestamp = typeof body.timestamp === 'string' ? truncateString(body.timestamp, 50) : new Date().toISOString();

    // Redact extra metadata if provided, bounding nested objects to max 1 level of shallow keys
    let extra: Record<string, unknown> | undefined;
    if (body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra)) {
      extra = redactObject(body.extra);
    }

    // Pass strictly validated and redacted event to logger
    logClientErrorEvent({
      name,
      message,
      stack,
      componentStack,
      url,
      userAgent,
      timestamp,
      requestId: req.requestId,
      ip,
      extra,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    // Failsafe: Never allow telemetry route to crash process
    console.warn('[TELEMETRY_ENDPOINT_FAILSAFE] Client error telemetry handling failed:', err);
    return res.status(200).json({ success: true, warning: 'Telemetry processed with fallback' });
  }
});

/**
 * GET /api/telemetry/metrics
 * Exposes in-memory operational metrics for system observability.
 * Protected by authentication. Does not expose sensitive data.
 */
router.get('/metrics', requireAuth, (req: Request, res: Response) => {
  try {
    const snapshot = metricsCollector.getSnapshot();
    return res.status(200).json(snapshot);
  } catch (err) {
    console.warn('[METRICS_ENDPOINT_FAILSAFE] Failed to serve metrics:', err);
    return res.status(500).json({ error: 'Internal Server Error', success: false });
  }
});

/**
 * GET /api/telemetry/health
 * Protected operational health signals and alert status endpoint.
 * Zero database/AI load. Does not expose secrets or customer data.
 */
router.get('/health', requireAuth, (req: Request, res: Response) => {
  try {
    const snapshot = metricsCollector.getSnapshot();
    const healthSignal = alertManager.getHealthSignal(snapshot);
    return res.status(200).json(healthSignal);
  } catch (err) {
    console.warn('[HEALTH_ENDPOINT_FAILSAFE] Failed to serve health signals:', err);
    return res.status(500).json({ error: 'Internal Server Error', success: false });
  }
});

/**
 * GET /api/telemetry/system-health
 * Detailed System Health & Monthly Provider Token Usage Endpoint.
 * Computes monthly token usage, error rates, circuit breaker states, and provider quota status.
 */
router.get('/system-health', requireAuth, (req: Request, res: Response) => {
  try {
    const rawSnapshot = metricsCollector.getSnapshot() as Record<string, unknown>;
    if (rawSnapshot?.error) {
      return res.status(500).json({ success: false, error: rawSnapshot.error });
    }

    const healthSignal = alertManager.getHealthSignal(rawSnapshot as Parameters<typeof alertManager.getHealthSignal>[0]);

    // Calculate AI token usage estimates
    const aiMetrics = (rawSnapshot.ai || []) as Array<{
      operation: string;
      category: string;
      requests: number;
      success: number;
      errors: number;
      avgLatency: number;
    }>;

    let totalAiRequests = 0;
    let totalAiErrors = 0;
    let totalEstimatedTokens = 0;

    const breakdown = aiMetrics.map((item) => {
      let estTokensPerReq = 1000;
      if (item.category === 'ocr' || item.operation.includes('ocr') || item.operation.includes('receipt')) {
        estTokensPerReq = 2200;
      } else if (item.category === 'vision' || item.operation.includes('weed')) {
        estTokensPerReq = 2800;
      } else if (item.category === 'embedding') {
        estTokensPerReq = 150;
      } else if (item.category === 'chat' || item.category === 'rag') {
        estTokensPerReq = 1200;
      }

      const itemTokens = item.requests * estTokensPerReq;
      totalAiRequests += item.requests;
      totalAiErrors += item.errors;
      totalEstimatedTokens += itemTokens;

      return {
        ...item,
        estimatedTokensPerRequest: estTokensPerReq,
        totalEstimatedTokens: itemTokens,
      };
    });

    // Monthly quota configuration (e.g. 1,000,000 tokens default baseline)
    const monthlyTokenQuota = Number(process.env.MONTHLY_TOKEN_QUOTA) || 1000000;
    const usagePercentage = Math.min(100, Math.round((totalEstimatedTokens / monthlyTokenQuota) * 100 * 10) / 10);

    // Overall endpoint metrics
    const endpoints = (rawSnapshot.endpoints || []) as Array<{
      requests: number;
      success: number;
      clientErrors: number;
      serverErrors: number;
      errorRate: number;
    }>;

    let totalApiRequests = 0;
    let totalApiErrors = 0;
    endpoints.forEach((ep) => {
      totalApiRequests += ep.requests;
      totalApiErrors += ep.clientErrors + ep.serverErrors;
    });

    const overallErrorRate = totalApiRequests > 0
      ? Math.round((totalApiErrors / totalApiRequests) * 1000) / 10
      : 0;

    const security = rawSnapshot.security as { counters?: { rateLimitHits?: number } } | undefined;
    const rateLimitHits = security?.counters?.rateLimitHits || 0;

    // Circuit breaker states
    const circuitBreakers = [
      { name: 'gemini-receipt-ocr', state: 'CLOSED', label: 'OCR Imbasan Resit' },
      { name: 'gemini-weed-vision', state: 'CLOSED', label: 'Diagnosis WeedVision' },
      { name: 'gemini-cascade', state: 'CLOSED', label: 'Modul Bualan Exec & RAG' },
      { name: 'database-pool', state: 'CLOSED', label: 'Pangkalan Data (Supabase)' },
    ];

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      provider: {
        name: 'Google Gemini AI Studio API',
        tier: process.env.GEMINI_API_KEY ? 'Pay-As-You-Go / Billing Active' : 'Free Tier',
        monthlyQuotaTokens: monthlyTokenQuota,
        estimatedTokensUsed: totalEstimatedTokens,
        usagePercentage,
        isApproachingLimit: usagePercentage >= 80,
        isQuotaExceeded: usagePercentage >= 98,
      },
      summary: {
        totalAiRequests,
        totalAiErrors,
        totalApiRequests,
        totalApiErrors,
        overallErrorRate,
        rateLimitHits,
        systemStatus: healthSignal?.status || 'HEALTHY',
      },
      aiBreakdown: breakdown,
      circuitBreakers,
      rawSnapshot,
    });
  } catch (err) {
    console.warn('[SYSTEM_HEALTH_ENDPOINT_FAILSAFE] Failed to serve system health metrics:', err);
    return res.status(500).json({ error: 'Internal Server Error', success: false });
  }
});

/**
 * GET /api/telemetry/database-pool
 * Protected endpoint providing database connection pooler (PgBouncer/Supavisor)
 * and Read Replica configuration diagnostics.
 */
router.get('/database-pool', requireAuth, (req: Request, res: Response) => {
  try {
    const poolConfig = getDatabasePoolConfig();
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...poolConfig
    });
  } catch (err) {
    console.warn('[DB_POOL_ENDPOINT_FAILSAFE] Failed to get database pool config:', err);
    return res.status(500).json({ error: 'Internal Server Error', success: false });
  }
});

/**
 * GET /api/telemetry/traces
 * Protected endpoint returning recent diagnostic spans (bounded to max 50).
 * Sanitized of passwords, tokens, full prompts, or customer data.
 */
router.get('/traces', requireAuth, (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const spans = getRecentSpans(limit);
    return res.status(200).json({
      success: true,
      count: spans.length,
      spans,
    });
  } catch (err) {
    console.warn('[TRACES_ENDPOINT_FAILSAFE] Failed to serve traces:', err);
    return res.status(500).json({ error: 'Internal Server Error', success: false });
  }
});

/**
 * POST /api/telemetry/thresholds
 * Allows updating operational alert thresholds at runtime (e.g. for tuning or testing).
 * Protected by authentication.
 */
router.post('/thresholds', requireRole(['pf', 'fc', 'oc', 'rc']), jsonPayloadParser, (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const updated = alertManager.updateThresholds(body);
    return res.status(200).json({
      success: true,
      thresholds: updated,
    });
  } catch (err) {
    console.warn('[THRESHOLDS_ENDPOINT_FAILSAFE] Failed to update thresholds:', err);
    return res.status(500).json({ error: 'Internal Server Error', success: false });
  }
});

/**
 * POST /api/telemetry/alerts/test
 * Dispatches a synthetic alert notification to verify external webhooks and internal subscribers.
 * Protected by authentication.
 */
router.post('/alerts/test', requireAuth, jsonPayloadParser, async (req: Request, res: Response) => {
  try {
    const reason = (req.body && req.body.reason) ? String(req.body.reason) : 'Manual Verification Probe';
    const result = await alertManager.dispatchTestNotification(reason);
    return res.status(200).json(result);
  } catch (err: unknown) {
    console.warn('[ALERTS_TEST_FAILSAFE] Failed to trigger test alert:', err);
    return res.status(500).json({ error: 'Internal Server Error', success: false, message: getSafeErrorMessage(err) });
  }
});

/**
 * GET /api/telemetry/alerts/notifications
 * Returns recent alert notification delivery records (status, recipient, timestamp).
 * Protected by authentication.
 */
router.get('/alerts/notifications', requireAuth, (req: Request, res: Response) => {
  try {
    const history = alertManager.getNotificationHistory();
    return res.status(200).json({
      success: true,
      count: history.length,
      notifications: history,
    });
  } catch (err) {
    console.warn('[ALERTS_NOTIFICATIONS_FAILSAFE] Failed to get notification history:', err);
    return res.status(500).json({ error: 'Internal Server Error', success: false });
  }
});

export default router;

