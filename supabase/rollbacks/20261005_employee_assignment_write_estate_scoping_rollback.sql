-- ==============================================================================
-- ROLLBACK: 20261005_employee_assignment_write_estate_scoping_rollback.sql
-- Reverses: 20261005_employee_assignment_write_estate_scoping.sql
--
-- Location note: kept OUTSIDE supabase/migrations/ on purpose so the Supabase
-- CLI does not auto-apply this script as a forward migration when
-- `supabase db push` runs (it applies every *.sql in supabase/migrations/).
-- Apply manually only during a reviewed rollback.
--
-- WARNING: this restores the pre-P4-1 behaviour, i.e. an allowed estate-level
-- role (fc/pf) can again INSERT/UPDATE/DELETE employee_assignments rows for ANY
-- estate in the tenant via direct PostgREST access, including moving a row from
-- its own estate to another estate.
--
-- Restores the exact policy text created by
-- 20260915_employee_master_data_foundation.sql (section 11.6).
-- ==============================================================================

BEGIN;

-- Per-command policies introduced by the forward migration must also be removed,
-- otherwise the per-command shape would survive the rollback.
DROP POLICY IF EXISTS "assignments_write_insert_policy" ON public.employee_assignments;
DROP POLICY IF EXISTS "assignments_write_update_policy" ON public.employee_assignments;
DROP POLICY IF EXISTS "assignments_write_delete_policy" ON public.employee_assignments;
DROP POLICY IF EXISTS "assignments_write_policy" ON public.employee_assignments;
CREATE POLICY "assignments_write_policy" ON public.employee_assignments
  FOR ALL TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
  );

COMMIT;
