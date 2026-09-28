-- ==============================================================================
-- iPDS ENTERPRISE DATABASE ARCHITECTURE: STAGE C2
-- Module: Employee Master Data & Organizational Assignment Foundation
-- Migration: 20260915_employee_master_data_foundation.sql
-- Compatibility: 100% Backward-Compatible with iPDS Phase 1-7 Organizational Topology
-- Multi-Tenant Scope: FELDA, FELCRA, RISDA & Commercial Plantation Groups
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & JWT CLAIMS HELPERS FOR TENANT-LEVEL CONTEXT
-- ------------------------------------------------------------------------------

-- Helper to safely extract tenant_id (UUID) from Supabase JWT claims
CREATE OR REPLACE FUNCTION public.auth_tenant_id()
RETURNS uuid AS $$
DECLARE
  v_claims jsonb;
  v_tenant text;
BEGIN
  IF auth.jwt() IS NULL THEN
    -- Deterministic fallback to default system tenant for local development/unauthenticated scripts
    RETURN '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  v_claims := auth.jwt();
  v_tenant := COALESCE(
    v_claims -> 'app_metadata' ->> 'tenant_id',
    v_claims ->> 'tenant_id',
    v_claims -> 'user_metadata' ->> 'tenant_id'
  );

  IF v_tenant IS NULL OR TRIM(v_tenant) = '' THEN
    RETURN '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  RETURN v_tenant::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN '00000000-0000-0000-0000-000000000001'::uuid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;


-- ------------------------------------------------------------------------------
-- 2. TENANT & COMPANY MASTER DATA (MULTI-TENANCY TOPOGRAPHY)
-- ------------------------------------------------------------------------------

-- Level 0: Tenant (Enterprise SaaS boundary: FELDA Group, FELCRA, RISDA, etc.)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'ENTERPRISE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Level 1: Operating Companies within Tenant (FPMSB, FIC, Felda Global Ventures, etc.)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    registration_no VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    CONSTRAINT uq_companies_tenant_code UNIQUE (tenant_id, code)
);

-- Seed Baseline Default Tenant & Primary Company for FPMSB / FELDA
INSERT INTO public.tenants (id, code, name) VALUES
('00000000-0000-0000-0000-000000000001', 'FELDA_GROUP', 'Lembaga Kemajuan Tanah Persekutuan (FELDA)')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.companies (id, tenant_id, code, name, registration_no) VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'FPMSB', 'Felda Palm Industries & Management Sdn Bhd', '197501002233')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ------------------------------------------------------------------------------
-- 3. ENRICH EXISTING ORGANIZATIONAL TOPOLOGY WITHOUT DESTRUCTIVE CHANGES
-- ------------------------------------------------------------------------------

-- Link existing public.org_estates to Tenant and Company (Additive & Non-breaking)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'org_estates') THEN
    ALTER TABLE public.org_estates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT;
    ALTER TABLE public.org_estates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
    
    -- Backfill default tenant & company for legacy estates
    UPDATE public.org_estates 
    SET 
      tenant_id = '00000000-0000-0000-0000-000000000001',
      company_id = '10000000-0000-0000-0000-000000000001'
    WHERE tenant_id IS NULL;
  END IF;
END $$;

-- Master Physical Block Registry (Normalized Block entity linking to Estate and Division)
CREATE TABLE IF NOT EXISTS public.org_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    estate_id VARCHAR(50) NOT NULL REFERENCES public.org_estates(id) ON DELETE RESTRICT,
    division_id VARCHAR(50) REFERENCES public.org_divisions(id) ON DELETE RESTRICT,
    block_code VARCHAR(50) NOT NULL,
    crop_type VARCHAR(50) DEFAULT 'OIL_PALM',
    hectarage NUMERIC(10,2) DEFAULT 0,
    planting_year INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    CONSTRAINT uq_org_blocks_estate_code UNIQUE (estate_id, block_code)
);

CREATE INDEX IF NOT EXISTS idx_org_blocks_estate_div ON public.org_blocks(estate_id, division_id);
CREATE INDEX IF NOT EXISTS idx_org_blocks_tenant ON public.org_blocks(tenant_id);

-- ------------------------------------------------------------------------------
-- 4. POSITIONS MASTER DATA (JAWATAN PIAWAI)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.org_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'OPERATIONS' CHECK (category IN ('EXECUTIVE', 'MANAGEMENT', 'SUPERVISORY', 'FIELD_STAFF', 'GENERAL_WORKER')),
    department VARCHAR(100) DEFAULT 'LADANG',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    CONSTRAINT uq_org_positions_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_positions_tenant ON public.org_positions(tenant_id, is_active);

-- Seed Standard Plantation Positions
INSERT INTO public.org_positions (id, tenant_id, code, title, category, department) VALUES
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'EM', 'Estate Manager (Pengurus Ladang)', 'MANAGEMENT', 'PENTADBIRAN'),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'AM', 'Assistant Manager (Penolong Pengurus)', 'MANAGEMENT', 'OPERASI'),
('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'FS', 'Field Supervisor (Penyelia Lapangan)', 'SUPERVISORY', 'OPERASI'),
('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'MDR', 'Mandore / Mandur Penuaian', 'SUPERVISORY', 'PENUAIAN'),
('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'CLK', 'Estate Clerk (Kerani Operasi & Timbang)', 'FIELD_STAFF', 'PENTADBIRAN'),
('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'GW', 'General Worker (Pekerja Am / Penuai)', 'GENERAL_WORKER', 'OPERASI')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;


-- ------------------------------------------------------------------------------
-- 5. EMPLOYEE MASTER TABLE (MAKLUMAT ASAS PEKERJA)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    staff_no VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    position_id UUID NOT NULL REFERENCES public.org_positions(id) ON DELETE RESTRICT,
    employment_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' 
      CHECK (employment_status IN ('ACTIVE', 'PROBATION', 'INACTIVE', 'RETIRED', 'TERMINATED', 'RESIGNED')),
    id_card_passport VARCHAR(50),
    contact_number VARCHAR(50),
    email VARCHAR(255),
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    -- Multi-tenant staff number isolation: Unique only within the tenant scope
    CONSTRAINT uq_employees_tenant_staff_no UNIQUE (tenant_id, staff_no),
    CONSTRAINT chk_employees_date_order CHECK (end_date IS NULL OR end_date >= hire_date)
);

-- Dedicated Indexes for employee queries
CREATE INDEX IF NOT EXISTS idx_employees_tenant_staff_no ON public.employees (tenant_id, staff_no);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_status ON public.employees (tenant_id, employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_position ON public.employees (tenant_id, position_id);
CREATE INDEX IF NOT EXISTS idx_employees_full_name ON public.employees (full_name);


-- ------------------------------------------------------------------------------
-- 6. EMPLOYEE ASSIGNMENTS TABLE (PENETAPAN LADANG & BAHAGIAN BERSEJARAH)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    estate_id VARCHAR(50) NOT NULL REFERENCES public.org_estates(id) ON DELETE RESTRICT,
    division_id VARCHAR(50) REFERENCES public.org_divisions(id) ON DELETE RESTRICT,
    assignment_role VARCHAR(50) NOT NULL DEFAULT 'PRIMARY' 
      CHECK (assignment_role IN ('PRIMARY', 'SECONDARY', 'ACTING', 'TEMPORARY')),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' 
      CHECK (status IN ('ACTIVE', 'TRANSFERRED', 'EXPIRED', 'CANCELLED')),
    effective_from DATE NOT NULL,
    effective_to DATE,
    transfer_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    CONSTRAINT chk_assignment_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Partial Unique Index: Ensures at most ONE active PRIMARY assignment per employee at any single moment
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_active_primary_assignment 
ON public.employee_assignments (employee_id) 
WHERE (assignment_role = 'PRIMARY' AND status = 'ACTIVE' AND effective_to IS NULL);

-- Performance Indexes for assignment lookups
CREATE INDEX IF NOT EXISTS idx_employee_assignments_employee ON public.employee_assignments (employee_id, status);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_tenant_estate ON public.employee_assignments (tenant_id, estate_id, status);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_division ON public.employee_assignments (division_id, status);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_dates ON public.employee_assignments (effective_from, effective_to);


-- ------------------------------------------------------------------------------
-- 7. ASSIGNMENT BLOCKS JUNCTION TABLE (PENETAPAN BLOK LAPANGAN)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_assignment_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    assignment_id UUID NOT NULL REFERENCES public.employee_assignments(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES public.org_blocks(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    CONSTRAINT uq_assignment_block_pair UNIQUE (assignment_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_blocks_block ON public.employee_assignment_blocks (block_id);
CREATE INDEX IF NOT EXISTS idx_assignment_blocks_assignment ON public.employee_assignment_blocks (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_blocks_tenant ON public.employee_assignment_blocks (tenant_id);


-- ------------------------------------------------------------------------------
-- 8. INTEGRITY TRIGGER: PREVENT INVALID OVERLAPPING ACTIVE ASSIGNMENTS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validate_employee_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_overlap_count INTEGER;
BEGIN
  -- Auto-sync tenant_id from parent employee record
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.employees WHERE id = NEW.employee_id;
  END IF;

  -- Ensure effective_to is logically sound
  IF NEW.effective_to IS NOT NULL AND NEW.effective_to < NEW.effective_from THEN
    RAISE EXCEPTION 'ASSIGNMENT_ERROR: effective_to (%) cannot precede effective_from (%)', 
      NEW.effective_to, NEW.effective_from;
  END IF;

  -- For PRIMARY ACTIVE assignments, verify no date overlapping occurs with another active assignment
  IF NEW.assignment_role = 'PRIMARY' AND NEW.status = 'ACTIVE' THEN
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.employee_assignments
    WHERE employee_id = NEW.employee_id
      AND assignment_role = 'PRIMARY'
      AND status = 'ACTIVE'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (
        (NEW.effective_to IS NULL AND (effective_to IS NULL OR effective_to >= NEW.effective_from))
        OR
        (NEW.effective_to IS NOT NULL AND (
          (effective_to IS NULL AND NEW.effective_to >= effective_from)
          OR
          (effective_from <= NEW.effective_to AND effective_to >= NEW.effective_from)
        ))
      );

    IF v_overlap_count > 0 THEN
      RAISE EXCEPTION 'ASSIGNMENT_ERROR: Employee % already has an overlapping active primary assignment. Please close the prior assignment first.', 
        NEW.employee_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_employee_assignment ON public.employee_assignments;
CREATE TRIGGER trg_validate_employee_assignment
    BEFORE INSERT OR UPDATE ON public.employee_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_validate_employee_assignment();


-- ------------------------------------------------------------------------------
-- 9. SOFT DELETION & PHYSICAL DELETE PROTECTION TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_prevent_physical_employee_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SECURITY_VIOLATION: Physical deletion of employee master records is strictly prohibited. Use employment_status = ''TERMINATED'', ''RESIGNED'', or ''INACTIVE'' for audit compliance.';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_employee_deletion ON public.employees;
CREATE TRIGGER trg_prevent_employee_deletion
    BEFORE DELETE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_physical_employee_delete();


-- ------------------------------------------------------------------------------
-- 10. ATTACH REUSABLE AUDIT LOGGING & TIMESTAMP TRIGGERS
-- ------------------------------------------------------------------------------

DO $$ 
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'tenants', 
        'companies', 
        'org_blocks', 
        'org_positions', 
        'employees', 
        'employee_assignments'
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
-- 11. ROW LEVEL SECURITY (RLS) POLICIES ENFORCEMENT
-- ------------------------------------------------------------------------------

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignment_blocks ENABLE ROW LEVEL SECURITY;

-- 11.1 TENANTS POLICIES
DROP POLICY IF EXISTS "tenants_read_policy" ON public.tenants;
CREATE POLICY "tenants_read_policy" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.auth_tenant_id() OR public.auth_is_super_admin());

-- 11.2 COMPANIES POLICIES
DROP POLICY IF EXISTS "companies_read_policy" ON public.companies;
CREATE POLICY "companies_read_policy" ON public.companies
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());

-- 11.3 POSITIONS POLICIES
DROP POLICY IF EXISTS "positions_read_policy" ON public.org_positions;
CREATE POLICY "positions_read_policy" ON public.org_positions
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());

DROP POLICY IF EXISTS "positions_write_policy" ON public.org_positions;
CREATE POLICY "positions_write_policy" ON public.org_positions
  FOR ALL TO authenticated
  USING (tenant_id = public.auth_tenant_id() AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin'))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin'));

-- 11.4 ORG BLOCKS POLICIES
DROP POLICY IF EXISTS "blocks_read_policy" ON public.org_blocks;
CREATE POLICY "blocks_read_policy" ON public.org_blocks
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());

DROP POLICY IF EXISTS "blocks_write_policy" ON public.org_blocks;
CREATE POLICY "blocks_write_policy" ON public.org_blocks
  FOR ALL TO authenticated
  USING (tenant_id = public.auth_tenant_id() AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin'))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin'));

-- 11.5 EMPLOYEES POLICIES
DROP POLICY IF EXISTS "employees_read_policy" ON public.employees;
CREATE POLICY "employees_read_policy" ON public.employees
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());

DROP POLICY IF EXISTS "employees_insert_policy" ON public.employees;
CREATE POLICY "employees_insert_policy" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id() 
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  );

DROP POLICY IF EXISTS "employees_update_policy" ON public.employees;
CREATE POLICY "employees_update_policy" ON public.employees
  FOR UPDATE TO authenticated
  USING (tenant_id = public.auth_tenant_id() AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin'))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin'));

-- 11.6 EMPLOYEE ASSIGNMENTS POLICIES
DROP POLICY IF EXISTS "assignments_read_policy" ON public.employee_assignments;
CREATE POLICY "assignments_read_policy" ON public.employee_assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.auth_tenant_id() 
    AND (
      estate_id = public.auth_estate_id() 
      OR public.auth_is_cross_estate_role() 
      OR public.auth_is_super_admin()
    )
  );

DROP POLICY IF EXISTS "assignments_write_policy" ON public.employee_assignments;
CREATE POLICY "assignments_write_policy" ON public.employee_assignments
  FOR ALL TO authenticated
  USING (
    tenant_id = public.auth_tenant_id() 
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id() 
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  );

-- 11.7 ASSIGNMENT BLOCKS POLICIES
DROP POLICY IF EXISTS "assignment_blocks_read_policy" ON public.employee_assignment_blocks;
CREATE POLICY "assignment_blocks_read_policy" ON public.employee_assignment_blocks
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());

DROP POLICY IF EXISTS "assignment_blocks_write_policy" ON public.employee_assignment_blocks;
CREATE POLICY "assignment_blocks_write_policy" ON public.employee_assignment_blocks
  FOR ALL TO authenticated
  USING (
    tenant_id = public.auth_tenant_id() 
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id() 
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  );

-- ------------------------------------------------------------------------------
-- 12. CONVENIENCE VIEW: CURRENT ACTIVE EMPLOYEE RESPONSIBILITY MAPPING
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_current_employee_assignments AS
SELECT 
    e.id AS employee_id,
    e.tenant_id,
    e.staff_no,
    e.full_name,
    e.employment_status,
    pos.code AS position_code,
    pos.title AS position_title,
    ea.id AS assignment_id,
    ea.company_id,
    c.name AS company_name,
    ea.estate_id,
    est.name AS estate_name,
    ea.division_id,
    div.name AS division_name,
    ea.assignment_role,
    ea.effective_from,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'block_id', b.id,
          'block_code', b.block_code,
          'hectarage', b.hectarage
        )
      ) FILTER (WHERE b.id IS NOT NULL), 
      '[]'::jsonb
    ) AS assigned_blocks
FROM public.employees e
JOIN public.org_positions pos ON e.position_id = pos.id
LEFT JOIN public.employee_assignments ea ON e.id = ea.employee_id 
    AND ea.status = 'ACTIVE' 
    AND (ea.effective_to IS NULL OR ea.effective_to >= CURRENT_DATE)
LEFT JOIN public.companies c ON ea.company_id = c.id
LEFT JOIN public.org_estates est ON ea.estate_id = est.id
LEFT JOIN public.org_divisions div ON ea.division_id = div.id
LEFT JOIN public.employee_assignment_blocks eab ON ea.id = eab.assignment_id
LEFT JOIN public.org_blocks b ON eab.block_id = b.id
GROUP BY 
    e.id, e.tenant_id, e.staff_no, e.full_name, e.employment_status, 
    pos.code, pos.title, ea.id, ea.company_id, c.name, ea.estate_id, 
    est.name, ea.division_id, div.name, ea.assignment_role, ea.effective_from;

COMMIT;
