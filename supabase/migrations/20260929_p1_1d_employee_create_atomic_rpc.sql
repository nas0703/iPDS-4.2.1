-- ==============================================================================
-- MIGRATION: 20260929_p1_1d_employee_create_atomic_rpc.sql
-- PURPOSE: P1.1-D — atomic employee + primary assignment creation.
--
--   PostgREST cannot span two independent INSERTs in one transaction, so the
--   previous two-call flow could leave an orphan employee when the assignment
--   INSERT failed. This function performs BOTH inserts inside a single
--   PostgreSQL function body, which PostgreSQL executes as one transaction:
--   any raised exception (including an RLS violation or a duplicate staff_no
--   on uq_employees_tenant_staff_no) rolls back the whole operation.
--
-- SECURITY MODEL:
--   * SECURITY INVOKER — no privilege escalation. Caller RLS applies to every
--     statement (employees_insert_policy / assignments_write_policy).
--   * SET search_path = '' — every object is schema-qualified.
--   * Tenant/estate boundary is enforced INSIDE the function, independently of
--     the application layer, via public.auth_tenant_id() / public.auth_estate_id()
--     and public.auth_is_cross_estate_role().
--   * EXECUTE is granted ONLY to `authenticated` (the application uses the
--     authenticated scoped client). service_role is intentionally NOT granted —
--     no system/background path creates employees.
--
-- RLS PREREQUISITE (see audit note in the migration footer):
--   employees_insert_policy and assignments_write_policy currently allow only
--   app_role IN ('super_admin','fc','pf','admin'). FC/PF callers can execute
--   this function; RC/OC cannot until the policy is aligned. This migration
--   does NOT alter RLS policies.
-- ==============================================================================

BEGIN;

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
    INSERT INTO public.employees
        (tenant_id, staff_no, full_name, position_id, employment_status,
         id_card_passport, contact_number, email, hire_date)
    VALUES
        (p_tenant_id, upper(btrim(p_staff_no)), btrim(p_full_name), p_position_id, v_status,
         p_id_card_passport, p_contact_number, p_email, coalesce(p_hire_date, CURRENT_DATE))
    RETURNING id INTO v_employee_id;

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
'P1.1-D atomic employee+assignment creation. SECURITY INVOKER, search_path=''''. Enforces tenant/estate boundary and employment_status allowlist. Any error rolls back both inserts. EXECUTE granted to authenticated only.';

-- ==============================================================================
-- RLS AUDIT (informational; no policy change in this migration):
--   employees_insert_policy / assignments_write_policy allow
--   auth_app_role() IN ('super_admin','fc','pf','admin').
--   FC/PF callers execute fine; RC/OC (allowed by the route's write-role list)
--   will be denied by RLS until the policies also permit
--   public.auth_is_cross_estate_role(). See P1.1-D report.
-- ==============================================================================

COMMIT;
