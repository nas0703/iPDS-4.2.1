-- ==============================================================================
-- IPDS ENTERPRISE DATABASE ARCHITECTURE: STAGE C2 EXTENDED OPERATIONAL TABLES
-- Migration: 20260912_add_estate_id_to_extended_operational_tables.sql
-- Status: EXECUTING (Explicitly authorized by user)
-- Purpose:
--   1. Adds additive estate_id to all remaining tenant-sensitive operational tables
--   2. Enforces multi-tenant Row Level Security (FORCE RLS)
--   3. Revokes anonymous direct table access, granting only to authenticated & service_role
--   4. Drops legacy permissive USING(true) policies on these operational tables
-- ==============================================================================

BEGIN;

-- 1. ADD COLUMN estate_id WITH DEFAULT 'FPM_TUNGGAL'
ALTER TABLE public.work_assignments 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.hantaran_pruning 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.fertilizer_daily_entries 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.fertilizer_master_schedule 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.fertilizer_inventory 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.fertilizer_inventory_transactions 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.merumput_inventory 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.merumput_inventory_transactions 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.bts_submissions 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.weed_scan_logs 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.hasil_abw_history 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.hasil_bbc_history 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

ALTER TABLE public.presentation_decks 
  ADD COLUMN IF NOT EXISTS estate_id text DEFAULT 'FPM_TUNGGAL';

-- 2. RELATIONAL & CONTEXTUAL BACKFILLS
UPDATE public.hasil_abw_history 
SET estate_id = 'FPM_ADELA' 
WHERE category = 'abwHistory_FPM_ADELA';

UPDATE public.work_assignments wa 
SET estate_id = w.estate_id 
FROM public.workers w 
WHERE wa.worker_id = w.id AND w.estate_id IS NOT NULL;

UPDATE public.fertilizer_inventory_transactions fit 
SET estate_id = fi.estate_id 
FROM public.fertilizer_inventory fi 
WHERE fit.inventory_id = fi.id AND fi.estate_id IS NOT NULL;

-- 3. CREATE OPTIMIZED INDEXES FOR MULTI-TENANCY
CREATE INDEX IF NOT EXISTS idx_work_assignments_estate_id ON public.work_assignments(estate_id);
CREATE INDEX IF NOT EXISTS idx_hantaran_pruning_estate_id ON public.hantaran_pruning(estate_id);
CREATE INDEX IF NOT EXISTS idx_fertilizer_daily_estate_id ON public.fertilizer_daily_entries(estate_id);
CREATE INDEX IF NOT EXISTS idx_fertilizer_master_estate_id ON public.fertilizer_master_schedule(estate_id);
CREATE INDEX IF NOT EXISTS idx_fertilizer_inventory_estate_id ON public.fertilizer_inventory(estate_id);
CREATE INDEX IF NOT EXISTS idx_fertilizer_transactions_estate_id ON public.fertilizer_inventory_transactions(estate_id);
CREATE INDEX IF NOT EXISTS idx_merumput_inventory_estate_id ON public.merumput_inventory(estate_id);
CREATE INDEX IF NOT EXISTS idx_merumput_transactions_estate_id ON public.merumput_inventory_transactions(estate_id);
CREATE INDEX IF NOT EXISTS idx_bts_submissions_estate_id ON public.bts_submissions(estate_id);
CREATE INDEX IF NOT EXISTS idx_weed_scan_logs_estate_id ON public.weed_scan_logs(estate_id);
CREATE INDEX IF NOT EXISTS idx_hasil_abw_history_estate_id ON public.hasil_abw_history(estate_id);
CREATE INDEX IF NOT EXISTS idx_hasil_bbc_history_estate_id ON public.hasil_bbc_history(estate_id);
CREATE INDEX IF NOT EXISTS idx_presentation_decks_estate_id ON public.presentation_decks(estate_id);

-- 4. ENABLE AND FORCE ROW LEVEL SECURITY
ALTER TABLE public.work_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hantaran_pruning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hantaran_pruning FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fertilizer_daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_daily_entries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fertilizer_master_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_master_schedule FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fertilizer_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_inventory FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fertilizer_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_inventory_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.merumput_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_inventory FORCE ROW LEVEL SECURITY;

ALTER TABLE public.merumput_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merumput_inventory_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bts_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bts_submissions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.weed_scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weed_scan_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hasil_abw_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_abw_history FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hasil_bbc_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_bbc_history FORCE ROW LEVEL SECURITY;

ALTER TABLE public.presentation_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_decks FORCE ROW LEVEL SECURITY;

-- 5. REVOKE ANONYMOUS ACCESS & GRANT AUTHENTICATED
REVOKE ALL ON public.work_assignments FROM anon;
REVOKE ALL ON public.hantaran_pruning FROM anon;
REVOKE ALL ON public.fertilizer_daily_entries FROM anon;
REVOKE ALL ON public.fertilizer_master_schedule FROM anon;
REVOKE ALL ON public.fertilizer_inventory FROM anon;
REVOKE ALL ON public.fertilizer_inventory_transactions FROM anon;
REVOKE ALL ON public.merumput_inventory FROM anon;
REVOKE ALL ON public.merumput_inventory_transactions FROM anon;
REVOKE ALL ON public.bts_submissions FROM anon;
REVOKE ALL ON public.weed_scan_logs FROM anon;
REVOKE ALL ON public.hasil_abw_history FROM anon;
REVOKE ALL ON public.hasil_bbc_history FROM anon;
REVOKE ALL ON public.presentation_decks FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hantaran_pruning TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fertilizer_daily_entries TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fertilizer_master_schedule TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fertilizer_inventory TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fertilizer_inventory_transactions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merumput_inventory TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merumput_inventory_transactions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bts_submissions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weed_scan_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hasil_abw_history TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hasil_bbc_history TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_decks TO authenticated, service_role;

-- 6. DROP EXISTING PERMISSIVE OR CONFLICTING POLICIES
DROP POLICY IF EXISTS "Enable all access for work_assignments" ON public.work_assignments;
DROP POLICY IF EXISTS "Allow full app access on work_assignments" ON public.work_assignments;
DROP POLICY IF EXISTS "work_assignments_select_policy" ON public.work_assignments;
DROP POLICY IF EXISTS "work_assignments_insert_policy" ON public.work_assignments;
DROP POLICY IF EXISTS "work_assignments_update_policy" ON public.work_assignments;
DROP POLICY IF EXISTS "work_assignments_delete_policy" ON public.work_assignments;

DROP POLICY IF EXISTS "Enable all access for pruning" ON public.hantaran_pruning;
DROP POLICY IF EXISTS "Allow full app access on hantaran_pruning" ON public.hantaran_pruning;
DROP POLICY IF EXISTS "hantaran_pruning_select_policy" ON public.hantaran_pruning;
DROP POLICY IF EXISTS "hantaran_pruning_insert_policy" ON public.hantaran_pruning;
DROP POLICY IF EXISTS "hantaran_pruning_update_policy" ON public.hantaran_pruning;
DROP POLICY IF EXISTS "hantaran_pruning_delete_policy" ON public.hantaran_pruning;

DROP POLICY IF EXISTS "Allow full app access on fertilizer_daily_entries" ON public.fertilizer_daily_entries;
DROP POLICY IF EXISTS "fertilizer_daily_entries_select_policy" ON public.fertilizer_daily_entries;
DROP POLICY IF EXISTS "fertilizer_daily_entries_insert_policy" ON public.fertilizer_daily_entries;
DROP POLICY IF EXISTS "fertilizer_daily_entries_update_policy" ON public.fertilizer_daily_entries;
DROP POLICY IF EXISTS "fertilizer_daily_entries_delete_policy" ON public.fertilizer_daily_entries;

DROP POLICY IF EXISTS "Allow full app access on fertilizer_master_schedule" ON public.fertilizer_master_schedule;
DROP POLICY IF EXISTS "fertilizer_master_schedule_select_policy" ON public.fertilizer_master_schedule;
DROP POLICY IF EXISTS "fertilizer_master_schedule_insert_policy" ON public.fertilizer_master_schedule;
DROP POLICY IF EXISTS "fertilizer_master_schedule_update_policy" ON public.fertilizer_master_schedule;
DROP POLICY IF EXISTS "fertilizer_master_schedule_delete_policy" ON public.fertilizer_master_schedule;

DROP POLICY IF EXISTS "Enable all access for inventory" ON public.fertilizer_inventory;
DROP POLICY IF EXISTS "Allow full app access on fertilizer_inventory" ON public.fertilizer_inventory;
DROP POLICY IF EXISTS "fertilizer_inventory_select_policy" ON public.fertilizer_inventory;
DROP POLICY IF EXISTS "fertilizer_inventory_insert_policy" ON public.fertilizer_inventory;
DROP POLICY IF EXISTS "fertilizer_inventory_update_policy" ON public.fertilizer_inventory;
DROP POLICY IF EXISTS "fertilizer_inventory_delete_policy" ON public.fertilizer_inventory;

DROP POLICY IF EXISTS "Enable all access for inventory_transactions" ON public.fertilizer_inventory_transactions;
DROP POLICY IF EXISTS "Allow full app access on fertilizer_inventory_transactions" ON public.fertilizer_inventory_transactions;
DROP POLICY IF EXISTS "fertilizer_inventory_transactions_select_policy" ON public.fertilizer_inventory_transactions;
DROP POLICY IF EXISTS "fertilizer_inventory_transactions_insert_policy" ON public.fertilizer_inventory_transactions;
DROP POLICY IF EXISTS "fertilizer_inventory_transactions_update_policy" ON public.fertilizer_inventory_transactions;
DROP POLICY IF EXISTS "fertilizer_inventory_transactions_delete_policy" ON public.fertilizer_inventory_transactions;

DROP POLICY IF EXISTS "Enable all access for merumput_inventory" ON public.merumput_inventory;
DROP POLICY IF EXISTS "Allow full app access on merumput_inventory" ON public.merumput_inventory;
DROP POLICY IF EXISTS "merumput_inventory_select_policy" ON public.merumput_inventory;
DROP POLICY IF EXISTS "merumput_inventory_insert_policy" ON public.merumput_inventory;
DROP POLICY IF EXISTS "merumput_inventory_update_policy" ON public.merumput_inventory;
DROP POLICY IF EXISTS "merumput_inventory_delete_policy" ON public.merumput_inventory;

DROP POLICY IF EXISTS "Enable all access for merumput_inventory_transactions" ON public.merumput_inventory_transactions;
DROP POLICY IF EXISTS "Allow full app access on merumput_inventory_transactions" ON public.merumput_inventory_transactions;
DROP POLICY IF EXISTS "merumput_inventory_transactions_select_policy" ON public.merumput_inventory_transactions;
DROP POLICY IF EXISTS "merumput_inventory_transactions_insert_policy" ON public.merumput_inventory_transactions;
DROP POLICY IF EXISTS "merumput_inventory_transactions_update_policy" ON public.merumput_inventory_transactions;
DROP POLICY IF EXISTS "merumput_inventory_transactions_delete_policy" ON public.merumput_inventory_transactions;

DROP POLICY IF EXISTS "Allow full app access on bts_submissions" ON public.bts_submissions;
DROP POLICY IF EXISTS "bts_submissions_select_policy" ON public.bts_submissions;
DROP POLICY IF EXISTS "bts_submissions_insert_policy" ON public.bts_submissions;
DROP POLICY IF EXISTS "bts_submissions_update_policy" ON public.bts_submissions;
DROP POLICY IF EXISTS "bts_submissions_delete_policy" ON public.bts_submissions;

DROP POLICY IF EXISTS "weed_scan_logs_select_policy" ON public.weed_scan_logs;
DROP POLICY IF EXISTS "weed_scan_logs_insert_policy" ON public.weed_scan_logs;
DROP POLICY IF EXISTS "weed_scan_logs_update_policy" ON public.weed_scan_logs;
DROP POLICY IF EXISTS "weed_scan_logs_delete_policy" ON public.weed_scan_logs;

DROP POLICY IF EXISTS "Enable all access for hasil_abw_history" ON public.hasil_abw_history;
DROP POLICY IF EXISTS "Allow full app access on hasil_abw_history" ON public.hasil_abw_history;
DROP POLICY IF EXISTS "hasil_abw_history_select_policy" ON public.hasil_abw_history;
DROP POLICY IF EXISTS "hasil_abw_history_insert_policy" ON public.hasil_abw_history;
DROP POLICY IF EXISTS "hasil_abw_history_update_policy" ON public.hasil_abw_history;
DROP POLICY IF EXISTS "hasil_abw_history_delete_policy" ON public.hasil_abw_history;

DROP POLICY IF EXISTS "Allow full app access on hasil_bbc_history" ON public.hasil_bbc_history;
DROP POLICY IF EXISTS "hasil_bbc_history_select_policy" ON public.hasil_bbc_history;
DROP POLICY IF EXISTS "hasil_bbc_history_insert_policy" ON public.hasil_bbc_history;
DROP POLICY IF EXISTS "hasil_bbc_history_update_policy" ON public.hasil_bbc_history;
DROP POLICY IF EXISTS "hasil_bbc_history_delete_policy" ON public.hasil_bbc_history;

DROP POLICY IF EXISTS "Allow full app access on presentation_decks" ON public.presentation_decks;
DROP POLICY IF EXISTS "presentation_decks_select_policy" ON public.presentation_decks;
DROP POLICY IF EXISTS "presentation_decks_insert_policy" ON public.presentation_decks;
DROP POLICY IF EXISTS "presentation_decks_update_policy" ON public.presentation_decks;
DROP POLICY IF EXISTS "presentation_decks_delete_policy" ON public.presentation_decks;

-- 7. RE-CREATE GRANULAR MULTI-TENANT POLICIES
-- A. work_assignments
CREATE POLICY work_assignments_select_policy ON public.work_assignments
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY work_assignments_insert_policy ON public.work_assignments
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY work_assignments_update_policy ON public.work_assignments
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY work_assignments_delete_policy ON public.work_assignments
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- B. hantaran_pruning
CREATE POLICY hantaran_pruning_select_policy ON public.hantaran_pruning
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY hantaran_pruning_insert_policy ON public.hantaran_pruning
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hantaran_pruning_update_policy ON public.hantaran_pruning
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hantaran_pruning_delete_policy ON public.hantaran_pruning
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- C. fertilizer_daily_entries
CREATE POLICY fertilizer_daily_entries_select_policy ON public.fertilizer_daily_entries
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY fertilizer_daily_entries_insert_policy ON public.fertilizer_daily_entries
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY fertilizer_daily_entries_update_policy ON public.fertilizer_daily_entries
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY fertilizer_daily_entries_delete_policy ON public.fertilizer_daily_entries
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- D. fertilizer_master_schedule
CREATE POLICY fertilizer_master_schedule_select_policy ON public.fertilizer_master_schedule
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY fertilizer_master_schedule_insert_policy ON public.fertilizer_master_schedule
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY fertilizer_master_schedule_update_policy ON public.fertilizer_master_schedule
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY fertilizer_master_schedule_delete_policy ON public.fertilizer_master_schedule
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- E. fertilizer_inventory
CREATE POLICY fertilizer_inventory_select_policy ON public.fertilizer_inventory
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY fertilizer_inventory_insert_policy ON public.fertilizer_inventory
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY fertilizer_inventory_update_policy ON public.fertilizer_inventory
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY fertilizer_inventory_delete_policy ON public.fertilizer_inventory
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- F. fertilizer_inventory_transactions
CREATE POLICY fertilizer_inventory_transactions_select_policy ON public.fertilizer_inventory_transactions
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY fertilizer_inventory_transactions_insert_policy ON public.fertilizer_inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY fertilizer_inventory_transactions_update_policy ON public.fertilizer_inventory_transactions
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY fertilizer_inventory_transactions_delete_policy ON public.fertilizer_inventory_transactions
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- G. merumput_inventory
CREATE POLICY merumput_inventory_select_policy ON public.merumput_inventory
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY merumput_inventory_insert_policy ON public.merumput_inventory
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY merumput_inventory_update_policy ON public.merumput_inventory
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY merumput_inventory_delete_policy ON public.merumput_inventory
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- H. merumput_inventory_transactions
CREATE POLICY merumput_inventory_transactions_select_policy ON public.merumput_inventory_transactions
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY merumput_inventory_transactions_insert_policy ON public.merumput_inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY merumput_inventory_transactions_update_policy ON public.merumput_inventory_transactions
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY merumput_inventory_transactions_delete_policy ON public.merumput_inventory_transactions
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- I. bts_submissions
CREATE POLICY bts_submissions_select_policy ON public.bts_submissions
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY bts_submissions_insert_policy ON public.bts_submissions
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY bts_submissions_update_policy ON public.bts_submissions
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY bts_submissions_delete_policy ON public.bts_submissions
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- J. weed_scan_logs
CREATE POLICY weed_scan_logs_select_policy ON public.weed_scan_logs
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY weed_scan_logs_insert_policy ON public.weed_scan_logs
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY weed_scan_logs_update_policy ON public.weed_scan_logs
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY weed_scan_logs_delete_policy ON public.weed_scan_logs
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- K. hasil_abw_history
CREATE POLICY hasil_abw_history_select_policy ON public.hasil_abw_history
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY hasil_abw_history_insert_policy ON public.hasil_abw_history
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hasil_abw_history_update_policy ON public.hasil_abw_history
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hasil_abw_history_delete_policy ON public.hasil_abw_history
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- L. hasil_bbc_history
CREATE POLICY hasil_bbc_history_select_policy ON public.hasil_bbc_history
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY hasil_bbc_history_insert_policy ON public.hasil_bbc_history
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hasil_bbc_history_update_policy ON public.hasil_bbc_history
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY hasil_bbc_history_delete_policy ON public.hasil_bbc_history
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

-- M. presentation_decks
CREATE POLICY presentation_decks_select_policy ON public.presentation_decks
  FOR SELECT TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role());

CREATE POLICY presentation_decks_insert_policy ON public.presentation_decks
  FOR INSERT TO authenticated
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY presentation_decks_update_policy ON public.presentation_decks
  FOR UPDATE TO authenticated
  USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())
  WITH CHECK (estate_id = public.auth_estate_id());

CREATE POLICY presentation_decks_delete_policy ON public.presentation_decks
  FOR DELETE TO authenticated
  USING (estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin'));

COMMIT;
