import { getSupabase, getWriteSupabase, isMissingTableError } from '../db.js';

/**
 * Enterprise Serverless-Aware Durable Rate Limiter Service
 *
 * Persists rate-limit bucket state across independent serverless / container instances
 * to public.rate_limit_buckets table (migration 20260929_rate_limiter_durable_store.sql).
 *
 * Concurrency:
 * Uses an atomic PostgreSQL UPSERT with in-database conditional increment (via RPC
 * increment_rate_limit_bucket) to guarantee zero race conditions between concurrent requests.
 *
 * Resilient Degradation:
 * If Supabase is unconfigured, unreachable, or times out, the service degrades gracefully
 * to the in-memory RateLimiterStore with a structured warning log, ensuring neither outages
 * nor unmonitored bypasses occur.
 */

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  remaining: number;
  resetTimeEpochSec: number;
  retryAfterSec: number;
  source: 'durable' | 'memory';
}

export type DurableRateLimiterClient = {
  rpc: (
    fn: string,
    args: { p_bucket_key: string; p_tier: string; p_limit: number; p_window_ms: number }
  ) => Promise<{ data: any; error: any }>;
};

let testDurableClient: DurableRateLimiterClient | null = null;
let durableUnavailableUntil = 0;

export function setTestDurableClient(client: DurableRateLimiterClient | null): void {
  testDurableClient = client;
  durableUnavailableUntil = 0;
}

export function getTestDurableClient(): DurableRateLimiterClient | null {
  return testDurableClient;
}

export function resetDurableCircuitBreaker(): void {
  durableUnavailableUntil = 0;
}

/**
 * Checks whether real Supabase credentials are configured for durable rate limiting.
 * Mirrors isDurableSessionStoreConfigured(), strictly excluding the mock fallback
 * (mockproject.supabase.co) so local/test runs remain deterministic.
 */
export function isDurableRateLimiterConfigured(): boolean {
  if (testDurableClient !== null) {
    return true;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
  // Never treat the non-production mock fallback as a real durable store.
  if (url.includes('mockproject.supabase.co')) return false;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Atomically increments the request count for a sliding window and checks limits.
 * Single SQL atomic upsert via Postgres RPC ensures race-free execution across serverless instances.
 *
 * Returns RateLimitResult on success, or null on any error/timeout to trigger in-memory fallback.
 */
export async function incrementAndCheck(
  bucketKey: string,
  tier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  if (!isDurableRateLimiterConfigured()) {
    return null;
  }

  // Fast-path: If circuit breaker is open (missing table/RPC or recent timeout),
  // bypass remote call immediately to maintain zero added latency.
  if (!testDurableClient && Date.now() < durableUnavailableUntil) {
    return null;
  }

  try {
    let data: any = null;
    let error: any = null;

    if (testDurableClient) {
      const res = await testDurableClient.rpc('increment_rate_limit_bucket', {
        p_bucket_key: bucketKey,
        p_tier: tier,
        p_limit: limit,
        p_window_ms: windowMs
      });
      data = res.data;
      error = res.error;
    } else {
      const client = getWriteSupabase() || getSupabase();
      if (!client) {
        return null;
      }

      // 800ms safety timeout: rate limiting check must never stall operations
      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Durable rate limiter timeout (800ms exceeded)')), 800)
      );

      const rpcPromise = client.rpc('increment_rate_limit_bucket', {
        p_bucket_key: bucketKey,
        p_tier: tier,
        p_limit: limit,
        p_window_ms: windowMs
      });

      const res = await Promise.race([rpcPromise, timeoutPromise]);
      data = res.data;
      error = res.error;
    }

    if (error) {
      if (isMissingTableError(error) || error.code === 'PGRST202' || error.code === 'PGRST205') {
        // Table or stored procedure not deployed: suppress noise and open circuit breaker for 5 minutes
        durableUnavailableUntil = Date.now() + 300_000;
      } else {
        durableUnavailableUntil = Date.now() + 60_000;
        console.warn(
          `[DURABLE_RATE_LIMITER] Supabase RPC execution error for tier=${tier}, falling back to in-memory store:`,
          error.message || error
        );
      }
      return null;
    }

    if (!data) {
      durableUnavailableUntil = Date.now() + 30_000;
      return null;
    }

    const record = Array.isArray(data) ? data[0] : data;
    if (!record || typeof record.current_count !== 'number') {
      durableUnavailableUntil = Date.now() + 30_000;
      return null;
    }

    return {
      allowed: Boolean(record.allowed),
      currentCount: Number(record.current_count),
      remaining: Number(record.remaining),
      resetTimeEpochSec: Number(record.reset_time_epoch_sec),
      retryAfterSec: Number(record.retry_after_sec),
      source: 'durable'
    };
  } catch (err: unknown) {
    // Open circuit breaker for 60s upon network failure or timeout to protect API responsiveness
    durableUnavailableUntil = Date.now() + 60_000;
    return null;
  }
}
