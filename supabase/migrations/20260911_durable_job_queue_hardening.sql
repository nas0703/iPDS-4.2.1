-- ====================================================================
-- iPDS VER 4.1.0 — MIGRATION: DURABLE SERVERLESS JOB QUEUE HARDENING
-- File: supabase/migrations/20260911_durable_job_queue_hardening.sql
-- 
-- Objectives:
-- 1. Add `available_at` (TIMESTAMPTZ) for durable retry scheduling & backoff.
-- 2. Add `lease_version` (BIGINT) for optimistic concurrency & fencing tokens.
-- 3. Upgrade `claim_background_jobs_batch` to enforce `available_at <= NOW()`
--    and increment `lease_version` atomically under `FOR UPDATE SKIP LOCKED`.
-- 4. Provide zero-downtime, fully backward-compatible schema hardening.
-- ====================================================================

-- Step 1: Add durable scheduling and fencing columns
ALTER TABLE public.background_jobs 
ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.background_jobs 
ADD COLUMN IF NOT EXISTS lease_version BIGINT NOT NULL DEFAULT 0;

-- Step 2: Optimised indexes for scheduling, queue polling & fencing
CREATE INDEX IF NOT EXISTS idx_background_jobs_queue_sched
ON public.background_jobs (status, priority, available_at, locked_until)
WHERE status IN ('QUEUED', 'PROCESSING');

CREATE INDEX IF NOT EXISTS idx_background_jobs_fencing
ON public.background_jobs (id, locked_by, lease_version);

-- Step 3: Upgrade Stored Procedure: claim_background_jobs_batch
-- Enforces:
-- 1. Recovery of expired leases (Part A & Part B).
-- 2. `available_at <= NOW()` constraint for delayed/backoff retries.
-- 3. Atomic `lease_version = lease_version + 1` incrementation.
-- 4. `FOR UPDATE SKIP LOCKED` for concurrent multi-worker partitioning.

CREATE OR REPLACE FUNCTION public.claim_background_jobs_batch(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 10,
    p_lease_duration_seconds INT DEFAULT 300
)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lease_interval INTERVAL;
BEGIN
    -- Validate input bounds
    IF p_batch_size IS NULL OR p_batch_size <= 0 THEN
        p_batch_size := 10;
    ELSIF p_batch_size > 50 THEN
        p_batch_size := 50;
    END IF;

    IF p_lease_duration_seconds IS NULL OR p_lease_duration_seconds < 10 THEN
        p_lease_duration_seconds := 300;
    ELSIF p_lease_duration_seconds > 3600 THEN
        p_lease_duration_seconds := 3600;
    END IF;

    v_lease_interval := (p_lease_duration_seconds || ' seconds')::INTERVAL;

    -- ==================================================================
    -- PART A: RECOVER STUCK / EXPIRED LEASE JOBS (Attempts < max_attempts)
    -- Reset to QUEUED, bump lease_version to invalidate stale worker, set available_at = NOW()
    -- ==================================================================
    UPDATE public.background_jobs
    SET 
        status = 'QUEUED',
        locked_by = NULL,
        locked_until = NULL,
        available_at = NOW(),
        lease_version = lease_version + 1,
        updated_at = NOW()
    WHERE 
        status = 'PROCESSING'
        AND locked_until IS NOT NULL
        AND locked_until < NOW()
        AND attempts < max_attempts;

    -- ==================================================================
    -- PART B: MARK EXHAUSTED LEASE JOBS AS FAILED (Attempts >= max_attempts)
    -- ==================================================================
    UPDATE public.background_jobs
    SET 
        status = 'FAILED',
        locked_by = NULL,
        locked_until = NULL,
        error_message = COALESCE(error_message || ' | ', '') || 'Job execution timed out and exceeded max retry attempts.',
        updated_at = NOW()
    WHERE 
        status = 'PROCESSING'
        AND locked_until IS NOT NULL
        AND locked_until < NOW()
        AND attempts >= max_attempts;

    -- ==================================================================
    -- PART C: ATOMIC BATCH CLAIM WITH LEASE FENCING & FOR UPDATE SKIP LOCKED
    -- ==================================================================
    RETURN QUERY
    WITH candidate_jobs AS (
        SELECT id
        FROM public.background_jobs
        WHERE 
            status = 'QUEUED'
            AND available_at <= NOW()
            AND (locked_until IS NULL OR locked_until < NOW())
            AND attempts < max_attempts
        ORDER BY 
            CASE priority 
                WHEN 'HIGH' THEN 1 
                WHEN 'DEFAULT' THEN 2 
                WHEN 'LOW' THEN 3 
                ELSE 2 
            END ASC,
            created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.background_jobs AS bj
    SET 
        status = 'PROCESSING',
        attempts = bj.attempts + 1,
        lease_version = bj.lease_version + 1,
        started_at = COALESCE(bj.started_at, NOW()),
        locked_by = p_worker_id,
        locked_until = NOW() + v_lease_interval,
        updated_at = NOW()
    FROM candidate_jobs cj
    WHERE bj.id = cj.id
    RETURNING bj.*;
END;
$$;

-- Secure execute permissions
REVOKE ALL ON FUNCTION public.claim_background_jobs_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_background_jobs_batch(TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_background_jobs_batch(TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.claim_background_jobs_batch IS 
'Atomically claims a batch of background jobs with FOR UPDATE SKIP LOCKED, available_at scheduling, and lease_version fencing tokens.';
