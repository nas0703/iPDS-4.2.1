-- ==============================================================================
-- iPDS v4.1.0 — Remediate Direct Anon Access & RLS Hardening Blueprint
-- Fixes:
-- 1. Enforces ENABLE & FORCE ROW LEVEL SECURITY across all operational tables.
-- 2. Restricts anonymous (anon) role direct table access on operational data.
-- 3. Ensures 100% tenant-bound (estate_id) RLS policies for authenticated users.
-- ==============================================================================

BEGIN;

-- 1. HARDEN OPERATIONAL TABLES: ENABLE & FORCE ROW LEVEL SECURITY
ALTER TABLE IF EXISTS public.hujan_rekod ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hujan_rekod FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workers FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.work_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.work_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.penggredan_rekod ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penggredan_rekod FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.merumput_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.merumput_progress FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.annual_yield ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.annual_yield FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.block_annual_yields ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.block_annual_yields FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.hantaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hantaran FORCE ROW LEVEL SECURITY;

-- 2. REVOKE DIRECT ANON ACCESS ON OPERATIONAL TABLES
REVOKE ALL ON public.hujan_rekod FROM anon;
REVOKE ALL ON public.workers FROM anon;
REVOKE ALL ON public.work_assignments FROM anon;
REVOKE ALL ON public.penggredan_rekod FROM anon;
REVOKE ALL ON public.merumput_progress FROM anon;
REVOKE ALL ON public.annual_yield FROM anon;
REVOKE ALL ON public.block_annual_yields FROM anon;
REVOKE ALL ON public.hantaran FROM anon;

-- Grant access ONLY to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hujan_rekod TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.penggredan_rekod TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merumput_progress TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_yield TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_annual_yields TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hantaran TO authenticated, service_role;

-- 3. ENSURE TENANT-BOUND RLS POLICIES FOR HUJAN_REKOD
DROP POLICY IF EXISTS "hujan_rekod_tenant_isolation_select" ON public.hujan_rekod;
CREATE POLICY "hujan_rekod_tenant_isolation_select" ON public.hujan_rekod FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

DROP POLICY IF EXISTS "hujan_rekod_tenant_isolation_insert" ON public.hujan_rekod;
CREATE POLICY "hujan_rekod_tenant_isolation_insert" ON public.hujan_rekod FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

-- 4. ENSURE TENANT-BOUND RLS POLICIES FOR WORKERS
DROP POLICY IF EXISTS "workers_tenant_isolation_select" ON public.workers;
CREATE POLICY "workers_tenant_isolation_select" ON public.workers FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

DROP POLICY IF EXISTS "workers_tenant_isolation_insert" ON public.workers;
CREATE POLICY "workers_tenant_isolation_insert" ON public.workers FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

DROP POLICY IF EXISTS "workers_tenant_isolation_delete" ON public.workers;
CREATE POLICY "workers_tenant_isolation_delete" ON public.workers FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

-- 5. ENSURE TENANT-BOUND RLS POLICIES FOR PENGGREDAN_REKOD
DROP POLICY IF EXISTS "penggredan_rekod_tenant_isolation_select" ON public.penggredan_rekod;
CREATE POLICY "penggredan_rekod_tenant_isolation_select" ON public.penggredan_rekod FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

DROP POLICY IF EXISTS "penggredan_rekod_tenant_isolation_insert" ON public.penggredan_rekod;
CREATE POLICY "penggredan_rekod_tenant_isolation_insert" ON public.penggredan_rekod FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

DROP POLICY IF EXISTS "penggredan_rekod_tenant_isolation_delete" ON public.penggredan_rekod;
CREATE POLICY "penggredan_rekod_tenant_isolation_delete" ON public.penggredan_rekod FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

COMMIT;
