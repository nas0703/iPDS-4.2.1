-- ==============================================================================
-- IPDS ENTERPRISE DATABASE SCHEMA & GRANULAR ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Architecture: PostgREST JWT Trust Chain with Dual-Layer Identity (Kiosk + Operator)
-- Estate Isolation: Enforced via auth.jwt() -> app_metadata -> estate_id
-- Granular RBAC:
--   staff, mandur: SELECT, INSERT, UPDATE
--   pf, fc:        SELECT, INSERT, UPDATE, DELETE
--   afc, fs, eqi:  SELECT (and specific INSERT/UPDATE permissions)
-- ==============================================================================

-- 1. HELPER FUNCTIONS FOR POSTGREST JWT CLAIMS EXTRACTION
CREATE OR REPLACE FUNCTION auth.estate_id()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'estate_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'estate_id', '')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.app_role()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'app_role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.kiosk_id()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'kiosk_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'kiosk_id', '')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.operator_id()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'operator_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'operator_id', '')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.session_id()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'session_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'session_id', '')
  );
$$ LANGUAGE sql STABLE;

-- 2. ENSURE estate_id AND AUDIT COLUMNS EXIST ACROSS TRANSACTION TABLES
DO $$
BEGIN
  -- hantaran_hasil
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hantaran_hasil') THEN
    ALTER TABLE hantaran_hasil ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    ALTER TABLE hantaran_hasil ADD COLUMN IF NOT EXISTS recorded_by_kiosk UUID;
    ALTER TABLE hantaran_hasil ADD COLUMN IF NOT EXISTS operator_id TEXT;
    ALTER TABLE hantaran_hasil ADD COLUMN IF NOT EXISTS operator_name TEXT;
    ALTER TABLE hantaran_hasil ADD COLUMN IF NOT EXISTS session_id TEXT;
  END IF;

  -- hantaran_pruning
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hantaran_pruning') THEN
    ALTER TABLE hantaran_pruning ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    ALTER TABLE hantaran_pruning ADD COLUMN IF NOT EXISTS recorded_by_kiosk UUID;
    ALTER TABLE hantaran_pruning ADD COLUMN IF NOT EXISTS operator_id TEXT;
    ALTER TABLE hantaran_pruning ADD COLUMN IF NOT EXISTS operator_name TEXT;
    ALTER TABLE hantaran_pruning ADD COLUMN IF NOT EXISTS session_id TEXT;
  END IF;

  -- merumput_daily_entries & merumput_progress
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'merumput_daily_entries') THEN
    ALTER TABLE merumput_daily_entries ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    ALTER TABLE merumput_daily_entries ADD COLUMN IF NOT EXISTS recorded_by_kiosk UUID;
    ALTER TABLE merumput_daily_entries ADD COLUMN IF NOT EXISTS operator_id TEXT;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'merumput_progress') THEN
    ALTER TABLE merumput_progress ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    ALTER TABLE merumput_progress ADD COLUMN IF NOT EXISTS recorded_by_kiosk UUID;
    ALTER TABLE merumput_progress ADD COLUMN IF NOT EXISTS operator_id TEXT;
  END IF;

  -- fertilizer_daily_entries
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fertilizer_daily_entries') THEN
    ALTER TABLE fertilizer_daily_entries ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
    ALTER TABLE fertilizer_daily_entries ADD COLUMN IF NOT EXISTS recorded_by_kiosk UUID;
    ALTER TABLE fertilizer_daily_entries ADD COLUMN IF NOT EXISTS operator_id TEXT;
  END IF;

  -- fertilizer_master_schedule
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fertilizer_master_schedule') THEN
    ALTER TABLE fertilizer_master_schedule ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- fertilizer_inventory
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fertilizer_inventory') THEN
    ALTER TABLE fertilizer_inventory ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- fertilizer_inventory_transactions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fertilizer_inventory_transactions') THEN
    ALTER TABLE fertilizer_inventory_transactions ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- merumput_inventory
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'merumput_inventory') THEN
    ALTER TABLE merumput_inventory ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- merumput_inventory_transactions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'merumput_inventory_transactions') THEN
    ALTER TABLE merumput_inventory_transactions ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- data_hujan & hujan_rekod
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'data_hujan') THEN
    ALTER TABLE data_hujan ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hujan_rekod') THEN
    ALTER TABLE hujan_rekod ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- data_pekerja & workers
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'data_pekerja') THEN
    ALTER TABLE data_pekerja ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workers') THEN
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- hasil_abw_history
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hasil_abw_history') THEN
    ALTER TABLE hasil_abw_history ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- hasil_bbc_history
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hasil_bbc_history') THEN
    ALTER TABLE hasil_bbc_history ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- hasil_backlog_history
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hasil_backlog_history') THEN
    ALTER TABLE hasil_backlog_history ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- app_settings
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'app_settings') THEN
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;

  -- presentation_decks
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'presentation_decks') THEN
    ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS estate_id TEXT DEFAULT 'FPM_TUNGGAL';
  END IF;
END $$;

-- 3. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE IF EXISTS hantaran_hasil ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hantaran_pruning ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS merumput_daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS merumput_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fertilizer_daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fertilizer_master_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fertilizer_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fertilizer_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS merumput_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS merumput_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS data_hujan ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hujan_rekod ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS data_pekerja ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hasil_abw_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hasil_bbc_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hasil_backlog_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS presentation_decks ENABLE ROW LEVEL SECURITY;

-- 4. DROP LEGACY POLICIES TO PREVENT OR-COLLAPSE
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

-- ==============================================================================
-- 5. GRANULAR POLICIES: HANTARAN HASIL
-- ==============================================================================
CREATE POLICY "hantaran_hasil_select" ON hantaran_hasil
  FOR SELECT TO authenticated
  USING (estate_id = auth.estate_id());

CREATE POLICY "hantaran_hasil_insert" ON hantaran_hasil
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "hantaran_hasil_update" ON hantaran_hasil
  FOR UPDATE TO authenticated
  USING (estate_id = auth.estate_id())
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "hantaran_hasil_delete" ON hantaran_hasil
  FOR DELETE TO authenticated
  USING (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

-- ==============================================================================
-- 6. GRANULAR POLICIES: HANTARAN PRUNING
-- ==============================================================================
CREATE POLICY "hantaran_pruning_select" ON hantaran_pruning
  FOR SELECT TO authenticated
  USING (estate_id = auth.estate_id());

CREATE POLICY "hantaran_pruning_insert" ON hantaran_pruning
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "hantaran_pruning_update" ON hantaran_pruning
  FOR UPDATE TO authenticated
  USING (estate_id = auth.estate_id())
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "hantaran_pruning_delete" ON hantaran_pruning
  FOR DELETE TO authenticated
  USING (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

-- ==============================================================================
-- 7. GRANULAR POLICIES: MERUMPUT (WEEDING)
-- ==============================================================================
CREATE POLICY "merumput_entries_select" ON merumput_daily_entries
  FOR SELECT TO authenticated
  USING (estate_id = auth.estate_id());

CREATE POLICY "merumput_entries_insert" ON merumput_daily_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "merumput_entries_update" ON merumput_daily_entries
  FOR UPDATE TO authenticated
  USING (estate_id = auth.estate_id())
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "merumput_entries_delete" ON merumput_daily_entries
  FOR DELETE TO authenticated
  USING (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

-- ==============================================================================
-- 8. GRANULAR POLICIES: FERTILIZER (DAILY & MASTER)
-- ==============================================================================
CREATE POLICY "fertilizer_entries_select" ON fertilizer_daily_entries
  FOR SELECT TO authenticated
  USING (estate_id = auth.estate_id());

CREATE POLICY "fertilizer_entries_insert" ON fertilizer_daily_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "fertilizer_entries_update" ON fertilizer_daily_entries
  FOR UPDATE TO authenticated
  USING (estate_id = auth.estate_id())
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "fertilizer_entries_delete" ON fertilizer_daily_entries
  FOR DELETE TO authenticated
  USING (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

CREATE POLICY "fertilizer_master_select" ON fertilizer_master_schedule
  FOR SELECT TO authenticated
  USING (estate_id = auth.estate_id());

CREATE POLICY "fertilizer_master_insert" ON fertilizer_master_schedule
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

CREATE POLICY "fertilizer_master_update" ON fertilizer_master_schedule
  FOR UPDATE TO authenticated
  USING (estate_id = auth.estate_id())
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

CREATE POLICY "fertilizer_master_delete" ON fertilizer_master_schedule
  FOR DELETE TO authenticated
  USING (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

-- ==============================================================================
-- 9. GRANULAR POLICIES: INVENTORIES & TRANSACTIONS
-- ==============================================================================
CREATE POLICY "fertilizer_inv_select" ON fertilizer_inventory
  FOR SELECT TO authenticated
  USING (estate_id = auth.estate_id());

CREATE POLICY "fertilizer_inv_insert" ON fertilizer_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "fertilizer_inv_update" ON fertilizer_inventory
  FOR UPDATE TO authenticated
  USING (estate_id = auth.estate_id())
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "fertilizer_inv_delete" ON fertilizer_inventory
  FOR DELETE TO authenticated
  USING (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

CREATE POLICY "fertilizer_tx_select" ON fertilizer_inventory_transactions
  FOR SELECT TO authenticated
  USING (estate_id = auth.estate_id());

CREATE POLICY "fertilizer_tx_insert" ON fertilizer_inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "fertilizer_tx_delete" ON fertilizer_inventory_transactions
  FOR DELETE TO authenticated
  USING (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

CREATE POLICY "merumput_inv_select" ON merumput_inventory
  FOR SELECT TO authenticated
  USING (estate_id = auth.estate_id());

CREATE POLICY "merumput_inv_insert" ON merumput_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "merumput_inv_update" ON merumput_inventory
  FOR UPDATE TO authenticated
  USING (estate_id = auth.estate_id())
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "merumput_inv_delete" ON merumput_inventory
  FOR DELETE TO authenticated
  USING (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

CREATE POLICY "merumput_tx_select" ON merumput_inventory_transactions
  FOR SELECT TO authenticated
  USING (estate_id = auth.estate_id());

CREATE POLICY "merumput_tx_insert" ON merumput_inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs')
  );

CREATE POLICY "merumput_tx_delete" ON merumput_inventory_transactions
  FOR DELETE TO authenticated
  USING (
    estate_id = auth.estate_id()
    AND auth.app_role() IN ('pf', 'fc')
  );

-- ==============================================================================
-- 10. GRANULAR POLICIES: SUPPORT & PRESENTATION TABLES
-- ==============================================================================
CREATE POLICY "data_hujan_select" ON data_hujan FOR SELECT TO authenticated USING (estate_id = auth.estate_id());
CREATE POLICY "data_hujan_insert" ON data_hujan FOR INSERT TO authenticated WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "data_hujan_update" ON data_hujan FOR UPDATE TO authenticated USING (estate_id = auth.estate_id()) WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "data_hujan_delete" ON data_hujan FOR DELETE TO authenticated USING (estate_id = auth.estate_id() AND auth.app_role() IN ('pf', 'fc'));

CREATE POLICY "data_pekerja_select" ON data_pekerja FOR SELECT TO authenticated USING (estate_id = auth.estate_id());
CREATE POLICY "data_pekerja_insert" ON data_pekerja FOR INSERT TO authenticated WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "data_pekerja_update" ON data_pekerja FOR UPDATE TO authenticated USING (estate_id = auth.estate_id()) WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "data_pekerja_delete" ON data_pekerja FOR DELETE TO authenticated USING (estate_id = auth.estate_id() AND auth.app_role() IN ('pf', 'fc'));

CREATE POLICY "hasil_abw_select" ON hasil_abw_history FOR SELECT TO authenticated USING (estate_id = auth.estate_id());
CREATE POLICY "hasil_abw_insert" ON hasil_abw_history FOR INSERT TO authenticated WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "hasil_abw_update" ON hasil_abw_history FOR UPDATE TO authenticated USING (estate_id = auth.estate_id()) WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "hasil_abw_delete" ON hasil_abw_history FOR DELETE TO authenticated USING (estate_id = auth.estate_id() AND auth.app_role() IN ('pf', 'fc'));

CREATE POLICY "hasil_bbc_select" ON hasil_bbc_history FOR SELECT TO authenticated USING (estate_id = auth.estate_id());
CREATE POLICY "hasil_bbc_insert" ON hasil_bbc_history FOR INSERT TO authenticated WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "hasil_bbc_update" ON hasil_bbc_history FOR UPDATE TO authenticated USING (estate_id = auth.estate_id()) WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "hasil_bbc_delete" ON hasil_bbc_history FOR DELETE TO authenticated USING (estate_id = auth.estate_id() AND auth.app_role() IN ('pf', 'fc'));

CREATE POLICY "hasil_backlog_select" ON hasil_backlog_history FOR SELECT TO authenticated USING (estate_id = auth.estate_id());
CREATE POLICY "hasil_backlog_insert" ON hasil_backlog_history FOR INSERT TO authenticated WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "hasil_backlog_update" ON hasil_backlog_history FOR UPDATE TO authenticated USING (estate_id = auth.estate_id()) WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs'));
CREATE POLICY "hasil_backlog_delete" ON hasil_backlog_history FOR DELETE TO authenticated USING (estate_id = auth.estate_id() AND auth.app_role() IN ('pf', 'fc'));

CREATE POLICY "app_settings_select" ON app_settings FOR SELECT TO authenticated USING (estate_id = auth.estate_id());
CREATE POLICY "app_settings_insert" ON app_settings FOR INSERT TO authenticated WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('pf', 'fc'));
CREATE POLICY "app_settings_update" ON app_settings FOR UPDATE TO authenticated USING (estate_id = auth.estate_id()) WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('pf', 'fc'));
CREATE POLICY "app_settings_delete" ON app_settings FOR DELETE TO authenticated USING (estate_id = auth.estate_id() AND auth.app_role() IN ('pf', 'fc'));

CREATE POLICY "presentation_decks_select" ON presentation_decks FOR SELECT TO authenticated USING (estate_id = auth.estate_id());
CREATE POLICY "presentation_decks_insert" ON presentation_decks FOR INSERT TO authenticated WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi'));
CREATE POLICY "presentation_decks_update" ON presentation_decks FOR UPDATE TO authenticated USING (estate_id = auth.estate_id()) WITH CHECK (estate_id = auth.estate_id() AND auth.app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi'));
CREATE POLICY "presentation_decks_delete" ON presentation_decks FOR DELETE TO authenticated USING (estate_id = auth.estate_id() AND auth.app_role() IN ('pf', 'fc'));
