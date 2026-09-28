-- ==============================================================================
-- IPDS Ver 3.7 — Phase 2: Supabase Row Level Security (RLS) Enterprise Enforcement
-- Date: 2026-09-05
-- Standard: FPMSB Enterprise Multi-Tenant & RBAC Policy Blueprint
-- Target: All 8 Core Operational Tables + Organizational Topology Master Tables
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS FOR POSTGREST JWT CLAIMS EXTRACTION & ROLE RECOGNITION
-- ------------------------------------------------------------------------------

-- Extract estate_id claim from JWT app_metadata or payload
CREATE OR REPLACE FUNCTION public.auth_estate_id()
RETURNS text AS $$
DECLARE
  v_claims jsonb;
  v_estate text;
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN 'FPM_TUNGGAL'; -- Fallback for unauthenticated or local dev
  END IF;

  v_claims := auth.jwt();
  v_estate := COALESCE(
    v_claims -> 'app_metadata' ->> 'estate_id',
    v_claims ->> 'estate_id',
    v_claims -> 'user_metadata' ->> 'estate_id'
  );

  IF v_estate IS NULL OR TRIM(v_estate) = '' THEN
    RETURN 'FPM_TUNGGAL';
  END IF;

  RETURN TRIM(v_estate);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Extract app_role claim from JWT
CREATE OR REPLACE FUNCTION public.auth_app_role()
RETURNS text AS $$
DECLARE
  v_claims jsonb;
  v_role text;
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN 'staff'; -- Fallback
  END IF;

  v_claims := auth.jwt();
  v_role := COALESCE(
    v_claims -> 'app_metadata' ->> 'app_role',
    v_claims -> 'app_metadata' ->> 'role',
    v_claims ->> 'role'
  );

  IF v_role IS NULL OR TRIM(v_role) = '' THEN
    RETURN 'staff';
  END IF;

  RETURN LOWER(TRIM(v_role));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Check if current user is Super Admin or Executive HQ
CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN public.auth_app_role() IN ('super_admin', 'executive_hq', 'fc', 'zonal_controller', 'regional_controller');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Check if role has cross-estate read permissions
CREATE OR REPLACE FUNCTION public.auth_is_cross_estate_role()
RETURNS boolean AS $$
BEGIN
  RETURN public.auth_app_role() IN ('super_admin', 'executive_hq', 'fc', 'zonal_controller', 'regional_controller', 'operation_controller');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;


-- ------------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ------------------------------------------------------------------------------

-- Master Topology Tables
ALTER TABLE public.org_macro_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_op_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_estates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_divisions ENABLE ROW LEVEL SECURITY;

-- 8 Core Operational Tables
ALTER TABLE public.hasil_abw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hantaran_resit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pruning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kualiti_bts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observability_logs ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 3. DROP PREVIOUS POLICIES TO PREVENT CONFLICTS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 4. MASTER TOPOLOGY READ-ONLY POLICIES FOR AUTHENTICATED USERS
-- ------------------------------------------------------------------------------
CREATE POLICY "org_macro_zones_select_policy" ON public.org_macro_zones FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "org_regions_select_policy" ON public.org_regions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "org_op_zones_select_policy" ON public.org_op_zones FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "org_estates_select_policy" ON public.org_estates FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "org_divisions_select_policy" ON public.org_divisions FOR SELECT TO authenticated USING (TRUE);


-- ------------------------------------------------------------------------------
-- 5. GRANULAR POLICIES FOR THE 8 CORE OPERATIONAL TABLES
-- ------------------------------------------------------------------------------

-- TABLE 1: hasil_abw
CREATE POLICY "hasil_abw_select_policy" ON public.hasil_abw FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "hasil_abw_insert_policy" ON public.hasil_abw FOR INSERT TO authenticated
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'estate_manager', 'super_admin')
  );

CREATE POLICY "hasil_abw_update_policy" ON public.hasil_abw FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'estate_manager', 'super_admin')
  );

CREATE POLICY "hasil_abw_delete_policy" ON public.hasil_abw FOR DELETE TO authenticated
  USING (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('pf', 'fc', 'estate_manager', 'super_admin')
  );


-- TABLE 2: hantaran_resit
CREATE POLICY "hantaran_resit_select_policy" ON public.hantaran_resit FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "hantaran_resit_insert_policy" ON public.hantaran_resit FOR INSERT TO authenticated
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'weighbridge_clerk', 'estate_manager', 'super_admin')
  );

CREATE POLICY "hantaran_resit_update_policy" ON public.hantaran_resit FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'weighbridge_clerk', 'estate_manager', 'super_admin')
  );

CREATE POLICY "hantaran_resit_delete_policy" ON public.hantaran_resit FOR DELETE TO authenticated
  USING (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('pf', 'fc', 'estate_manager', 'super_admin')
  );


-- TABLE 3: pruning_progress
CREATE POLICY "pruning_progress_select_policy" ON public.pruning_progress FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "pruning_progress_insert_policy" ON public.pruning_progress FOR INSERT TO authenticated
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'field_mandore', 'estate_manager', 'super_admin')
  );

CREATE POLICY "pruning_progress_update_policy" ON public.pruning_progress FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'field_mandore', 'estate_manager', 'super_admin')
  );

CREATE POLICY "pruning_progress_delete_policy" ON public.pruning_progress FOR DELETE TO authenticated
  USING (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('pf', 'fc', 'estate_manager', 'super_admin')
  );


-- TABLE 4: merumput_progress
CREATE POLICY "merumput_progress_select_policy" ON public.merumput_progress FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "merumput_progress_insert_policy" ON public.merumput_progress FOR INSERT TO authenticated
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'field_mandore', 'estate_manager', 'super_admin')
  );

CREATE POLICY "merumput_progress_update_policy" ON public.merumput_progress FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'field_mandore', 'estate_manager', 'super_admin')
  );

CREATE POLICY "merumput_progress_delete_policy" ON public.merumput_progress FOR DELETE TO authenticated
  USING (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('pf', 'fc', 'estate_manager', 'super_admin')
  );


-- TABLE 5: merumput_inventory
CREATE POLICY "merumput_inventory_select_policy" ON public.merumput_inventory FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "merumput_inventory_insert_policy" ON public.merumput_inventory FOR INSERT TO authenticated
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'pf', 'fc', 'estate_manager', 'super_admin')
  );

CREATE POLICY "merumput_inventory_update_policy" ON public.merumput_inventory FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'pf', 'fc', 'estate_manager', 'super_admin')
  );

CREATE POLICY "merumput_inventory_delete_policy" ON public.merumput_inventory FOR DELETE TO authenticated
  USING (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('pf', 'fc', 'estate_manager', 'super_admin')
  );


-- TABLE 6: workers
CREATE POLICY "workers_select_policy" ON public.workers FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "workers_insert_policy" ON public.workers FOR INSERT TO authenticated
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'estate_manager', 'super_admin')
  );

CREATE POLICY "workers_update_policy" ON public.workers FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'estate_manager', 'super_admin')
  );

CREATE POLICY "workers_delete_policy" ON public.workers FOR DELETE TO authenticated
  USING (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('pf', 'fc', 'estate_manager', 'super_admin')
  );


-- TABLE 7: kualiti_bts
CREATE POLICY "kualiti_bts_select_policy" ON public.kualiti_bts FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "kualiti_bts_insert_policy" ON public.kualiti_bts FOR INSERT TO authenticated
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'estate_manager', 'super_admin')
  );

CREATE POLICY "kualiti_bts_update_policy" ON public.kualiti_bts FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'estate_manager', 'super_admin')
  );

CREATE POLICY "kualiti_bts_delete_policy" ON public.kualiti_bts FOR DELETE TO authenticated
  USING (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
    AND public.auth_app_role() IN ('pf', 'fc', 'estate_manager', 'super_admin')
  );


-- TABLE 8: observability_logs
CREATE POLICY "observability_logs_select_policy" ON public.observability_logs FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY "observability_logs_insert_policy" ON public.observability_logs FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role()
  );
