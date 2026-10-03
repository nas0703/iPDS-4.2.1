-- ==============================================================================
-- IPDS Ver 4.2.1 — Rollback Kiosk Staff Identities Schema
-- Rollback Migration: 20261003_kiosk_identities_schema_rollback.sql
-- Description:
--   Rolls back migration 20261003_kiosk_identities_schema.sql and safely removes
--   the public.kiosk_identities table and associated triggers/indexes.
-- ==============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_kiosk_identities_audit ON public.kiosk_identities;
DROP POLICY IF EXISTS kiosk_identities_service_role_policy ON public.kiosk_identities;
DROP TABLE IF EXISTS public.kiosk_identities CASCADE;

COMMIT;
