-- ==============================================================================
-- IPDS Ver 3.7 — Phase 1: Multi-Tenant Schema & 8 Core Operational Tables Hardening
-- Date: 2026-09-04
-- Target: Supabase PostgreSQL (Production Baseline)
-- Standard: FPMSB Enterprise Multi-Tenant Topography
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. MULTI-LAYER AUDIT IDENTITY TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_timestamp_and_tenant_user()
RETURNS TRIGGER AS $$
DECLARE
  v_jwt jsonb;
  v_user_identity text;
BEGIN
   NEW.updated_at = NOW();
   
   -- Extract user identity from authenticated JWT claims if present
   IF auth.jwt() IS NOT NULL THEN
     v_jwt := auth.jwt();
     v_user_identity := COALESCE(
       v_jwt ->> 'email',
       v_jwt -> 'app_metadata' ->> 'operator_id',
       v_jwt -> 'app_metadata' ->> 'kiosk_id',
       v_jwt ->> 'sub'
     );
   END IF;
   
   -- Fallback to database user context
   IF v_user_identity IS NULL OR v_user_identity = '' THEN
     v_user_identity := current_user;
   END IF;
   
   NEW.updated_by := v_user_identity;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ------------------------------------------------------------------------------
-- 2. ORGANIZATIONAL TOPOLOGY MASTER DATA TABLES (5-LEVEL HIERARCHY)
-- ------------------------------------------------------------------------------

-- Level 2: Macro Zone
CREATE TABLE IF NOT EXISTS public.org_macro_zones (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level 3: Region (10 Regions)
CREATE TABLE IF NOT EXISTS public.org_regions (
    id VARCHAR(50) PRIMARY KEY,
    macro_zone_id VARCHAR(50) NOT NULL REFERENCES public.org_macro_zones(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level 4: Operational Zone / Cluster
CREATE TABLE IF NOT EXISTS public.org_op_zones (
    id VARCHAR(50) PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL REFERENCES public.org_regions(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level 5: Estate / Ladang
CREATE TABLE IF NOT EXISTS public.org_estates (
    id VARCHAR(50) PRIMARY KEY,
    op_zone_id VARCHAR(50) NOT NULL REFERENCES public.org_op_zones(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    total_area_ha NUMERIC(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level 6: Division / Bahagian
CREATE TABLE IF NOT EXISTS public.org_divisions (
    id VARCHAR(50) PRIMARY KEY,
    estate_id VARCHAR(50) NOT NULL REFERENCES public.org_estates(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 3. THE 8 CORE OPERATIONAL TABLES (MANDATORY estate_id & COMPOSITE INDEXES)
-- ------------------------------------------------------------------------------

-- TABLE 1: HASIL & ABW (hasil_abw)
CREATE TABLE IF NOT EXISTS public.hasil_abw (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estate_id VARCHAR(50) NOT NULL,
    blok VARCHAR(50) NOT NULL,
    peringkat VARCHAR(50),
    tarikh DATE NOT NULL,
    bunch_count INTEGER DEFAULT 0,
    sample_weight_kg NUMERIC(10,2) DEFAULT 0,
    abw_kg NUMERIC(6,2) DEFAULT 0,
    total_tan NUMERIC(10,2) DEFAULT 0,
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hasil_abw_estate_tarikh ON public.hasil_abw (estate_id, tarikh DESC);
CREATE INDEX IF NOT EXISTS idx_hasil_abw_estate_blok ON public.hasil_abw (estate_id, blok);

-- TABLE 2: HANTARAN & WEIGHBRIDGE RESIT (hantaran_resit)
CREATE TABLE IF NOT EXISTS public.hantaran_resit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    no_resit VARCHAR(100) NOT NULL,
    estate_id VARCHAR(50) NOT NULL,
    no_lori VARCHAR(50) NOT NULL,
    no_seal VARCHAR(100),
    no_nota_hantaran VARCHAR(100),
    kpg VARCHAR(50),
    blok VARCHAR(50) NOT NULL,
    tan NUMERIC(10,2) DEFAULT 0,
    muda NUMERIC(10,2) DEFAULT 0,
    reject NUMERIC(10,2) DEFAULT 0,
    rm_mt NUMERIC(10,2) DEFAULT 0,
    tarikh DATE NOT NULL,
    masa_masuk TIME,
    is_efb BOOLEAN DEFAULT FALSE,
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hantaran_resit_estate_tarikh ON public.hantaran_resit (estate_id, tarikh DESC);
CREATE INDEX IF NOT EXISTS idx_hantaran_resit_estate_no_resit ON public.hantaran_resit (estate_id, no_resit);

-- TABLE 3: PRUNING PROGRESS (pruning_progress)
CREATE TABLE IF NOT EXISTS public.pruning_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estate_id VARCHAR(50) NOT NULL,
    blok VARCHAR(50) NOT NULL,
    luas_hek NUMERIC(10,2) DEFAULT 0,
    pusingan INTEGER DEFAULT 1,
    tarikh_mula DATE NOT NULL,
    tarikh_siap DATE,
    hek_siap NUMERIC(10,2) DEFAULT 0,
    workers_count INTEGER DEFAULT 1,
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pruning_progress_estate_tarikh ON public.pruning_progress (estate_id, tarikh_mula DESC);
CREATE INDEX IF NOT EXISTS idx_pruning_progress_estate_blok ON public.pruning_progress (estate_id, blok);

-- TABLE 4: MERUMPUT PROGRESS (merumput_progress)
CREATE TABLE IF NOT EXISTS public.merumput_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estate_id VARCHAR(50) NOT NULL,
    blok VARCHAR(50) NOT NULL,
    luas NUMERIC(10,2) DEFAULT 0,
    pusingan INTEGER NOT NULL DEFAULT 1,
    jenis VARCHAR(100) NOT NULL,
    tarikh_mula DATE NOT NULL,
    tarikh_siap DATE,
    hek_siap NUMERIC(10,2) DEFAULT 0,
    workers_count INTEGER DEFAULT 1,
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_merumput_progress_estate_tarikh ON public.merumput_progress (estate_id, tarikh_mula DESC);
CREATE INDEX IF NOT EXISTS idx_merumput_progress_estate_blok ON public.merumput_progress (estate_id, blok);

-- TABLE 5: MERUMPUT INVENTORY (merumput_inventory)
CREATE TABLE IF NOT EXISTS public.merumput_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estate_id VARCHAR(50) NOT NULL,
    item_code VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'RACUN',
    unit VARCHAR(50) DEFAULT 'LITER',
    stok_semasa NUMERIC(10,2) DEFAULT 0,
    paras_minimum NUMERIC(10,2) DEFAULT 10.0,
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_merumput_inventory_estate_code ON public.merumput_inventory (estate_id, item_code);

-- TABLE 6: PEKERJA RECORDS (workers)
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estate_id VARCHAR(50) NOT NULL,
    worker_no VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    negara_asal VARCHAR(100) DEFAULT 'Malaysia',
    kumpulan VARCHAR(100) DEFAULT 'Kerja Am dan Lain-lain',
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workers_estate_active ON public.workers (estate_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workers_estate_worker_no ON public.workers (estate_id, worker_no);

-- TABLE 7: KUALITI BTS & PENGGREDAN (kualiti_bts)
CREATE TABLE IF NOT EXISTS public.kualiti_bts (
    id VARCHAR(100) PRIMARY KEY,
    estate_id VARCHAR(50) NOT NULL,
    tajuk TEXT,
    program TEXT,
    jenis_grading TEXT,
    tarikh DATE NOT NULL,
    peringkat_blok VARCHAR(100),
    no_lori VARCHAR(50),
    nama_penggred VARCHAR(255),
    total_di_gred INTEGER DEFAULT 0,
    total_di_tinggal INTEGER DEFAULT 0,
    total_di_bawa INTEGER DEFAULT 0,
    platforms JSONB DEFAULT '[]'::jsonb,
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kualiti_bts_estate_tarikh ON public.kualiti_bts (estate_id, tarikh DESC);

-- TABLE 8: AUDIT LOGS (observability_logs)
CREATE TABLE IF NOT EXISTS public.observability_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estate_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'INFO',
    actor_id VARCHAR(255),
    module VARCHAR(100),
    payload JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_observability_logs_estate_time ON public.observability_logs (estate_id, timestamp DESC);


-- ------------------------------------------------------------------------------
-- 4. ATTACH AUTOMATED TIMESTAMP & IDENTITY AUDIT TRIGGERS
-- ------------------------------------------------------------------------------
DO $$ 
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'hasil_abw', 
        'hantaran_resit', 
        'pruning_progress', 
        'merumput_progress', 
        'merumput_inventory', 
        'workers', 
        'kualiti_bts'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I;
            CREATE TRIGGER trg_%I_audit
                BEFORE UPDATE ON public.%I
                FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_and_tenant_user();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 5. SEED BASELINE ORGANIZATIONAL TOPOLOGY
-- ------------------------------------------------------------------------------
INSERT INTO public.org_macro_zones (id, name) VALUES
('MACRO_ZONE_SELATAN', 'Zon Selatan (Pengawal Perladangan Zon Selatan)'),
('MACRO_ZONE_TIMUR', 'Zon Timur (Pengawal Perladangan Zon Timur)'),
('MACRO_ZONE_UTARA', 'Zon Utara (Pengawal Perladangan Zon Utara)')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.org_regions (id, macro_zone_id, name) VALUES
('REG_JOHOR_BAHRU', 'MACRO_ZONE_SELATAN', 'Wilayah Johor Bahru'),
('REG_SEGAMAT', 'MACRO_ZONE_SELATAN', 'Wilayah Segamat'),
('REG_RAJA_ALIAS', 'MACRO_ZONE_SELATAN', 'Wilayah Raja Alias'),
('REG_KUANTAN', 'MACRO_ZONE_TIMUR', 'Wilayah Kuantan'),
('REG_JENGKA', 'MACRO_ZONE_TIMUR', 'Wilayah Jengka'),
('REG_TERENGGANU', 'MACRO_ZONE_TIMUR', 'Wilayah Terengganu'),
('REG_GUA_MUSANG', 'MACRO_ZONE_TIMUR', 'Wilayah Gua Musang'),
('REG_MEMPAGA', 'MACRO_ZONE_UTARA', 'Wilayah Mempaga'),
('REG_TROLAK', 'MACRO_ZONE_UTARA', 'Wilayah Trolak'),
('REG_ALOR_SETAR', 'MACRO_ZONE_UTARA', 'Wilayah Alor Setar')
ON CONFLICT (id) DO UPDATE SET macro_zone_id = EXCLUDED.macro_zone_id, name = EXCLUDED.name;

INSERT INTO public.org_op_zones (id, region_id, name) VALUES
('OP_ZONE_TAIB_ANDAK', 'REG_JOHOR_BAHRU', 'Zon Taib Andak'),
('OP_ZONE_SEPAKAT', 'REG_JOHOR_BAHRU', 'Zon Sepakat'),
('OP_ZONE_ADELA', 'REG_JOHOR_BAHRU', 'Zon Adela'),
('OP_ZONE_LAW', 'REG_JOHOR_BAHRU', 'Zon Law'),
('OP_ZONE_TENGGAROH', 'REG_JOHOR_BAHRU', 'Zon Tenggaroh')
ON CONFLICT (id) DO UPDATE SET region_id = EXCLUDED.region_id, name = EXCLUDED.name;

INSERT INTO public.org_estates (id, op_zone_id, name, total_area_ha) VALUES
('FPM_ADELA', 'OP_ZONE_ADELA', 'Ladang FPM Adela', 2145.50),
('FPM_KLEDANG', 'OP_ZONE_ADELA', 'Ladang FPM Kledang', 1890.20),
('FPM_SENING', 'OP_ZONE_ADELA', 'Ladang FPM Sening', 2015.00),
('FPM_TUNGGAL', 'OP_ZONE_ADELA', 'Ladang FPM Tunggal', 2340.80)
ON CONFLICT (id) DO UPDATE SET op_zone_id = EXCLUDED.op_zone_id, name = EXCLUDED.name;
