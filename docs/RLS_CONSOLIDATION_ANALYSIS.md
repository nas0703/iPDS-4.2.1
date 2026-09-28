# RLS Consolidation & Tenant Isolation Analysis

**Document**: `docs/RLS_CONSOLIDATION_ANALYSIS.md`  
**Target Tables**: `public.hujan_rekod`, `public.workers`, `public.merumput_progress`  
**Branch**: `fix/rls-tenant-isolation-gaps`  
**Date**: 2026-09-28  

---

## 1. Exact SQL Definitions of Helper Functions

Below are the exact SQL bodies and line numbers from the migrations defining `public.auth_is_cross_estate_role()`, `public.auth_app_role()`, and `public.auth_estate_id()`.

### A. Current Active / Canonical Definitions

#### `supabase/migrations/20260911_consolidate_schema_and_rls_alignment.sql`

```sql
-- Lines 19-25
CREATE OR REPLACE FUNCTION public.auth_estate_id()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'estate_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'estate_id', '')
  );
$$ LANGUAGE sql STABLE;

-- Lines 27-33
CREATE OR REPLACE FUNCTION public.auth_app_role()
RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'app_role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '')
  );
$$ LANGUAGE sql STABLE;

-- Lines 35-38
CREATE OR REPLACE FUNCTION public.auth_is_cross_estate_role()
RETURNS boolean AS $$
  SELECT public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin');
$$ LANGUAGE sql STABLE;
```

*(Note: These three definitions are also reaffirmed identically in `supabase/migrations/20260930_ipds_grading_tasks.sql` lines 39–58).*

---

### B. Prior / Historical Migration Definitions

#### `supabase/migrations/20260905_phase2_supabase_rls_policies.sql`

```sql
-- Lines 13-36
CREATE OR REPLACE FUNCTION public.auth_estate_id()
RETURNS text AS $$
DECLARE
  v_claims jsonb;
  v_estate text;
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN 'FPM_TUNGGAL'; -- Fallback for unauthenticated or local dev
  END IF;

  v_claims := auth.jwt();
  v_estate := COALESCE(
    v_claims -> 'app_metadata' ->> 'estate_id',
    v_claims ->> 'estate_id',
    v_claims -> 'user_metadata' ->> 'estate_id'
  );

  IF v_estate IS NULL OR TRIM(v_estate) = '' THEN
    RETURN 'FPM_TUNGGAL';
  END IF;

  RETURN TRIM(v_estate);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Lines 39-62
CREATE OR REPLACE FUNCTION public.auth_app_role()
RETURNS text AS $$
DECLARE
  v_claims jsonb;
  v_role text;
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN 'staff'; -- Fallback
  END IF;

  v_claims := auth.jwt();
  v_role := COALESCE(
    v_claims -> 'app_metadata' ->> 'app_role',
    v_claims -> 'app_metadata' ->> 'role',
    v_claims ->> 'role'
  );

  IF v_role IS NULL OR TRIM(v_role) = '' THEN
    RETURN 'staff';
  END IF;

  RETURN LOWER(TRIM(v_role));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Lines 73-78
CREATE OR REPLACE FUNCTION public.auth_is_cross_estate_role()
RETURNS boolean AS $$
BEGIN
  RETURN public.auth_app_role() IN ('super_admin', 'executive_hq', 'fc', 'zonal_controller', 'regional_controller', 'operation_controller');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
```

#### `supabase/migrations/20260908_phase7_complete_rls_coverage_matrix.sql`

```sql
-- Lines 12-35
CREATE OR REPLACE FUNCTION public.auth_estate_id()
RETURNS text AS $$
DECLARE
  v_claims jsonb;
  v_estate text;
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN 'FPM_TUNGGAL';
  END IF;

  v_claims := auth.jwt();
  v_estate := COALESCE(
    v_claims -> 'app_metadata' ->> 'estate_id',
    v_claims ->> 'estate_id',
    v_claims -> 'user_metadata' ->> 'estate_id'
  );

  IF v_estate IS NULL OR TRIM(v_estate) = '' THEN
    RETURN 'FPM_TUNGGAL';
  END IF;

  RETURN TRIM(v_estate);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Lines 37-60
CREATE OR REPLACE FUNCTION public.auth_app_role()
RETURNS text AS $$
DECLARE
  v_claims jsonb;
  v_role text;
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN 'staff';
  END IF;

  v_claims := auth.jwt();
  v_role := COALESCE(
    v_claims -> 'app_metadata' ->> 'app_role',
    v_claims -> 'app_metadata' ->> 'role',
    v_claims ->> 'role'
  );

  IF v_role IS NULL OR TRIM(v_role) = '' THEN
    RETURN 'staff';
  END IF;

  RETURN LOWER(TRIM(v_role));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
```

---

## 2. Role Evaluation & Comparison

### Function Evaluation
1. **`public.auth_estate_id()`**:
   - Returns the string `estate_id` from JWT `app_metadata.estate_id` or top-level `estate_id`.
   - Returns `NULL` if no claim is present or empty.
2. **`public.auth_app_role()`**:
   - Returns the string `app_role` from JWT `app_metadata.app_role` or `role`.
   - Returns `NULL` if no claim is present or empty.
3. **`public.auth_is_cross_estate_role()`** (Canonical definition in 20260911):
   - Evaluates to `true` if and only if `public.auth_app_role()` is one of:
     - `'rc'` (Regional Controller)
     - `'oc'` (Operation Controller)
     - `'admin'` (Admin)
     - `'super_admin'` (Super Admin)
   - Evaluates to `false` for all other roles (`'staff'`, `'mandur'`, `'pf'`, `'fc'`, `'afc'`, `'fs'`, `'eqi'`) and unauthenticated requests (`NULL`).

### Set Comparison: `auth_is_cross_estate_role()` vs `('rc', 'oc', 'admin', 'super_admin')`
- **Active Canonical State (20260911 onwards)**:
  `auth_is_cross_estate_role()` is defined verbatim as `public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin')`.
  Therefore, it is the **EXACT SAME SET** (`{'rc', 'oc', 'admin', 'super_admin'}`), neither a proper superset nor a proper subset.
- *(Historical Note: In the deprecated 20260905 migration, it was a **different set** including `'fc'`, `'executive_hq'`, `'zonal_controller'`, but that definition was completely superseded by 20260911).*

---

## 3. Inventory of Policies on `hujan_rekod` and `workers`

PostgreSQL RLS applies multiple permissive policies using Boolean `OR` (`Policy1 OR Policy2`). Below is every policy active when migrations are executed in sequence:

### A. Table: `public.hujan_rekod`

| # | Policy Name | Cmd | Source Migration | USING Expression | WITH CHECK Expression | Stale / Dropped Status |
|---|---|---|---|---|---|---|
| 1 | `hujan_rekod_tenant_isolation_select` | `SELECT` | `20260910_remediate_direct_anon_access_and_rls_hardening.sql` (lines 57-59) | `estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role()` | *None* | **NEVER DROPPED** by 20260911 (Stale / Overlapping) |
| 2 | `hujan_rekod_tenant_isolation_insert` | `INSERT` | `20260910_remediate_direct_anon_access_and_rls_hardening.sql` (lines 61-63) | *None* | `estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role()` | **NEVER DROPPED** by 20260911 (Stale / Overlapping - Security Gap) |
| 3 | `hujan_rekod_select_policy` | `SELECT` | `20260911_consolidate_schema_and_rls_alignment.sql` (lines 149-152) | `estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin')` | *None* | Active (Canonical 20260911) |
| 4 | `hujan_rekod_insert_policy` | `INSERT` | `20260911_consolidate_schema_and_rls_alignment.sql` (lines 154-157) | *None* | `estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')` | Active (Canonical 20260911) |
| 5 | `hujan_rekod_update_policy` | `UPDATE` | `20260911_consolidate_schema_and_rls_alignment.sql` (lines 159-163) | `estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin')` | `estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')` | Active (No 20260910 duplicate) |
| 6 | `hujan_rekod_delete_policy` | `DELETE` | `20260911_consolidate_schema_and_rls_alignment.sql` (lines 165-168) | `estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin')` | *None* | Active (No 20260910 duplicate) |

---

### B. Table: `public.workers`

| # | Policy Name | Cmd | Source Migration | USING Expression | WITH CHECK Expression | Stale / Dropped Status |
|---|---|---|---|---|---|---|
| 1 | `workers_tenant_isolation_select` | `SELECT` | `20260910_remediate_direct_anon_access_and_rls_hardening.sql` (lines 66-68) | `estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role()` | *None* | **NEVER DROPPED** by 20260911 (Stale / Overlapping) |
| 2 | `workers_tenant_isolation_insert` | `INSERT` | `20260910_remediate_direct_anon_access_and_rls_hardening.sql` (lines 70-72) | *None* | `estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role()` | **NEVER DROPPED** by 20260911 (Stale / Overlapping - Security Gap) |
| 3 | `workers_tenant_isolation_delete` | `DELETE` | `20260910_remediate_direct_anon_access_and_rls_hardening.sql` (lines 74-76) | `estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role()` | *None* | **NEVER DROPPED** by 20260911 (Stale / Overlapping - Critical Security Gap) |
| 4 | `workers_select_policy` | `SELECT` | `20260911_consolidate_schema_and_rls_alignment.sql` (lines 171-174) | `estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin')` | *None* | Active (Canonical 20260911) |
| 5 | `workers_insert_policy` | `INSERT` | `20260911_consolidate_schema_and_rls_alignment.sql` (lines 176-179) | *None* | `estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')` | Active (Canonical 20260911) |
| 6 | `workers_update_policy` | `UPDATE` | `20260911_consolidate_schema_and_rls_alignment.sql` (lines 181-185) | `estate_id = public.auth_estate_id() OR public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin')` | `estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')` | Active (No 20260910 duplicate) |
| 7 | `workers_delete_policy` | `DELETE` | `20260911_consolidate_schema_and_rls_alignment.sql` (lines 187-190) | `estate_id = public.auth_estate_id() AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin')` | *None* | Active (Canonical 20260911) |

---

## 4. Verdict Per Table: Does Stacked State Grant Excess Access?

Because PostgreSQL ORs all permissive policies, if either policy permits the operation, the query succeeds.

### Table: `public.hujan_rekod`
- **Verdict**: **YES** (The stacked state grants more access than 20260911 intended).
- **Commands & Roles Affected**:
  1. **Command**: `INSERT`
     - **Roles `rc` and `oc`**: 20260911 explicitly restricts `INSERT` to users with `estate_id = auth_estate_id() AND role IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')`. Regional and Zonal/Operation controllers (`rc` and `oc`) were intentionally excluded from inserting rainfall records, and writes were strictly bound to own-estate. Under the 20260910 policy `hujan_rekod_tenant_isolation_insert` (`WITH CHECK (estate_id = auth_estate_id() OR auth_is_cross_estate_role())`), `rc` and `oc` are granted the ability to insert rainfall records into **ANY** estate.
     - **Roles not in 20260911 allowlist (e.g., `eqi`, `auditor`, or standard authenticated accounts)**: 20260910 allows them to `INSERT` as long as `estate_id = auth_estate_id()`, bypassing the intended role-based gate in 20260911.

---

### Table: `public.workers`
- **Verdict**: **YES** (The stacked state grants significantly more access than 20260911 intended).
- **Commands & Roles Affected**:
  1. **Command**: `INSERT`
     - **Roles `rc` and `oc`**: Under 20260911, `rc` and `oc` have no write access to `workers`. Under the 20260910 policy `workers_tenant_isolation_insert`, `rc` and `oc` are permitted to insert worker records into **ANY** estate.
     - **Roles outside 20260911 allowlist (e.g., `eqi`)**: Allowed to insert workers in their own estate via 20260910.
  2. **Command**: `DELETE` (**Critical Violation**)
     - **Non-privileged roles (`staff`, `mandur`, `afc`, `fs`, `eqi`)**: 20260911 strictly restricts worker deletion to `('pf', 'fc', 'admin', 'super_admin')`. Under the active 20260910 policy `workers_tenant_isolation_delete` (`USING (estate_id = auth_estate_id() OR auth_is_cross_estate_role())`), **ANY** authenticated user whose `estate_id` matches the worker record (including junior field staff and mandurs) is permitted to delete workers!
     - **Cross-estate roles (`rc`, `oc`)**: 20260911 denies delete to `rc` and `oc`. Under 20260910, `rc` and `oc` are permitted to delete worker records across **ANY** estate.

---

## 5. Recommendation & Standardization

### Recommended Standard Helper: `public.auth_is_cross_estate_role()`
We recommend standardizing all cross-estate tenancy checks on:
```sql
public.auth_is_cross_estate_role()
```
rather than inlining `public.auth_app_role() IN ('rc', 'oc', 'admin', 'super_admin')`.

### Reasons:
1. **Centralized SSOT**: Encapsulates the cross-estate role definitions in a single database function. If regional governance roles change, only the helper function needs updating rather than dozens of table policies.
2. **Consistency Across Migrations**: Matches `20260912_finalize_all_tenant_policies.sql`, `20260912_add_estate_id_to_extended_operational_tables.sql`, and `20260930_ipds_grading_tasks.sql`, as well as Section 5 of `AGENTS.md`.
3. **Explicit Write Boundaries**:
   - Reads/SELECT: `USING (estate_id = public.auth_estate_id() OR public.auth_is_cross_estate_role())`
   - Writes/INSERT/UPDATE: Scoped to `estate_id = public.auth_estate_id()` and guarded by specific role arrays.
   - Deletes: Scoped strictly to `estate_id = public.auth_estate_id()` and executive roles (`'pf', 'fc', 'admin', 'super_admin'`).

### Impact on Effective Access: **TIGHTENS**
Dropping the stale 20260910 policies (`hujan_rekod_tenant_isolation_*` and `workers_tenant_isolation_*`) and retaining exactly one policy per command per table:
- **TIGHTENS** effective access.
- Eliminates the vulnerability where junior roles (`staff`, `mandur`) could delete worker master records.
- Eliminates cross-estate INSERT and DELETE capabilities for `rc` and `oc` on operational tables.
- Restores single-policy deterministic security evaluation per table.
