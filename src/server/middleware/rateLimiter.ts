/**
 * iPDS v3.8 — Enterprise Serverless-Aware Rate Limiting Middleware
 * 
 * DESIGN PRINCIPLES:
 * 1. Sliding window rate limiter with auto-expiring sliding timestamps.
 * 2. Multi-tier sensitivity limits (Auth, AI/RAG, OCR, Transcription, Admin, General).
 * 3. Graceful degradation: Fail-open if rate limiter encounters internal error so plantation operations are never stalled.
 * 4. RFC 6585 compliant headers: Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
 * 5. Memory safe for long-running containers and serverless warm containers (automatic periodic TTL cleanup).
 */

import { Request, Response, NextFunction } from 'express';
import {
  isDurableRateLimiterConfigured,
  incrementAndCheck,
  RateLimitResult
} from '../services/durableRateLimiter.service.js';

export interface RateLimitOptions {
  windowMs: number;       // Window duration in milliseconds
  maxRequests: number;    // Maximum allowed requests within the window
  tierName: string;       // Descriptive name for logging/metrics
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  message?: string;
  store?: RateLimiterStore;
}

interface ClientBucket {
  timestamps: number[];
  lastSeen: number;
}

export interface RateLimiterHitResult {
  currentCount: number;
  oldestTimestamp: number;
  allowed: boolean;
  remaining: number;
  resetTimeEpochSec: number;
  retryAfterSec: number;
  source: 'durable' | 'memory';
}

export class RateLimiterStore {
  private buckets: Map<string, ClientBucket> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every 2 minutes to prevent memory accumulation in warm instances
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.pruneStaleBuckets(10 * 60 * 1000); // 10 minute inactivity cutoff
      }, 2 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  public pruneStaleBuckets(maxAgeMs: number): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastSeen < cutoff) {
        this.buckets.delete(key);
      }
    }
  }

  public hit(key: string, windowMs: number): { currentCount: number; oldestTimestamp: number } {
    const now = Date.now();
    const windowStart = now - windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [], lastSeen: now };
      this.buckets.set(key, bucket);
    }

    bucket.lastSeen = now;
    // Filter timestamps inside current sliding window
    bucket.timestamps = bucket.timestamps.filter(ts => ts > windowStart);
    bucket.timestamps.push(now);

    const oldestTimestamp = bucket.timestamps[0] || now;
    return {
      currentCount: bucket.timestamps.length,
      oldestTimestamp
    };
  }

  public async hitAsync(
    key: string,
    windowMs: number,
    maxRequests: number,
    tier: string
  ): Promise<RateLimiterHitResult> {
    if (isDurableRateLimiterConfigured()) {
      try {
        const durable = await incrementAndCheck(key, tier, maxRequests, windowMs);
        if (durable) {
          return {
            currentCount: durable.currentCount,
            oldestTimestamp: Date.now() - (windowMs - durable.retryAfterSec * 1000),
            allowed: durable.allowed,
            remaining: durable.remaining,
            resetTimeEpochSec: durable.resetTimeEpochSec,
            retryAfterSec: durable.retryAfterSec,
            source: 'durable'
          };
        }
        console.warn(`[RateLimiterStore:${tier}] Durable store returned null for key=${key}, falling back to memory store`);
      } catch (err) {
        console.warn(`[RateLimiterStore:${tier}] Durable store error for key=${key}, falling back to memory store:`, err);
      }
    }

    // In-memory fallback
    const { currentCount, oldestTimestamp } = this.hit(key, windowMs);
    const remaining = Math.max(0, maxRequests - currentCount);
    const resetTimeMs = oldestTimestamp + windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((resetTimeMs - Date.now()) / 1000));
    const resetTimeEpochSec = Math.ceil(resetTimeMs / 1000);

    return {
      currentCount,
      oldestTimestamp,
      allowed: currentCount <= maxRequests,
      remaining,
      resetTimeEpochSec,
      retryAfterSec,
      source: 'memory'
    };
  }

  public reset(key: string): void {
    this.buckets.delete(key);
  }
}

const globalStore = new RateLimiterStore();

/**
 * Standard client identifier extractor (IP + optional User ID)
 */
export function getClientKey(req: Request, tier: string): string {
  // If Express trust proxy is enabled and set, req.ip reflects the client IP.
  // Otherwise check x-forwarded-for before falling back to socket remoteAddress.
  let ip = req.ip;
  if (!ip && req.headers['x-forwarded-for']) {
    const forwarded = req.headers['x-forwarded-for'];
    ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim() 
      : Array.isArray(forwarded)
        ? (forwarded[0] ? String(forwarded[0]).trim() : '')
        : '';
  }
  if (!ip) {
    ip = req.socket?.remoteAddress || '127.0.0.1';
  }

  // Normalize IPv6 mapped IPv4 address (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  const clientId = (req.headers['x-client-id'] as string) || (req.headers['x-session-id'] as string) || '';
  const userId = (req as any).user?.app_metadata?.operator_id || (req as any).user?.sub || clientId || '';
  return `${tier}:${ip}${userId ? `:${userId}` : ''}`;
}

/**
 * Creates an Express rate-limiting middleware instance
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    tierName,
    keyGenerator = (req) => getClientKey(req, tierName),
    skip = (req) => {
      // Allow staging load test bypass when explicit test header is provided
      if (req.headers['x-staging-load-test'] === 'ipds-benchmark-1500' || process.env.STAGING_LOAD_TEST === 'true') {
        return true;
      }
      return false;
    },
    message = 'Kadar permintaan melebihi had yang dibenarkan. Sila cuba sebentar lagi.',
    store = globalStore
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (skip(req)) {
        return next();
      }

      const key = keyGenerator(req);

      // Fast synchronous execution path when durable store is unconfigured
      if (!isDurableRateLimiterConfigured()) {
        const { currentCount, oldestTimestamp } = store.hit(key, windowMs);

        const remaining = Math.max(0, maxRequests - currentCount);
        const resetTimeMs = oldestTimestamp + windowMs;
        const retryAfterSec = Math.max(1, Math.ceil((resetTimeMs - Date.now()) / 1000));
        const resetTimeEpochSec = Math.ceil(resetTimeMs / 1000);

        // RFC 6585 & IETF Draft Standard RateLimit Headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTimeEpochSec);
        res.setHeader('RateLimit-Limit', maxRequests);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', retryAfterSec);

        if (currentCount > maxRequests) {
          res.setHeader('Retry-After', retryAfterSec);
          return res.status(429).json({
            success: false,
            error: message,
            code: 'RATE_LIMITED',
            retryAfter: retryAfterSec,
            tier: tierName
          });
        }

        return next();
      }

      // Durable cross-instance execution path
      return store
        .hitAsync(key, windowMs, maxRequests, tierName)
        .then((result) => {
          // RFC 6585 & IETF Draft Standard RateLimit Headers
          res.setHeader('X-RateLimit-Limit', maxRequests);
          res.setHeader('X-RateLimit-Remaining', result.remaining);
          res.setHeader('X-RateLimit-Reset', result.resetTimeEpochSec);
          res.setHeader('RateLimit-Limit', maxRequests);
          res.setHeader('RateLimit-Remaining', result.remaining);
          res.setHeader('RateLimit-Reset', result.retryAfterSec);

          if (!result.allowed) {
            res.setHeader('Retry-After', result.retryAfterSec);
            return res.status(429).json({
              success: false,
              error: message,
              code: 'RATE_LIMITED',
              retryAfter: result.retryAfterSec,
              tier: tierName
            });
          }

          next();
        })
        .catch((err) => {
          // Fail-open: Never block legitimate operational plantation traffic due to rate limiter bug
          console.warn(`[RateLimiter:${tierName}] Non-fatal rate limiting error:`, err);
          next();
        });
    } catch (err) {
      // Fail-open: Never block legitimate operational plantation traffic due to rate limiter bug
      console.warn(`[RateLimiter:${tierName}] Non-fatal rate limiting error:`, err);
      next();
    }
  };
}

// -----------------------------------------------------------------------------
// PRE-CONFIGURED TIERED RATE LIMITERS
// -----------------------------------------------------------------------------

/**
 * 1. AUTH LIMITER: Highly sensitive PIN authentication (10 attempts per minute)
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  tierName: 'auth_pin',
  message: 'Terlalu banyak percubaan log masuk. Sila cuba lagi dalam beberapa saat.'
});

/**
 * 2. AI RAG & CHAT LIMITER: Gemini conversational assistant (30 queries per minute per user/IP)
 */
export const aiChatRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  tierName: 'ai_chat',
  message: 'Had capaian AI RAG tercapai. Sila tunggu sebentar sebelum menghantar soalan seterusnya.'
});

/**
 * 3. MULTIMODAL & OCR LIMITER: Heavy image & audio document processing (15 requests per minute)
 */
export const aiMultimodalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  tierName: 'ai_multimodal',
  message: 'Had pemprosesan OCR/Transkripsi telah dicapai. Sila cuba lagi sebentar lagi.'
});

/**
 * 4. HEAVY BENCHMARK / STRESS TEST LIMITER: Expensive model evals (5 requests per minute)
 */
export const benchmarkRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  tierName: 'benchmark_eval',
  message: 'Penilaian benchmark sedang diproses. Had permintaan intensif dicapai.'
});

/**
 * 5. ADMIN SENSITIVE OPERATIONS LIMITER: Logo upload, system configurations (30 requests per minute)
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  tierName: 'admin_sensitive',
  message: 'Had pengurusan konfigurasi dicapai. Sila cuba sebentar lagi.'
});

/**
 * 6. GENERAL API RATE LIMITER: General operational endpoints (150 requests per minute)
 */
export const generalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 150,
  tierName: 'api_general',
  message: 'Had trafik API dicapai. Sila cuba sebentar lagi.'
});
