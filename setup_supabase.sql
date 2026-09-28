
-- FERTILIZER MODULE SCHEMA
-- Run this in your Supabase SQL Editor

-- 1. Master Schedule Table
CREATE TABLE IF NOT EXISTS fertilizer_master_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blok_code TEXT UNIQUE NOT NULL,
  luas_ha DECIMAL,
  dirian INTEGER,
  pokok INTEGER,
  pus1_beg INTEGER,
  pus2_beg INTEGER,
  pus3_beg INTEGER,
  pus4_beg INTEGER,
  compact_total_beg INTEGER,
  organic_total_beg INTEGER,
  grand_total_beg INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Daily Entries Table
CREATE TABLE IF NOT EXISTS fertilizer_daily_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL,
  blok_code TEXT NOT NULL,
  pus INTEGER NOT NULL,
  interval_name TEXT,
  fertilizer_type TEXT,
  workers_count INTEGER,
  total_beg_completed INTEGER,
  productivity_beg_per_worker DECIMAL,
  target_beg_for_selected_pus INTEGER,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, blok_code, pus)
);

-- 3. Disable RLS
ALTER TABLE fertilizer_master_schedule DISABLE ROW LEVEL SECURITY;
ALTER TABLE fertilizer_daily_entries DISABLE ROW LEVEL SECURITY;

-- 5. Helpful Indexes
CREATE INDEX idx_entries_date ON fertilizer_daily_entries(entry_date);
CREATE INDEX idx_entries_blok ON fertilizer_daily_entries(blok_code);

-- PRUNING MODULE SCHEMA
CREATE TABLE IF NOT EXISTS hantaran_pruning (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blok TEXT UNIQUE NOT NULL,
  luas DECIMAL DEFAULT 0,
  tarikh_mula DATE,
  tarikh_siap DATE,
  hek_siap_pekerja DECIMAL DEFAULT 0,
  hek_pekerja_cekrol DECIMAL DEFAULT 0,
  jum_hektar_siap DECIMAL DEFAULT 0,
  peratus_siap DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS
ALTER TABLE hantaran_pruning DISABLE ROW LEVEL SECURITY;

-- 6. Monthly Targets Table
CREATE TABLE IF NOT EXISTS monthly_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  category TEXT NOT NULL, -- "001", "002", "003"
  targets JSONB NOT NULL, -- Array of 12 numbers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, category)
);

ALTER TABLE monthly_targets DISABLE ROW LEVEL SECURITY;

-- Insert seed data for 2026
INSERT INTO monthly_targets (year, category, targets)
VALUES
  (2026, '001', '[1.9, 1.8, 1.9, 1.9, 2.0, 2.2, 2.45, 2.7, 2.85, 2.95, 2.75, 2.4]'),
  (2026, '002', '[1.6, 1.3, 1.8, 1.7, 2.1, 2.2, 2.6, 2.4, 2.6, 2.8, 3.0, 2.7]'),
  (2026, '003', '[0.80, 0.65, 0.80, 0.83, 0.91, 0.98, 1.01, 1.24, 1.50, 1.60, 1.32, 1.35]')
ON CONFLICT (year, category)
DO UPDATE SET targets = EXCLUDED.targets, updated_at = NOW();

-- 7. Fertilizer Inventory Table
CREATE TABLE IF NOT EXISTS fertilizer_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  quantity DECIMAL DEFAULT 0, -- Store with precision for KG
  min_threshold DECIMAL DEFAULT 50,
  unit TEXT DEFAULT 'BEG',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Fertilizer Inventory Transactions Table
CREATE TABLE IF NOT EXISTS fertilizer_inventory_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES fertilizer_inventory(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('IN', 'OUT')),
  quantity DECIMAL NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS
ALTER TABLE fertilizer_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE fertilizer_inventory_transactions DISABLE ROW LEVEL SECURITY;

-- Seed Initial Inventory Items
INSERT INTO fertilizer_inventory (name, quantity, min_threshold, unit)
VALUES
  ('COMPACT FELDA 12', 0, 50, 'BEG'),
  ('FELDA ORGANIC', 0, 50, 'BEG'),
  ('MOP (MURIATE OF POTASH)', 0, 50, 'BEG'),
  ('ERP (EGYPT ROCK PHOSPHATE)', 0, 50, 'BEG'),
  ('KIESERITE', 0, 50, 'BEG'),
  ('BORATE', 0, 50, 'BEG'),
  ('NPK 15-15-15', 0, 50, 'BEG'),
  ('NPK 12-12-17-2', 0, 50, 'BEG')
ON CONFLICT (name) DO NOTHING;

-- 9. Helpful Indexes for hantaran_hasil table (Performance Optimization)
CREATE INDEX IF NOT EXISTS idx_hantaran_tarikh ON hantaran_hasil(tarikh);
CREATE INDEX IF NOT EXISTS idx_hantaran_blok ON hantaran_hasil(blok);
CREATE INDEX IF NOT EXISTS idx_hantaran_created_at ON hantaran_hasil(created_at DESC);

-- 10. MERUMPUT (WEEDING/MERACUN) SCHEMA
CREATE TABLE IF NOT EXISTS merumput_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  quantity DECIMAL DEFAULT 0, -- Store with precision for Liters / KG
  min_threshold DECIMAL DEFAULT 10,
  unit TEXT DEFAULT 'LITER',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merumput_inventory_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES merumput_inventory(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('IN', 'OUT')),
  quantity DECIMAL NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merumput_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blok TEXT NOT NULL,
  luas DECIMAL DEFAULT 0,
  pusingan INTEGER NOT NULL DEFAULT 1,
  jenis TEXT NOT NULL, -- 'BULATAN & LORONG', 'DADA (R&S)'
  tarikh_mula DATE NOT NULL,
  tarikh_siap DATE,
  hek_siap DECIMAL DEFAULT 0,
  workers_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT merumput_progress_key UNIQUE (blok, pusingan, jenis)
);

-- Disable RLS for merumput
ALTER TABLE merumput_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE merumput_inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE merumput_progress DISABLE ROW LEVEL SECURITY;

-- Seed Initial Merumput Inventory Items (Common Weedicide/Herbicides in Estate)
INSERT INTO merumput_inventory (name, quantity, min_threshold, unit)
VALUES
  ('GLYPHOSATE 41% (GLYPHOSENE/KEN-UP)', 0, 20, 'LITER'),
  ('TRICLOPYR 32% (KENELON/GARLON)', 0, 10, 'LITER'),
  ('METSULFURON-METHYL (ALLY 20DF)', 0, 5, 'KG'),
  ('GLUFOSINATE-AMMONIUM (BASTA 15)', 0, 20, 'LITER'),
  ('FLUROXYPYR (STARANE HARMONY)', 0, 10, 'LITER')
ON CONFLICT (name) DO NOTHING;

-- 11. PRESENTATION DECKS (SLIDES) SCHEMA
CREATE TABLE IF NOT EXISTS presentation_decks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Umum',
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  author TEXT,
  pptx_base64 TEXT,
  file_name TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE presentation_decks DISABLE ROW LEVEL SECURITY;



