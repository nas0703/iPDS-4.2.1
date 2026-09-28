# iPDS-4.1 PRODUCTION MIGRATION BASELINE & FORENSIC RECONCILIATION

> **IMPORTANT STATEMENT:**  
> **No production database modification was performed during this reconciliation.**  
> The live production Supabase database was inspected strictly in **READ-ONLY** mode.

---

## 1. Executive Summary & Tracking Status
1. **Production migration tracking is unavailable/unverified:**
   - The remote production database does NOT contain the schema or table `supabase_migrations.schema_migrations`.
   - The Supabase CLI cannot automatically derive or verify remote migration state.
2. **Read-Only Forensic Inspection:**
   - All production schema validations were performed via non-destructive queries against PostgreSQL system catalogs (`information_schema.tables`, `information_schema.columns`, `information_schema.routines`, `pg_class`, and `pg_policies`).
3. **Local Migration History Limitation:**
   - The local `supabase/migrations/` directory contains a mix of legacy 8-digit timestamps, renamed files, manual reconstruction attempts, and unapplied future feature migrations.
   - Local migration history is **not** a reliable chronological record of production execution history.

---

## 2. Complete Classification of 36 Local Migrations

### Classification Legend:
- **A** = Production object already exists (Known/likely represented in production)
- **B** = Production object apparently does not exist (Represents functionality not currently present in production)
- **C** = Partially represented (Some tables/views exist, secondary objects/functions pending)
- **D** = Duplicate / Re-timestamped migration
- **E** = Uncertain / Requires further architectural verification

| # | Local Migration File | Classification | Status & Verified Forensic Evidence |
|---|---|:---:|---|
| 1 | `20260818_create_kadar_upah_table.sql` | **A** | Table `public.kadar_upah_knowledge` exists in production. |
| 2 | `20260818_ipds_rag_knowledge_base.sql` | **A** | Table `public.pdf_documents` and function `public.match_pdf_documents()` exist in production. |
| 3 | `20260823_enterprise_rag_schema.sql` | **B** | Tables `public.ipds_rag_documents`, `ipds_rag_pages`, `ipds_rag_ingestion_log` do NOT exist in production. |
| 4 | `20260823_lexical_bm25_schema.sql` | **B** | Function `public.search_rag_lexical_bm25()` does NOT exist in production. |
| 5 | `20260823_the_oil_palm_5th_edition_knowledge.sql` | **A** | Table `public.the_oil_palm_knowledge` exists in production. |
| 6 | `20260824_ipds_granular_rls.sql` | **A** | Baseline granular RLS rules represented (superseded by Phase 2/7 policies). |
| 7 | `20260825_ipds_hardened_schema_stage_c1.sql` | **A** | Core tables `merumput_progress`, `hujan_rekod`, `workers`, `attendance_records` exist in production. |
| 8 | `20260826_observability_persistent_history.sql` | **B** | Table `public.observability_metric_snapshots` does NOT exist in production. |
| 9 | `20260827_rag_performance_logs.sql` | **B** | Table `public.rag_performance_logs` does NOT exist in production. |
| 10 | `20260901_ipds_enterprise_rls_blueprint.sql` | **C** | Tables `org_estates` & `org_divisions` exist; table `rbac_permissions` does NOT exist. |
| 11 | `20260904_phase1_multi_tenant_schema.sql` | **C** | `org_estates` exists, but `tenant_id` column is not applied to `org_estates`. |
| 12 | `20260905_phase2_supabase_rls_policies.sql` | **A** | Security functions `auth_estate_id()`, `auth_app_role()`, `auth_is_cross_estate_role()` exist and are active. |
| 13 | `20260906_phase5_unified_identity_profiles.sql` | **B** | Table `public.user_profiles` does NOT exist in production. |
| 14 | `20260907_phase6_active_sessions_schema.sql` | **B** | Table `public.active_sessions` does NOT exist in production. |
| 15 | `20260908_phase7_complete_rls_coverage_matrix.sql` | **A** | Complete RLS coverage matrix implemented across all operational tables with `FORCE ROW LEVEL SECURITY`. |
| 16 | `20260909_background_job_queue_schema.sql` | **B** | Table `public.background_jobs` does NOT exist in production. |
| 17 | `20260910_atomic_batch_claim_and_recovery.sql` | **B** | Function `public.claim_background_jobs_batch()` does NOT exist in production. |
| 18 | `20260910_remediate_direct_anon_access_and_rls_hardening.sql` | **A** | `FORCE ROW LEVEL SECURITY` (`relforcerowsecurity=true`) and `REVOKE anon` applied to operational tables. |
| 19 | `20260911_consolidate_schema_and_rls_alignment.sql` | **A** | Views `merumput_daily_entries`, `data_pekerja`, `annual_yield` exist in production. |
| 20 | `20260911_durable_job_queue_hardening.sql` | **B** | Modifies `background_jobs` table which does NOT exist in production. |
| 21 | `20260912_add_estate_id_to_extended_operational_tables.sql` | **A** | Column `estate_id` exists across `fertilizer_inventory`, `hantaran_pruning`, `weed_scan_logs`, `hasil_abw_history`, etc. |
| 22 | `20260912_finalize_all_tenant_policies.sql` | **A** | Tenant RLS policies exist on `hantaran_hasil`, `attendance_records`, `data_hujan`, `hasil_backlog_history`. |
| 23 | `20260915_employee_master_data_foundation.sql` | **C** | Tables `tenants`, `companies`, `employees`, `org_positions`, `org_blocks` exist; function `auth_tenant_id` pending. |
| 24 | `20260916_p0_04_harden_background_job_security_definer.sql` | **B** | Depends on `background_jobs` which does NOT exist in production. |
| 25 | `20260917_p0_05_harden_tenant_views_security_invoker.sql` | **A** | Tenant views exist and operate under caller security context. |
| 26 | `20260918_p0_16_registered_devices.sql` | **A** | Table `public.registered_devices` exists in production (42 active devices). |
| 27 | `20260919_p0_16a_device_approval_capabilities.sql` | **A** | Table `public.device_approval_capabilities` exists in production (10 capability records). |
| 28 | `20260920_p0_16b_device_approval_requester_context.sql` | **A** | Columns `requester_name`, `requester_staff_id`, `device_name` exist on `public.device_approval_capabilities`. |
| 29 | `20260921_p0_16_registered_devices_acl_reconciliation.sql` | **A** | ACL RLS policies on `registered_devices` exist and are enforced in production. |
| 30 | `20260922_p0_16b_pekerja_unique_keys.sql` | **A** | Unique index on `employees(tenant_id, estate_id, employee_no)` exists in production. |
| 31 | `20260923_p0_16c_device_credentials.sql` | **A** | Column `credential_hash` exists on `public.registered_devices` in production. |
| 32 | `20260924_p0_16c_device_estate_access.sql` | **B** | Table `public.device_estate_access` does NOT exist in production. |
| 33 | `20260925_p0_16c5_backfill_device_estate_grants.sql` | **B** | Depends on `public.device_estate_access` which does NOT exist. |
| 34 | `20260926_p1_device_merge_tracking.sql` | **B** | Table `public.registered_devices_archive` does NOT exist in production. |
| 35 | `20260927_p1_device_merge_function.sql` | **B** | Function `public.merge_registered_devices()` does NOT exist in production. |
| 36 | `20260928_p1_org_positions_reconciliation.sql` | **A** | Positions data reconciled in `public.org_positions`. |

---

## 3. Duplicate & Re-Timestamped Migration Analysis

The following duplicate/re-timestamped candidate pairs were evaluated:

| Canonical Migration File | Alternate / Historical Timestamp | Analysis & Relationship | Action Recommendation | Reason |
|---|---|---|---|---|
| `20260818_create_kadar_upah_table.sql` | `20260830_create_kadar_upah_table.sql` | Identical DDL creating `kadar_upah_knowledge`. | Retain `20260818` as canonical. | `20260818` is the earliest origin timestamp matching knowledge base inception. |
| `20260823_lexical_bm25_schema.sql` | `20260831_lexical_bm25_schema.sql` | Identical function definition `search_rag_lexical_bm25`. | Retain `20260823` as canonical. | Represents RAG BM25 feature addition. |
| `20260823_the_oil_palm_5th_edition_knowledge.sql` | `20260902_the_oil_palm_5th_edition_knowledge.sql` | Identical DDL creating `the_oil_palm_knowledge`. | Retain `20260823` as canonical. | Represents 5th Edition Agronomy knowledge base. |
| `20260910_remediate_direct_anon_access_and_rls_hardening.sql` | `20260903_remediate_direct_anon_access_and_rls_hardening.sql` | Identical P0 anonymous access lockdown. | Retain `20260910` as canonical. | Aligns with P0 security remediation sequence. |
| `20260911_durable_job_queue_hardening.sql` | `20260913_durable_job_queue_hardening.sql` | Identical durable job queue schema. | Retain `20260911` as canonical. | Aligns with queue hardening sequence. |
| `20260912_finalize_all_tenant_policies.sql` | `20260914_finalize_all_tenant_policies.sql` | Identical tenant policy finalization. | Retain `20260912` as canonical. | Aligns with multi-tenant policy completion. |

---

## 4. Reconstruction Migrations Analysis

Three historical 14-digit migrations were identified during forensic tracking:
1. `20260824010000_create_hantaran_hasil.sql`
2. `20260824020000_operational_foundation.sql`
3. `20260824030000_missing_legacy_operational_tables.sql`

### Findings:
- These migrations were created in attempts to reconstruct baseline operational tables (`hantaran_hasil`, `hujan_rekod`, `workers`, `merumput_progress`) from source code definitions after those tables had already been created in production via legacy scripts.
- In the current clean workspace, their target tables are fully covered and hardened under canonical migrations `20260825_ipds_hardened_schema_stage_c1.sql`, `20260908_phase7_complete_rls_coverage_matrix.sql`, and `20260911_consolidate_schema_and_rls_alignment.sql`.

---

## 5. Security Invariant Protection
- Production contains active operational data: **42 registered staff devices** and **10 capability approval tokens**.
- All operational tables have `FORCE ROW LEVEL SECURITY` active (`relforcerowsecurity = true`).
- The canonical security functions (`auth_estate_id()`, `auth_app_role()`, `auth_is_cross_estate_role()`) are set to `INVOKER` and protect multi-tenant estate boundaries.
