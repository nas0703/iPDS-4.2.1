-- ==============================================================================
-- MIGRATION: 20260923_p0_16c_device_credentials.sql
-- PURPOSE: P0-16C.1 — cryptographic device credential foundation.
--
-- Adds the minimum schema needed to store a SHA-256 HASH of a server-issued,
-- high-entropy device credential. The plaintext credential is NEVER stored.
--
-- IMPORTANT:
--   * `device_id` remains a NON-SECRET display identifier (unchanged).
--   * `credential_hash` is the only credential material persisted.
--   * This phase does NOT enforce credentials at login (that is P0-16C.3) and
--     does NOT retro-issue credentials for existing devices (P0-16C.5).
--
-- SAFETY:
--   * Forward-only. Affects ONLY public.registered_devices.
--   * Additive + idempotent (ADD COLUMN IF NOT EXISTS / CREATE UNIQUE INDEX
--     IF NOT EXISTS). No INSERT/UPDATE/DELETE, no data or approval changes.
--   * Existing rows remain valid: credential_hash is NULL and the partial unique
--     index ignores NULLs, so APPROVED/PENDING/REVOKED rows are unaffected.
--   * No RLS / grant / policy changes: still service_role-only + FORCE RLS.
-- ==============================================================================

BEGIN;

ALTER TABLE public.registered_devices
    ADD COLUMN IF NOT EXISTS credential_hash TEXT,
    ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS credential_rotated_at TIMESTAMPTZ;

-- Partial unique index: enforces uniqueness of issued credential hashes while
-- allowing any number of existing rows with credential_hash IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_registered_devices_credential_hash
    ON public.registered_devices (credential_hash)
    WHERE credential_hash IS NOT NULL;

COMMIT;
