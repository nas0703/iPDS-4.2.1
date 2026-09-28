-- ==============================================================================
-- IPDS ENTERPRISE DATABASE ARCHITECTURE: FINALIZE ALL TENANT POLICIES
-- Migration: 20260912_finalize_all_tenant_policies.sql
-- ==============================================================================

BEGIN;

-- 1. hantaran_hasil
DROP POLICY IF EXISTS "Enable insert for all" ON public.hantaran_hasil;
DROP POLICY IF EXISTS "hantaran_hasil_select_policy" ON public.hantaran_hasil;
DROP POLICY IF EXISTS "hantaran_hasil_insert_policy" ON public.hantaran_hasil;
DROP POLICY IF EXISTS "hantaran_hasil_update_policy" ON public.hantaran_hasil;
DROP POLICY IF EXISTS "hantaran_hasil_delete_policy" ON public.hantaran_hasil;

CREATE POLICY hantaran_hasil_select_policy ON public.hantaran_hasil
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY hantaran_hasil_insert_policy ON public.hantaran_hasil
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hantaran_hasil_update_policy ON public.hantaran_hasil
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hantaran_hasil_delete_policy ON public.hantaran_hasil
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- 2. attendance_records
DROP POLICY IF EXISTS "attendance_records_select_policy" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_insert_policy" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_update_policy" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_delete_policy" ON public.attendance_records;

CREATE POLICY attendance_records_select_policy ON public.attendance_records
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY attendance_records_insert_policy ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY attendance_records_update_policy ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY attendance_records_delete_policy ON public.attendance_records
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- 3. data_hujan
DROP POLICY IF EXISTS "data_hujan_select_policy" ON public.data_hujan;
DROP POLICY IF EXISTS "data_hujan_insert_policy" ON public.data_hujan;
DROP POLICY IF EXISTS "data_hujan_update_policy" ON public.data_hujan;
DROP POLICY IF EXISTS "data_hujan_delete_policy" ON public.data_hujan;

CREATE POLICY data_hujan_select_policy ON public.data_hujan
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY data_hujan_insert_policy ON public.data_hujan
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY data_hujan_update_policy ON public.data_hujan
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY data_hujan_delete_policy ON public.data_hujan
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- 4. hasil_backlog_history
DROP POLICY IF EXISTS "hasil_backlog_history_select_policy" ON public.hasil_backlog_history;
DROP POLICY IF EXISTS "hasil_backlog_history_insert_policy" ON public.hasil_backlog_history;
DROP POLICY IF EXISTS "hasil_backlog_history_update_policy" ON public.hasil_backlog_history;
DROP POLICY IF EXISTS "hasil_backlog_history_delete_policy" ON public.hasil_backlog_history;

CREATE POLICY hasil_backlog_history_select_policy ON public.hasil_backlog_history
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY hasil_backlog_history_insert_policy ON public.hasil_backlog_history
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hasil_backlog_history_update_policy ON public.hasil_backlog_history
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hasil_backlog_history_delete_policy ON public.hasil_backlog_history
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- 5. Revoke anon and grant to authenticated
REVOKE ALL ON public.hantaran_hasil FROM anon;
REVOKE ALL ON public.attendance_records FROM anon;
REVOKE ALL ON public.data_hujan FROM anon;
REVOKE ALL ON public.hasil_backlog_history FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hantaran_hasil TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_hujan TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hasil_backlog_history TO authenticated, service_role;

ALTER TABLE public.hantaran_hasil FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.data_hujan FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_backlog_history FORCE ROW LEVEL SECURITY;

COMMIT;
