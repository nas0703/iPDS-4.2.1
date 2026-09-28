-- Migration: 20260928_p1_org_positions_reconciliation.sql
-- Description: Reconcile organization positions (org_positions) with frontend master registries
--              to prevent foreign key violations on public.employees(position_id).

BEGIN;

-- 1. Ensure all standard positions are seeded and reconciled
INSERT INTO public.org_positions (id, tenant_id, code, title, category, department, is_active)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'EM', 'Estate Manager (Pengurus Ladang)', 'MANAGEMENT', 'PENTADBIRAN', true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'AM', 'Assistant Manager (Penolong Pengurus)', 'MANAGEMENT', 'OPERASI', true),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'FS', 'Field Supervisor (Penyelia Lapangan)', 'SUPERVISORY', 'OPERASI', true),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'MDR', 'Mandore / Mandur Penuaian', 'SUPERVISORY', 'PENUAIAN', true),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'CLK', 'Estate Clerk (Kerani Operasi & Timbang)', 'FIELD_STAFF', 'PENTADBIRAN', true),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'GW', 'General Worker (Pekerja Am / Penuai)', 'GENERAL_WORKER', 'OPERASI', true),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'MDR_FIELD', 'Mandur Penuaian / Operasi', 'SUPERVISORY', 'PENUAIAN', true),
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'KK', 'Kerani Kewangan', 'FIELD_STAFF', 'KEWANGAN', true),
  ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'KSB', 'Kerani Stok Dan Bekalan', 'FIELD_STAFF', 'STOR & BEKALAN', true),
  ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'KR', 'Kerani Resit', 'FIELD_STAFF', 'PENTADBIRAN', true),
  ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'FC', 'Field Controller (FC)', 'MANAGEMENT', 'PENTADBIRAN', true),
  ('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'AFC', 'Asst. Field Controller (AFC)', 'MANAGEMENT', 'OPERASI', true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMIT;
