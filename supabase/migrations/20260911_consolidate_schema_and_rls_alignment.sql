-- ==============================================================================
-- IPDS ENTERPRISE DATABASE ARCHITECTURE: STAGE C1-SAFE CONSOLIDATION
-- Migration: 20260911_consolidate_schema_and_rls_alignment.sql
-- Status: EXECUTING (Explicitly authorized by user)
-- Purpose: 
--   1. Ensures auth helper functions exist in auth schema (public.auth_estate_id(), public.auth_app_role())
--   2. Reconciles code-vs-RLS naming conflicts between canonical tables & RLS policies
--   3. Enforces multi-tenant estate_id & Row Level Security across all live tables
--   4. Revokes anonymous direct table access, granting only to authenticated & service_role
--   5. Establishes zero-downtime backward-compatible views for legacy callers
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 0. POSTGREST JWT CLAIMS EXTRACTION HELPERS (public schema)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.auth_estate_id()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'estate_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'estate_id', '')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.auth_app_role()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'app_role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.auth_is_cross_estate_role()
RETURNS boolean AS $$
  SELECT public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin');
$$ LANGUAGE sql STABLE;

-- ==============================================================================
-- 1. ADDITIVE TENANT ISOLATION (estate_id) ENFORCEMENT
-- Retains DEFAULT 'FPM_TUNGGAL', NULL-safe, 100% backward compatible
-- ==============================================================================

-- 1.1 block_annual_yields (Add estate_id to resolve isolation gap)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'block_annual_yields') THEN
    ALTER TABLE public.block_annual_yields ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    CREATE INDEX IF NOT EXISTS idx_block_annual_yields_estate ON public.block_annual_yields (estate_id, year, block);
  END IF;
END $$;

-- 1.2 penggredan_rekod (Ensure estate_id exists alongside ladang)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'penggredan_rekod') THEN
    ALTER TABLE public.penggredan_rekod ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    -- Backfill estate_id from ladang where appropriate
    UPDATE public.penggredan_rekod 
    SET estate_id = CASE 
      WHEN ladang ILIKE '%adela%' THEN 'FPM_ADELA'
      WHEN ladang ILIKE '%kledang%' THEN 'FPM_KLEDANG'
      WHEN ladang ILIKE '%sening%' THEN 'FPM_SENING'
      WHEN ladang ILIKE '%tunggal%' THEN 'FPM_TUNGGAL'
      ELSE 'FPM_TUNGGAL'
    END
    WHERE estate_id IS NULL OR estate_id = 'FPM_TUNGGAL';
    CREATE INDEX IF NOT EXISTS idx_penggredan_rekod_estate ON public.penggredan_rekod (estate_id, created_at DESC);
  END IF;
END $$;

-- 1.3 merumput_progress (Ensure audit and estate_id exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'merumput_progress') THEN
    ALTER TABLE public.merumput_progress ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    CREATE INDEX IF NOT EXISTS idx_merumput_progress_estate ON public.merumput_progress (estate_id, blok, pusingan);
  END IF;
END $$;

-- 1.4 workers (Ensure audit and estate_id exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workers') THEN
    ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    CREATE INDEX IF NOT EXISTS idx_workers_estate ON public.workers (estate_id, worker_no);
  END IF;
END $$;

-- 1.5 hujan_rekod (Ensure audit and estate_id exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hujan_rekod') THEN
    ALTER TABLE public.hujan_rekod ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    CREATE INDEX IF NOT EXISTS idx_hujan_rekod_estate ON public.hujan_rekod (estate_id, tahun, bulan);
  END IF;
END $$;

-- ==============================================================================
-- 2. ENABLE & FORCE ROW LEVEL SECURITY (RLS) ON CANONICAL TABLES
-- ==============================================================================

ALTER TABLE IF EXISTS public.merumput_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.merumput_progress FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.hujan_rekod ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hujan_rekod FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workers FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.penggredan_rekod ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.penggredan_rekod FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.block_annual_yields ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.block_annual_yields FORCE ROW LEVEL SECURITY;

-- If data_hujan table exists as legacy stub, protect it as well
ALTER TABLE IF EXISTS public.data_hujan ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. GRANULAR MULTI-TENANT RLS POLICIES FOR AUTHENTICATED USERS
-- ==============================================================================

-- 3.1 POLICIES: merumput_progress
DROP POLICY IF EXISTS "merumput_progress_select_policy" ON public.merumput_progress;
CREATE POLICY "merumput_progress_select_policy" ON public.merumput_progress
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "merumput_progress_insert_policy" ON public.merumput_progress;
CREATE POLICY "merumput_progress_insert_policy" ON public.merumput_progress
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "merumput_progress_update_policy" ON public.merumput_progress;
CREATE POLICY "merumput_progress_update_policy" ON public.merumput_progress
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'))
  WITH CHECK (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "merumput_progress_delete_policy" ON public.merumput_progress;
CREATE POLICY "merumput_progress_delete_policy" ON public.merumput_progress
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- 3.2 POLICIES: hujan_rekod
DROP POLICY IF EXISTS "hujan_rekod_select_policy" ON public.hujan_rekod;
CREATE POLICY "hujan_rekod_select_policy" ON public.hujan_rekod
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "hujan_rekod_insert_policy" ON public.hujan_rekod;
CREATE POLICY "hujan_rekod_insert_policy" ON public.hujan_rekod
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "hujan_rekod_update_policy" ON public.hujan_rekod;
CREATE POLICY "hujan_rekod_update_policy" ON public.hujan_rekod
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'))
  WITH CHECK (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "hujan_rekod_delete_policy" ON public.hujan_rekod;
CREATE POLICY "hujan_rekod_delete_policy" ON public.hujan_rekod
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- 3.3 POLICIES: workers
DROP POLICY IF EXISTS "workers_select_policy" ON public.workers;
CREATE POLICY "workers_select_policy" ON public.workers
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "workers_insert_policy" ON public.workers;
CREATE POLICY "workers_insert_policy" ON public.workers
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "workers_update_policy" ON public.workers;
CREATE POLICY "workers_update_policy" ON public.workers
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'))
  WITH CHECK (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "workers_delete_policy" ON public.workers;
CREATE POLICY "workers_delete_policy" ON public.workers
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- 3.4 POLICIES: penggredan_rekod
DROP POLICY IF EXISTS "penggredan_rekod_select_policy" ON public.penggredan_rekod;
CREATE POLICY "penggredan_rekod_select_policy" ON public.penggredan_rekod
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "penggredan_rekod_insert_policy" ON public.penggredan_rekod;
CREATE POLICY "penggredan_rekod_insert_policy" ON public.penggredan_rekod
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "penggredan_rekod_update_policy" ON public.penggredan_rekod;
CREATE POLICY "penggredan_rekod_update_policy" ON public.penggredan_rekod
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'))
  WITH CHECK (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "penggredan_rekod_delete_policy" ON public.penggredan_rekod;
CREATE POLICY "penggredan_rekod_delete_policy" ON public.penggredan_rekod
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- 3.5 POLICIES: block_annual_yields
DROP POLICY IF EXISTS "block_annual_yields_select_policy" ON public.block_annual_yields;
CREATE POLICY "block_annual_yields_select_policy" ON public.block_annual_yields
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "block_annual_yields_write_policy" ON public.block_annual_yields;
CREATE POLICY "block_annual_yields_write_policy" ON public.block_annual_yields
  FOR ALL TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'))
  WITH CHECK (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- ==============================================================================
-- 4. BACKWARD COMPATIBILITY: NON-DESTRUCTIVE ALIAS VIEWS
-- Bridges legacy table references to active canonical tables
-- ==============================================================================

-- 4.1 merumput_daily_entries -> points to merumput_progress
CREATE OR REPLACE VIEW public.merumput_daily_entries AS
  SELECT 
    id,
    blok,
    luas,
    pusingan,
    jenis,
    tarikh_mula,
    tarikh_siap,
    hek_siap,
    workers_count,
    created_at,
    updated_at,
    COALESCE(estate_id, 'FPM_TUNGGAL') AS estate_id
  FROM public.merumput_progress;

-- 4.2 data_pekerja -> points to workers
CREATE OR REPLACE VIEW public.data_pekerja AS
  SELECT 
    id,
    worker_no,
    name,
    role,
    created_at,
    updated_at,
    is_active,
    negara_asal,
    kumpulan,
    COALESCE(estate_id, 'FPM_TUNGGAL') AS estate_id
  FROM public.workers;

-- 4.3 annual_yield -> points to block_annual_yields
CREATE OR REPLACE VIEW public.annual_yield AS
  SELECT 
    id,
    year,
    block,
    yield,
    created_at,
    COALESCE(estate_id, 'FPM_TUNGGAL') AS estate_id
  FROM public.block_annual_yields;

-- Revoke direct anonymous access on operational tables
REVOKE ALL ON public.merumput_progress FROM anon;
REVOKE ALL ON public.hujan_rekod FROM anon;
REVOKE ALL ON public.workers FROM anon;
REVOKE ALL ON public.penggredan_rekod FROM anon;
REVOKE ALL ON public.block_annual_yields FROM anon;
REVOKE ALL ON public.merumput_daily_entries FROM anon;
REVOKE ALL ON public.data_pekerja FROM anon;
REVOKE ALL ON public.annual_yield FROM anon;

-- Ensure service_role and authenticated roles have permission on canonical tables and views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merumput_progress TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hujan_rekod TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.penggredan_rekod TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.block_annual_yields TO authenticated, service_role;

GRANT SELECT ON public.merumput_daily_entries TO authenticated, service_role;
GRANT SELECT ON public.data_pekerja TO authenticated, service_role;
GRANT SELECT ON public.annual_yield TO authenticated, service_role;

COMMIT;
