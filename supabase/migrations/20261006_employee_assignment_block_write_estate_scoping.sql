-- ==============================================================================
-- MIGRATION: 20261006_employee_assignment_block_write_estate_scoping.sql
-- PURPOSE: P5-1 — close the cross-estate WRITE gap on
--          public.employee_assignment_blocks (the last employee-master table
--          whose write policy was still tenant + role scoped with no estate
--          restriction).
--
--   BEFORE (20260915_employee_master_data_foundation.sql lines 449-455):
--     CREATE POLICY "assignment_blocks_write_policy" ON public.employee_assignment_blocks
--       FOR ALL TO authenticated
--       USING (tenant_id = public.auth_tenant_id()
--              AND public.auth_app_role() IN ('super_admin','fc','pf','admin'))
--       WITH CHECK (same)
--     -> an allowed estate-level role could INSERT/UPDATE/DELETE block rows
--        attached to ANY estate's assignment in the tenant, and could repoint a
--        block row at another estate's assignment.
--
--   AFTER: the same tenant boundary and the same role allowlist, plus an estate
--   clause on BOTH USING and WITH CHECK that resolves the estate through the
--   parent assignment (this table has NO estate_id column of its own; the estate
--   dimension lives on public.employee_assignments, reached via assignment_id):
--     * public.auth_is_cross_estate_role() -> rc, oc, admin, super_admin
--     * public.auth_is_super_admin()       -> superadmin alias + FC Tunggal
--     retain cross-estate write access;
--     * every other allowed role (ordinary estate-level fc/pf) is confined to
--       rows whose parent assignment belongs to public.auth_estate_id().
--
--   WITH CHECK is what prevents repointing a block row at another estate's
--   assignment: for an ordinary estate user the OLD parent must be in their
--   estate (USING) AND the NEW parent must still be in their estate (WITH CHECK).
--
-- WRITER-PATH CHECK (no STOP condition):
--   There is currently NO INSERT/UPDATE/DELETE writer of
--   public.employee_assignment_blocks anywhere in the repository. Migrations
--   only define the table and its policies; src/ touches it read-only
--   (employeeMasterService.getAssignmentHistory performs a nested SELECT of
--   employee_assignment_blocks + org_blocks). Nothing legitimate is broken.
--   NOTE (out of scope, not changed here): create_employee_with_assignment()
--   accepts p_* parameters and the route sends block_ids, but the RPC never
--   inserts employee_assignment_blocks rows — that pre-existing gap is
--   untouched.
--
-- NOT CHANGED (deliberately):
--   * public.auth_* helper definitions.
--   * "assignment_blocks_read_policy" (estate-scoped by P3-1 / 20261004).
--   * public.employee_assignments policies (P4-1 / 20261005).
--   * public.employees policies (P3-1 / 20261004).
--   * public.employee_credentials.
--   * The role allowlist literal, so `pf` is confined (not broadened) and
--     `rc`, `oc`, `executive_hq` gain nothing (they were never in the allowlist).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EMPLOYEE ASSIGNMENT BLOCKS: estate-scoped writes via the parent assignment
--    (tenant + role allowlist preserved verbatim)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "assignment_blocks_write_policy" ON public.employee_assignment_blocks;
DROP POLICY IF EXISTS "assignment_blocks_write_insert_policy" ON public.employee_assignment_blocks;
DROP POLICY IF EXISTS "assignment_blocks_write_update_policy" ON public.employee_assignment_blocks;
DROP POLICY IF EXISTS "assignment_blocks_write_delete_policy" ON public.employee_assignment_blocks;

CREATE POLICY "assignment_blocks_write_insert_policy" ON public.employee_assignment_blocks
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
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

CREATE POLICY "assignment_blocks_write_update_policy" ON public.employee_assignment_blocks
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
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
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
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

CREATE POLICY "assignment_blocks_write_delete_policy" ON public.employee_assignment_blocks
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
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
-- 2. DEPLOY-TIME GUARD: exactly one permissive policy per command.
--    Same-command permissive policies are OR-combined, so a leftover duplicate
--    would silently re-open the cross-estate write path.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_cmd   text;
  v_count integer;
BEGIN
  FOREACH v_cmd IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
  LOOP
    SELECT count(*) INTO v_count
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employee_assignment_blocks'
      AND cmd IN (v_cmd, 'ALL')
      AND permissive = 'PERMISSIVE';

    IF v_count <> 1 THEN
      RAISE EXCEPTION
        'DUPLICATE_PERMISSIVE_POLICY_DETECTED: public.employee_assignment_blocks has % permissive policies applying to % (expected exactly 1)',
        v_count, v_cmd
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- RLS AUDIT (informational; not changed by this migration):
--   * The parent-assignment subquery is evaluated as the caller, so
--     "assignments_read_policy" (estate-scoped since 20260915:419-429) also
--     applies to it: an ordinary caller can only match an assignment it is
--     allowed to read, which fails closed for foreign estates.
--   * The same role-allowlist literal is preserved, including the pre-existing
--     alias gap ('superadmin' without underscore is not in
--     ('super_admin','fc','pf','admin')). Intentionally NOT widened here.
--   * ON DELETE CASCADE from public.employee_assignments performs its child
--     delete as a referential action; PostgreSQL does not apply row security to
--     referential integrity actions, so cascades are unaffected by this policy.
-- ==============================================================================

COMMIT;
