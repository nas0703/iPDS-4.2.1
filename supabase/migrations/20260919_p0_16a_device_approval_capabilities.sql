-- ==============================================================================
-- MIGRATION: 20260919_p0_16a_device_approval_capabilities.sql
-- PURPOSE: P0-16A — one-time, short-lived approval capabilities for the FC
--          WhatsApp device-approval link.
--
-- The raw capability is NEVER stored. Only its SHA-256 hash is persisted.
-- A capability is bound to exactly one device_id + estate_id and is consumed
-- atomically (single-use) with a 10–15 minute expiry.
--
-- Access is restricted to the privileged server (service_role) only. This does
-- not weaken requireAuth/requireDeviceAdmin for the management endpoints.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.device_approval_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    estate_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_approval_capabilities_hash
    ON public.device_approval_capabilities (token_hash);

ALTER TABLE public.device_approval_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_approval_capabilities FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.device_approval_capabilities FROM PUBLIC;
REVOKE ALL ON public.device_approval_capabilities FROM anon;
REVOKE ALL ON public.device_approval_capabilities FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_approval_capabilities TO service_role;

DROP POLICY IF EXISTS device_approval_capabilities_service_role_policy ON public.device_approval_capabilities;
CREATE POLICY device_approval_capabilities_service_role_policy ON public.device_approval_capabilities
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.device_approval_capabilities IS
'P0-16A one-time FC device-approval capabilities. Stores only the SHA-256 hash; single-use, short-lived, bound to one device+estate. service_role only.';

COMMIT;
