-- ==============================================================================
-- MIGRATION: 20261008_create_employee_assignment_block_persistence.sql
-- PURPOSE: P6B-1 — persist the employee creation block selection.
--
--   BEFORE: the route sanitised `block_ids` and echoed them back as synthetic
--           UUIDs; create_employee_with_assignment() never received them and
--           public.employee_assignment_blocks was never written. Selected blocks
--           were silently lost.
--
--   AFTER:  create_employee_with_assignment() accepts an additive optional
--           `p_block_ids text[] DEFAULT NULL`, resolves every supplied block CODE
--           against public.org_blocks by (tenant_id, estate_id, block_code) —
--           the codes seeded by 20261007 — and inserts the resolved org_blocks.id
--           rows into public.employee_assignment_blocks inside the SAME
--           transaction. Any unresolvable code aborts the whole creation.
--
-- BLOCK CODES, NOT UUIDS: the UI (CreateEmployeeModal -> getBlocksForEstate)
--   submits `block_code` values such as 'B01'. Resolution is therefore by code,
--   and NEVER by client-supplied id. `employee_assignment_blocks.block_id` is
--   UUID -> public.org_blocks(id) (20260915:238), so the stored value is the
--   authoritative org_blocks.id.
--
-- ARGUMENT LIST / IDENTITY: PostgreSQL treats a changed argument list as a
--   DIFFERENT function, so the exact 15-argument version is DROPped first.
--   Without that, the new 16-argument function would coexist as a callable
--   overload (ambiguous for PostgREST). All 15 original parameters keep their
--   names, types and order; p_block_ids is appended last with a DEFAULT.
--   Return type is UNCHANGED: RETURNS TABLE (employee_id uuid, assignment_id uuid).
--
-- UNCHANGED (deliberately):
--   * All existing validation: staff_no/full_name/tenant/company/position/
--     estate_id required, EMPLOYEE_TENANT_VIOLATION and EMPLOYEE_ESTATE_VIOLATION
--     boundary checks, employment_status and assignment_role allowlists.
--   * The employees INSERT strategy from P3-1 (explicit id, NO RETURNING) and
--     the employee_assignments INSERT (RETURNING id) — both preserved verbatim.
--   * SECURITY INVOKER, SET search_path = '', EXECUTE granted to authenticated
--     only (PUBLIC/anon revoked).
--   * public.auth_* helpers, all RLS policies (20261004/20261005/20261006), the
--     org_blocks master data, and the route's external API contract.
--
-- RLS: the function is SECURITY INVOKER, so the new employee_assignment_blocks
--   INSERT is subject to "assignment_blocks_write_policy" (20261006), which
--   requires the parent assignment to sit in public.auth_estate_id() for
--   ordinary roles. Because the function independently forces
--   p_estate_id = auth_estate_id() for ordinary callers, the legitimate path
--   satisfies the policy; cross-estate roles pass via the policy's role clause.
--   No policy is bypassed and none is modified.
--
-- NUMBERING NOTE: the requested filename used the 20261007 prefix, which is
--   already occupied by 20261007_org_blocks_master_data_seed.sql (P6A-1). This
--   migration therefore uses the next free prefix, 20261008, so the ordering
--   remains unambiguous (blocks must exist before they can be resolved).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. DROP the exact 15-argument function so no stale overload can survive.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_employee_with_assignment(
    uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar,
    date, varchar, varchar, varchar, date, text
);

-- ------------------------------------------------------------------------------
-- 2. Recreate with the additive optional block parameter (same 15 params, same
--    order, same return type) plus same-transaction block persistence.
-- ------------------------------------------------------------------------------
CREATE FUNCTION public.create_employee_with_assignment(
    p_tenant_id         uuid,
    p_company_id        uuid,
    p_position_id       uuid,
    p_staff_no          varchar,
    p_full_name         varchar,
    p_employment_status varchar,
    p_id_card_passport  varchar,
    p_contact_number    varchar,
    p_email             varchar,
    p_hire_date         date,
    p_estate_id         varchar,
    p_division_id       varchar,
    p_assignment_role   varchar,
    p_effective_from    date,
    p_transfer_reason   text DEFAULT NULL,
    p_block_ids         text[] DEFAULT NULL
) RETURNS TABLE (employee_id uuid, assignment_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_employee_id   uuid;
    v_assignment_id uuid;
    v_status        varchar(30);
    v_role          varchar(50);
    v_unknown_code  text;
BEGIN
    -- ---- input validation (defense in depth; app validates too) ----
    IF p_staff_no IS NULL OR btrim(p_staff_no) = '' THEN
        RAISE EXCEPTION 'EMPLOYEE_VALIDATION_ERROR: staff_no required' USING ERRCODE = '22023';
    END IF;
    IF p_full_name IS NULL OR btrim(p_full_name) = '' THEN
        RAISE EXCEPTION 'EMPLOYEE_VALIDATION_ERROR: full_name required' USING ERRCODE = '22023';
    END IF;
    IF p_tenant_id IS NULL OR p_company_id IS NULL OR p_position_id IS NULL THEN
        RAISE EXCEPTION 'EMPLOYEE_VALIDATION_ERROR: tenant/company/position required' USING ERRCODE = '22023';
    END IF;
    IF p_estate_id IS NULL OR btrim(p_estate_id) = '' THEN
        RAISE EXCEPTION 'EMPLOYEE_VALIDATION_ERROR: estate_id required' USING ERRCODE = '22023';
    END IF;

    -- ---- independent tenant / estate boundary enforcement ----
    IF p_tenant_id IS DISTINCT FROM public.auth_tenant_id() THEN
        RAISE EXCEPTION 'EMPLOYEE_TENANT_VIOLATION: tenant outside caller scope' USING ERRCODE = '42501';
    END IF;
    IF p_estate_id IS DISTINCT FROM public.auth_estate_id()
       AND NOT public.auth_is_cross_estate_role() THEN
        RAISE EXCEPTION 'EMPLOYEE_ESTATE_VIOLATION: estate % outside caller scope', p_estate_id USING ERRCODE = '42501';
    END IF;

    -- ---- employment_status allowlist ----
    v_status := upper(coalesce(nullif(btrim(p_employment_status), ''), 'ACTIVE'));
    IF v_status NOT IN ('ACTIVE', 'PROBATION', 'INACTIVE', 'RETIRED', 'TERMINATED', 'RESIGNED') THEN
        RAISE EXCEPTION 'EMPLOYEE_VALIDATION_ERROR: invalid employment_status %', p_employment_status USING ERRCODE = '22023';
    END IF;

    -- ---- assignment_role allowlist ----
    v_role := coalesce(nullif(btrim(p_assignment_role), ''), 'PRIMARY');
    IF v_role NOT IN ('PRIMARY', 'SECONDARY', 'ACTING', 'TEMPORARY') THEN
        RAISE EXCEPTION 'EMPLOYEE_VALIDATION_ERROR: invalid assignment_role %', p_assignment_role USING ERRCODE = '22023';
    END IF;

    -- ---- block code validation (fail closed, BEFORE any write) ----
    -- NULL or empty array = no blocks (existing behaviour preserved).
    -- Codes are matched verbatim (trimmed) against org_blocks.block_code, which
    -- is UNIQUE per (estate_id, block_code), so a match is guaranteed unique.
    -- Never resolved by code alone: tenant AND estate are always enforced.
    IF p_block_ids IS NOT NULL AND array_length(p_block_ids, 1) IS NOT NULL THEN

        SELECT c.code INTO v_unknown_code
        FROM (SELECT DISTINCT btrim(code) AS code FROM unnest(p_block_ids) AS code) c
        WHERE c.code = ''
           OR NOT EXISTS (
                SELECT 1
                FROM public.org_blocks b
                WHERE b.tenant_id  = p_tenant_id
                  AND b.estate_id  = p_estate_id
                  AND b.block_code = c.code
           )
        LIMIT 1;

        IF v_unknown_code IS NOT NULL THEN
            RAISE EXCEPTION
                'INVALID_ASSIGNMENT_BLOCK: block code % does not resolve to a block in tenant % estate %',
                v_unknown_code, p_tenant_id, p_estate_id
                USING ERRCODE = '22023';
        END IF;
    END IF;

    -- ---- statement 1: employee ----
    -- The id is generated here instead of relying on the column default plus
    -- RETURNING: INSERT ... RETURNING requires the SELECT policies to pass, and
    -- the employee has no assignment yet at this point (see P3-1).
    v_employee_id := gen_random_uuid();

    INSERT INTO public.employees
        (id, tenant_id, staff_no, full_name, position_id, employment_status,
         id_card_passport, contact_number, email, hire_date)
    VALUES
        (v_employee_id, p_tenant_id, upper(btrim(p_staff_no)), btrim(p_full_name), p_position_id, v_status,
         p_id_card_passport, p_contact_number, p_email, coalesce(p_hire_date, CURRENT_DATE));

    -- ---- statement 2: primary assignment (same transaction) ----
    INSERT INTO public.employee_assignments
        (tenant_id, employee_id, company_id, estate_id, division_id,
         assignment_role, status, effective_from, transfer_reason)
    VALUES
        (p_tenant_id, v_employee_id, p_company_id, p_estate_id, p_division_id,
         v_role, 'ACTIVE', coalesce(p_effective_from, coalesce(p_hire_date, CURRENT_DATE)), p_transfer_reason)
    RETURNING id INTO v_assignment_id;

    -- ---- statement 3: assignment blocks (same transaction) ----
    -- Set-based, deduplicated (DISTINCT on the trimmed code) and resolved to the
    -- authoritative org_blocks.id. created_by is intentionally NOT set: the
    -- existing function never sets created_by on employees/employee_assignments,
    -- so omitting it preserves the established semantics.
    IF p_block_ids IS NOT NULL AND array_length(p_block_ids, 1) IS NOT NULL THEN
        INSERT INTO public.employee_assignment_blocks (tenant_id, assignment_id, block_id)
        SELECT
            p_tenant_id,
            v_assignment_id,
            (
                SELECT b.id
                FROM public.org_blocks b
                WHERE b.tenant_id  = p_tenant_id
                  AND b.estate_id  = p_estate_id
                  AND b.block_code = c.code
            )
        FROM (SELECT DISTINCT btrim(code) AS code FROM unnest(p_block_ids) AS code) c;
    END IF;

    RETURN QUERY SELECT v_employee_id, v_assignment_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. EXECUTE ACL: unchanged semantics (authenticated only, no PUBLIC/anon).
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text, text[]) TO authenticated;

COMMENT ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text, text[]) IS
'P6B-1 atomic employee + assignment + assignment-block creation. SECURITY INVOKER, search_path=''''. Employee id generated in-function (no RETURNING on public.employees). Block codes are resolved by (tenant_id, estate_id, block_code) against public.org_blocks; any unresolvable code raises INVALID_ASSIGNMENT_BLOCK (22023) and rolls back employee, assignment and blocks together. EXECUTE granted to authenticated only.';

-- ------------------------------------------------------------------------------
-- 4. DEPLOY-TIME GUARDS: no duplicate/overloaded version, fail-closed block
--    validation present and tenant+estate scoped, no privilege widening.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_oid   oid;
  v_count integer;
  v_def   text;
BEGIN
  -- (a) exactly one callable version -> no stale 15-arg overload may coexist
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'create_employee_with_assignment';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'DUPLICATE_FUNCTION_SIGNATURE_DETECTED: public.create_employee_with_assignment has % callable versions (expected exactly 1)',
      v_count
      USING ERRCODE = '42501';
  END IF;

  SELECT p.oid INTO v_oid
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'create_employee_with_assignment';

  -- (b) the additive parameter must exist as the FINAL input parameter, of the
  --     exact type text[] and carrying an explicit DEFAULT.
  --
  --     CORRECTED (false-negative guard bug): the previous implementation was
  --       array_to_string(proargnames, ',') NOT LIKE '%p_block_ids'
  --     proargnames also carries the RETURNS TABLE output columns
  --     (employee_id, assignment_id) APPENDED after the input parameters, so the
  --     joined string ends with '...,employee_id,assignment_id'. The pattern had
  --     no trailing wildcard, so it only matched a value ENDING with
  --     'p?block?ids' and therefore never matched a correct 16-argument function:
  --     the guard raised unconditionally. Verified live (isolated, rolled back):
  --       LIKE '%p_block_ids'                -> false
  --       strpos(position) / regex / = ANY   -> true
  --       proargnames::text LIKE '%p_block_ids%' -> true
  --     The replacement is exact (no wildcard semantics) and strictly STRONGER:
  --     it verifies the name, that it is the last INPUT parameter, its exact
  --     type, and the presence of a default. No requirement is relaxed.
  IF NOT (
       SELECT p.pronargs = 16
         AND p.proargnames[p.pronargs] = 'p_block_ids'
         AND p.proargtypes[p.pronargs - 1] = 'text[]'::regtype
         AND p.pronargdefaults >= 1
       FROM pg_catalog.pg_proc p
       WHERE p.oid = v_oid
     ) THEN
    RAISE EXCEPTION
      'BLOCK_PARAMETER_GUARD_FAILED: p_block_ids must be the final input parameter of type text[] with a DEFAULT'
      USING ERRCODE = '42501';
  END IF;

  -- Whitespace is normalised before the text probes below. pg_get_functiondef()
  -- reproduces the source with its ORIGINAL alignment, so a guard written with
  -- single spaces does not match an aligned body
  -- (e.g. "WHERE b.tenant_id  = p_tenant_id"). Verified live: the aligned body
  -- failed the un-normalised probe with
  -- "BLOCK_VALIDATION_GUARD_FAILED: block resolution is not tenant+estate scoped",
  -- i.e. a false negative. Normalising makes the probes check the same content
  -- without depending on formatting. No requirement is relaxed.
  v_def := pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(v_oid), '\s+', ' ', 'g');

  -- (c) block validation must be fail-closed and tenant+estate scoped
  IF v_def NOT LIKE '%INVALID_ASSIGNMENT_BLOCK%' THEN
    RAISE EXCEPTION 'BLOCK_VALIDATION_GUARD_FAILED: fail-closed invalid-block error is missing' USING ERRCODE = '42501';
  END IF;
  IF v_def NOT LIKE '%b.tenant_id = p_tenant_id%' OR v_def NOT LIKE '%b.estate_id = p_estate_id%' THEN
    RAISE EXCEPTION 'BLOCK_VALIDATION_GUARD_FAILED: block resolution is not tenant+estate scoped' USING ERRCODE = '42501';
  END IF;
  IF v_def NOT LIKE '%b.block_code = c.code%' THEN
    RAISE EXCEPTION 'BLOCK_VALIDATION_GUARD_FAILED: block lookup is not by block_code' USING ERRCODE = '42501';
  END IF;
  IF v_def NOT LIKE '%INSERT INTO public.employee_assignment_blocks%' THEN
    RAISE EXCEPTION 'BLOCK_VALIDATION_GUARD_FAILED: assignment block persistence is missing' USING ERRCODE = '42501';
  END IF;

  -- (d) no privilege widening: still SECURITY INVOKER, anon still cannot execute.
  --     CORRECTED: this must be checked on the catalog attribute, because
  --     pg_get_functiondef() OMITS the default SECURITY INVOKER keyword — a text
  --     probe ("v_def NOT LIKE '%SECURITY INVOKER%'") is a false negative that
  --     raises for a correctly INVOKER function. prosecdef = true means DEFINER.
  IF (SELECT p.prosecdef FROM pg_catalog.pg_proc p WHERE p.oid = v_oid) THEN
    RAISE EXCEPTION
      'PRIVILEGE_WIDENING_DETECTED: public.create_employee_with_assignment is not SECURITY INVOKER (prosecdef = true)'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname = 'anon')
     AND pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE_WIDENING_DETECTED: anon has EXECUTE on public.create_employee_with_assignment' USING ERRCODE = '42501';
  END IF;
END $$;

COMMIT;
