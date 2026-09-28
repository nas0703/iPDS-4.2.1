-- ==============================================================================
-- MIGRATION: 20260916_p0_04_harden_background_job_security_definer.sql
-- PURPOSE: P0-04 remediation — restrict the GLOBAL background-job claim routine
--          to the privileged service_role only, and harden its SECURITY DEFINER
--          search_path.
--
-- CONTEXT:
--   public.claim_background_jobs_batch(TEXT, INT, INT) is intentionally GLOBAL:
--   the Vercel cron worker claims jobs across all estates through the
--   server-side service-role client. It must therefore NEVER be executable by
--   PUBLIC, anon, or authenticated callers (e.g. direct PostgREST
--   /rest/v1/rpc/claim_background_jobs_batch access).
--
--   History:
--     * 20260910_atomic_batch_claim_and_recovery.sql granted EXECUTE to
--       service_role AND authenticated, and did NOT revoke the PostgreSQL
--       default PUBLIC grant.
--     * 20260911_durable_job_queue_hardening.sql revoked PUBLIC but still
--       granted authenticated.
--
--   This corrective migration establishes the final intended privilege state
--   idempotently. It only changes privileges and search_path; the queue logic
--   (lease recovery, exhausted-job failure, clamping, FOR UPDATE SKIP LOCKED,
--   worker_id semantics and returned structure) is byte-for-byte preserved.
-- ==============================================================================

-- 1. Recreate the function with a hardened, empty search_path.
--    Every non-pg_catalog object reference is fully schema-qualified
--    (public.background_jobs). CREATE OR REPLACE preserves existing ACLs, so
--    step 2 explicitly sets the intended grants/revokes afterwards.
CREATE OR REPLACE FUNCTION public.claim_background_jobs_batch(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 10,
    p_lease_duration_seconds INT DEFAULT 300
)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- 2. Idempotent privilege hardening: ONLY service_role may execute.
--    This explicitly overrides the default PUBLIC grant and the historical
--    authenticated grants, and is safe to re-apply.
REVOKE ALL ON FUNCTION public.claim_background_jobs_batch(TEXT, INT, INT)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_background_jobs_batch(TEXT, INT, INT)
    TO service_role;

COMMENT ON FUNCTION public.claim_background_jobs_batch IS
'Atomically claims a batch of background jobs with FOR UPDATE SKIP LOCKED, available_at scheduling, and lease_version fencing tokens. GLOBAL by design: executable by service_role only (P0-04).';
