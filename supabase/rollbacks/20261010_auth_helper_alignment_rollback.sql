-- ==============================================================================
-- ROLLBACK: 20261010_auth_helper_alignment_rollback.sql
-- Reverses: 20261010_auth_helper_alignment.sql
--
-- Location note: kept OUTSIDE supabase/migrations/ on purpose so the Supabase
-- CLI does not auto-apply this script as a forward migration when
-- `supabase db push` runs. Apply manually only during a reviewed rollback.
--
-- WHAT THIS DOES
--   Restores the EXACT live (pre-20261010) definitions of the four helpers, i.e.
--   the superseded 20260905 forms that were present on staging before this
--   alignment: LANGUAGE plpgsql, STABLE, SECURITY DEFINER,
--   SET search_path TO 'public', 'pg_temp', reading auth.jwt() with hard-coded
--   fallbacks, and the broad role lists.
--
-- WHAT THIS DOES NOT DO (deliberate)
--   * Does NOT touch public.auth_tenant_id() (never modified by 20261010).
--   * Does NOT touch any table, RLS policy, grant, trigger or RPC.
--   * Does NOT touch public.org_divisions_select_policy.
--
-- WARNING: rolling this back RE-INTRODUCES the fail-open model — a branch 'fc'
--   becomes cross-estate again and a missing JWT resolves to staff @ FPM_TUNGGAL.
--   Roll back only to restore the previous operational state, never to make a
--   failing isolation test pass.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. public.auth_estate_id()  -- pre-20261010 live form
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_estate_id()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_claims jsonb;
  v_estate text;
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN 'FPM_TUNGGAL'; -- Fallback for unauthenticated or local dev
  END IF;

  v_claims := auth.jwt();
  v_estate := COALESCE(
    v_claims -> 'app_metadata' ->> 'estate_id',
    v_claims ->> 'estate_id',
    v_claims -> 'user_metadata' ->> 'estate_id'
  );

  IF v_estate IS NULL OR TRIM(v_estate) = '' THEN
    RETURN 'FPM_TUNGGAL';
  END IF;

  RETURN TRIM(v_estate);
END;
$function$;

-- ------------------------------------------------------------------------------
-- 2. public.auth_app_role()  -- pre-20261010 live form
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_app_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN 'staff'; -- Fallback
  END IF;

  v_claims := auth.jwt();
  v_role := COALESCE(
    v_claims -> 'app_metadata' ->> 'app_role',
    v_claims -> 'app_metadata' ->> 'role',
    v_claims ->> 'role'
  );

  IF v_role IS NULL OR TRIM(v_role) = '' THEN
    RETURN 'staff';
  END IF;

  RETURN LOWER(TRIM(v_role));
END;
$function$;

-- ------------------------------------------------------------------------------
-- 3. public.auth_is_cross_estate_role()  -- pre-20261010 live form (broad list)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_cross_estate_role()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN public.auth_app_role() IN ('super_admin', 'executive_hq', 'fc', 'zonal_controller', 'regional_controller', 'operation_controller');
END;
$function$;

-- ------------------------------------------------------------------------------
-- 4. public.auth_is_super_admin()  -- pre-20261010 live form (broad list)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN public.auth_app_role() IN ('super_admin', 'executive_hq', 'fc', 'zonal_controller', 'regional_controller');
END;
$function$;

-- ------------------------------------------------------------------------------
-- 5. VERIFY the restore matches the recorded pre-20261010 state.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(p.oid), '\s+', ' ', 'g') INTO v_def
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_is_cross_estate_role';
  IF v_def NOT LIKE '%''fc''%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_ROLLBACK_FAILED: auth_is_cross_estate_role() was not restored to the pre-20261010 form' USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(p.oid), '\s+', ' ', 'g') INTO v_def
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_estate_id';
  IF v_def NOT LIKE '%auth.jwt()%' OR v_def NOT LIKE '%''FPM_TUNGGAL''%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_ROLLBACK_FAILED: auth_estate_id() was not restored to the pre-20261010 form' USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(p.oid), '\s+', ' ', 'g') INTO v_def
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_app_role';
  IF v_def NOT LIKE '%auth.jwt()%' OR v_def NOT LIKE '%''staff''%' THEN
    RAISE EXCEPTION 'AUTH_HELPER_ROLLBACK_FAILED: auth_app_role() was not restored to the pre-20261010 form' USING ERRCODE = '42501';
  END IF;
END $$;

COMMIT;
