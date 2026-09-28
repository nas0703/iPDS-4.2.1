-- ==============================================================================
-- MIGRATION: 20260921_p0_16_registered_devices_acl_reconciliation.sql
-- PURPOSE: P0-16 corrective reconciliation — remove the legacy broad
--          registered_devices_all_access policy and re-assert the intended
--          service_role-only access model for public.registered_devices.
--
-- CONTEXT (source <-> runtime reconciliation):
--   The runtime database was found in a state that does not match the
--   repository's P0-16 design:
--     * RLS enabled, but FORCE RLS disabled;
--     * anon + authenticated held table privileges (SELECT);
--     * a legacy policy registered_devices_all_access with roles
--       {anon, authenticated}, command ALL, USING (true), WITH CHECK (true).
--   The forward P0-16 migration (20260918) revoked anon/authenticated and
--   recreated its own service-role policy, but it never dropped the legacy
--   policy by name, and its hardening effects were not present at runtime.
--
-- SAFETY:
--   * FORWARD-ONLY. Does not modify 20260918 / 20260919 / 20260920.
--   * NON-DESTRUCTIVE. No DELETE / UPDATE / TRUNCATE / DROP TABLE / INSERT.
--     Device rows, status, approval state, timestamps and requester metadata
--     are never touched. Only policies, privileges and RLS flags change.
--   * IDEMPOTENT and safe to re-run (DROP POLICY IF EXISTS + re-assert).
-- ==============================================================================

BEGIN;

-- 1. Remove the known legacy broad policy (roles anon+authenticated, ALL,
--    USING true, WITH CHECK true). Idempotent.
DROP POLICY IF EXISTS registered_devices_all_access ON public.registered_devices;

-- 2. Re-assert RLS enforcement so RLS cannot be bypassed by the table owner.
ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_devices FORCE ROW LEVEL SECURITY;

-- 3. Revoke every table privilege from PUBLIC / anon / authenticated.
REVOKE ALL ON public.registered_devices FROM PUBLIC;
REVOKE ALL ON public.registered_devices FROM anon;
REVOKE ALL ON public.registered_devices FROM authenticated;

-- 4. Grant only the intended DML privileges to the privileged server role.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registered_devices TO service_role;

-- 5. Recreate the single intended service_role-only policy (idempotent).
DROP POLICY IF EXISTS registered_devices_service_role_policy ON public.registered_devices;
CREATE POLICY registered_devices_service_role_policy ON public.registered_devices
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
