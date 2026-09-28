-- ==============================================================================
-- MIGRATION: 20260924_p0_16c_device_estate_access.sql
-- PURPOSE: P0-16C.2 — explicit device -> estate authorization.
--
-- A single device may be authorized for ONE OR MULTIPLE estates independently.
-- Global registered_devices.status = 'APPROVED' alone is NOT sufficient for
-- login authorization (enforced in P0-16C.3); this table is the explicit grant
-- layer. Missing row = NOT authorized (never treated as ACTIVE).
--
-- SAFETY:
--   * Forward-only. Creates ONLY public.device_estate_access.
--   * Additive + idempotent (CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF
--     EXISTS). No INSERT/UPDATE/DELETE, no backfill, no DROP TABLE.
--   * Does NOT modify registered_devices rows or approval state.
--   * Mirrors registered_devices security: ENABLE + FORCE RLS, service_role-only
--     ACL/policy, no PUBLIC/anon/authenticated access.
--
-- NOTE ON FOREIGN KEYS: no FK is added. public.registered_devices.estate_id is
-- intentionally FK-free, and public.org_estates does not contain every estate
-- alias used by the application (e.g. WILAYAH_JB). Estate validity is enforced
-- server-side against the canonical ESTATES_REGISTRY. Adding an FK here would
-- invent a relationship the existing schema does not rely on.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.device_estate_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    estate_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'REVOKED')),
    granted_by TEXT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_by TEXT,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uq_device_estate_access_device_estate UNIQUE (device_id, estate_id)
);

CREATE INDEX IF NOT EXISTS idx_device_estate_access_device
    ON public.device_estate_access (device_id);
CREATE INDEX IF NOT EXISTS idx_device_estate_access_estate
    ON public.device_estate_access (estate_id);
CREATE INDEX IF NOT EXISTS idx_device_estate_access_device_status
    ON public.device_estate_access (device_id, status);

ALTER TABLE public.device_estate_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_estate_access FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.device_estate_access FROM PUBLIC;
REVOKE ALL ON public.device_estate_access FROM anon;
REVOKE ALL ON public.device_estate_access FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_estate_access TO service_role;

DROP POLICY IF EXISTS device_estate_access_service_role_policy ON public.device_estate_access;
CREATE POLICY device_estate_access_service_role_policy ON public.device_estate_access
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
