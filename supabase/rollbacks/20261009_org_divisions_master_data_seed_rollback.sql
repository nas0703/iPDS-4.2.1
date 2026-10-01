-- ==============================================================================
-- ROLLBACK: 20261009_org_divisions_master_data_seed_rollback.sql
-- Reverses: 20261009_org_divisions_master_data_seed.sql
--
-- Location note: kept OUTSIDE supabase/migrations/ on purpose so the Supabase
-- CLI does not auto-apply this script as a forward migration when
-- `supabase db push` runs. Apply manually only during a reviewed rollback.
--
-- WHAT THIS DOES
--   * Deletes ONLY the 8 authoritative org_divisions rows seeded by 20261009.
--
-- WHAT THIS DOES NOT DO (deliberate)
--   * Does NOT delete any other org_divisions row (none are authored here).
--   * Does NOT delete org_estates or org_blocks rows.
--
-- FAIL-CLOSED BEHAVIOUR
--   public.employee_assignments.division_id and public.org_blocks.division_id
--   both reference public.org_divisions(id) ON DELETE RESTRICT. If any seeded
--   division has been referenced by live data, the DELETE would raise a foreign
--   key violation. That is intentional: the rollback refuses to silently break
--   referential integrity. The guard below reports the offending rows up front
--   with an explicit error instead of failing with a raw FK message.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. GUARD: refuse to remove divisions that are still referenced.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_referenced text;
BEGIN
  SELECT string_agg(x.id, ', ' ORDER BY x.id) INTO v_referenced
  FROM (VALUES
    ('DIV_TGL_P1'), ('DIV_TGL_P2'), ('DIV_ADL_P1'), ('DIV_ADL_P2'),
    ('DIV_KLD_P1'), ('DIV_KLD_P2'), ('DIV_SNG_P1'), ('DIV_SNG_P2')
  ) AS x(id)
  WHERE EXISTS (SELECT 1 FROM public.employee_assignments a WHERE a.division_id = x.id)
     OR EXISTS (SELECT 1 FROM public.org_blocks b WHERE b.division_id = x.id);

  IF v_referenced IS NOT NULL THEN
    RAISE EXCEPTION
      'DIVISIONS_SEED_ROLLBACK_BLOCKED: seeded divisions are still referenced by live data (%)',
      v_referenced
      USING ERRCODE = '42501';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. DELETE the 8 seeded rows.
-- ------------------------------------------------------------------------------
DELETE FROM public.org_divisions
WHERE id IN ('DIV_TGL_P1','DIV_TGL_P2','DIV_ADL_P1','DIV_ADL_P2',
             'DIV_KLD_P1','DIV_KLD_P2','DIV_SNG_P1','DIV_SNG_P2');

COMMIT;
