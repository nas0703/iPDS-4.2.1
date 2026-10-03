-- ==============================================================================
-- ROLLBACK: 20261008_create_employee_assignment_block_persistence_rollback.sql
-- Reverses: 20261008_create_employee_assignment_block_persistence.sql
--
-- Location note: kept OUTSIDE supabase/migrations/ on purpose so the Supabase
-- CLI does not auto-apply this script as a forward migration when
-- `supabase db push` runs (it applies every *.sql in supabase/migrations/).
-- Apply manually only during a reviewed rollback.
--
-- WHAT THIS DOES
--   * DROPs the 16-argument function (with p_block_ids).
--   * Restores the original 15-argument implementation exactly as created by
--     20261004_employee_master_rls_estate_scoping.sql.
--   * Restores its original EXECUTE grants (authenticated only).
--
-- WHAT THIS DOES NOT DO (deliberate)
--   * Does NOT delete public.org_blocks master data (Phase 6A seed stays).
--   * Does NOT delete public.employee_assignment_blocks rows that were already
--     persisted. Deleting them automatically could destroy assignment history
--     and is blocked by employee_assignment_blocks.block_id -> org_blocks(id)
--     ON DELETE RESTRICT anyway. Clean them up manually if required.
--
-- EFFECT AFTER ROLLBACK: employee creation stops persisting block selections
--   (block_ids supplied by the route are ignored by the restored function), and
--   the route will fail closed with 500 when blocks are requested, because it
--   only takes the schema-cache fallback path when no blocks were requested.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. DROP the 16-argument version
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_employee_with_assignment(
    uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar,
    date, varchar, varchar, varchar, date, text, text[]
);

-- ------------------------------------------------------------------------------
-- 2. Restore the original 15-argument implementation (20261004 definition)
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

    v_employee_id := gen_random_uuid();

    INSERT INTO public.employees
        (id, tenant_id, staff_no, full_name, position_id, employment_status,
         id_card_passport, contact_number, email, hire_date)
    VALUES
        (v_employee_id, p_tenant_id, upper(btrim(p_staff_no)), btrim(p_full_name), p_position_id, v_status,
         p_id_card_passport, p_contact_number, p_email, coalesce(p_hire_date, CURRENT_DATE));

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

-- ------------------------------------------------------------------------------
-- 3. Restore the original EXECUTE grants
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_employee_with_assignment(uuid, uuid, uuid, varchar, varchar, varchar, varchar, varchar, varchar, date, varchar, varchar, varchar, date, text) TO authenticated;

COMMIT;
