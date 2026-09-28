-- ==============================================================================
-- MIGRATION: 20260926_p1_device_merge_tracking.sql
-- PURPOSE: P1 — soft-merge tracking for duplicate device registrations +
--          server-only archive of the complete original rows.
--
-- SCOPE:
--   * Additive only. Affects public.registered_devices and creates
--     public.registered_devices_archive.
--   * No data mutation. No INSERT/UPDATE/DELETE. No rows are deleted or changed.
--   * Idempotent (ADD COLUMN IF NOT EXISTS / CREATE ... IF NOT EXISTS).
--
-- SAFETY:
--   * Duplicate rows are NEVER deleted; they are marked merged_into=<canonical>.
--   * credential_hash is preserved verbatim; this migration never reads, copies
--     or exposes credential material.
--   * tenant isolation: merges are performed only within the same estate_id by
--     the merge script, never here.
--   * The archive table mirrors the registered_devices lockdown:
--     ENABLE + FORCE RLS, service_role only, no PUBLIC/anon/authenticated.
-- ==============================================================================

BEGIN;

-- 1. Soft-merge tracking columns (no status CHECK change).
ALTER TABLE public.registered_devices
    ADD COLUMN IF NOT EXISTS merged_into TEXT,
    ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS merge_operation_id TEXT;

-- Fast lookup of merged duplicates / canonical lineage.
CREATE INDEX IF NOT EXISTS idx_registered_devices_merged_into
    ON public.registered_devices (merged_into)
    WHERE merged_into IS NOT NULL;

-- 2. Server-only archive of the complete original rows (never discard data).
CREATE TABLE IF NOT EXISTS public.registered_devices_archive (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merge_operation_id TEXT NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_role TEXT NOT NULL CHECK (row_role IN ('CANONICAL_BEFORE', 'DUPLICATE')),
    canonical_device_id TEXT,
    device_id TEXT NOT NULL,
    row_data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registered_devices_archive_op
    ON public.registered_devices_archive (merge_operation_id);
CREATE INDEX IF NOT EXISTS idx_registered_devices_archive_device
    ON public.registered_devices_archive (device_id);

ALTER TABLE public.registered_devices_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_devices_archive FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.registered_devices_archive FROM PUBLIC;
REVOKE ALL ON public.registered_devices_archive FROM anon;
REVOKE ALL ON public.registered_devices_archive FROM authenticated;
GRANT SELECT, INSERT ON public.registered_devices_archive TO service_role;

DROP POLICY IF EXISTS registered_devices_archive_service_role_policy ON public.registered_devices_archive;
CREATE POLICY registered_devices_archive_service_role_policy ON public.registered_devices_archive
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.registered_devices_archive IS
'P1 device-merge archive. Server-managed (service_role only). Preserves the complete original registered_devices row (including credential_hash) for reversibility; never exposed to clients.';

COMMIT;
