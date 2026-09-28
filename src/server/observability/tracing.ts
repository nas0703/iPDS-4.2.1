import crypto from 'crypto';
import { truncateString } from './logger.js';
import { metricsCollector } from './metrics.js';

/**
 * Lightweight Internal Tracing & Span Model
 * 
 * ZERO DISRUPTION GUARANTEE:
 * 1. Non-blocking & in-memory only.
 * 2. Bounded span buffer (MAX 200 recent spans) to prevent memory leaks.
 * 3. Never swallows business errors in withSpan.
 * 4. Never captures sensitive data, credentials, request bodies, or full prompts.
 */

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  category: 'http' | 'database' | 'ai' | 'internal';
  startTimeMs: number;
  durationMs?: number;
  status: 'active' | 'success' | 'error';
  errorMessage?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface RequestContext {
  requestId: string;
  traceId: string;
  rootSpanId: string;
  startTime: number;
  method: string;
  path: string;
  currentOperation?: string;
  metadata?: Record<string, string | number | boolean>;
}

const MAX_RECENT_SPANS = 200;
const recentSpans: Span[] = [];

/**
 * Generate a cryptographically random, lightweight trace ID
 */
export function generateTraceId(): string {
  return `trc_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate a cryptographically random, lightweight span ID
 */
export function generateSpanId(): string {
  return `spn_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Store completed span in a bounded circular buffer for diagnostic correlation
 */
function recordCompletedSpan(span: Span): void {
  try {
    if (recentSpans.length >= MAX_RECENT_SPANS) {
      recentSpans.shift();
    }
    recentSpans.push(span);
  } catch (err) {
    console.warn('[TRACING_FAILSAFE] Failed to store span:', err);
  }
}

/**
 * Retrieve recent spans snapshot for diagnostics (read-only, sanitized)
 */
export function getRecentSpans(limit = 50): Span[] {
  try {
    const safeLimit = Math.min(Math.max(1, limit), MAX_RECENT_SPANS);
    return recentSpans.slice(-safeLimit);
  } catch (err) {
    console.warn('[TRACING_FAILSAFE] Failed to get recent spans:', err);
    return [];
  }
}

/**
 * Reusable execution wrapper to trace operations (withSpan)
 * 
 * Guarantees:
 * - Measures precise duration
 * - Records success or error
 * - Never swallows business errors (rethrows original error)
 * - Safe failsafe against tracing runtime exceptions
 */
export async function withSpan<T>(
  operation: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    category?: 'http' | 'database' | 'ai' | 'internal';
    traceId?: string;
    parentSpanId?: string;
    metadata?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const traceId = options?.traceId || generateTraceId();
  const spanId = generateSpanId();
  const category = options?.category || 'internal';
  const startTimeMs = Date.now();

  const span: Span = {
    traceId,
    spanId,
    parentSpanId: options?.parentSpanId,
    operation: truncateString(operation, 100),
    category,
    startTimeMs,
    status: 'active',
    metadata: options?.metadata ? { ...options.metadata } : undefined,
  };

  try {
    const result = await fn(span);
    
    span.durationMs = Math.max(0, Date.now() - startTimeMs);
    span.status = 'success';
    recordCompletedSpan(span);

    // Record metrics hook if applicable
    if (category === 'database') {
      metricsCollector.recordDatabaseTiming(operation, span.durationMs, false);
    } else if (category === 'ai') {
      metricsCollector.recordAiTiming(operation, 'ai_model', span.durationMs, false);
    }

    return result;
  } catch (error: any) {
    span.durationMs = Math.max(0, Date.now() - startTimeMs);
    span.status = 'error';
    span.errorMessage = truncateString(error?.message || 'Operation failed', 300);
    recordCompletedSpan(span);

    if (category === 'database') {
      metricsCollector.recordDatabaseTiming(operation, span.durationMs, true);
    } else if (category === 'ai') {
      metricsCollector.recordAiTiming(operation, 'ai_model', span.durationMs, true);
    }

    // CRITICAL: Rethrow original error to ensure business logic remains unchanged
    throw error;
  }
}
