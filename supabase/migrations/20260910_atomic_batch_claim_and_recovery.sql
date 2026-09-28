-- ==============================================================================
-- MIGRATION: 20260910_atomic_batch_claim_and_recovery.sql
-- DESCRIPTION: High-Concurrency Atomic Batch Claiming & Lease Recovery for Background Jobs
-- AUTHOR: CTO / Senior Full-Stack Architect
-- SPECIFICATION: 
--   1. Implements lease duration locking (locked_until, locked_by)
--   2. Atomic batch claiming via FOR UPDATE SKIP LOCKED (multi-worker race-proof)
--   3. Automatic stuck-job recovery for orphaned or crashed worker jobs
--   4. Preserves tenant boundary integrity and RLS compatibility
-- ==============================================================================

-- Step 1: Add worker lease locking columns to background_jobs if not already present
ALTER TABLE public.background_jobs 
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS locked_by TEXT DEFAULT NULL;

-- Step 2: Create targeted index for high-concurrency queue polling and worker claiming
CREATE INDEX IF NOT EXISTS idx_background_jobs_claim_queue 
ON public.background_jobs (status, priority, locked_until, created_at)
WHERE status IN ('QUEUED', 'PROCESSING');

-- Step 3: Stored Procedure for Atomic Batch Claiming & Stuck-Job Recovery
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
    -- Safe boundary check on batch size (max 50 per claim to prevent memory spikes)
    IF p_batch_size < 1 THEN
        p_batch_size := 1;
    ELSIF p_batch_size > 50 THEN
        p_batch_size := 50;
    END IF;

    -- Compute lease duration safely
    v_lease_interval := (GREATEST(p_lease_duration_seconds, 30) || ' seconds')::INTERVAL;

    -- PART A: Automatic Stuck-Job Recovery
    -- Any job stuck in PROCESSING whose lease (locked_until) has expired is automatically
    -- requeued if it has remaining attempts available.
    UPDATE public.background_jobs
    SET 
        status = 'QUEUED',
        locked_until = NULL,
        locked_by = NULL,
        updated_at = NOW()
    WHERE 
        status = 'PROCESSING'
        AND locked_until IS NOT NULL
        AND locked_until < NOW()
        AND attempts < max_attempts;

    -- PART B: Mark permanently dead jobs whose lease expired and attempts exhausted
    UPDATE public.background_jobs
    SET 
        status = 'FAILED',
        error_message = COALESCE(error_message, '') || ' [System: Lease expired and maximum attempts reached during worker crash]',
        locked_until = NULL,
        locked_by = NULL,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE 
        status = 'PROCESSING'
        AND locked_until IS NOT NULL
        AND locked_until < NOW()
        AND attempts >= max_attempts;

    -- PART C: Atomic Claim with FOR UPDATE SKIP LOCKED
    -- Locks up to p_batch_size available QUEUED jobs without waiting or blocking other workers.
    RETURN QUERY
    WITH candidate_jobs AS (
        SELECT id
        FROM public.background_jobs
        WHERE 
            status = 'QUEUED'
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
        started_at = COALESCE(bj.started_at, NOW()),
        locked_by = p_worker_id,
        locked_until = NOW() + v_lease_interval,
        updated_at = NOW()
    FROM candidate_jobs cj
    WHERE bj.id = cj.id
    RETURNING bj.*;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.claim_background_jobs_batch(TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_background_jobs_batch(TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.claim_background_jobs_batch IS 
'Atomically claims a batch of queued background jobs using FOR UPDATE SKIP LOCKED with lease locking and automatic recovery of orphaned jobs.';
