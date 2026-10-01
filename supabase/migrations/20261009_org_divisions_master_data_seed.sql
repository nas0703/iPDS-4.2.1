-- ==============================================================================
-- MIGRATION: 20261009_org_divisions_master_data_seed.sql
-- PURPOSE: Seed the authoritative public.org_divisions master data required by
--          the employee / assignment write path.
--
-- WHY THIS IS REQUIRED (live staging evidence, Phase 7 Step 1):
--   public.org_divisions was EMPTY (0 rows), while
--   public.employee_assignments.division_id is
--       FOREIGN KEY (division_id) REFERENCES public.org_divisions(id)
--       ON DELETE RESTRICT,
--   and the application route (src/server/routes/employees.routes.ts) defaults
--   p_division_id to 'DIV_TGL_P1'. Employee creation therefore fails on an FK
--   violation until these rows exist.
--
-- AUTHORITATIVE SOURCE (no invented values):
--   scripts/apply_employee_schema.ts lines 41-49 -- the repository's own database
--   provisioning script, which seeds org_divisions with exactly these 8 rows.
--   The identifiers also match the client-side SSOT
--   (src/features/pekerja/services/employeeMasterService.ts DEFAULT_DIVISIONS),
--   which is what the UI submits as division_id.
--
-- DELIBERATELY EXCLUDED:
--   'DIV_WJB_HQ' appears in the client DEFAULT_DIVISIONS for estate 'WILAYAH_JB'.
--   It is NOT seeded here because:
--     a) 'WILAYAH_JB' does not exist in public.org_estates on the target
--        database, so the estate_id FK would fail; and
--   (b) there is no authoritative op_zone_id mapping for WILAYAH_JB, so the
--        estate row cannot be created without inventing master data.
--   Seeding a division for a non-existent estate is out of scope for this phase.
--
-- IDEMPOTENCY: keyed on the primary key (id) with DO UPDATE, mirroring the
--   repository's existing seed convention in scripts/apply_employee_schema.ts
--   ("ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name"). Re-running this
--   migration is safe and converges to the same 8 rows.
--
-- SCOPE: data only. No schema, policy, grant, function or view is altered.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PRECONDITION GUARD: every referenced estate must already exist.
--    Fails closed rather than producing a partially applied seed.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(e.estate_id, ', ' ORDER BY e.estate_id) INTO v_missing
  FROM (VALUES
    ('FPM_TUNGGAL'), ('FPM_ADELA'), ('FPM_KLEDANG'), ('FPM_SENING')
  ) AS e(estate_id)
  WHERE NOT EXISTS (SELECT 1 FROM public.org_estates oe WHERE oe.id = e.estate_id);

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'DIVISIONS_SEED_PRECONDITION_FAILED: required org_estates rows are missing (%)',
      v_missing
      USING ERRCODE = '42501';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. SEED: the authoritative 8 rows (scripts/apply_employee_schema.ts:41-49).
-- ------------------------------------------------------------------------------
WITH seed(id, estate_id, name) AS (
  VALUES
    ('DIV_TGL_P1', 'FPM_TUNGGAL', 'Peringkat 1 (Blok 1 - 9)'),
    ('DIV_TGL_P2', 'FPM_TUNGGAL', 'Peringkat 2 (Blok 10 - 18)'),
    ('DIV_ADL_P1', 'FPM_ADELA',   'Peringkat 1 (Blok 1 - 11)'),
    ('DIV_ADL_P2', 'FPM_ADELA',   'Peringkat 2 (Blok 12 - 17)'),
    ('DIV_KLD_P1', 'FPM_KLEDANG', 'Peringkat 1'),
    ('DIV_KLD_P2', 'FPM_KLEDANG', 'Peringkat 2'),
    ('DIV_SNG_P1', 'FPM_SENING',  'Peringkat 1'),
    ('DIV_SNG_P2', 'FPM_SENING',  'Peringkat 2')
)
INSERT INTO public.org_divisions (id, estate_id, name)
SELECT s.id, s.estate_id, s.name FROM seed s
ON CONFLICT (id) DO UPDATE
  SET estate_id = EXCLUDED.estate_id,
      name      = EXCLUDED.name;

-- ------------------------------------------------------------------------------
-- 3. POST-CHECK GUARD: exactly 8 authoritative rows, each with the intended estate.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_count   integer;
  v_bad     text;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.org_divisions
  WHERE id IN ('DIV_TGL_P1','DIV_TGL_P2','DIV_ADL_P1','DIV_ADL_P2',
               'DIV_KLD_P1','DIV_KLD_P2','DIV_SNG_P1','DIV_SNG_P2');

  IF v_count <> 8 THEN
    RAISE EXCEPTION
      'DIVISIONS_SEED_VERIFICATION_FAILED: expected 8 authoritative org_divisions rows, found %',
      v_count
      USING ERRCODE = '42501';
  END IF;

  SELECT string_agg(d.id, ', ' ORDER BY d.id) INTO v_bad
  FROM public.org_divisions d
  WHERE d.id IN ('DIV_TGL_P1','DIV_TGL_P2','DIV_ADL_P1','DIV_ADL_P2',
                 'DIV_KLD_P1','DIV_KLD_P2','DIV_SNG_P1','DIV_SNG_P2')
    AND d.estate_id NOT IN ('FPM_TUNGGAL','FPM_ADELA','FPM_KLEDANG','FPM_SENING');

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'DIVISIONS_SEED_VERIFICATION_FAILED: unexpected estate_id on seeded rows (%)',
      v_bad
      USING ERRCODE = '42501';
  END IF;
END $$;

COMMIT;

-- ==============================================================================
-- ROLLBACK: supabase/rollbacks/20261009_org_divisions_master_data_seed_rollback.sql
-- ==============================================================================
