-- ==============================================================================
-- MIGRATION: 20260918_p0_16_registered_devices.sql
-- PURPOSE: P0-16 — persist the device whitelist so approvals survive serverless
--          cold starts, and lock the table down to the privileged service_role.
--
-- CONTEXT:
--   The device-security service reads/writes public.registered_devices, but no
--   migration provisioned the table. Without it (or without a working
--   service-role client), device lookups return null and approvals are lost on
--   the next serverless instance, causing the Preview bootstrap deadlock.
--
--   This migration is additive and idempotent. It does NOT weaken device
--   approval, tenant isolation, or authentication; it only provisions the
--   backing table and restricts access to service_role (the server).
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.registered_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL UNIQUE,
    device_name TEXT,
    estate_id TEXT,
    registered_by_pin TEXT,
    operator_name TEXT,
    role TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'BLOCKED', 'REVOKED')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registered_devices_estate_status
    ON public.registered_devices (estate_id, status);

-- Row Level Security: device whitelist data is server-managed security data.
ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_devices FORCE ROW LEVEL SECURITY;

-- Privilege lockdown: only the privileged server (service_role) may access it.
REVOKE ALL ON public.registered_devices FROM PUBLIC;
REVOKE ALL ON public.registered_devices FROM anon;
REVOKE ALL ON public.registered_devices FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registered_devices TO service_role;

DROP POLICY IF EXISTS registered_devices_service_role_policy ON public.registered_devices;
CREATE POLICY registered_devices_service_role_policy ON public.registered_devices
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.registered_devices IS
'P0-16 device whitelist. Server-managed (service_role only). Approvals must persist here so they survive serverless cold starts.';

COMMIT;
