-- ==============================================================================
-- MIGRATION: 20261010_auth_helper_alignment.sql
-- PURPOSE: Align four public.auth_* helper functions with the repository's
--          INTENDED definitions.
--
-- WHY (live evidence, Phase 7 read-only audit):
--   Staging is missing 20260911 and 20260930, so four helpers are still at their
--   superseded 20260905 form:
--     * auth_is_cross_estate_role() granted 'fc', 'executive_hq',
--       'zonal_controller', 'regional_controller', 'operation_controller'
--       -> a branch 'fc' was treated as CROSS-ESTATE across the employee-master
--          policies, contradicting the documented model.
--     * auth_is_super_admin() granted 'fc' for ANY estate (no FPM_TUNGGAL/5155
--       restriction) and did NOT accept 'superadmin'/'admin'.
--     * auth_estate_id() / auth_app_role() read auth.jwt() and returned
--       hard-coded FALLBACKS ('FPM_TUNGGAL' / 'staff') when no claim was present
--       -> fail-open: an unauthenticated context silently received a scope.
--
-- SOURCE OF TRUTH: supabase/migrations/20260930_ipds_grading_tasks.sql lines
--   40-67. The four function bodies below are copied VERBATIM from that file.
--
-- ATTRIBUTE CHANGE (intentional, part of "verbatim"): the 20260930 definitions
--   are `LANGUAGE sql STABLE` with NO SECURITY DEFINER and no SET search_path,
--   whereas the live 20260905 forms are `LANGUAGE plpgsql STABLE SECURITY
--   DEFINER SET search_path TO 'public','pg_temp'`. This migration therefore
--   restores SECURITY INVOKER. That is safe and stricter: these functions only
--   call current_setting() and the schema-qualified public.auth_app_role(), so
--   they need no elevated privileges.
--
-- SCOPE: exactly four functions.
--   * public.auth_estate_id()
--   * public.auth_app_role()
--   * public.auth_is_cross_estate_role()
--   * public.auth_is_super_admin()
--
-- DELIBERATELY NOT TOUCHED:
--   * public.auth_tenant_id()  -- 20260915 is its latest definition and live
--     already matches it; it is asserted byte-identical below.
--   * public.org_divisions_select_policy (USING (TRUE) TO authenticated) --
--     audited and confirmed to match repository intent.
--   No table, RLS policy, grant, trigger or RPC is altered.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. PRE-STATE SNAPSHOT: prove auth_tenant_id() is untouched by this migration.
-- ------------------------------------------------------------------------------
CREATE TEMP TABLE _p61010_auth_tenant_id_before ON COMMIT DROP AS
SELECT md5(pg_catalog.pg_get_functiondef(p.oid)) AS def_md5
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'auth_tenant_id';

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM _p61010_auth_tenant_id_before WHERE def_md5 IS NOT NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'AUTH_HELPER_PRECONDITION_FAILED: public.auth_tenant_id() not found exactly once (found %)', v_count
      USING ERRCODE = '42501';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. auth_estate_id()  -- verbatim 20260930:40-46. No fallback -> NULL deny.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_estate_id()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'estate_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'estate_id', '')
  );
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------------------------
-- 2. auth_app_role()  -- verbatim 20260930:51-57. No fallback -> NULL deny.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_app_role()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'app_role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '')
  );
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------------------------
-- 3. auth_is_cross_estate_role()  -- verbatim 20260930:59-62.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_cross_estate_role()
RETURNS boolean AS $$
  SELECT public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin');
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------------------------
-- 4. auth_is_super_admin()  -- verbatim 20260930:64-67.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS boolean AS $$
  SELECT public.auth_app_role() IN ('superadmin', 'super_admin', 'admin')
         OR (public.auth_app_role() = 'fc' AND public.auth_estate_id() IN ('FPM_TUNGGAL', '5155'));
$$ LANGUAGE sql STABLE;

-- ==============================================================================
-- 5. DEPLOY-TIME GUARDS -- fail closed. Any deviation aborts the transaction.
--    Guards are ordered: (a) untouched function, (b) static body shape,
--    (c) behavioural proof, (d) attribute proof. None relaxes an existing
--    requirement; all of them ADD verification.
-- ==============================================================================
DO $$
DECLARE
  v_before_tenant text;
  v_now_tenant    text;
  v_def           text;
  v_oid           oid;
  v_prosecdef     boolean;
  v_lang          text;
  v_bad           text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- (a) auth_tenant_id() must be BYTE-IDENTICAL to its pre-migration definition
  -- ---------------------------------------------------------------------------
  SELECT def_md5 INTO v_before_tenant FROM _p61010_auth_tenant_id_before;
  SELECT md5(pg_catalog.pg_get_functiondef(p.oid)) INTO v_now_tenant
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_tenant_id';

  IF v_before_tenant IS DISTINCT FROM v_now_tenant THEN
    RAISE EXCEPTION
      'AUTH_HELPER_GUARD_FAILED: public.auth_tenant_id() was modified but must be untouched'
      USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------------
  -- (b1) auth_is_cross_estate_role(): exactly rc, oc, admin, super_admin
  --      and NONE of the superseded broad roles.
  -- ---------------------------------------------------------------------------
  SELECT pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(p.oid), '\s+', ' ', 'g'), p.oid
    INTO v_def, v_oid
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_is_cross_estate_role';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_is_cross_estate_role() not found' USING ERRCODE = '42501';
  END IF;
  IF v_def NOT LIKE '%''rc'', ''oc'', ''admin'', ''super_admin''%' THEN
    RAISE EXCEPTION
      'AUTH_HELPER_GUARD_FAILED: auth_is_cross_estate_role() does not list exactly rc, oc, admin, super_admin'
      USING ERRCODE = '42501';
  END IF;
  SELECT string_agg(r, ', ' ORDER BY r) INTO v_bad
  FROM unnest(ARRAY['fc','executive_hq','zonal_controller','regional_controller','operation_controller']) AS r
  WHERE v_def LIKE '%''' || r || '''%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'AUTH_HELPER_GUARD_FAILED: auth_is_cross_estate_role() still grants superseded role(s): %', v_bad
      USING ERRCODE = '42501';
  END IF;

  -- attribute proof for the same function
  SELECT p.prosecdef, l.lanname INTO v_prosecdef, v_lang
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public' AND p.proname = 'auth_is_cross_estate_role';
  IF v_prosecdef IS NOT FALSE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_is_cross_estate_role() must be SECURITY INVOKER' USING ERRCODE = '42501';
  END IF;
  IF v_lang <> 'sql' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_is_cross_estate_role() must be LANGUAGE sql (found %)', v_lang USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------------
  -- (b2) auth_is_super_admin(): superadmin + super_admin + admin, plus fc ONLY
  --      when the estate is FPM_TUNGGAL or 5155.
  -- ---------------------------------------------------------------------------
  SELECT pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(p.oid), '\s+', ' ', 'g')
    INTO v_def
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_is_super_admin';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_is_super_admin() not found' USING ERRCODE = '42501';
  END IF;
  FOR v_bad IN SELECT unnest(ARRAY['superadmin','super_admin','admin']) LOOP
    IF v_def NOT LIKE '%''' || v_bad || '''%' THEN
      RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_is_super_admin() does not accept %', v_bad USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF v_def NOT LIKE '%''fc''%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_is_super_admin() no longer special-cases fc' USING ERRCODE = '42501';
  END IF;
  IF v_def NOT LIKE '%''FPM_TUNGGAL''%' OR v_def NOT LIKE '%''5155''%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_is_super_admin() fc special case is not restricted to FPM_TUNGGAL/5155' USING ERRCODE = '42501';
  END IF;
  IF v_def NOT LIKE '%auth_estate_id()%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_is_super_admin() does not consult auth_estate_id()' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------------
  -- (b3) readers: must read request.jwt.claims, must NOT call auth.jwt(), and
  --      must contain NO hard-coded fallback.
  -- ---------------------------------------------------------------------------
  SELECT pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(p.oid), '\s+', ' ', 'g')
    INTO v_def
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_estate_id';
  IF v_def NOT LIKE '%current_setting(''request.jwt.claims''%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_estate_id() does not read request.jwt.claims' USING ERRCODE = '42501';
  END IF;
  IF v_def LIKE '%auth.jwt()%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_estate_id() still calls auth.jwt()' USING ERRCODE = '42501';
  END IF;
  IF v_def LIKE '%''FPM_TUNGGAL''%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_estate_id() still contains a hard-coded FPM_TUNGGAL fallback' USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(p.oid), '\s+', ' ', 'g')
    INTO v_def
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_app_role';
  IF v_def NOT LIKE '%current_setting(''request.jwt.claims''%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_app_role() does not read request.jwt.claims' USING ERRCODE = '42501';
  END IF;
  IF v_def LIKE '%auth.jwt()%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_app_role() still calls auth.jwt()' USING ERRCODE = '42501';
  END IF;
  IF v_def LIKE '%''staff''%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_app_role() still contains a hard-coded staff fallback' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------------
  -- (c) BEHAVIOURAL PROOF with transaction-local claims.
  --     set_config(..., is_local => true) reverts automatically at COMMIT.
  -- ---------------------------------------------------------------------------
  -- (c1) fail-closed when no claims are present.
  --      Fixture MUST be valid JSON: the intended readers cast the raw setting
  --      with ::jsonb, and '' is not valid JSON (22P02). '{}' is a valid, empty
  --      claim set -> both readers resolve to NULL -> fail closed.
  PERFORM pg_catalog.set_config('request.jwt.claims', '{}', true);
  IF public.auth_app_role() IS NOT NULL THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_app_role() must be NULL without claims (fail closed)' USING ERRCODE = '42501';
  END IF;
  IF public.auth_estate_id() IS NOT NULL THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_estate_id() must be NULL without claims (fail closed)' USING ERRCODE = '42501';
  END IF;

  -- (c2) cross-estate role matrix
  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"rc"}', true);
  IF public.auth_app_role() IS DISTINCT FROM 'rc' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_app_role() did not read the rc claim' USING ERRCODE = '42501';
  END IF;
  IF public.auth_is_cross_estate_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: rc must be cross-estate' USING ERRCODE = '42501';
  END IF;
  IF public.auth_is_super_admin() IS NOT FALSE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: rc must not be super admin' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"oc"}', true);
  IF public.auth_is_cross_estate_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: oc must be cross-estate' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"admin"}', true);
  IF public.auth_is_cross_estate_role() IS NOT TRUE OR public.auth_is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: admin must be cross-estate AND super admin' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"super_admin"}', true);
  IF public.auth_is_cross_estate_role() IS NOT TRUE OR public.auth_is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: super_admin must be cross-estate AND super admin' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"superadmin"}', true);
  IF public.auth_is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: superadmin alias must be super admin' USING ERRCODE = '42501';
  END IF;

  -- (c3) superseded roles must NOT be cross-estate
  FOR v_bad IN SELECT unnest(ARRAY['fc','executive_hq','zonal_controller','regional_controller','operation_controller','pf','staff']) LOOP
    PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"' || v_bad || '","estate_id":"FPM_ADELA"}', true);
    IF public.auth_is_cross_estate_role() IS TRUE THEN
      RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: role % must NOT be cross-estate', v_bad USING ERRCODE = '42501';
    END IF;
  END LOOP;

  -- (c4) fc special case for super admin is restricted to FPM_TUNGGAL / 5155
  PERFORM pg_catalog.set_config('request.jwt.claims', '{"app_metadata":{"app_role":"fc","estate_id":"FPM_ADELA"}}', true);
  IF public.auth_is_super_admin() IS TRUE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: fc outside FPM_TUNGGAL/5155 must not be super admin' USING ERRCODE = '42501';
  END IF;
  IF public.auth_estate_id() IS DISTINCT FROM 'FPM_ADELA' THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: auth_estate_id() did not read the FPM_ADELA claim' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claims', '{"app_metadata":{"app_role":"fc","estate_id":"FPM_TUNGGAL"}}', true);
  IF public.auth_is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: fc at FPM_TUNGGAL must be super admin' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claims', '{"app_metadata":{"app_role":"fc","estate_id":"5155"}}', true);
  IF public.auth_is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'AUTH_HELPER_GUARD_FAILED: fc at 5155 must be super admin' USING ERRCODE = '42501';
  END IF;

  -- reset claims so no later statement inherits the guard fixtures
  PERFORM pg_catalog.set_config('request.jwt.claims', '', true);

  RAISE NOTICE 'AUTH_HELPER_GUARD_OK: four helpers aligned; auth_tenant_id() untouched';
END $$;

COMMIT;

-- ==============================================================================
-- ROLLBACK: supabase/rollbacks/20261010_auth_helper_alignment_rollback.sql
-- ==============================================================================
