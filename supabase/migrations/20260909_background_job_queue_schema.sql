-- ==============================================================================
-- iPDS v4.1.0 — PHASE 8 BACKGROUND JOB QUEUE & ASYNCHRONOUS ENGINE SCHEMA
-- Migration: 20260909_background_job_queue_schema.sql
-- Target: Supabase Postgres Persistent Queue with 100% RLS Tenant Isolation
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    estate_id TEXT NOT NULL REFERENCES public.org_estates(estate_id) ON DELETE RESTRICT,
    created_by_user_id TEXT NOT NULL,
    created_by_operator_id TEXT NOT NULL,
    created_by_role TEXT NOT NULL,
    idempotency_key TEXT,
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    priority TEXT NOT NULL DEFAULT 'DEFAULT' CHECK (priority IN ('HIGH', 'DEFAULT', 'LOW')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    failed_at TIMESTAMPTZ DEFAULT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compound Indexes for high performance worker polling & tenant isolation
CREATE INDEX IF NOT EXISTS idx_background_jobs_polling ON public.background_jobs (status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_background_jobs_tenant ON public.background_jobs (estate_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_background_jobs_idempotency ON public.background_jobs (estate_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs FORCE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - Tenant Isolated
CREATE POLICY background_jobs_select_policy ON public.background_jobs
    FOR SELECT TO authenticated
    USING (
        auth_is_super_admin() OR
        auth_is_cross_estate_role() OR
        estate_id = auth_estate_id()
    );

-- RLS Policy: INSERT - Tenant Bound
CREATE POLICY background_jobs_insert_policy ON public.background_jobs
    FOR INSERT TO authenticated
    WITH CHECK (
        auth_is_super_admin() OR
        auth_is_cross_estate_role() OR
        estate_id = auth_estate_id()
    );

-- RLS Policy: UPDATE - Worker & Tenant Bound
CREATE POLICY background_jobs_update_policy ON public.background_jobs
    FOR UPDATE TO authenticated
    USING (
        auth_is_super_admin() OR
        auth_is_cross_estate_role() OR
        estate_id = auth_estate_id()
    )
    WITH CHECK (
        auth_is_super_admin() OR
        auth_is_cross_estate_role() OR
        estate_id = auth_estate_id()
    );

-- RLS Policy: DELETE - Restrict to Super Admin & High Tier Managers
CREATE POLICY background_jobs_delete_policy ON public.background_jobs
    FOR DELETE TO authenticated
    USING (
        auth_is_super_admin() OR
        auth_app_role() IN ('pf', 'fc')
    );
