import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { truncateString } from '../observability/logger.js';
import { metricsCollector } from '../observability/metrics.js';
import { generateSpanId, generateTraceId, RequestContext } from '../observability/tracing.js';

/**
 * Structured Log Payload Interface
 */
export interface TelemetryLogEvent {
  timestamp: string;
  correlationId?: string;
  requestId: string;
  traceId?: string;
  method: string;
  url: string;
  path: string;
  statusCode: number;
  durationMs: number;
  estateId?: string;
  userId?: string;
  userRole?: string;
  userAgent?: string;
  ip?: string;
  memoryUsageMb?: number;
  error?: string;
}

/**
 * Non-Blocking Observability & Telemetry Middleware
 * 
 * ZERO DISRUPTION GUARANTEE:
 * 1. Fully non-blocking - wrapped in try/catch.
 * 2. If telemetry or logging fails, request processing CONTINUES UNINTERRUPTED.
 * 3. Does NOT alter API payloads or status codes.
 * 4. Does NOT modify or write to database tables.
 */
export const observabilityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Idempotency Guard: Prevent duplicate execution if re-entered internally
  if ((req as any).requestId || (req as any)._observed) {
    return next();
  }
  (req as any)._observed = true;

  // Only observe API requests (ignore static frontend asset requests)
  const rawUrl = req.originalUrl || req.url || '';
  if (!rawUrl.startsWith('/api') && !req.path.startsWith('/api') && !req.baseUrl.startsWith('/api')) {
    return next();
  }

  const startTime = process.hrtime();
  const startTimeEpoch = Date.now();

  try {
    // Generate or pass-through correlation request ID safely (sanitized against CRLF / header injection)
    const existingReqId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    let requestId: string;
    if (typeof existingReqId === 'string' && existingReqId.trim().length > 0) {
      const sanitized = existingReqId.replace(/[\r\n\t]/g, '').trim();
      requestId = /^[a-zA-Z0-9_\-\.]{1,100}$/.test(sanitized)
        ? sanitized
        : `req_${crypto.randomBytes(8).toString('hex')}`;
    } else {
      requestId = `req_${crypto.randomBytes(8).toString('hex')}`;
    }

    const existingTraceId = req.headers['x-trace-id'];
    let traceId: string;
    if (typeof existingTraceId === 'string' && existingTraceId.trim().length > 0) {
      const sanitized = existingTraceId.replace(/[\r\n\t]/g, '').trim();
      traceId = /^[a-zA-Z0-9_\-\.]{1,100}$/.test(sanitized)
        ? sanitized
        : generateTraceId();
    } else {
      traceId = generateTraceId();
    }

    const rootSpanId = generateSpanId();

    // Create server-side RequestContext
    const requestContext: RequestContext = {
      requestId,
      traceId,
      rootSpanId,
      startTime: startTimeEpoch,
      method: req.method,
      path: req.path || '',
      currentOperation: `http.${req.method.toLowerCase()}`,
    };

    // Attach correlation ID, request ID and trace context to request object and response header safely
    (req as any).requestId = requestId;
    (req as any).correlationId = requestId;
    (req as any).traceId = traceId;
    (req as any).requestContext = requestContext;

    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Correlation-ID', requestId);
    res.setHeader('X-Trace-ID', traceId);

    // Enterprise Security Response Headers (Safe, additive, enterprise-grade)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');

    // Suspicious Vulnerability Probe / Exploit Scanner Blocker (In-memory fail-fast)
    const checkPath = (req.path || req.originalUrl || '').toLowerCase();
    const isSuspiciousProbe = 
      /\.(env|git|svn|htaccess|bak|config|sql|aws|yml|yaml)$/i.test(checkPath) ||
      /(wp-admin|wp-login|xmlrpc|phpmyadmin|pma|actuator|cgi-bin|web-inf)/i.test(checkPath);

    if (isSuspiciousProbe) {
      metricsCollector.recordSecurityEvent('suspicious_probe', { path: truncateString(checkPath, 100), method: req.method });
      console.warn(`[SECURITY_PROBE_BLOCKED] [${requestId}] Suspicious probe blocked: ${req.method} ${checkPath}`);
      res.status(404).json({
        success: false,
        error: 'Sumber tidak dijumpai.',
        code: 'NOT_FOUND',
        correlationId: requestId
      });
      return;
    }

    // Track response completion non-blockingly
    res.on('finish', () => {
      try {
        const diff = process.hrtime(startTime);
        const durationMs = Math.round((diff[0] * 1e3 + diff[1] * 1e-6) * 100) / 100;

        const memoryMb = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;

        const rawUrl = req.originalUrl || req.url || '';
        const cleanUrl = truncateString(rawUrl, 500);
        const cleanPath = truncateString(req.path || '', 250);
        const cleanUserAgent = req.headers['user-agent'] ? truncateString(req.headers['user-agent'], 250) : undefined;

        // Record metrics to in-memory collector
        metricsCollector.recordApiRequest(req.method, cleanPath || cleanUrl, res.statusCode, durationMs);

        // Record security aggregate signals
        if (res.statusCode === 401) {
          metricsCollector.recordSecurityEvent('auth_failure', { path: cleanPath, method: req.method });
        } else if (res.statusCode === 403) {
          metricsCollector.recordSecurityEvent('auth_denied', { path: cleanPath, method: req.method });
        } else if (res.statusCode === 429) {
          metricsCollector.recordSecurityEvent('rate_limit_hit', { path: cleanPath, method: req.method });
        }

        // Detect slow requests and emit structured warning event (conservative threshold: 1500ms for standard, 8000ms for heavy AI/OCR)
        const isAiEndpoint = cleanPath.includes('/ai/') || cleanPath.includes('/gemini');
        const slowThresholdMs = isAiEndpoint ? 8000 : 1500;
        if (durationMs >= slowThresholdMs) {
          const slowLog = {
            timestamp: new Date().toISOString(),
            level: 'WARN',
            correlation_id: requestId,
            request_id: requestId,
            service: 'api-server',
            operation: `http.${req.method.toLowerCase()}`,
            event: 'SLOW_REQUEST_DETECTED',
            duration_ms: durationMs,
            threshold_ms: slowThresholdMs,
            status_code: res.statusCode,
            endpoint: cleanPath || cleanUrl,
            method: req.method,
            message: `Request exceeded latency threshold (${durationMs}ms >= ${slowThresholdMs}ms)`
          };
          console.warn(`[SLOW_REQUEST_WARN] ${JSON.stringify(slowLog)}`);
        }

        const telemetryEvent: TelemetryLogEvent = {
          timestamp: new Date().toISOString(),
          correlationId: requestId,
          requestId,
          traceId,
          method: req.method,
          url: cleanUrl,
          path: cleanPath,
          statusCode: res.statusCode,
          durationMs,
          estateId: (req as any).estateId || req.body?.estate_id || (req.query?.estate_id as string),
          userId: (req as any).user?.id,
          userRole: (req as any).user?.role || (req as any).user?.app_metadata?.role,
          userAgent: cleanUserAgent,
          ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
          memoryUsageMb: memoryMb,
        };

        if (res.statusCode >= 500) {
          console.error(`[TELEMETRY_ERROR] ${JSON.stringify(telemetryEvent)}`);
        } else if (res.statusCode >= 400) {
          console.warn(`[TELEMETRY_WARN] ${JSON.stringify(telemetryEvent)}`);
        } else {
          console.log(`[TELEMETRY_INFO] ${JSON.stringify(telemetryEvent)}`);
        }
      } catch (logErr) {
        // SILENT FAILSAFE: Logging errors must NEVER affect API response
        console.warn("[TELEMETRY_FAILSAFE] Failed to log telemetry event:", logErr);
      }
    });
  } catch (err) {
    // SILENT FAILSAFE: Middleware initialization error must NEVER block request
    console.warn("[TELEMETRY_FAILSAFE] Observability middleware setup encountered issue:", err);
  }

  // Always proceed to next middleware / route handler
  next();
};
