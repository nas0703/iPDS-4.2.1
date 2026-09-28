-- ==============================================================================
-- IPDS ENTERPRISE MULTI-TENANT & ROW LEVEL SECURITY (RLS) BLUEPRINT
-- Standard: Enterprise-Grade Oil Palm Plantation IAM (FPMSB 2026 Topology)
-- Status: PROPOSED — NOT EXECUTED (ON HOLD PENDING EXECUTION COMMAND)
-- Architecture: Dual-API Hybrid Architecture (Legacy Compatibility + RLS Engine)
-- Fallback Rule: Unauthenticated / Legacy JWTs fallback seamlessly to 'FPM_TUNGGAL'
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BOOTSTRAP SECURITY TABLE (ANTI-RECURSION FOR SUPER ADMIN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_super_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_super_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_self_read" ON public.system_super_admins
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- SINGLE SOURCE is_super_admin FUNCTION (TABLE-BASED, ZERO RECURSION)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.system_super_admins
        WHERE user_id = auth.uid()
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. LOCATION STRUCTURE TOPOLOGY (3NF NORMALIZED - NO REDUNDANT KEYS)
-- ------------------------------------------------------------------------------

-- Level 2: Macro Zone (HQ Zonal Controllers)
CREATE TABLE IF NOT EXISTS public.org_macro_zones (
    id VARCHAR(50) PRIMARY KEY, -- 'MACRO_ZONE_SELATAN', 'MACRO_ZONE_TIMUR', 'MACRO_ZONE_UTARA'
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level 3: Region (10 Regional Controllers)
CREATE TABLE IF NOT EXISTS public.org_regions (
    id VARCHAR(50) PRIMARY KEY, -- 'REG_JOHOR_BAHRU', 'REG_SEGAMAT', etc.
    macro_zone_id VARCHAR(50) NOT NULL REFERENCES public.org_macro_zones(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level 4: Operational Zone / Cluster (Operation Controllers - OC)
CREATE TABLE IF NOT EXISTS public.org_op_zones (
    id VARCHAR(50) PRIMARY KEY, -- 'OP_ZONE_ADELA', 'OP_ZONE_TAIB_ANDAK', etc.
    region_id VARCHAR(50) NOT NULL REFERENCES public.org_regions(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level 5: Estate / Ladang (Estate Managers & Field Staff)
-- NOTE: region_id is fully removed to maintain Single Source of Truth via op_zone_id
CREATE TABLE IF NOT EXISTS public.org_estates (
    id VARCHAR(50) PRIMARY KEY, -- 'FPM_ADELA', 'FPM_KLEDANG', 'FPM_SENING', 'FPM_TUNGGAL'
    op_zone_id VARCHAR(50) NOT NULL REFERENCES public.org_op_zones(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    total_area_ha NUMERIC(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level 6: Division / Bahagian (Field Mandores & Workers)
CREATE TABLE IF NOT EXISTS public.org_divisions (
    id VARCHAR(50) PRIMARY KEY, -- 'FPM_ADELA_DIV1'
    estate_id VARCHAR(50) NOT NULL REFERENCES public.org_estates(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROTECT MASTER HIERARCHY TABLES (READ-ONLY FOR REGULAR AUTHENTICATED USERS)
ALTER TABLE public.org_macro_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_op_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_estates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_macro_zones_read" ON public.org_macro_zones
FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "org_regions_read" ON public.org_regions
FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "org_op_zones_read" ON public.org_op_zones
FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "org_estates_read" ON public.org_estates
FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "org_divisions_read" ON public.org_divisions
FOR SELECT TO authenticated USING (TRUE);

-- ------------------------------------------------------------------------------
-- 3. PERMISSION MATRIX (WHAT ACTIONS CAN A ROLE EXECUTE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,    -- 'WEIGHBRIDGE', 'HUJAN', 'FERTILIZER', 'MERUMPUT', 'PEKERJA', 'SETTINGS', 'REPORTS'
    can_read BOOLEAN DEFAULT FALSE,
    can_write BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (role, module)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_read_all" ON public.role_permissions
FOR SELECT TO authenticated
USING (TRUE);

-- ------------------------------------------------------------------------------
-- 4. USER ROLE ASSIGNMENTS (WHERE CAN YOU DO IT - DECOUPLED IAM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    scope_type VARCHAR(20) NOT NULL CHECK (
        scope_type IN (
            'ORGANIZATION',
            'MACRO_ZONE',
            'REGION',
            'OP_ZONE',
            'ESTATE',
            'DIVISION'
        )
    ),
    scope_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role, scope_type, scope_id)
);

ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

-- ANTI-SELF ESCALATION POLICIES (PROTECTED FROM UNAUTHORIZED MODIFICATIONS)
CREATE POLICY "ura_select_policy" ON public.user_role_assignments
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_super_admin()
);

CREATE POLICY "ura_insert_policy" ON public.user_role_assignments
FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "ura_update_policy" ON public.user_role_assignments
FOR UPDATE TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "ura_delete_policy" ON public.user_role_assignments
FOR DELETE TO authenticated
USING (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 5. INTEGRITY VALIDATORS (TRIGGERS FOR ROLE & POLYMORPHIC SCOPE)
-- ------------------------------------------------------------------------------

-- Validator 1: Strict Role <-> Scope Type Compatibility (With Reject Catch-All ELSE)
CREATE OR REPLACE FUNCTION public.validate_role_scope_compatibility()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role IN ('SUPER_ADMIN', 'EXECUTIVE_HQ') THEN
        IF NEW.scope_type != 'ORGANIZATION' THEN
            RAISE EXCEPTION 'Role % hanya sah dengan scope_type ORGANIZATION', NEW.role;
        END IF;

    ELSIF NEW.role = 'ZONAL_CONTROLLER' THEN
        IF NEW.scope_type != 'MACRO_ZONE' THEN
            RAISE EXCEPTION 'Role ZONAL_CONTROLLER hanya sah dengan scope_type MACRO_ZONE';
        END IF;

    ELSIF NEW.role = 'REGIONAL_CONTROLLER' THEN
        IF NEW.scope_type != 'REGION' THEN
            RAISE EXCEPTION 'Role REGIONAL_CONTROLLER hanya sah dengan scope_type REGION';
        END IF;

    ELSIF NEW.role = 'OPERATION_CONTROLLER' THEN
        IF NEW.scope_type != 'OP_ZONE' THEN
            RAISE EXCEPTION 'Role OPERATION_CONTROLLER hanya sah dengan scope_type OP_ZONE';
        END IF;

    ELSIF NEW.role IN ('ESTATE_MANAGER', 'ASSISTANT_MANAGER', 'WEIGHBRIDGE_CLERK') THEN
        IF NEW.scope_type != 'ESTATE' THEN
            RAISE EXCEPTION 'Role % hanya sah dengan scope_type ESTATE', NEW.role;
        END IF;

    ELSIF NEW.role = 'FIELD_MANDORE' THEN
        IF NEW.scope_type NOT IN ('DIVISION', 'ESTATE') THEN
            RAISE EXCEPTION 'Role FIELD_MANDORE hanya sah dengan scope_type DIVISION atau ESTATE';
        END IF;

    ELSE
        RAISE EXCEPTION 'Ralat Keselamatan: Role "%" tidak sah atau tidak wujud dalam sistem!', NEW.role;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_role_scope ON public.user_role_assignments;
CREATE TRIGGER trg_validate_role_scope
BEFORE INSERT OR UPDATE ON public.user_role_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_role_scope_compatibility();

-- Validator 2: Polymorphic Scope ID Physical Existence Check
CREATE OR REPLACE FUNCTION public.validate_polymorphic_scope_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.scope_type = 'ORGANIZATION' THEN
        IF NEW.scope_id != 'FPMSB' THEN
            RAISE EXCEPTION 'scope_id "%" tidak sah untuk ORGANIZATION FPMSB', NEW.scope_id;
        END IF;
    ELSIF NEW.scope_type = 'MACRO_ZONE' THEN
        IF NOT EXISTS (SELECT 1 FROM public.org_macro_zones WHERE id = NEW.scope_id) THEN
            RAISE EXCEPTION 'MACRO_ZONE ID "%" tidak wujud dalam master data', NEW.scope_id;
        END IF;
    ELSIF NEW.scope_type = 'REGION' THEN
        IF NOT EXISTS (SELECT 1 FROM public.org_regions WHERE id = NEW.scope_id) THEN
            RAISE EXCEPTION 'REGION ID "%" tidak wujud dalam master data', NEW.scope_id;
        END IF;
    ELSIF NEW.scope_type = 'OP_ZONE' THEN
        IF NOT EXISTS (SELECT 1 FROM public.org_op_zones WHERE id = NEW.scope_id) THEN
            RAISE EXCEPTION 'OP_ZONE ID "%" tidak wujud dalam master data', NEW.scope_id;
        END IF;
    ELSIF NEW.scope_type = 'ESTATE' THEN
        IF NOT EXISTS (SELECT 1 FROM public.org_estates WHERE id = NEW.scope_id) THEN
            RAISE EXCEPTION 'ESTATE ID "%" tidak wujud dalam master data', NEW.scope_id;
        END IF;
    ELSIF NEW.scope_type = 'DIVISION' THEN
        IF NOT EXISTS (SELECT 1 FROM public.org_divisions WHERE id = NEW.scope_id) THEN
            RAISE EXCEPTION 'DIVISION ID "%" tidak wujud dalam master data', NEW.scope_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_polymorphic_scope ON public.user_role_assignments;
CREATE TRIGGER trg_validate_polymorphic_scope
BEFORE INSERT OR UPDATE ON public.user_role_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_polymorphic_scope_id();

-- ------------------------------------------------------------------------------
-- 6. FULL HIERARCHY ACCESS CHECK FUNCTIONS (SECURITY DEFINER + SEARCH_PATH)
-- ------------------------------------------------------------------------------

-- Action Permission Validator
CREATE OR REPLACE FUNCTION public.has_module_permission(
    target_module VARCHAR,
    action_type VARCHAR -- 'READ', 'WRITE', 'DELETE', 'APPROVE'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF public.is_super_admin() THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM public.user_role_assignments ura
        JOIN public.role_permissions rp ON rp.role = ura.role
        WHERE ura.user_id = auth.uid()
        AND rp.module = target_module
        AND (
            (action_type = 'READ' AND rp.can_read = TRUE)
            OR (action_type = 'WRITE' AND rp.can_write = TRUE)
            OR (action_type = 'DELETE' AND rp.can_delete = TRUE)
            OR (action_type = 'APPROVE' AND rp.can_approve = TRUE)
        )
    );
END;
$$;

-- Estate Traversal Access Validator
CREATE OR REPLACE FUNCTION public.check_user_estate_access(target_estate_id VARCHAR)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF public.is_super_admin() THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM public.org_estates e
        JOIN public.org_op_zones oz ON oz.id = e.op_zone_id
        JOIN public.org_regions r ON r.id = oz.region_id
        JOIN public.org_macro_zones mz ON mz.id = r.macro_zone_id
        JOIN public.user_role_assignments ura ON ura.user_id = auth.uid()
        WHERE e.id = target_estate_id
        AND (
            (ura.scope_type = 'ORGANIZATION' AND ura.scope_id = 'FPMSB')
            OR (ura.scope_type = 'MACRO_ZONE' AND ura.scope_id = mz.id)
            OR (ura.scope_type = 'REGION' AND ura.scope_id = r.id)
            OR (ura.scope_type = 'OP_ZONE' AND ura.scope_id = oz.id)
            OR (ura.scope_type = 'ESTATE' AND ura.scope_id = target_estate_id)
        )
    );
END;
$$;

-- Division Traversal Access Validator
CREATE OR REPLACE FUNCTION public.check_user_division_access(target_division_id VARCHAR)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF public.is_super_admin() THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM public.org_divisions d
        JOIN public.org_estates e ON e.id = d.estate_id
        JOIN public.org_op_zones oz ON oz.id = e.op_zone_id
        JOIN public.org_regions r ON r.id = oz.region_id
        JOIN public.org_macro_zones mz ON mz.id = r.macro_zone_id
        JOIN public.user_role_assignments ura ON ura.user_id = auth.uid()
        WHERE d.id = target_division_id
        AND (
            (ura.scope_type = 'ORGANIZATION' AND ura.scope_id = 'FPMSB')
            OR (ura.scope_type = 'MACRO_ZONE' AND ura.scope_id = mz.id)
            OR (ura.scope_type = 'REGION' AND ura.scope_id = r.id)
            OR (ura.scope_type = 'OP_ZONE' AND ura.scope_id = oz.id)
            OR (ura.scope_type = 'ESTATE' AND ura.scope_id = e.id)
            OR (ura.scope_type = 'DIVISION' AND ura.scope_id = target_division_id)
        )
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. SEED MASTER DATA (FPMSB 2026 ORGANIZATIONAL BASELINE)
-- ------------------------------------------------------------------------------

-- Seed 3 Macro Zones
INSERT INTO public.org_macro_zones (id, name) VALUES
('MACRO_ZONE_SELATAN', 'Zon Selatan (Pengawal Perladangan Zon Selatan)'),
('MACRO_ZONE_TIMUR', 'Zon Timur (Pengawal Perladangan Zon Timur)'),
('MACRO_ZONE_UTARA', 'Zon Utara (Pengawal Perladangan Zon Utara)')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed Exactly 10 Regions
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

-- Seed 5 Operational Zones in Wilayah Johor Bahru
INSERT INTO public.org_op_zones (id, region_id, name) VALUES
('OP_ZONE_TAIB_ANDAK', 'REG_JOHOR_BAHRU', 'Zon Taib Andak'),
('OP_ZONE_SEPAKAT', 'REG_JOHOR_BAHRU', 'Zon Sepakat'),
('OP_ZONE_ADELA', 'REG_JOHOR_BAHRU', 'Zon Adela'),
('OP_ZONE_LAW', 'REG_JOHOR_BAHRU', 'Zon Law'),
('OP_ZONE_TENGGAROH', 'REG_JOHOR_BAHRU', 'Zon Tenggaroh')
ON CONFLICT (id) DO UPDATE SET region_id = EXCLUDED.region_id, name = EXCLUDED.name;

-- Seed Active Baseline Estates (Under OP_ZONE_ADELA)
INSERT INTO public.org_estates (id, op_zone_id, name, total_area_ha) VALUES
('FPM_ADELA', 'OP_ZONE_ADELA', 'Ladang FPM Adela', 2145.50),
('FPM_KLEDANG', 'OP_ZONE_ADELA', 'Ladang FPM Kledang', 1890.20),
('FPM_SENING', 'OP_ZONE_ADELA', 'Ladang FPM Sening', 2015.00),
('FPM_TUNGGAL', 'OP_ZONE_ADELA', 'Ladang FPM Tunggal', 2340.80)
ON CONFLICT (id) DO UPDATE SET op_zone_id = EXCLUDED.op_zone_id, name = EXCLUDED.name;

-- Seed Core Role Permissions
INSERT INTO public.role_permissions (role, module, can_read, can_write, can_delete, can_approve) VALUES
-- SUPER_ADMIN & EXECUTIVE_HQ
('SUPER_ADMIN', 'WEIGHBRIDGE', TRUE, TRUE, TRUE, TRUE),
('SUPER_ADMIN', 'HUJAN', TRUE, TRUE, TRUE, TRUE),
('SUPER_ADMIN', 'FERTILIZER', TRUE, TRUE, TRUE, TRUE),
('SUPER_ADMIN', 'MERUMPUT', TRUE, TRUE, TRUE, TRUE),
('SUPER_ADMIN', 'PEKERJA', TRUE, TRUE, TRUE, TRUE),
('SUPER_ADMIN', 'SETTINGS', TRUE, TRUE, TRUE, TRUE),
('EXECUTIVE_HQ', 'WEIGHBRIDGE', TRUE, FALSE, FALSE, FALSE),
('EXECUTIVE_HQ', 'HUJAN', TRUE, FALSE, FALSE, FALSE),
('EXECUTIVE_HQ', 'FERTILIZER', TRUE, FALSE, FALSE, FALSE),
('EXECUTIVE_HQ', 'MERUMPUT', TRUE, FALSE, FALSE, FALSE),
('EXECUTIVE_HQ', 'PEKERJA', TRUE, FALSE, FALSE, FALSE),
-- CONTROLLERS
('ZONAL_CONTROLLER', 'WEIGHBRIDGE', TRUE, FALSE, FALSE, TRUE),
('ZONAL_CONTROLLER', 'HUJAN', TRUE, FALSE, FALSE, TRUE),
('ZONAL_CONTROLLER', 'FERTILIZER', TRUE, FALSE, FALSE, TRUE),
('ZONAL_CONTROLLER', 'MERUMPUT', TRUE, FALSE, FALSE, TRUE),
('REGIONAL_CONTROLLER', 'WEIGHBRIDGE', TRUE, FALSE, FALSE, TRUE),
('REGIONAL_CONTROLLER', 'HUJAN', TRUE, FALSE, FALSE, TRUE),
('REGIONAL_CONTROLLER', 'FERTILIZER', TRUE, FALSE, FALSE, TRUE),
('REGIONAL_CONTROLLER', 'MERUMPUT', TRUE, FALSE, FALSE, TRUE),
('OPERATION_CONTROLLER', 'WEIGHBRIDGE', TRUE, FALSE, FALSE, TRUE),
('OPERATION_CONTROLLER', 'HUJAN', TRUE, FALSE, FALSE, TRUE),
('OPERATION_CONTROLLER', 'FERTILIZER', TRUE, FALSE, FALSE, TRUE),
('OPERATION_CONTROLLER', 'MERUMPUT', TRUE, FALSE, FALSE, TRUE),
-- ESTATE MANAGERS & CLERKS
('ESTATE_MANAGER', 'WEIGHBRIDGE', TRUE, TRUE, FALSE, TRUE),
('ESTATE_MANAGER', 'HUJAN', TRUE, TRUE, FALSE, TRUE),
('ESTATE_MANAGER', 'FERTILIZER', TRUE, TRUE, TRUE, TRUE),
('ESTATE_MANAGER', 'MERUMPUT', TRUE, TRUE, TRUE, TRUE),
('ESTATE_MANAGER', 'PEKERJA', TRUE, TRUE, TRUE, TRUE),
('WEIGHBRIDGE_CLERK', 'WEIGHBRIDGE', TRUE, TRUE, FALSE, FALSE),
('FIELD_MANDORE', 'HUJAN', TRUE, TRUE, FALSE, FALSE),
('FIELD_MANDORE', 'PEKERJA', TRUE, TRUE, FALSE, FALSE),
('FIELD_MANDORE', 'FERTILIZER', TRUE, TRUE, FALSE, FALSE),
('FIELD_MANDORE', 'MERUMPUT', TRUE, TRUE, FALSE, FALSE)
ON CONFLICT (role, module) DO UPDATE SET 
    can_read = EXCLUDED.can_read,
    can_write = EXCLUDED.can_write,
    can_delete = EXCLUDED.can_delete,
    can_approve = EXCLUDED.can_approve;
