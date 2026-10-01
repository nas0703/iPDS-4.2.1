-- ==============================================================================
-- ROLLBACK: 20261004_employee_master_rls_estate_scoping_rollback.sql
-- Reverses: 20261004_employee_master_rls_estate_scoping.sql
--
-- Location note: kept OUTSIDE supabase/migrations/ on purpose so the Supabase
-- CLI does not auto-apply this script as a forward migration when
-- `supabase db push` runs (it applies every *.sql in supabase/migrations/).
-- Apply manually only during a reviewed rollback.
--
-- WARNING: this restores the pre-P3-1 TENANT-WIDE employee read policies, i.e.
-- any authenticated JWT can again read every estate's employee master records.
-- The companion RPC is also restored to its RETURNING-based form, which is only
-- safe while the tenant-wide policies are in place.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Restore the tenant-wide employee read policy (20260915 lines 399-402)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "employees_read_policy" ON public.employees;
CREATE POLICY "employees_read_policy" ON public.employees
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());

-- ------------------------------------------------------------------------------
-- 2. Restore the tenant-wide assignment-block read policy (20260915 lines 444-447)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "assignment_blocks_read_policy" ON public.employee_assignment_blocks;
CREATE POLICY "assignment_blocks_read_policy" ON public.employee_assignment_blocks
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id() OR public.auth_is_super_admin());

-- ------------------------------------------------------------------------------
-- 2b. Restore the baseline FOR ALL write policy on employee_assignment_blocks
--     (20260915 section 11.7). The forward migration 2b section replaced it with
--     explicit per-command policies, so those must be dropped first or the
--     baseline shape would not be restored exactly.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "assignment_blocks_write_insert_policy" ON public.employee_assignment_blocks;
DROP POLICY IF EXISTS "assignment_blocks_write_update_policy" ON public.employee_assignment_blocks;
DROP POLICY IF EXISTS "assignment_blocks_write_delete_policy" ON public.employee_assignment_blocks;
DROP POLICY IF EXISTS "assignment_blocks_write_policy" ON public.employee_assignment_blocks;
CREATE POLICY "assignment_blocks_write_policy" ON public.employee_assignment_blocks
  FOR ALL TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  );

-- ------------------------------------------------------------------------------
-- 3. Restore the original RETURNING-based atomic create RPC
--    (20260929_p1_1d_employee_create_atomic_rpc.sql)
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

    IF p_tenant_id IS DISTINCT FROM public.auth_tenant_id() THEN
        RAISE EXCEPTION 'EMPLOYEE_TENANT_VIOLATION: tenant outside caller scope' USING ERRCODE = '42501';
    END IF;
    IF p_estate_id IS DISTINCT FROM public.auth_estate_id()
       AND NOT public.auth_is_cross_estate_role() THEN
        RAISE EXCEPTION 'EMPLOYEE_ESTATE_VIOLATION: estate % outside caller scope', p_estate_id USING ERRCODE = '42501';
    END IF;

    v_status := upper(coalesce(nullif(btrim(p_employment_status), ''), 'ACTIVE'));
    IF v_status NOT IN ('ACTIVE', 'PROBATION', 'INACTIVE', 'RETIRED', 'TERMINATED', 'RESIGNED') THEN
        RAISE EXCEPTION 'EMPLOYEE_VALIDATION_ERROR: invalid employment_status %', p_employment_status USING ERRCODE = '22023';
    END IF;

    v_role := coalesce(nullif(btrim(p_assignment_role), ''), 'PRIMARY');
    IF v_role NOT IN ('PRIMARY', 'SECONDARY', 'ACTING', 'TEMPORARY') THEN
        RAISE EXCEPTION 'EMPLOYEE_VALIDATION_ERROR: invalid assignment_role %', p_assignment_role USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.employees
        (tenant_id, staff_no, full_name, position_id, employment_status,
         id_card_passport, contact_number, email, hire_date)
    VALUES
        (p_tenant_id, upper(btrim(p_staff_no)), btrim(p_full_name), p_position_id, v_status,
         p_id_card_passport, p_contact_number, p_email, coalesce(p_hire_date, CURRENT_DATE))
    RETURNING id INTO v_employee_id;

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

COMMIT;
