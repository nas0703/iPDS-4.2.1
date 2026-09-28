-- ==============================================================================
-- IPDS Ver 3.7 — Phase 5: Unified Identity & User Profiles (Penyatuan Identiti)
-- Date: 2026-09-06
-- Target: Supabase PostgreSQL (Production Baseline)
-- Standard: FPMSB Enterprise Consolidated Identity & Kiosk SSO Architecture
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UNIFIED USER PROFILES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    username VARCHAR(64) UNIQUE,
    email VARCHAR(255) UNIQUE,
    pin VARCHAR(64),
    password_hash VARCHAR(255),
    app_role VARCHAR(32) NOT NULL CHECK (app_role IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi', 'oc', 'rc', 'superadmin')),
    primary_estate_id VARCHAR(50) NOT NULL REFERENCES public.org_estates(id) ON DELETE RESTRICT,
    assigned_estates TEXT[] DEFAULT '{}',
    kiosk_id VARCHAR(64) NOT NULL,
    station_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(255)
);

-- Indexes for lightning-fast lookups and cross-estate authorization checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_operator_id ON public.user_profiles (operator_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles (username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_primary_estate ON public.user_profiles (primary_estate_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_app_role ON public.user_profiles (app_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_pin ON public.user_profiles (pin);

-- Multi-layer audit timestamp and actor tracking trigger
DROP TRIGGER IF EXISTS trg_user_profiles_audit ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_audit
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_timestamp_and_tenant_user();


-- ------------------------------------------------------------------------------
-- 2. SEED UNIFIED IDENTITIES FOR PRODUCTION ESTATES & REGIONS
-- ------------------------------------------------------------------------------

-- Ensure base org_estates exist if not already populated
INSERT INTO public.org_macro_zones (id, name) VALUES ('MZ_SELATAN', 'Zon Selatan (Johor)') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.org_regions (id, macro_zone_id, name) VALUES ('REG_JB', 'MZ_SELATAN', 'Wilayah Johor Bahru') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.org_op_zones (id, region_id, name) VALUES ('ZON_ADELA', 'REG_JB', 'Zon Operasi Adela') ON CONFLICT (id) DO NOTHING;

INSERT INTO public.org_estates (id, op_zone_id, name, total_area_ha) VALUES 
    ('FPM_TUNGGAL', 'ZON_ADELA', 'Ladang Tunggal (5155)', 1845.20),
    ('FPM_ADELA', 'ZON_ADELA', 'Ladang Adela (5136)', 1920.50),
    ('FPM_KLEDANG', 'ZON_ADELA', 'Ladang Kledang (5176)', 1760.80),
    ('FPM_SENING', 'ZON_ADELA', 'Ladang Sening (5156)', 1640.40)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    total_area_ha = EXCLUDED.total_area_ha;

-- Insert consolidated seed user profiles
INSERT INTO public.user_profiles (
    operator_id, full_name, username, email, pin, app_role, 
    primary_estate_id, assigned_estates, kiosk_id, station_name, is_active
) VALUES
    -- Wilayah & Zon Controllers (Multi-Estate Scope)
    ('RC-0001', 'Regional Controller (Wilayah JB)', 'admin', 'admin@ipds.felda.gov.my', '111111', 'rc', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL', 'FPM_ADELA', 'FPM_KLEDANG', 'FPM_SENING'], 'kiosk-rc-hq', 'Pejabat Wilayah Johor Bahru', TRUE),
    ('OC-0002', 'Operation Controller (Zon Adela)', 'oc_adela', 'oc.adela@felda.gov.my', '333333', 'oc', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL', 'FPM_ADELA', 'FPM_KLEDANG', 'FPM_SENING'], 'kiosk-oc-adela', 'Pusat Operasi Zon Adela', TRUE),
    
    -- Ladang Tunggal (5155)
    ('FC-2401199', 'MD NASRUDDIN BIN BHSERAN', '2401199', 'nasruddin@felda.gov.my', '2401199', 'fc', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL'], 'kiosk-fc-tunggal', 'Pusat Kawalan Ladang Tunggal', TRUE),
    ('FC-TGL-01', 'Field Controller (FC Tunggal)', 'fc_tunggal', 'fc.tunggal@felda.gov.my', '654321', 'fc', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL'], 'kiosk-fc-tunggal', 'Pusat Kawalan Ladang Tunggal', TRUE),
    ('MGR-TGL-01', 'Pengurus Felda (PF Tunggal)', 'pf_tunggal', 'pf.tunggal@felda.gov.my', '888888', 'pf', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL'], 'kiosk-mgmt-tunggal', 'Pejabat Pentadbiran Tunggal', TRUE),
    ('STF-TGL-01', 'Kerani Input Operasi (Tunggal)', 'staff_tunggal', 'staff.tunggal@felda.gov.my', '123456', 'staff', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL'], 'kiosk-weighbridge-tgl', 'Stesen Timbang Tunggal', TRUE),
    ('AFC-TGL-01', 'Assistant FC (AFC Tunggal)', 'afc_tunggal', 'afc.tunggal@felda.gov.my', '777777', 'afc', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL'], 'kiosk-afc-tgl', 'Stesen Kawalan Tunggal', TRUE),
    ('FS-TGL-01', 'Field Supervisor (FS Tunggal)', 'fs_tunggal', 'fs.tunggal@felda.gov.my', '555555', 'fs', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL'], 'kiosk-fs-tgl', 'Pos Penyeliaan Tunggal', TRUE),
    ('EQI-TGL-01', 'Pemeriksa Kualiti Gred (EQI Tunggal)', 'eqi_tunggal', 'eqi.tunggal@felda.gov.my', '999999', 'eqi', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL'], 'kiosk-eqi-tgl', 'Ramp Penggredan Tunggal', TRUE),
    ('MDR-TGL-01', 'Mandur Penuaian (Tunggal)', 'mandur_tunggal', 'mandur.tunggal@felda.gov.my', '222222', 'mandur', 'FPM_TUNGGAL', ARRAY['FPM_TUNGGAL'], 'kiosk-mdr-tgl', 'Stesen Lapangan Tunggal', TRUE),

    -- Ladang Adela (5136)
    ('FC-ADL-01', 'Field Controller (FC Adela)', 'fc_adela', 'fc.adela@felda.gov.my', '600300', 'fc', 'FPM_ADELA', ARRAY['FPM_ADELA'], 'kiosk-fc-adela', 'Pusat Kawalan Ladang Adela', TRUE),
    ('MGR-ADL-01', 'Pengurus Felda (PF Adela)', 'pf_adela', 'pf.adela@felda.gov.my', '800300', 'pf', 'FPM_ADELA', ARRAY['FPM_ADELA'], 'kiosk-mgmt-adela', 'Pejabat Pentadbiran Adela', TRUE),
    ('STF-ADL-01', 'Kerani Operasi (Adela)', 'staff_adela', 'staff.adela@felda.gov.my', '100300', 'staff', 'FPM_ADELA', ARRAY['FPM_ADELA'], 'kiosk-staff-adela', 'Stesen Timbang Adela', TRUE),
    ('AFC-ADL-01', 'Assistant FC (AFC Adela)', 'afc_adela', 'afc.adela@felda.gov.my', '700300', 'afc', 'FPM_ADELA', ARRAY['FPM_ADELA'], 'kiosk-afc-adela', 'Stesen Kawalan Adela', TRUE),
    ('FS-ADL-01', 'Field Supervisor (FS Adela)', 'fs_adela', 'fs.adela@felda.gov.my', '500300', 'fs', 'FPM_ADELA', ARRAY['FPM_ADELA'], 'kiosk-fs-adela', 'Pos Penyeliaan Adela', TRUE),

    -- Ladang Kledang (5176)
    ('FC-KLD-01', 'Field Controller (FC Kledang)', 'fc_kledang', 'fc.kledang@felda.gov.my', '600200', 'fc', 'FPM_KLEDANG', ARRAY['FPM_KLEDANG'], 'kiosk-fc-kledang', 'Pusat Kawalan Ladang Kledang', TRUE),
    ('MGR-KLD-01', 'Pengurus Felda (PF Kledang)', 'pf_kledang', 'pf.kledang@felda.gov.my', '800200', 'pf', 'FPM_KLEDANG', ARRAY['FPM_KLEDANG'], 'kiosk-mgmt-kledang', 'Pejabat Pentadbiran Kledang', TRUE),
    ('STF-KLD-01', 'Kerani Operasi (Kledang)', 'staff_kledang', 'staff.kledang@felda.gov.my', '100200', 'staff', 'FPM_KLEDANG', ARRAY['FPM_KLEDANG'], 'kiosk-staff-kledang', 'Stesen Timbang Kledang', TRUE),
    ('AFC-KLD-01', 'Assistant FC (AFC Kledang)', 'afc_kledang', 'afc.kledang@felda.gov.my', '700200', 'afc', 'FPM_KLEDANG', ARRAY['FPM_KLEDANG'], 'kiosk-afc-kledang', 'Stesen Kawalan Kledang', TRUE),
    ('FS-KLD-01', 'Field Supervisor (FS Kledang)', 'fs_kledang', 'fs.kledang@felda.gov.my', '500200', 'fs', 'FPM_KLEDANG', ARRAY['FPM_KLEDANG'], 'kiosk-fs-kledang', 'Pos Penyeliaan Kledang', TRUE),

    -- Ladang Sening (5156)
    ('FC-SNG-01', 'Field Controller (FC Sening)', 'fc_sening', 'fc.sening@felda.gov.my', '600400', 'fc', 'FPM_SENING', ARRAY['FPM_SENING'], 'kiosk-fc-sening', 'Pusat Kawalan Ladang Sening', TRUE),
    ('MGR-SNG-01', 'Pengurus Felda (PF Sening)', 'pf_sening', 'pf.sening@felda.gov.my', '800400', 'pf', 'FPM_SENING', ARRAY['FPM_SENING'], 'kiosk-mgmt-sening', 'Pejabat Pentadbiran Sening', TRUE),
    ('STF-SNG-01', 'Kerani Operasi (Sening)', 'staff_sening', 'staff.sening@felda.gov.my', '100400', 'staff', 'FPM_SENING', ARRAY['FPM_SENING'], 'kiosk-staff-sening', 'Stesen Timbang Sening', TRUE),
    ('AFC-SNG-01', 'Assistant FC (AFC Sening)', 'afc_sening', 'afc.sening@felda.gov.my', '700400', 'afc', 'FPM_SENING', ARRAY['FPM_SENING'], 'kiosk-afc-sening', 'Stesen Kawalan Sening', TRUE),
    ('FS-SNG-01', 'Field Supervisor (FS Sening)', 'fs_sening', 'fs.sening@felda.gov.my', '500400', 'fs', 'FPM_SENING', ARRAY['FPM_SENING'], 'kiosk-fs-sening', 'Pos Penyeliaan Sening', TRUE)
ON CONFLICT (operator_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    pin = EXCLUDED.pin,
    app_role = EXCLUDED.app_role,
    primary_estate_id = EXCLUDED.primary_estate_id,
    assigned_estates = EXCLUDED.assigned_estates,
    kiosk_id = EXCLUDED.kiosk_id,
    station_name = EXCLUDED.station_name,
    is_active = EXCLUDED.is_active;


-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES FOR USER PROFILES
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if recreating
DROP POLICY IF EXISTS rls_user_profiles_self_select ON public.user_profiles;
DROP POLICY IF EXISTS rls_user_profiles_estate_admin_select ON public.user_profiles;
DROP POLICY IF EXISTS rls_user_profiles_regional_select ON public.user_profiles;
DROP POLICY IF EXISTS rls_user_profiles_service_role_all ON public.user_profiles;

-- Policy 1: Any authenticated user can view their own profile
CREATE POLICY rls_user_profiles_self_select ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        operator_id = (auth.jwt() -> 'app_metadata' ->> 'operator_id') OR
        id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id') OR
        id::text = (auth.jwt() ->> 'sub')
    );

-- Policy 2: Estate Administrators (PF, FC) can view profiles belonging to their assigned estate
CREATE POLICY rls_user_profiles_estate_admin_select ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'app_role') IN ('pf', 'fc') AND
        primary_estate_id = (auth.jwt() -> 'app_metadata' ->> 'estate_id')
    );

-- Policy 3: Regional / Zonal Controllers (RC, OC) can view profiles across all estates in their cluster
CREATE POLICY rls_user_profiles_regional_select ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'app_role') IN ('rc', 'oc', 'superadmin')
    );

-- Policy 4: Service Role and Backend APIs have unrestricted access for management and syncing
CREATE POLICY rls_user_profiles_service_role_all ON public.user_profiles
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);
