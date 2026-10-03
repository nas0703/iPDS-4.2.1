-- ==============================================================================
-- IPDS Ver 4.2.1 — Kiosk Staff Identities Schema & RLS Lockdown
-- Migration: 20261003_kiosk_identities_schema.sql
-- Description:
--   Provisions the authoritative kiosk_identities table to store bcrypt hashes
--   (staff_no_hash) for kiosk staff login (Estate Code + Staff No).
--
-- Security Controls:
--   1. Strict Multi-Tenant isolation: Mandatory estate_id foreign key to org_estates.
--   2. Zero-Trust Access: Complete lockdown to service_role (privileged backend).
--   3. Explicit Anon & Authenticated Revocation: Prevents any direct browser/client
--      exposure of staff_no_hash values via PostgREST.
--   4. Audit Tracking: Multi-layer update trigger via update_timestamp_and_tenant_user().
-- ==============================================================================

BEGIN;

-- 0. ENSURE AUDIT TRIGGER FUNCTION EXISTS (SELF-CONTAINED)
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

-- 1. CREATE KIOSK IDENTITIES TABLE
CREATE TABLE IF NOT EXISTS public.kiosk_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id VARCHAR(64) NOT NULL,
    staff_no_hash VARCHAR(255) NOT NULL,
    app_role VARCHAR(32) NOT NULL CHECK (app_role IN (
        'staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi', 'oc', 'rc', 'superadmin',
        'kerani_kewangan', 'kerani_stok', 'kerani_resit'
    )),
    estate_id VARCHAR(50) NOT NULL REFERENCES public.org_estates(id) ON DELETE RESTRICT,
    kiosk_id VARCHAR(64) NOT NULL,
    station_name VARCHAR(255) NOT NULL,
    operator_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    CONSTRAINT uq_kiosk_identities_estate_operator UNIQUE (estate_id, operator_id)
);

-- 2. HIGH-PERFORMANCE SEARCH INDEXES
CREATE INDEX IF NOT EXISTS idx_kiosk_identities_operator_id 
    ON public.kiosk_identities (operator_id);

CREATE INDEX IF NOT EXISTS idx_kiosk_identities_estate_active 
    ON public.kiosk_identities (estate_id, is_active);

CREATE INDEX IF NOT EXISTS idx_kiosk_identities_staff_no_hash 
    ON public.kiosk_identities (staff_no_hash);

-- 3. AUDIT TRIGGER FOR UPDATES
DROP TRIGGER IF EXISTS trg_kiosk_identities_audit ON public.kiosk_identities;
CREATE TRIGGER trg_kiosk_identities_audit
    BEFORE UPDATE ON public.kiosk_identities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_timestamp_and_tenant_user();

-- 4. ROW LEVEL SECURITY (RLS) LOCKDOWN
ALTER TABLE public.kiosk_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_identities FORCE ROW LEVEL SECURITY;

-- 5. PRIVILEGE RESTRICTION: SERVICE_ROLE EXCLUSIVE ACCESS
REVOKE ALL ON public.kiosk_identities FROM PUBLIC;
REVOKE ALL ON public.kiosk_identities FROM anon;
REVOKE ALL ON public.kiosk_identities FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_identities TO service_role;

-- 6. SERVICE ROLE POLICY
DROP POLICY IF EXISTS kiosk_identities_service_role_policy ON public.kiosk_identities;
CREATE POLICY kiosk_identities_service_role_policy ON public.kiosk_identities
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.kiosk_identities IS
'Authoritative kiosk staff identities with bcrypt staff_no_hash. Service-role only (privileged backend access).';

COMMIT;
