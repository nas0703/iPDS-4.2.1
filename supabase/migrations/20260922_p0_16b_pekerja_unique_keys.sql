-- ==============================================================================
-- MIGRATION: 20260922_p0_16b_pekerja_unique_keys.sql
-- PURPOSE: P0-16B.2 — database-native uniqueness for the Pekerja persistence
--          natural keys used by the authenticated APIs introduced in P0-16B.1.
--
-- CONTEXT:
--   P0-16B.1 added authenticated attendance/work-assignment persistence with an
--   application-level SELECT-then-UPDATE/INSERT upsert because no unique key
--   existed. A read-only duplicate inspection of the live Preview database
--   returned ZERO duplicate groups for both keys, so uniqueness can now be
--   established without touching any data.
--
-- KEYS (confirmed):
--   attendance_records (estate_id, worker_id, date)
--   work_assignments   (estate_id, worker_id, date)
--
-- SAFETY:
--   * Forward-only. Affects ONLY public.attendance_records and
--     public.work_assignments.
--   * Adds uniqueness ONLY. No INSERT/UPDATE/DELETE/TRUNCATE, no data change,
--     no automatic deduplication.
--   * No RLS / grant / policy / authentication / tenant-isolation changes.
--   * Idempotent: PostgreSQL has no "ADD CONSTRAINT IF NOT EXISTS", so the
--     deterministic CREATE UNIQUE INDEX IF NOT EXISTS form is used. A unique
--     index is a valid ON CONFLICT target for (estate_id, worker_id, date).
--   * Requires zero existing duplicates (confirmed by live inspection).
-- ==============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_estate_worker_date
    ON public.attendance_records (estate_id, worker_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_assignments_estate_worker_date
    ON public.work_assignments (estate_id, worker_id, date);

COMMIT;
