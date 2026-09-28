-- ==============================================================================
-- MIGRATION: 20260925_p0_16c5_backfill_device_estate_grants.sql
-- PURPOSE: P0-16C.5 — least-privilege backfill of device_estate_access for
--          EXISTING approved devices, so strict enforcement (P0-16C.3) can later
--          be enabled without locking out current devices.
--
-- EXACT RULE (no inference):
--   registered_devices.status = 'APPROVED'
--   AND estate_id IS NOT NULL / non-blank
--   AND UPPER(TRIM(estate_id)) is one of the canonical ESTATES_REGISTRY ids
--   -> INSERT device_estate_access(device_id, estate_id, 'ACTIVE')
--
-- SAFETY:
--   * Forward-only. Requires 20260924 (device_estate_access) applied first.
--   * Idempotent: ON CONFLICT (device_id, estate_id) DO NOTHING. Existing
--     ACTIVE grants are unchanged and existing REVOKED grants are NEVER
--     reactivated.
--   * Grants ONLY the device's own recorded estate. No additional estates, no
--     grant-all, no cross-estate inference.
--   * Does NOT modify registered_devices (status/estate_id/approval untouched).
--   * Does NOT delete/modify existing device_estate_access rows.
--   * PENDING / BLOCKED / REVOKED devices receive no ACTIVE grant.
--   * Devices with NULL / blank / non-canonical (invalid or unmapped) estate_id
--     are skipped and must be reviewed manually.
--
-- Canonical ids come from src/config/estateRegistry.ts ESTATES_REGISTRY:
--   WILAYAH_JB, FPM_TUNGGAL, FPM_KLEDANG, FPM_ADELA, FPM_SENING
-- ==============================================================================

BEGIN;

INSERT INTO public.device_estate_access (device_id, estate_id, status, granted_by, granted_at)
SELECT
    rd.device_id,
    UPPER(TRIM(rd.estate_id)),
    'ACTIVE',
    'P0-16C.5_BACKFILL',
    NOW()
FROM public.registered_devices rd
WHERE rd.status = 'APPROVED'
  AND rd.estate_id IS NOT NULL
  AND TRIM(rd.estate_id) <> ''
  AND UPPER(TRIM(rd.estate_id)) IN ('FPM_TUNGGAL', 'FPM_KLEDANG', 'FPM_ADELA', 'FPM_SENING', 'WILAYAH_JB')
ON CONFLICT (device_id, estate_id) DO NOTHING;

COMMIT;
