-- ==============================================================================
-- MIGRATION: 20261004_employee_master_rls_estate_scoping.sql
-- PURPOSE: P3-1 — close the cross-estate read leak on Employee Master data.
--
--   BEFORE: "employees_read_policy" (20260915_employee_master_data_foundation.sql
--           lines 399-402) and "assignment_blocks_read_policy" (same migration,
--           lines 444-447) were TENANT-wide:
--             USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin())
--           Any authenticated JWT (staff, mandur, eqi, branch fc, ...) could read
--           every estate's employee master records (full_name, staff_no,
--           id_card_passport, contact_number, email) directly through PostgREST,
--           bypassing the application-layer estate filter in employees.routes.ts.
--           The security_invoker view public.v_current_employee_assignments
--           exposed the same rows.
--
--   AFTER:  reads are scoped to the caller's estate through their employee
--           assignment. Documented cross-estate roles retain tenant-wide
--           visibility via the existing SSOT helpers:
--             * public.auth_is_cross_estate_role() -> rc, oc, admin, super_admin
--             * public.auth_is_super_admin()       -> superadmin alias + FC Tunggal
--           The tenant boundary itself is unchanged.
--
-- COMPANION CHANGE (required, not optional):
--   PostgreSQL requires the SELECT policies to pass for INSERT ... RETURNING
--   (CREATE POLICY, "Per-Command Policies" -> SELECT: "any newly inserted or
--   updated rows from the relation must satisfy the relation's SELECT policies
--   in order to be available to the RETURNING clause. If a newly inserted or
--   updated row does not satisfy the relation's SELECT policies, an error will
--   be thrown"). create_employee_with_assignment() inserted the employee with
--   RETURNING id *before* its assignment row existed, so any assignment-based
--   SELECT policy on public.employees would abort every employee creation.
--   The function is therefore recreated verbatim EXCEPT that it now supplies
--   the employee id explicitly (gen_random_uuid()) and no longer uses RETURNING
--   on public.employees. Signature, attributes (SECURITY INVOKER,
--   SET search_path = '') and EXECUTE ACL are preserved, so no application
--   change is required. The assignment INSERT still uses RETURNING id because
--   the new assignment satisfies "assignments_read_policy" (its estate is
--   pinned to the caller's estate by the function's own boundary check).
--
-- SCOPE:
--   * public.employees            -> replace "employees_read_policy"
--   * public.employee_assignment_blocks -> replace "assignment_blocks_read_policy"
--     AND make "assignment_blocks_write_policy" explicit per command (see 2b)
--   * public.create_employee_with_assignment -> recreate (id generation only)
--   No schema, grant, service, route, transfer or JSON-fallback change.
--   INSERT/UPDATE policies on employees and "assignments_read_policy" /
--   "assignments_write_policy" are deliberately NOT touched here (20261005).
--
-- BASELINE CORRECTION (2b): the 20260915 baseline defines
--   "assignment_blocks_write_policy" FOR ALL. A FOR ALL policy also applies to
--   SELECT, and same-command permissive policies are OR-combined, so the table
--   had TWO permissive SELECT policies: the estate-scoped read policy added
--   here, and the tenant-wide-without-estate-clause write policy. The combined
--   SELECT predicate would therefore still have been tenant-wide for the write
--   roles, silently defeating the estate scoping this migration introduces.
--   Section 2b expresses the identical predicate explicitly per command
--   (INSERT/UPDATE/DELETE), which the guard in section 3 requires. The guard is
--   NOT weakened or removed.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EMPLOYEES: estate-scoped reads
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "employees_read_policy" ON public.employees;
CREATE POLICY "employees_read_policy" ON public.employees
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (
      public.auth_is_cross_estate_role()
      OR public.auth_is_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.employee_assignments ea
        WHERE ea.employee_id = employees.id
          AND ea.tenant_id   = public.auth_tenant_id()
          AND ea.estate_id   = public.auth_estate_id()
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 2. EMPLOYEE ASSIGNMENT BLOCKS: estate-scoped reads
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "assignment_blocks_read_policy" ON public.employee_assignment_blocks;
CREATE POLICY "assignment_blocks_read_policy" ON public.employee_assignment_blocks
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND (
      public.auth_is_cross_estate_role()
      OR public.auth_is_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.employee_assignments ea
        WHERE ea.id = employee_assignment_blocks.assignment_id
          AND ea.tenant_id = public.auth_tenant_id()
          AND ea.estate_id = public.auth_estate_id()
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 2b. EMPLOYEE ASSIGNMENT BLOCKS: make the write policy explicit per command.
--
--    The union of privileges is UNCHANGED: FOR ALL with USING + WITH CHECK is
--    equivalent to INSERT(WITH CHECK) + UPDATE(USING, WITH CHECK) +
--    DELETE(USING). No predicate is broadened. The only access change is that
--    the write roles no longer receive an incidental SELECT grant from this
--    policy, because SELECT is now governed solely by the estate-scoped
--    "assignment_blocks_read_policy" created in section 2.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "assignment_blocks_write_policy" ON public.employee_assignment_blocks;

CREATE POLICY "assignment_blocks_write_insert_policy" ON public.employee_assignment_blocks
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  );

CREATE POLICY "assignment_blocks_write_update_policy" ON public.employee_assignment_blocks
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  );

CREATE POLICY "assignment_blocks_write_delete_policy" ON public.employee_assignment_blocks
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  );

-- ------------------------------------------------------------------------------
-- 3. DEPLOY-TIME GUARD: exactly one permissive SELECT/ALL policy per table.
--    Policies of the same command type are combined with OR, so a leftover
--    duplicate permissive policy would silently re-open the tenant-wide leak.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_employees_count integer;
  v_blocks_count    integer;
BEGIN
  SELECT count(*) INTO v_employees_count
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'employees'
    AND cmd IN ('SELECT', 'ALL')
    AND permissive = 'PERMISSIVE';

  SELECT count(*) INTO v_blocks_count
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'employee_assignment_blocks'
    AND cmd IN ('SELECT', 'ALL')
    AND permissive = 'PERMISSIVE';

  IF v_employees_count <> 1 THEN
    RAISE EXCEPTION
      'DUPLICATE_PERMISSIVE_POLICY_DETECTED: public.employees has % permissive SELECT/ALL policies (expected exactly 1)',
      v_employees_count
      USING ERRCODE = '42501';
  END IF;

  IF v_blocks_count <> 1 THEN
    RAISE EXCEPTION
      'DUPLICATE_PERMISSIVE_POLICY_DETECTED: public.employee_assignment_blocks has % permissive SELECT/ALL policies (expected exactly 1)',
      v_blocks_count
      USING ERRCODE = '42501';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. COMPANION: keep atomic employee creation working under the scoped policy.
--    Recreated from 20260929_p1_1d_employee_create_atomic_rpc.sql; the ONLY
--    functional difference is the employees INSERT (explicit id, no RETURNING).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_employee_with_assignment(
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
    p_transfer_reason   text DEFAULT NULL
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

    -- ---- statement 1: employee ----
    -- The id is generated here instead of relying on the column default plus
    -- RETURNING: INSERT ... RETURNING requires the SELECT policies to pass, and
    -- the employee has no assignment yet at this point (see migration header).
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

    RETURN QUERY SELECT v_employee_id, v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text) TO authenticated;

COMMENT ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text) IS
'P3-1 atomic employee+assignment creation. SECURITY INVOKER, search_path=''''. Enforces tenant/estate boundary and employment_status allowlist. The employee id is generated in-function (no RETURNING on public.employees) so the estate-scoped employees_read_policy cannot abort creation. Any error rolls back both inserts. EXECUTE granted to authenticated only.';

-- ==============================================================================
-- RLS AUDIT (informational; not changed by this migration):
--   * public.employee_assignments."assignments_read_policy" is already
--     estate-scoped (20260915 lines 419-429).
--   * public.employee_assignments."assignments_write_policy" (20260915 lines
--     431-441) is tenant + role scoped with NO estate check. A tenant fc/pf
--     can therefore INSERT/UPDATE/DELETE another estate's assignment rows,
--     which can move an employee between estates. Out of scope for P3-1;
--     tracked as a follow-up.
--   * public.employee_credentials (20261003) has FORCE RLS with no policies
--     (default deny except service_role/owner). Out of scope for P3-1.
-- ==============================================================================

COMMIT;
