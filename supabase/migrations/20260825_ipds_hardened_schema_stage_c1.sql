-- ============================================================================
-- IPDS Ver. 3.7 — Stage C1 (Revised): Database Schema Hardening Migration
-- Date: 2026-08-25
-- Description: Non-destructive schema hardening, multi-estate column additions,
--              safe data backfills (no permanent default 'FPM_TUNGGAL'), 
--              non-cascading foreign keys (ON DELETE RESTRICT), composite 
--              performance indexes, and multi-layer identity audit infrastructure.
--
-- REVISION HIGHLIGHTS:
-- 1. NO PERMANENT DEFAULT 'FPM_TUNGGAL': Column estate_id is set to NOT NULL, but
--    DEFAULT 'FPM_TUNGGAL' is dropped after backfilling so future inserts must 
--    supply estate_id explicitly from authenticated context.
-- 2. NO CASCADE DELETES: Foreign keys on operational history use ON DELETE RESTRICT
--    so deleting worker/inventory records never silently deletes historical logs.
-- 3. SAFE COMPOSITE INDEXES INSTEAD OF RISKY UNIQUE CONSTRAINTS: Avoids migration
--    failures caused by historical duplicates in legacy tables.
-- 4. MULTI-LAYER AUDIT IDENTITY: Trigger function extracts email, operator_id, 
--    kiosk_id, session_id, and sub from JWT claims with fallback to current_user.
-- 5. RLS STATUS: Does NOT enable final RLS. Does NOT delete tables or data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MULTI-LAYER AUDIT IDENTITY TRIGGER FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_and_user()
RETURNS TRIGGER AS $$
DECLARE
  v_jwt jsonb;
  v_user_identity text;
BEGIN
   NEW.updated_at = NOW();
   
   -- Extract identity from authenticated JWT claims if available
   IF auth.jwt() IS NOT NULL THEN
     v_jwt := auth.jwt();
     v_user_identity := COALESCE(
       v_jwt ->> 'email',
       v_jwt -> 'app_metadata' ->> 'operator_id',
       v_jwt -> 'app_metadata' ->> 'kiosk_id',
       v_jwt -> 'user_metadata' ->> 'operator_id',
       v_jwt ->> 'sub'
     );
   END IF;
   
   -- Fallback to system current_user
   IF v_user_identity IS NULL OR v_user_identity = '' THEN
     v_user_identity := current_user;
   END IF;
   
   NEW.updated_by := v_user_identity;
   
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ----------------------------------------------------------------------------
-- 2. CANONICAL TABLE: merumput_progress
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merumput_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blok TEXT NOT NULL,
  luas DECIMAL DEFAULT 0,
  pusingan INTEGER NOT NULL DEFAULT 1,
  jenis TEXT NOT NULL,
  tarikh_mula DATE NOT NULL,
  tarikh_siap DATE,
  hek_siap DECIMAL DEFAULT 0,
  workers_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE merumput_progress 
  ADD COLUMN IF NOT EXISTS estate_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Backfill NULL estate_id safely
UPDATE merumput_progress SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;

-- Enforce NOT NULL and DROP DEFAULT (no permanent 'FPM_TUNGGAL' default)
ALTER TABLE merumput_progress ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE merumput_progress ALTER COLUMN estate_id DROP DEFAULT;

-- Non-unique composite performance index
CREATE INDEX IF NOT EXISTS idx_merumput_progress_estate ON merumput_progress (estate_id, blok, pusingan);

-- Audit Trigger
DROP TRIGGER IF EXISTS trg_merumput_progress_audit ON merumput_progress;
CREATE TRIGGER trg_merumput_progress_audit
  BEFORE UPDATE ON merumput_progress
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();


-- ----------------------------------------------------------------------------
-- 3. CANONICAL TABLE: hujan_rekod
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hujan_rekod (
  bulan VARCHAR(20) PRIMARY KEY,
  "2021" NUMERIC DEFAULT 0,
  "2022" NUMERIC DEFAULT 0,
  "2023" NUMERIC DEFAULT 0,
  "2024" NUMERIC DEFAULT 0,
  "2025" NUMERIC DEFAULT 0,
  "2026" NUMERIC DEFAULT 0,
  "2027" NUMERIC DEFAULT 0,
  "2028" NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hujan_rekod 
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS estate_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

UPDATE hujan_rekod SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;

ALTER TABLE hujan_rekod ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE hujan_rekod ALTER COLUMN estate_id DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_hujan_rekod_estate ON hujan_rekod (estate_id, bulan);

DROP TRIGGER IF EXISTS trg_hujan_rekod_audit ON hujan_rekod;
CREATE TRIGGER trg_hujan_rekod_audit
  BEFORE UPDATE ON hujan_rekod
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();


-- ----------------------------------------------------------------------------
-- 4. CANONICAL TABLE: workers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_no VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  negara_asal VARCHAR(255) DEFAULT 'Malaysia',
  kumpulan VARCHAR(255) DEFAULT 'Kerja Am dan Lain-lain',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workers 
  ADD COLUMN IF NOT EXISTS estate_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

UPDATE workers SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;

ALTER TABLE workers ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE workers ALTER COLUMN estate_id DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_workers_estate_active ON workers (estate_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workers_estate_worker_no ON workers (estate_id, worker_no);

DROP TRIGGER IF EXISTS trg_workers_audit ON workers;
CREATE TRIGGER trg_workers_audit
  BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();


-- ----------------------------------------------------------------------------
-- 5. CHILD TABLE: attendance_records (RESTRICT Foreign Key)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE attendance_records 
  ADD COLUMN IF NOT EXISTS estate_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

UPDATE attendance_records SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;

ALTER TABLE attendance_records ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE attendance_records ALTER COLUMN estate_id DROP DEFAULT;

-- Use ON DELETE RESTRICT to protect operational attendance logs
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_worker_id_fkey;
ALTER TABLE attendance_records 
  ADD CONSTRAINT attendance_records_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_attendance_estate_date ON attendance_records (estate_id, date DESC);

DROP TRIGGER IF EXISTS trg_attendance_records_audit ON attendance_records;
CREATE TRIGGER trg_attendance_records_audit
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();


-- ----------------------------------------------------------------------------
-- 6. CHILD TABLE: work_assignments (RESTRICT Foreign Key)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  date DATE NOT NULL,
  work_type VARCHAR(255) NOT NULL,
  blok VARCHAR(255) NOT NULL,
  peringkat VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_assignments 
  ADD COLUMN IF NOT EXISTS estate_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

UPDATE work_assignments SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;

ALTER TABLE work_assignments ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE work_assignments ALTER COLUMN estate_id DROP DEFAULT;

-- Use ON DELETE RESTRICT to protect task assignment history
ALTER TABLE work_assignments DROP CONSTRAINT IF EXISTS work_assignments_worker_id_fkey;
ALTER TABLE work_assignments 
  ADD CONSTRAINT work_assignments_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_work_assignments_estate_date ON work_assignments (estate_id, date DESC);

DROP TRIGGER IF EXISTS trg_work_assignments_audit ON work_assignments;
CREATE TRIGGER trg_work_assignments_audit
  BEFORE UPDATE ON work_assignments
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();


-- ----------------------------------------------------------------------------
-- 7. CANONICAL TABLE: penggredan_rekod
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS penggredan_rekod (
  id TEXT PRIMARY KEY,
  tajuk TEXT,
  program TEXT,
  jenis_grading TEXT,
  tarikh TEXT,
  ladang TEXT,
  peringkat_blok TEXT,
  no_lori TEXT,
  nama_penggred TEXT,
  platforms JSONB DEFAULT '[]'::jsonb,
  total_di_gred INTEGER DEFAULT 0,
  total_di_tinggal INTEGER DEFAULT 0,
  total_di_bawa INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE penggredan_rekod 
  ADD COLUMN IF NOT EXISTS estate_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Backfill derived from ladang string or default to FPM_TUNGGAL
UPDATE penggredan_rekod 
  SET estate_id = COALESCE(NULLIF(TRIM(ladang), ''), 'FPM_TUNGGAL') 
  WHERE estate_id IS NULL;

ALTER TABLE penggredan_rekod ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE penggredan_rekod ALTER COLUMN estate_id DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_penggredan_estate_created ON penggredan_rekod (estate_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_penggredan_rekod_audit ON penggredan_rekod;
CREATE TRIGGER trg_penggredan_rekod_audit
  BEFORE UPDATE ON penggredan_rekod
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();


-- ----------------------------------------------------------------------------
-- 8. CANONICAL TABLES: annual_yield & block_annual_yields
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS annual_yield (
  tahun INTEGER PRIMARY KEY,
  ton_sebenar DECIMAL DEFAULT 0,
  ton_anggaran DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE annual_yield 
  ADD COLUMN IF NOT EXISTS estate_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

UPDATE annual_yield SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;

ALTER TABLE annual_yield ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE annual_yield ALTER COLUMN estate_id DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_annual_yield_estate ON annual_yield (estate_id, tahun);

DROP TRIGGER IF EXISTS trg_annual_yield_audit ON annual_yield;
CREATE TRIGGER trg_annual_yield_audit
  BEFORE UPDATE ON annual_yield
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();


CREATE TABLE IF NOT EXISTS block_annual_yields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tahun INTEGER NOT NULL,
  blok TEXT NOT NULL,
  ton_sebenar DECIMAL DEFAULT 0,
  ton_anggaran DECIMAL DEFAULT 0,
  yield_per_hektar DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE block_annual_yields 
  ADD COLUMN IF NOT EXISTS estate_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

UPDATE block_annual_yields SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;

ALTER TABLE block_annual_yields ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE block_annual_yields ALTER COLUMN estate_id DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_block_annual_yields_estate ON block_annual_yields (estate_id, tahun, blok);

DROP TRIGGER IF EXISTS trg_block_annual_yields_audit ON block_annual_yields;
CREATE TRIGGER trg_block_annual_yields_audit
  BEFORE UPDATE ON block_annual_yields
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();


-- ----------------------------------------------------------------------------
-- 9. OTHER OPERATIONAL TABLES (No Permanent Defaults, RESTRICT Foreign Keys)
-- ----------------------------------------------------------------------------

-- hantaran_hasil
ALTER TABLE hantaran_hasil ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE hantaran_hasil SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE hantaran_hasil ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE hantaran_hasil ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE hantaran_hasil ADD COLUMN IF NOT EXISTS updated_by TEXT;
CREATE INDEX IF NOT EXISTS idx_hantaran_hasil_estate_tarikh ON hantaran_hasil (estate_id, tarikh DESC);
DROP TRIGGER IF EXISTS trg_hantaran_hasil_audit ON hantaran_hasil;
CREATE TRIGGER trg_hantaran_hasil_audit BEFORE UPDATE ON hantaran_hasil FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();

-- hantaran_pruning
ALTER TABLE hantaran_pruning ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE hantaran_pruning SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE hantaran_pruning ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE hantaran_pruning ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE hantaran_pruning ADD COLUMN IF NOT EXISTS updated_by TEXT;
CREATE INDEX IF NOT EXISTS idx_hantaran_pruning_estate ON hantaran_pruning (estate_id);
DROP TRIGGER IF EXISTS trg_hantaran_pruning_audit ON hantaran_pruning;
CREATE TRIGGER trg_hantaran_pruning_audit BEFORE UPDATE ON hantaran_pruning FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();

-- fertilizer_daily_entries
ALTER TABLE fertilizer_daily_entries ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE fertilizer_daily_entries SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE fertilizer_daily_entries ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE fertilizer_daily_entries ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE fertilizer_daily_entries ADD COLUMN IF NOT EXISTS updated_by TEXT;
CREATE INDEX IF NOT EXISTS idx_fertilizer_entries_estate_entry_date ON fertilizer_daily_entries (estate_id, entry_date DESC);
DROP TRIGGER IF EXISTS trg_fertilizer_daily_entries_audit ON fertilizer_daily_entries;
CREATE TRIGGER trg_fertilizer_daily_entries_audit BEFORE UPDATE ON fertilizer_daily_entries FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();

-- fertilizer_master_schedule
ALTER TABLE fertilizer_master_schedule ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE fertilizer_master_schedule SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE fertilizer_master_schedule ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE fertilizer_master_schedule ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE fertilizer_master_schedule ADD COLUMN IF NOT EXISTS updated_by TEXT;
CREATE INDEX IF NOT EXISTS idx_fertilizer_schedule_estate ON fertilizer_master_schedule (estate_id, blok_code);
DROP TRIGGER IF EXISTS trg_fertilizer_master_schedule_audit ON fertilizer_master_schedule;
CREATE TRIGGER trg_fertilizer_master_schedule_audit BEFORE UPDATE ON fertilizer_master_schedule FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();

-- fertilizer_inventory
ALTER TABLE fertilizer_inventory ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE fertilizer_inventory SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE fertilizer_inventory ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE fertilizer_inventory ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE fertilizer_inventory ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- fertilizer_inventory_transactions (ON DELETE RESTRICT)
ALTER TABLE fertilizer_inventory_transactions ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE fertilizer_inventory_transactions SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE fertilizer_inventory_transactions ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE fertilizer_inventory_transactions ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE fertilizer_inventory_transactions DROP CONSTRAINT IF EXISTS fertilizer_inventory_transactions_inventory_id_fkey;
ALTER TABLE fertilizer_inventory_transactions 
  ADD CONSTRAINT fertilizer_inventory_transactions_inventory_id_fkey 
  FOREIGN KEY (inventory_id) REFERENCES fertilizer_inventory(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_fertilizer_tx_estate ON fertilizer_inventory_transactions (estate_id, created_at DESC);

-- merumput_inventory
ALTER TABLE merumput_inventory ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE merumput_inventory SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE merumput_inventory ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE merumput_inventory ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE merumput_inventory ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- merumput_inventory_transactions (ON DELETE RESTRICT)
ALTER TABLE merumput_inventory_transactions ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE merumput_inventory_transactions SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE merumput_inventory_transactions ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE merumput_inventory_transactions ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE merumput_inventory_transactions DROP CONSTRAINT IF EXISTS merumput_inventory_transactions_inventory_id_fkey;
ALTER TABLE merumput_inventory_transactions 
  ADD CONSTRAINT merumput_inventory_transactions_inventory_id_fkey 
  FOREIGN KEY (inventory_id) REFERENCES merumput_inventory(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_merumput_tx_estate ON merumput_inventory_transactions (estate_id, created_at DESC);

-- hasil_abw_history
ALTER TABLE hasil_abw_history ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE hasil_abw_history SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE hasil_abw_history ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE hasil_abw_history ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE hasil_abw_history ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- hasil_bbc_history
ALTER TABLE hasil_bbc_history ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE hasil_bbc_history SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE hasil_bbc_history ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE hasil_bbc_history ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE hasil_bbc_history ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- hasil_backlog_history
ALTER TABLE hasil_backlog_history ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE hasil_backlog_history SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE hasil_backlog_history ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE hasil_backlog_history ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE hasil_backlog_history ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE app_settings SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE app_settings ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN estate_id DROP DEFAULT;

-- presentation_decks
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS estate_id TEXT;
UPDATE presentation_decks SET estate_id = 'FPM_TUNGGAL' WHERE estate_id IS NULL;
ALTER TABLE presentation_decks ALTER COLUMN estate_id SET NOT NULL;
ALTER TABLE presentation_decks ALTER COLUMN estate_id DROP DEFAULT;
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS updated_by TEXT;
CREATE INDEX IF NOT EXISTS idx_presentation_decks_estate ON presentation_decks (estate_id);
DROP TRIGGER IF EXISTS trg_presentation_decks_audit ON presentation_decks;
CREATE TRIGGER trg_presentation_decks_audit BEFORE UPDATE ON presentation_decks FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_user();

-- ============================================================================
-- END OF REVISED STAGE C1 MIGRATION
-- ============================================================================
