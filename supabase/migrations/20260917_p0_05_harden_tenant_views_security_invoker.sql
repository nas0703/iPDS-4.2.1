-- ==============================================================================
-- MIGRATION: 20260917_p0_05_harden_tenant_views_security_invoker.sql
-- PURPOSE: P0-05 remediation — eliminate cross-tenant RLS bypass through
--          non-invoker (SECURITY DEFINER) views on tenant tables.
--
-- BACKGROUND:
--   Views in PostgreSQL execute with the privileges of their OWNER. The four
--   public views below were created without `security_invoker = true`, so they
--   ran as the migration owner (which bypasses RLS) and returned rows across ALL
--   tenants/estates, ignoring the estate_id / tenant_id RLS policies on the
--   underlying tables. `v_current_employee_assignments` is additionally queried
--   from the browser with the public anon key.
--
-- SCOPE (P0-05):
--   1. Force all four views to run with the caller's privileges
--      (security_invoker = true) so the underlying table RLS is enforced.
--   2. Revoke PUBLIC/anon access to the views; keep authenticated + service_role.
--   3. FORCE ROW LEVEL SECURITY on the seven Stage C2 tables so RLS also applies
--      to the table owner.
--
-- This migration does NOT change any view definition, table policy or
-- application code. Existing tenant/estate RLS policies are preserved.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SECURITY INVOKER VIEWS: enforce caller-privilege (RLS-respecting) execution
-- ------------------------------------------------------------------------------
ALTER VIEW public.merumput_daily_entries SET (security_invoker = true);
ALTER VIEW public.data_pekerja SET (security_invoker = true);
ALTER VIEW public.annual_yield SET (security_invoker = true);
ALTER VIEW public.v_current_employee_assignments SET (security_invoker = true);

-- ------------------------------------------------------------------------------
-- 2. PRIVILEGE LOCKDOWN: revoke PUBLIC/anon; grant intended roles only
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.merumput_daily_entries FROM PUBLIC, anon;
REVOKE ALL ON public.data_pekerja FROM PUBLIC, anon;
REVOKE ALL ON public.annual_yield FROM PUBLIC, anon;
REVOKE ALL ON public.v_current_employee_assignments FROM PUBLIC, anon;

GRANT SELECT ON public.merumput_daily_entries TO authenticated, service_role;
GRANT SELECT ON public.data_pekerja TO authenticated, service_role;
GRANT SELECT ON public.annual_yield TO authenticated, service_role;
GRANT SELECT ON public.v_current_employee_assignments TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. FORCE ROW LEVEL SECURITY on Stage C2 tables
-- ------------------------------------------------------------------------------
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.org_positions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.org_blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.employees FORCE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignment_blocks FORCE ROW LEVEL SECURITY;

COMMIT;
