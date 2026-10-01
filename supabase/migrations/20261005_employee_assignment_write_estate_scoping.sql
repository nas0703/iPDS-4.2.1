-- ==============================================================================
-- MIGRATION: 20261005_employee_assignment_write_estate_scoping.sql
-- PURPOSE: P4-1 — close the cross-estate WRITE gap on public.employee_assignments.
--
--   BEFORE (20260915_employee_master_data_foundation.sql lines 431-441):
--     CREATE POLICY "assignments_write_policy" ON public.employee_assignments
--       FOR ALL TO authenticated
--       USING (tenant_id = public.auth_tenant_id()
--              AND public.auth_app_role() IN ('super_admin','fc','pf','admin'))
--       WITH CHECK (same)
--     -> a tenant-scoped, role-scoped policy with NO estate restriction. An
--        allowed estate-level role (fc/pf) could INSERT/UPDATE/DELETE assignment
--        rows belonging to ANY estate in the tenant through direct PostgREST
--        access, and could move a row from its own estate to another estate.
--
--   AFTER: the same tenant boundary and the same role allowlist, plus an estate
--   clause on BOTH USING and WITH CHECK:
--     * public.auth_is_cross_estate_role() -> rc, oc, admin, super_admin
--     * public.auth_is_super_admin()       -> superadmin alias + FC Tunggal
--     retain cross-estate write access;
--     * every other allowed role (i.e. ordinary estate-level fc/pf) is confined
--       to rows whose estate_id = public.auth_estate_id().
--
--   WITH CHECK is what prevents an estate reassignment: for an ordinary estate
--   user the OLD row must be in their estate (USING) AND the NEW row must still
--   be in their estate (WITH CHECK), so Estate A -> Estate B fails.
--
-- NOT CHANGED (deliberately):
--   * public.auth_* helper definitions.
--   * "assignments_read_policy" (already estate-scoped since 20260915:419-429).
--   * public."employees"/"employee_assignment_blocks" policies (P3-1).
--   * public.employee_credentials.
--   * The role allowlist literal, so `pf` and `executive_hq` are NOT broadened.
--     `executive_hq` is not in the allowlist and is not an auth_* cross-estate
--     role, so it remains denied exactly as before.
--
-- LEGITIMATE WRITE PATH CHECK (no STOP condition):
--   The only writer of public.employee_assignments in the repository is the
--   INSERT inside public.create_employee_with_assignment (20260929:104,
--   superseded by 20261004:213). That function independently enforces
--   "p_estate_id IS DISTINCT FROM public.auth_estate_id() AND NOT
--   public.auth_is_cross_estate_role() => EMPLOYEE_ESTATE_VIOLATION", so an
--   ordinary caller always inserts into their own estate (new WITH CHECK
--   passes) and a cross-estate role passes via the role clause. There is no
--   UPDATE or DELETE of employee_assignments anywhere in the codebase, and no
--   server-side transfer operation exists (transferAssignment is client-side
--   local storage only), so no legitimate path is broken and none was weakened.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EMPLOYEE ASSIGNMENTS: estate-scoped writes (tenant + role allowlist kept)
-- ------------------------------------------------------------------------------
--    BASELINE CORRECTION: the policy is expressed explicitly per command
--    instead of FOR ALL. A FOR ALL policy also applies to SELECT, so combining
--    it with "assignments_read_policy" left TWO permissive SELECT policies and
--    the tenant-wide write predicate (which has no estate clause) would have
--    widened SELECT across estates. The union of INSERT/UPDATE/DELETE
--    privileges is identical -- no predicate is broadened -- and the guard in
--    section 2 is intentionally NOT weakened.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "assignments_write_policy" ON public.employee_assignments;
DROP POLICY IF EXISTS "assignments_write_insert_policy" ON public.employee_assignments;
DROP POLICY IF EXISTS "assignments_write_update_policy" ON public.employee_assignments;
DROP POLICY IF EXISTS "assignments_write_delete_policy" ON public.employee_assignments;

CREATE POLICY "assignments_write_insert_policy" ON public.employee_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
    AND (
      public.auth_is_cross_estate_role()
      OR public.auth_is_super_admin()
      OR estate_id = public.auth_estate_id()
    )
  );

CREATE POLICY "assignments_write_update_policy" ON public.employee_assignments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
    AND (
      public.auth_is_cross_estate_role()
      OR public.auth_is_super_admin()
      OR estate_id = public.auth_estate_id()
    )
  )
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
    AND (
      public.auth_is_cross_estate_role()
      OR public.auth_is_super_admin()
      OR estate_id = public.auth_estate_id()
    )
  );

CREATE POLICY "assignments_write_delete_policy" ON public.employee_assignments
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_app_role() IN ('super_admin', 'fc', 'pf', 'admin')
    AND (
      public.auth_is_cross_estate_role()
      OR public.auth_is_super_admin()
      OR estate_id = public.auth_estate_id()
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
      AND tablename = 'employee_assignments'
      AND cmd IN (v_cmd, 'ALL')
      AND permissive = 'PERMISSIVE';

    IF v_count <> 1 THEN
      RAISE EXCEPTION
        'DUPLICATE_PERMISSIVE_POLICY_DETECTED: public.employee_assignments has % permissive policies applying to % (expected exactly 1)',
        v_count, v_cmd
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- RLS AUDIT (informational; not changed by this migration):
--   * The role allowlist literal is preserved verbatim, including the
--     pre-existing alias gap: 'superadmin' (no underscore) is NOT in
--     ('super_admin','fc','pf','admin'), so such an identity still cannot write
--     assignments even though auth_is_super_admin() recognises it for reads.
--     Pre-existing; intentionally NOT widened here.
--   * "assignments_read_policy" remains estate-scoped, so an UPDATE/DELETE also
--     requires SELECT visibility of the row (PostgreSQL applies SELECT policies
--     to UPDATE/DELETE and to RETURNING), keeping read and write scope aligned.
-- ==============================================================================

COMMIT;
