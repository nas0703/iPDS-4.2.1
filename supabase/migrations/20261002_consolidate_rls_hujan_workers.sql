-- ==============================================================================
-- IPDS ENTERPRISE DATABASE ARCHITECTURE: RLS POLICY CONSOLIDATION
-- Migration: 20261002_consolidate_rls_hujan_workers.sql
-- Description:
--   Consolidates overlapping RLS policies on public.hujan_rekod and public.workers
--   caused by stale un-dropped policies from 20260910.
--   Enforces single permissive policy per command with standard helper
--   public.auth_is_cross_estate_role().
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. CONSOLIDATE POLICIES ON public.hujan_rekod
-- ==============================================================================

-- Drop stale policies from 20260910
DROP POLICY IF EXISTS "hujan_rekod_tenant_isolation_select" ON public.hujan_rekod;
DROP POLICY IF EXISTS "hujan_rekod_tenant_isolation_insert" ON public.hujan_rekod;

-- Drop existing canonical policies from 20260911 to recreate cleanly
DROP POLICY IF EXISTS "hujan_rekod_select_policy" ON public.hujan_rekod;
DROP POLICY IF EXISTS "hujan_rekod_insert_policy" ON public.hujan_rekod;
DROP POLICY IF EXISTS "hujan_rekod_update_policy" ON public.hujan_rekod;
DROP POLICY IF EXISTS "hujan_rekod_delete_policy" ON public.hujan_rekod;

-- Recreate canonical single policies per command for hujan_rekod
CREATE POLICY "hujan_rekod_select_policy" ON public.hujan_rekod
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "hujan_rekod_insert_policy" ON public.hujan_rekod
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = public.auth_estate_id()
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')
  );

CREATE POLICY "hujan_rekod_update_policy" ON public.hujan_rekod
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id())
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
-- 2. CONSOLIDATE POLICIES ON public.workers
-- ==============================================================================

-- Drop stale policies from 20260910
DROP POLICY IF EXISTS "workers_tenant_isolation_select" ON public.workers;
DROP POLICY IF EXISTS "workers_tenant_isolation_insert" ON public.workers;
DROP POLICY IF EXISTS "workers_tenant_isolation_delete" ON public.workers;

-- Drop existing canonical policies from 20260911 to recreate cleanly
DROP POLICY IF EXISTS "workers_select_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_insert_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_update_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_delete_policy" ON public.workers;

-- Recreate canonical single policies per command for workers
CREATE POLICY "workers_select_policy" ON public.workers
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "workers_insert_policy" ON public.workers
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = public.auth_estate_id()
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')
  );

CREATE POLICY "workers_update_policy" ON public.workers
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id())
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

-- ==============================================================================
-- 3. INTEGRITY CHECK: ENFORCE EXACTLY ONE PERMISSIVE POLICY PER COMMAND
-- ==============================================================================

DO $$
DECLARE
  v_rec RECORD;
  v_count integer;
  v_tables text[] := ARRAY['hujan_rekod', 'workers', 'merumput_progress'];
  v_tbl text;
  v_cmd text;
  v_commands text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    FOREACH v_cmd IN ARRAY v_commands LOOP
      SELECT count(*) INTO v_count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_tbl
        AND permissive = 'PERMISSIVE'
        AND (
          cmd = v_cmd
          OR cmd = 'ALL'
        );

      IF v_count > 1 THEN
        RAISE EXCEPTION 'DUPLICATE_PERMISSIVE_POLICY_DETECTED: Table public.% has % permissive policies for command %',
          v_tbl, v_count, v_cmd;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
