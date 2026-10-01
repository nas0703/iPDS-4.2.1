-- ==============================================================================
-- MIGRATION: 20261007_org_blocks_master_data_seed.sql
-- PURPOSE: P6A-1 — establish the public.org_blocks master-data foundation.
--
-- WHY: public.employee_assignment_blocks.block_id is
--      UUID NOT NULL REFERENCES public.org_blocks(id) (20260915:238), but
--      public.org_blocks had NO data source anywhere in the repository. The
--      block catalogue the UI offers comes from the client-side registry
--      src/config/estateRegistry.ts, so block persistence (Phase 6B) has nothing
--      to validate against until this table is populated.
--
-- PROVENANCE (no fabricated values):
--   Every row below is transcribed from src/config/estateRegistry.ts
--   (ESTATES_REGISTRY[estate].blocks) — the existing client-side SSOT. The
--   block_code uses the client's own derivation,
--   `'B' || padStart(blok, 2, '0')` (employeeMasterService.getBlocksForEstate),
--   which is exactly what CreateEmployeeModal submits as block_ids.
--   hectarage = round(luas, 2) to fit NUMERIC(10,2).
--
-- FIELD CLASSIFICATION (public.org_blocks, 20260915:108-123):
--   id            -> deterministically derivable: md5(namespace||estate||code)::uuid
--   tenant_id     -> directly available: the single seeded tenant (20260915:68)
--   estate_id     -> directly available: registry estate key, present in org_estates
--   block_code    -> deterministically derivable: client derivation above
--   hectarage     -> directly available: registry `luas`
--   is_active     -> NOT populated; column DEFAULT TRUE applies (not asserted)
--   crop_type     -> NOT populated; column DEFAULT 'OIL_PALM' applies.
--                    The registry has no crop data -> value not asserted.
--   planting_year -> NOT populated (NULL). The registry has NO planting-year
--                    data; the client's `pkt === '001' ? 2012 : 2018` is a
--                    frontend guess and is deliberately NOT copied here.
--   division_id   -> NOT populated (NULL). public.org_divisions has NO seed in
--                    any migration (only the legacy
--                    scripts/apply_employee_schema.ts:42 seeds it), and the
--                    client pkt->division mapping is lossy (pkts 003/004 all
--                    collapse to the "P2" division). Reporting as a gap rather
--                    than inventing a value.
--
-- COVERAGE: only the two estates that actually have registry blocks are seeded
--   (FPM_TUNGGAL 23, FPM_ADELA 22 = 45 rows). FPM_KLEDANG, FPM_SENING and
--   WILAYAH_JB have ZERO blocks in the registry, so nothing is invented for them.
--
-- IDENTITY: `md5('ipds:org_block:v1:' || estate_id || ':' || block_code)::uuid`
--   — deterministic and reproducible across environments, no extension required
--   (pg_catalog.md5 + uuid input accepts the 32-hex form). On conflict the
--   existing row's id is preserved, so re-running never duplicates or churns ids.
--
-- IDEMPOTENCY: ON CONFLICT on the existing natural key
--   uq_org_blocks_estate_code UNIQUE (estate_id, block_code) (20260915:122).
--
-- NOT CHANGED: org_blocks schema, its indexes, its RLS policies
--   (blocks_read_policy / blocks_write_policy, 20260915:387-397), FORCE RLS
--   (20260917:54), employee_assignment_blocks, employee_assignments and
--   create_employee_with_assignment(). No policy, grant or table is altered.
--
-- NO ROLLBACK FILE: deliberately omitted. Seeded blocks are referenced by
--   employee_assignment_blocks.block_id ON DELETE RESTRICT, so an automated
--   DELETE rollback could fail or destroy referenced master data. Removing
--   seeded blocks must be a reviewed, manual operation.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PREFLIGHT: the referenced estates must exist (org_blocks.estate_id FK is
--    NOT NULL REFERENCES public.org_estates(id)). Fail with a clear message
--    rather than an opaque FK violation.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(e, ', ') INTO v_missing
  FROM unnest(ARRAY['FPM_TUNGGAL', 'FPM_ADELA']) AS e
  WHERE NOT EXISTS (SELECT 1 FROM public.org_estates s WHERE s.id = e);

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'ORG_BLOCKS_SEED_PRECONDITION_FAILED: missing public.org_estates rows: %',
      v_missing
      USING ERRCODE = '42501';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. SEED: deterministic ids, values transcribed from estateRegistry.ts
-- ------------------------------------------------------------------------------
WITH seed(estate_id, block_code, hectarage) AS (
  VALUES
    -- FPM_TUNGGAL (23 blocks)
    ('FPM_TUNGGAL', 'B01', 72.15),
    ('FPM_TUNGGAL', 'B02', 68.37),
    ('FPM_TUNGGAL', 'B03', 76.59),
    ('FPM_TUNGGAL', 'B04', 92.39),
    ('FPM_TUNGGAL', 'B05', 60.19),
    ('FPM_TUNGGAL', 'B06', 80.42),
    ('FPM_TUNGGAL', 'B07', 89.46),
    ('FPM_TUNGGAL', 'B08', 82.03),
    ('FPM_TUNGGAL', 'B09', 83.61),
    ('FPM_TUNGGAL', 'B10', 84.36),
    ('FPM_TUNGGAL', 'B11', 47.85),
    ('FPM_TUNGGAL', 'B12', 76.50),
    ('FPM_TUNGGAL', 'B13', 50.75),
    ('FPM_TUNGGAL', 'B14', 70.44),
    ('FPM_TUNGGAL', 'B15', 68.36),
    ('FPM_TUNGGAL', 'B16', 64.44),
    ('FPM_TUNGGAL', 'B17', 84.08),
    ('FPM_TUNGGAL', 'B18', 76.20),
    ('FPM_TUNGGAL', 'B19', 81.75),
    ('FPM_TUNGGAL', 'B20', 68.62),
    ('FPM_TUNGGAL', 'B21', 24.26),
    ('FPM_TUNGGAL', 'B22', 65.29),
    ('FPM_TUNGGAL', 'B88', 98.51),
    -- FPM_ADELA (22 blocks; includes non-numeric registry labels 1F/2F/125Y/128Y/121V)
    ('FPM_ADELA', 'B01', 30.46),
    ('FPM_ADELA', 'B02', 58.07),
    ('FPM_ADELA', 'B03', 45.91),
    ('FPM_ADELA', 'B04', 57.89),
    ('FPM_ADELA', 'B05', 60.05),
    ('FPM_ADELA', 'B06', 64.64),
    ('FPM_ADELA', 'B07', 68.17),
    ('FPM_ADELA', 'B08', 77.53),
    ('FPM_ADELA', 'B09', 64.04),
    ('FPM_ADELA', 'B10', 63.01),
    ('FPM_ADELA', 'B11', 23.87),
    ('FPM_ADELA', 'B12', 59.93),
    ('FPM_ADELA', 'B13', 60.47),
    ('FPM_ADELA', 'B14', 40.40),
    ('FPM_ADELA', 'B15', 48.41),
    ('FPM_ADELA', 'B16', 67.76),
    ('FPM_ADELA', 'B17', 56.45),
    ('FPM_ADELA', 'B1F', 39.81),
    ('FPM_ADELA', 'B2F', 38.23),
    ('FPM_ADELA', 'B125Y', 8.06),
    ('FPM_ADELA', 'B128Y', 4.08),
    ('FPM_ADELA', 'B121V', 4.02)
)
INSERT INTO public.org_blocks (id, tenant_id, estate_id, block_code, hectarage, created_by)
SELECT
  md5('ipds:org_block:v1:' || s.estate_id || ':' || s.block_code)::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  s.estate_id,
  s.block_code,
  s.hectarage,
  'migration:20261007_org_blocks_master_data_seed'
FROM seed s
ON CONFLICT (estate_id, block_code) DO UPDATE
  SET hectarage = EXCLUDED.hectarage,
      updated_at = NOW();

-- ------------------------------------------------------------------------------
-- 3. POST-CHECK: coverage must be present after the seed.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_tunggal integer;
  v_adela   integer;
BEGIN
  SELECT count(*) INTO v_tunggal FROM public.org_blocks WHERE estate_id = 'FPM_TUNGGAL';
  SELECT count(*) INTO v_adela   FROM public.org_blocks WHERE estate_id = 'FPM_ADELA';

  IF v_tunggal < 23 OR v_adela < 22 THEN
    RAISE EXCEPTION
      'ORG_BLOCKS_SEED_VERIFICATION_FAILED: expected >= 23/22 org_blocks rows for FPM_TUNGGAL/FPM_ADELA but found %/%',
      v_tunggal, v_adela
      USING ERRCODE = '42501';
  END IF;
END $$;

COMMIT;
