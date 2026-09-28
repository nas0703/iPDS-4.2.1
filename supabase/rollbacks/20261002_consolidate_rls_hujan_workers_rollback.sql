-- ==============================================================================
-- IPDS ENTERPRISE DATABASE ARCHITECTURE: ROLLBACK RLS POLICY CONSOLIDATION
-- Rollback Migration: 20261002_consolidate_rls_hujan_workers_rollback.sql
-- Description:
--   Rolls back migration 20261002_consolidate_rls_hujan_workers.sql and restores
--   the pre-existing policy set on public.hujan_rekod and public.workers.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. ROLLBACK POLICIES ON public.hujan_rekod
-- ==============================================================================

DROP POLICY IF EXISTS "hujan_rekod_select_policy" ON public.hujan_rekod;
DROP POLICY IF EXISTS "hujan_rekod_insert_policy" ON public.hujan_rekod;
DROP POLICY IF EXISTS "hujan_rekod_update_policy" ON public.hujan_rekod;
DROP POLICY IF EXISTS "hujan_rekod_delete_policy" ON public.hujan_rekod;
DROP POLICY IF EXISTS "hujan_rekod_tenant_isolation_select" ON public.hujan_rekod;
DROP POLICY IF EXISTS "hujan_rekod_tenant_isolation_insert" ON public.hujan_rekod;

-- Restore 20260910 policies
CREATE POLICY "hujan_rekod_tenant_isolation_select" ON public.hujan_rekod
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "hujan_rekod_tenant_isolation_insert" ON public.hujan_rekod
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

-- Restore 20260911 policies
CREATE POLICY "hujan_rekod_select_policy" ON public.hujan_rekod
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'));

CREATE POLICY "hujan_rekod_insert_policy" ON public.hujan_rekod
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = public.auth_estate_id()
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')
  );

CREATE POLICY "hujan_rekod_update_policy" ON public.hujan_rekod
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'))
  WITH CHECK (
    estate_id = public.auth_estate_id()
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')
  );

CREATE POLICY "hujan_rekod_delete_policy" ON public.hujan_rekod
  FOR DELETE TO authenticated
  USING (
    estate_id = public.auth_estate_id()
    AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin')
  );

-- ==============================================================================
-- 2. ROLLBACK POLICIES ON public.workers
-- ==============================================================================

DROP POLICY IF EXISTS "workers_select_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_insert_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_update_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_delete_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_tenant_isolation_select" ON public.workers;
DROP POLICY IF EXISTS "workers_tenant_isolation_insert" ON public.workers;
DROP POLICY IF EXISTS "workers_tenant_isolation_delete" ON public.workers;

-- Restore 20260910 policies
CREATE POLICY "workers_tenant_isolation_select" ON public.workers
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "workers_tenant_isolation_insert" ON public.workers
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "workers_tenant_isolation_delete" ON public.workers
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

-- Restore 20260911 policies
CREATE POLICY "workers_select_policy" ON public.workers
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'));

CREATE POLICY "workers_insert_policy" ON public.workers
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = public.auth_estate_id()
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')
  );

CREATE POLICY "workers_update_policy" ON public.workers
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'))
  WITH CHECK (
    estate_id = public.auth_estate_id()
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')
  );

CREATE POLICY "workers_delete_policy" ON public.workers
  FOR DELETE TO authenticated
  USING (
    estate_id = public.auth_estate_id()
    AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin')
  );

COMMIT;
