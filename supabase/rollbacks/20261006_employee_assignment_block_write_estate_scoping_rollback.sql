-- ==============================================================================
-- ROLLBACK: 20261006_employee_assignment_block_write_estate_scoping_rollback.sql
-- Reverses: 20261006_employee_assignment_block_write_estate_scoping.sql
--
-- Location note: kept OUTSIDE supabase/migrations/ on purpose so the Supabase
-- CLI does not auto-apply this script as a forward migration when
-- `supabase db push` runs (it applies every *.sql in supabase/migrations/).
-- Apply manually only during a reviewed rollback.
--
-- WARNING: this restores the pre-P5-1 behaviour, i.e. an allowed estate-level
-- role (fc/pf) can again INSERT/UPDATE/DELETE employee_assignment_blocks rows
-- for ANY estate's assignment in the tenant, including repointing a block row
-- at another estate's assignment.
--
-- Restores the exact policy text created by
-- 20260915_employee_master_data_foundation.sql (section 11.7).
-- ==============================================================================

BEGIN;

-- Per-command policies introduced by the forward migration must also be removed,
-- otherwise the per-command shape would survive the rollback.
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

COMMIT;
