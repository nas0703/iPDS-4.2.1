-- =============================================================================
-- IPDS 4.1 - Daily Grading Task workflow
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Pre-requisite Identity & Audit Helpers (Idempotent)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_timestamp_and_user()
RETURNS TRIGGER AS $$
DECLARE
  v_jwt jsonb;
  v_user_identity text;
BEGIN
   NEW.updated_at = NOW();
   
   IF auth.jwt() IS NOT NULL THEN
     v_jwt := auth.jwt();
     v_user_identity := COALESCE(
       v_jwt ->> 'email',
       v_jwt -> 'app_metadata' ->> 'operator_id',
       v_jwt -> 'app_metadata' ->> 'kiosk_id',
       v_jwt -> 'user_metadata' ->> 'operator_id',
       v_jwt ->> 'sub'
     );
   END IF;
   
   IF v_user_identity IS NULL OR v_user_identity = '' THEN
     v_user_identity := current_user;
   END IF;
   
   NEW.updated_by := v_user_identity;
   
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.auth_estate_id()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'estate_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'estate_id', '')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.auth_app_role()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'app_role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.auth_is_cross_estate_role()
RETURNS boolean AS $$
  SELECT public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS boolean AS $$
  SELECT public.auth_app_role() IN ('superadmin', 'super_admin', 'admin')
         OR (public.auth_app_role() = 'fc' AND public.auth_estate_id() IN ('FPM_TUNGGAL', '5155'));
$$ LANGUAGE sql STABLE;

ALTER TABLE public.hantaran_hasil
  ADD COLUMN IF NOT EXISTS kpa NUMERIC(8,4);

CREATE TABLE IF NOT EXISTS public.grading_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id TEXT NOT NULL,
  task_date DATE NOT NULL,
  block TEXT NOT NULL,
  rank SMALLINT NOT NULL,
  source_window_start DATE NOT NULL,
  source_window_end DATE NOT NULL,
  cumulative_bts_muda INTEGER NOT NULL,
  source_receipt_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  grading_session_id TEXT,
  field_grade TEXT,
  field_muda_count INTEGER,
  field_lorry TEXT,
  field_resolved_at TIMESTAMPTZ,
  matched_receipt_id UUID,
  matched_no_resit TEXT,
  mill_muda INTEGER,
  mill_kpg NUMERIC(8,4),
  mill_kpa NUMERIC(8,4),
  kpg_achieved BOOLEAN,
  final_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT,
  CONSTRAINT grading_tasks_status_check
    CHECK (status IN ('OPEN', 'FIELD_RESOLVED', 'FINAL_VERIFIED')),
  CONSTRAINT grading_tasks_rank_check CHECK (rank BETWEEN 1 AND 5),
  CONSTRAINT grading_tasks_positive_evidence_check
    CHECK (cumulative_bts_muda > 0 AND source_receipt_count > 0),
  CONSTRAINT grading_tasks_window_check
    CHECK (
      source_window_start = task_date - 7
      AND source_window_end = task_date - 1
    ),
  CONSTRAINT grading_tasks_field_state_check
    CHECK (
      status = 'OPEN'
      OR (
        grading_session_id IS NOT NULL
        AND field_grade IS NOT NULL
        AND field_muda_count IS NOT NULL
        AND field_lorry IS NOT NULL
        AND field_resolved_at IS NOT NULL
      )
    ),
  CONSTRAINT grading_tasks_final_state_check
    CHECK (
      status <> 'FINAL_VERIFIED'
      OR (
        matched_receipt_id IS NOT NULL
        AND matched_no_resit IS NOT NULL
        AND mill_muda IS NOT NULL
        AND mill_kpg IS NOT NULL
        AND mill_kpa IS NOT NULL
        AND kpg_achieved IS TRUE
        AND final_verified_at IS NOT NULL
      )
    ),
  CONSTRAINT grading_tasks_session_fk
    FOREIGN KEY (grading_session_id)
    REFERENCES public.penggredan_rekod(id)
    ON DELETE RESTRICT,
  CONSTRAINT grading_tasks_receipt_fk
    FOREIGN KEY (matched_receipt_id)
    REFERENCES public.hantaran_hasil(id)
    ON DELETE RESTRICT
);

ALTER TABLE public.penggredan_rekod
  ADD COLUMN IF NOT EXISTS grading_task_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'penggredan_rekod_grading_task_fk'
      AND conrelid = 'public.penggredan_rekod'::regclass
  ) THEN
    ALTER TABLE public.penggredan_rekod
      ADD CONSTRAINT penggredan_rekod_grading_task_fk
      FOREIGN KEY (grading_task_id)
      REFERENCES public.grading_tasks(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_grading_tasks_estate_date_block
  ON public.grading_tasks (estate_id, task_date, block);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grading_tasks_grading_session
  ON public.grading_tasks (grading_session_id)
  WHERE grading_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_grading_tasks_matched_receipt
  ON public.grading_tasks (matched_receipt_id)
  WHERE matched_receipt_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_penggredan_rekod_grading_task
  ON public.penggredan_rekod (grading_task_id)
  WHERE grading_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_grading_tasks_estate_date_status
  ON public.grading_tasks (estate_id, task_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_grading_tasks_estate_block_status
  ON public.grading_tasks (estate_id, block, status);

CREATE INDEX IF NOT EXISTS idx_hantaran_hasil_grading_match
  ON public.hantaran_hasil (estate_id, tarikh, blok, no_lori);

CREATE OR REPLACE FUNCTION public.normalize_grading_block_identity(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_value TEXT := upper(btrim(coalesce(p_value, '')));
  v_match TEXT;
BEGIN
  IF v_value = '' THEN
    RETURN '';
  END IF;

  IF v_value ~ '^[0-9]{2}/[0-9]{1,3}[A-Z]?$' THEN
    v_value := split_part(v_value, '/', 2);
  ELSIF v_value ~ '^P(KT)?[ ]*[12][ :-]+[0-9]{1,3}[A-Z]?$' THEN
    v_value := regexp_replace(v_value, '^P(KT)?[ ]*[12][ :-]+', '');
  ELSIF v_value IN ('LF', 'LF PKT 1', 'LF PKT 2', 'LOT FELDA', '88 F', 'F88') THEN
    RETURN '88F';
  ELSE
    v_match := substring(v_value FROM '^(?:BLOK|BLOCK|B)[ :-]*([0-9]{1,3}[A-Z]?)$');
    IF v_match IS NOT NULL THEN
      v_value := v_match;
    END IF;
  END IF;

  IF v_value ~ '^[0-9]+$' THEN
    RETURN (v_value::INTEGER)::TEXT;
  END IF;

  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_grading_lorry(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT regexp_replace(upper(btrim(coalesce(p_value, ''))), '[^A-Z0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.enforce_grading_task_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_mode TEXT := current_setting('ipds.grading_task_transition', true);
BEGIN
  IF v_mode = 'FIELD_RESOLVE'
     AND OLD.status = 'OPEN'
     AND NEW.status = 'FIELD_RESOLVED' THEN
    RETURN NEW;
  END IF;

  IF v_mode = 'RECEIPT_VERIFY'
     AND OLD.status = 'FIELD_RESOLVED'
     AND NEW.status IN ('FIELD_RESOLVED', 'FINAL_VERIFIED') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'GRADING_TASK_INVALID_TRANSITION: % to %', OLD.status, NEW.status
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_grading_tasks_transition ON public.grading_tasks;
CREATE TRIGGER trg_grading_tasks_transition
  BEFORE UPDATE ON public.grading_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_grading_task_transition();

CREATE OR REPLACE FUNCTION public.save_task_grading_session(
  p_task_id UUID,
  p_record JSONB
)
RETURNS SETOF public.grading_tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_task public.grading_tasks%ROWTYPE;
  v_session_id TEXT := btrim(coalesce(p_record->>'id', ''));
  v_session_date DATE;
  v_role TEXT := public.auth_app_role();
  v_estate TEXT := public.auth_estate_id();
  v_session_block TEXT;
  v_total_gred NUMERIC := 0;
  v_total_tinggal NUMERIC := 0;
  v_total_masak NUMERIC := 0;
  v_field_muda_count INTEGER := 0;
  v_reject_pct NUMERIC := 0;
  v_masak_pct NUMERIC := 0;
  v_field_grade TEXT := 'A';
  v_actor_id TEXT := coalesce(
    auth.jwt()->'app_metadata'->>'operator_id',
    auth.jwt()->>'sub',
    'authenticated-operator'
  );
BEGIN
  IF v_role NOT IN ('eqi', 'fc', 'pf', 'afc', 'fs', 'oc', 'rc', 'superadmin', 'super_admin', 'admin') THEN
    RAISE EXCEPTION 'GRADING_TASK_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task
  FROM public.grading_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRADING_TASK_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_task.estate_id IS DISTINCT FROM v_estate
     AND NOT public.auth_is_cross_estate_role()
     AND NOT public.auth_is_super_admin() THEN
    RAISE EXCEPTION 'GRADING_TASK_ESTATE_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_task.status <> 'OPEN' THEN
    RAISE EXCEPTION 'GRADING_TASK_NOT_OPEN' USING ERRCODE = '23514';
  END IF;

  IF v_session_id = '' OR jsonb_typeof(p_record->'platforms') <> 'array'
     OR jsonb_array_length(p_record->'platforms') = 0 THEN
    RAISE EXCEPTION 'GRADING_TASK_INVALID_SESSION' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_session_date := to_date(p_record->>'tarikh', 'DD/MM/YY');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'GRADING_TASK_INVALID_DATE' USING ERRCODE = '22007';
  END;

  v_session_block := public.normalize_grading_block_identity(p_record->>'peringkat_blok');

  IF v_session_date IS DISTINCT FROM v_task.task_date THEN
    RAISE EXCEPTION 'GRADING_TASK_DATE_MISMATCH' USING ERRCODE = '23514';
  END IF;

  IF v_session_block IS DISTINCT FROM v_task.block THEN
    RAISE EXCEPTION 'GRADING_TASK_BLOCK_MISMATCH' USING ERRCODE = '23514';
  END IF;

  IF btrim(coalesce(p_record->>'no_lori', '')) = '' THEN
    RAISE EXCEPTION 'GRADING_TASK_LORRY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT
    coalesce(sum(coalesce((item->>'tandanDiGred')::NUMERIC, 0)), 0),
    coalesce(sum(coalesce((item->>'tandanDiTinggal')::NUMERIC, 0)), 0),
    coalesce(sum(coalesce((item->>'masak')::NUMERIC, 0)), 0),
    coalesce(sum(coalesce((item->>'rejectMuda')::NUMERIC, 0)), 0)::INTEGER
  INTO v_total_gred, v_total_tinggal, v_total_masak, v_field_muda_count
  FROM jsonb_array_elements(p_record->'platforms') AS item;

  IF v_total_gred <= 0 THEN
    RAISE EXCEPTION 'GRADING_TASK_EMPTY_GRADING' USING ERRCODE = '22023';
  END IF;

  IF v_total_gred > 0 THEN
    v_reject_pct := (v_total_tinggal / v_total_gred) * 100;
    v_masak_pct := (v_total_masak / v_total_gred) * 100;
  END IF;

  IF v_reject_pct > 10 OR v_masak_pct < 80 THEN
    v_field_grade := 'D';
  ELSIF v_reject_pct > 5 OR v_masak_pct < 85 THEN
    v_field_grade := 'C';
  ELSIF v_reject_pct > 2 OR v_masak_pct < 90 THEN
    v_field_grade := 'B';
  END IF;

  INSERT INTO public.penggredan_rekod (
    id, tajuk, program, jenis_grading, tarikh, ladang, estate_id,
    peringkat_blok, no_lori, nama_penggred, platforms,
    total_di_gred, total_di_tinggal, total_di_bawa,
    grading_task_id, created_at, updated_at, updated_by
  ) VALUES (
    v_session_id,
    p_record->>'tajuk',
    p_record->>'program',
    p_record->>'jenis_grading',
    p_record->>'tarikh',
    p_record->>'ladang',
    v_task.estate_id,
    p_record->>'peringkat_blok',
    upper(btrim(p_record->>'no_lori')),
    p_record->>'nama_penggred',
    p_record->'platforms',
    coalesce((p_record->>'total_di_gred')::INTEGER, 0),
    coalesce((p_record->>'total_di_tinggal')::INTEGER, 0),
    coalesce((p_record->>'total_di_bawa')::INTEGER, 0),
    v_task.id,
    coalesce((p_record->>'created_at')::TIMESTAMPTZ, NOW()),
    NOW(),
    v_actor_id
  )
  ON CONFLICT (id) DO UPDATE SET
    tajuk = EXCLUDED.tajuk,
    program = EXCLUDED.program,
    jenis_grading = EXCLUDED.jenis_grading,
    tarikh = EXCLUDED.tarikh,
    ladang = EXCLUDED.ladang,
    estate_id = EXCLUDED.estate_id,
    peringkat_blok = EXCLUDED.peringkat_blok,
    no_lori = EXCLUDED.no_lori,
    nama_penggred = EXCLUDED.nama_penggred,
    platforms = EXCLUDED.platforms,
    total_di_gred = EXCLUDED.total_di_gred,
    total_di_tinggal = EXCLUDED.total_di_tinggal,
    total_di_bawa = EXCLUDED.total_di_bawa,
    grading_task_id = EXCLUDED.grading_task_id,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by;

  PERFORM set_config('ipds.grading_task_transition', 'FIELD_RESOLVE', true);

  UPDATE public.grading_tasks
  SET status = 'FIELD_RESOLVED',
      grading_session_id = v_session_id,
      field_grade = v_field_grade,
      field_muda_count = v_field_muda_count,
      field_lorry = upper(btrim(p_record->>'no_lori')),
      field_resolved_at = NOW(),
      updated_at = NOW(),
      updated_by = v_actor_id
  WHERE id = v_task.id;

  RETURN QUERY SELECT * FROM public.grading_tasks WHERE id = v_task.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_grading_task_receipt(
  p_task_id UUID,
  p_receipt_id UUID
)
RETURNS SETOF public.grading_tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_task public.grading_tasks%ROWTYPE;
  v_receipt public.hantaran_hasil%ROWTYPE;
  v_achieved BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'GRADING_TASK_SYSTEM_ONLY' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task
  FROM public.grading_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND OR v_task.status <> 'FIELD_RESOLVED' THEN
    RAISE EXCEPTION 'GRADING_TASK_NOT_FIELD_RESOLVED' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_receipt
  FROM public.hantaran_hasil
  WHERE id = p_receipt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRADING_TASK_RECEIPT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_receipt.estate_id IS DISTINCT FROM v_task.estate_id
     OR public.normalize_grading_block_identity(v_receipt.blok) IS DISTINCT FROM v_task.block
     OR v_receipt.tarikh IS DISTINCT FROM v_task.task_date
     OR public.normalize_grading_lorry(v_receipt.no_lori) IS DISTINCT FROM public.normalize_grading_lorry(v_task.field_lorry) THEN
    RAISE EXCEPTION 'GRADING_TASK_RECEIPT_MISMATCH' USING ERRCODE = '23514';
  END IF;

  IF v_receipt.kpa IS NULL OR btrim(coalesce(v_receipt.kpg, '')) !~ '^[0-9]+([.][0-9]+)?$' THEN
    RAISE EXCEPTION 'GRADING_TASK_RECEIPT_RATES_REQUIRED' USING ERRCODE = '22023';
  END IF;

  v_achieved := (v_receipt.kpg::NUMERIC >= v_receipt.kpa);
  PERFORM set_config('ipds.grading_task_transition', 'RECEIPT_VERIFY', true);

  UPDATE public.grading_tasks
  SET matched_receipt_id = v_receipt.id,
      matched_no_resit = v_receipt.no_resit,
      mill_muda = coalesce(v_receipt.muda, 0),
      mill_kpg = v_receipt.kpg::NUMERIC,
      mill_kpa = v_receipt.kpa,
      kpg_achieved = v_achieved,
      status = CASE WHEN v_achieved THEN 'FINAL_VERIFIED' ELSE 'FIELD_RESOLVED' END,
      final_verified_at = CASE WHEN v_achieved THEN NOW() ELSE NULL END,
      updated_at = NOW(),
      updated_by = 'system:grading-receipt-match'
  WHERE id = v_task.id;

  RETURN QUERY SELECT * FROM public.grading_tasks WHERE id = v_task.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_grading_tasks_audit ON public.grading_tasks;
CREATE TRIGGER trg_grading_tasks_audit
  BEFORE UPDATE ON public.grading_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_and_user();

ALTER TABLE public.grading_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grading_tasks_select_policy ON public.grading_tasks;
CREATE POLICY grading_tasks_select_policy ON public.grading_tasks
  FOR SELECT TO authenticated
  USING (
    estate_id = public.auth_estate_id()
    OR public.auth_is_cross_estate_role()
    OR public.auth_is_super_admin()
  );

DROP POLICY IF EXISTS grading_tasks_update_policy ON public.grading_tasks;
CREATE POLICY grading_tasks_update_policy ON public.grading_tasks
  FOR UPDATE TO authenticated
  USING (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role() OR public.auth_is_super_admin())
    AND public.auth_app_role() IN ('eqi', 'fc', 'pf', 'afc', 'fs', 'oc', 'rc', 'superadmin', 'super_admin', 'admin')
  )
  WITH CHECK (
    (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role() OR public.auth_is_super_admin())
    AND public.auth_app_role() IN ('eqi', 'fc', 'pf', 'afc', 'fs', 'oc', 'rc', 'superadmin', 'super_admin', 'admin')
  );

REVOKE ALL ON public.grading_tasks FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON public.grading_tasks TO authenticated;
GRANT ALL ON public.grading_tasks TO service_role;

REVOKE ALL ON FUNCTION public.save_task_grading_session(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_task_grading_session(UUID, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.verify_grading_task_receipt(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_grading_task_receipt(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.normalize_grading_block_identity(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_grading_block_identity(TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.normalize_grading_lorry(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_grading_lorry(TEXT) TO authenticated, service_role;

COMMIT;
