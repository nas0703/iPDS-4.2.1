-- ==============================================================================
-- MIGRATION: 20260920_p0_16b_device_approval_requester_context.sql
-- PURPOSE: P0-16B — store the requester identity context server-side so the FC
--          approval page can show WHO is requesting approval before approving.
--
-- These columns are populated server-side from the authenticated login context
-- (verify-pin / verify-staff). They are NEVER placed in the approval URL. Only
-- the opaque capability travels in the URL; only its SHA-256 hash is stored.
--
-- This migration only extends the existing P0-16A table and does not change its
-- RLS / grants (still service_role only, FORCE RLS).
-- ==============================================================================

BEGIN;

ALTER TABLE public.device_approval_capabilities
    ADD COLUMN IF NOT EXISTS requester_name TEXT,
    ADD COLUMN IF NOT EXISTS requester_staff_id TEXT,
    ADD COLUMN IF NOT EXISTS device_name TEXT;

COMMENT ON COLUMN public.device_approval_capabilities.requester_name IS
'P0-16B requester display name (server-side only; never in the URL).';
COMMENT ON COLUMN public.device_approval_capabilities.requester_staff_id IS
'P0-16B requester staff/operator identifier (server-side only; never in the URL).';
COMMENT ON COLUMN public.device_approval_capabilities.device_name IS
'P0-16B device display name (server-side only; never in the URL).';

COMMIT;
