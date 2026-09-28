-- ==============================================================================
-- MIGRATION: 20260929_rate_limiter_durable_store.sql
-- DESCRIPTION: Durable Serverless-Aware Rate Limiting Store with Atomic Sliding Window Upsert
-- AUTHOR: CTO / Senior Full-Stack Architect
-- SPECIFICATION:
--   1. Lightweight rate_limit_buckets table persisting cross-instance rate limits
--   2. Index on (tier, window_start) for high-performance sliding window lookups & cleanup
--   3. Atomic increment RPC function increment_rate_limit_bucket avoiding race conditions
--   4. RLS enabled + forced with service_role privileges (internal security store)
--   5. Automatic TTL expiration on read + cleanup function for maintenance
-- ==============================================================================

-- 1. Create table for durable rate-limit tracking across serverless instances
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    bucket_key TEXT PRIMARY KEY,
    tier TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index on (tier, window_start) for rapid window lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_tier_window
ON public.rate_limit_buckets (tier, window_start);

-- 3. Row Level Security: Lock down to service_role and authenticated
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.rate_limit_buckets FROM PUBLIC, anon;
GRANT ALL ON public.rate_limit_buckets TO service_role, authenticated;

DROP POLICY IF EXISTS "service_role_rate_limit_buckets" ON public.rate_limit_buckets;
CREATE POLICY "service_role_rate_limit_buckets"
ON public.rate_limit_buckets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Atomic Increment and Sliding-Window Evaluation Stored Procedure
CREATE OR REPLACE FUNCTION public.increment_rate_limit_bucket(
    p_bucket_key TEXT,
    p_tier TEXT,
    p_limit INT,
    p_window_ms BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_window_interval INTERVAL := (p_window_ms || ' milliseconds')::INTERVAL;
    v_new_count INT;
    v_window_start TIMESTAMPTZ;
    v_reset_epoch INT;
    v_retry_after INT;
    v_allowed BOOLEAN;
BEGIN
    INSERT INTO public.rate_limit_buckets (bucket_key, tier, count, window_start, updated_at)
    VALUES (p_bucket_key, p_tier, 1, v_now, v_now)
    ON CONFLICT (bucket_key) DO UPDATE
    SET
        count = CASE
            WHEN rate_limit_buckets.window_start + v_window_interval <= EXCLUDED.window_start THEN 1
            ELSE rate_limit_buckets.count + 1
        END,
        window_start = CASE
            WHEN rate_limit_buckets.window_start + v_window_interval <= EXCLUDED.window_start THEN EXCLUDED.window_start
            ELSE rate_limit_buckets.window_start
        END,
        tier = EXCLUDED.tier,
        updated_at = EXCLUDED.updated_at
    RETURNING rate_limit_buckets.count, rate_limit_buckets.window_start
    INTO v_new_count, v_window_start;

    v_reset_epoch := CEIL(EXTRACT(EPOCH FROM (v_window_start + v_window_interval)))::INT;
    v_retry_after := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_start + v_window_interval - v_now))))::INT;
    v_allowed := (v_new_count <= p_limit);

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'current_count', v_new_count,
        'remaining', GREATEST(0, p_limit - v_new_count),
        'reset_time_epoch_sec', v_reset_epoch,
        'retry_after_sec', v_retry_after
    );
END;
$$;

REVOKE ALL ON FUNCTION public.increment_rate_limit_bucket FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit_bucket TO service_role;

-- 5. Periodic cleanup function for stale buckets older than given interval
CREATE OR REPLACE FUNCTION public.cleanup_stale_rate_limit_buckets(
    p_older_than INTERVAL DEFAULT INTERVAL '1 hour'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM public.rate_limit_buckets
    WHERE updated_at < (NOW() - p_older_than);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_rate_limit_buckets TO service_role;

COMMENT ON TABLE public.rate_limit_buckets IS 'Persists cross-instance rate-limit window counters for serverless execution.';

