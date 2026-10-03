/**
 * iPDS v4.2.1 — Test Module 66: P3-1 Employee Master RLS Estate Scoping
 *
 * Proves, from migration configuration (no live database required), that:
 *
 *   1. public."employees_read_policy" is no longer tenant-wide; the effective
 *      (last) definition is scoped to the caller's estate through their
 *      employee assignment.
 *   2. public."assignment_blocks_read_policy" is scoped the same way.
 *   3. Documented cross-estate roles keep tenant-wide visibility via the
 *      existing SSOT helpers: auth_is_cross_estate_role() (rc, oc, admin,
 *      super_admin) and auth_is_super_admin() (superadmin alias + FC Tunggal).
 *   4. The old tenant-wide policy is DROPped before the new one is created, so
 *      no duplicate permissive policy can OR the leak back open, and the
 *      migration carries a deploy-time guard for exactly that.
 *   5. The companion recreate of create_employee_with_assignment() keeps the
 *      atomic create path working under the scoped policy: the employees INSERT
 *      supplies the id explicitly and no longer uses RETURNING (PostgreSQL
 *      requires SELECT policies to pass for INSERT ... RETURNING, and the
 *      employee has no assignment row yet at that point). Signature,
 *      attributes and EXECUTE ACL are unchanged.
 *   6. The assignment INSERT still uses RETURNING (its row satisfies
 *      "assignments_read_policy").
 *   7. The rollback restores the previous tenant-wide state.
 *   8. Predicate simulation: a JWT authenticated to Estate A cannot select
 *      employee master records belonging to Estate B, while cross-estate roles
 *      retain their documented access.
 *
 * IMPORTANT LIMITATION: this module validates migration SQL and the policy
 * predicate logic. It CANNOT prove live PostgreSQL RLS behaviour. A staging
 * database verification with two estate JWTs is still required.
 */

import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const ROLLBACKS_DIR = path.join(process.cwd(), 'supabase', 'rollbacks');
const MIGRATION_FILE = '20261004_employee_master_rls_estate_scoping.sql';
const ROLLBACK_FILE = '20261004_employee_master_rls_estate_scoping_rollback.sql';
const BASE_MIGRATION_FILE = '20260915_employee_master_data_foundation.sql';
const RPC_MIGRATION_FILE = '20260929_p1_1d_employee_create_atomic_rpc.sql';
const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

function normalize(sql: string): string {
  return stripSqlComments(sql).replace(/\s+/g, ' ').trim();
}

function readMigrations(): Array<{ file: string; sql: string }> {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: normalize(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')) }));
}

function readMigrationRaw(file: string): string {
  const p = path.join(MIGRATIONS_DIR, file);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

function statementAt(sql: string, startIndex: number): string {
  const end = sql.indexOf(';', startIndex);
  return end === -1 ? sql.slice(startIndex) : sql.slice(startIndex, end + 1);
}

function findLastPolicyDefinition(name: string, table: string): { file: string; sql: string } | null {
  let found: { file: string; sql: string } | null = null;
  for (const { file, sql } of readMigrations()) {
    const re = new RegExp(`CREATE\\s+POLICY\\s+"?${name}"?\\s+ON\\s+(?:public\\.)?${table}\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      found = { file, sql: statementAt(sql, m.index) };
    }
  }
  return found;
}

function findLastFunctionDefinition(name: string): { file: string; sql: string } | null {
  let found: { file: string; sql: string } | null = null;
  // Matches BOTH `CREATE FUNCTION` and `CREATE OR REPLACE FUNCTION`: P6B-1 must
  // DROP the 15-argument function before creating the 16-argument one, so the
  // newer definition intentionally uses plain CREATE.
  const marker = new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${name}\\b`, 'g');
  for (const { file, sql } of readMigrations()) {
    let m: RegExpExecArray | null;
    marker.lastIndex = 0;
    while ((m = marker.exec(sql)) !== null) {
      const end = sql.indexOf('$$;', m.index);
      const body = end === -1 ? sql.slice(m.index) : sql.slice(m.index, end + 3);
      found = { file, sql: body };
      if (end !== -1) marker.lastIndex = end + 3;
    }
  }
  return found;
}

/* ---------------------------------------------------------------------------
 * Policy predicate simulation — mirrors the SQL in
 * 20261004_employee_master_rls_estate_scoping.sql (employees_read_policy).
 * ------------------------------------------------------------------------- */

const CROSS_ESTATE_ROLES = ['rc', 'oc', 'admin', 'super_admin'];
const SUPER_ADMIN_ROLES = ['superadmin', 'super_admin', 'admin'];
const FC_TUNGGAL_ESTATES = ['FPM_TUNGGAL', '5155'];

interface SimIdentity {
  appRole: string;
  estateId: string | null;
  tenantId?: string;
}

interface SimEmployee {
  id: string;
  tenantId: string;
}

interface SimAssignment {
  employeeId: string;
  tenantId: string;
  estateId: string;
}

function isCrossEstateRole(role: string): boolean {
  return CROSS_ESTATE_ROLES.includes(role);
}

function isSuperAdminIdentity(role: string, estateId: string | null): boolean {
  return SUPER_ADMIN_ROLES.includes(role) || (role === 'fc' && !!estateId && FC_TUNGGAL_ESTATES.includes(estateId));
}

function authTenantId(identity: SimIdentity): string {
  return identity.tenantId || DEFAULT_TENANT;
}

function canViewEmployee(identity: SimIdentity, employee: SimEmployee, assignments: SimAssignment[]): boolean {
  const tenant = authTenantId(identity);
  if (employee.tenantId !== tenant) return false;
  if (isCrossEstateRole(identity.appRole)) return true;
  if (isSuperAdminIdentity(identity.appRole, identity.estateId)) return true;
  if (!identity.estateId) return false;
  return assignments.some(
    (a) => a.employeeId === employee.id && a.tenantId === tenant && a.estateId === identity.estateId
  );
}

export async function runP3_1EmployeeRlsEstateScopingTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 66: P3-1 EMPLOYEE MASTER RLS ESTATE SCOPING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 66.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 66.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 66.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // ---- 1. Artefacts exist ----
  const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
  const rollbackPath = path.join(ROLLBACKS_DIR, ROLLBACK_FILE);
  assert(fs.existsSync(migrationPath), `P3-1 migration ${MIGRATION_FILE} exists`);
  assert(fs.existsSync(rollbackPath), `P3-1 rollback ${ROLLBACK_FILE} exists`);

  const migrationSql = fs.existsSync(migrationPath) ? normalize(readMigrationRaw(MIGRATION_FILE)) : '';

  // ---- 2. employees_read_policy is estate-scoped ----
  const employeesPolicy = findLastPolicyDefinition('employees_read_policy', 'employees');
  assert(!!employeesPolicy, 'employees_read_policy definition found in migrations');
  assert(
    !!employeesPolicy && employeesPolicy.file > BASE_MIGRATION_FILE,
    'effective employees_read_policy comes from a migration after the original foundation migration',
    `effective file: ${employeesPolicy?.file}`
  );
  assert(
    !!employeesPolicy && employeesPolicy.file === MIGRATION_FILE,
    `effective employees_read_policy is defined by ${MIGRATION_FILE}`,
    `effective file: ${employeesPolicy?.file}`
  );

  const empPolicySql = employeesPolicy?.sql || '';
  assert(/public\.auth_estate_id\(\)/.test(empPolicySql),
    'employees_read_policy references the caller estate via auth_estate_id()');
  assert(/FROM\s+public\.employee_assignments/i.test(empPolicySql),
    'employees_read_policy gates on the employee assignment estate');
  assert(/public\.auth_is_cross_estate_role\(\)/.test(empPolicySql),
    'employees_read_policy retains auth_is_cross_estate_role() access (rc/oc/admin/super_admin)');
  assert(/public\.auth_is_super_admin\(\)/.test(empPolicySql),
    'employees_read_policy retains auth_is_super_admin() access (superadmin alias + FC Tunggal)');
  assert(/tenant_id\s*=\s*public\.auth_tenant_id\(\)/.test(empPolicySql),
    'employees_read_policy still enforces the tenant boundary');
  assert(!/USING\s*\(\s*tenant_id\s*=\s*public\.auth_tenant_id\(\)\s+OR\s+public\.auth_is_super_admin\(\)\s*\)/.test(empPolicySql),
    'the old tenant-wide employees predicate is gone from the effective definition');

  // ---- 3. assignment_blocks_read_policy is estate-scoped ----
  const blocksPolicy = findLastPolicyDefinition('assignment_blocks_read_policy', 'employee_assignment_blocks');
  assert(!!blocksPolicy, 'assignment_blocks_read_policy definition found in migrations');
  assert(
    !!blocksPolicy && blocksPolicy.file === MIGRATION_FILE,
    `effective assignment_blocks_read_policy is defined by ${MIGRATION_FILE}`,
    `effective file: ${blocksPolicy?.file}`
  );
  const blocksPolicySql = blocksPolicy?.sql || '';
  assert(/public\.auth_estate_id\(\)/.test(blocksPolicySql) && /public\.employee_assignments/i.test(blocksPolicySql),
    'assignment_blocks_read_policy gates on the parent assignment estate');
  assert(/public\.auth_is_cross_estate_role\(\)/.test(blocksPolicySql) &&
    /public\.auth_is_super_admin\(\)/.test(blocksPolicySql),
    'assignment_blocks_read_policy retains documented cross-estate access');
  assert(!/USING\s*\(\s*tenant_id\s*=\s*public\.auth_tenant_id\(\)\s+OR\s+public\.auth_is_super_admin\(\)\s*\)/.test(blocksPolicySql),
    'the old tenant-wide assignment-blocks predicate is gone from the effective definition');

  // ---- 4. No duplicate permissive policy + deploy-time guard ----
  const dropIdx = migrationSql.indexOf('DROP POLICY IF EXISTS "employees_read_policy" ON public.employees');
  const createIdx = migrationSql.indexOf('CREATE POLICY "employees_read_policy" ON public.employees');
  assert(dropIdx !== -1 && createIdx !== -1 && dropIdx < createIdx,
    'migration DROPs employees_read_policy before recreating it (no duplicate permissive policy)');
  const blocksDropIdx = migrationSql.indexOf('DROP POLICY IF EXISTS "assignment_blocks_read_policy" ON public.employee_assignment_blocks');
  const blocksCreateIdx = migrationSql.indexOf('CREATE POLICY "assignment_blocks_read_policy" ON public.employee_assignment_blocks');
  assert(blocksDropIdx !== -1 && blocksCreateIdx !== -1 && blocksDropIdx < blocksCreateIdx,
    'migration DROPs assignment_blocks_read_policy before recreating it');
  assert(/DUPLICATE_PERMISSIVE_POLICY_DETECTED/.test(migrationSql) &&
    /pg_catalog\.pg_policies/.test(migrationSql),
    'migration carries a deploy-time guard against >1 permissive SELECT/ALL policy per table');

  // ---- 5. Untouched policies ----
  // "assignment_blocks_write_policy" is intentionally NOT in this list: 20261004
  // reshapes it into explicit per-command policies, because a FOR ALL policy also
  // governs SELECT and would have re-widened the estate-scoped read policy this
  // migration installs (same-command permissive policies are OR-combined).
  const untouched = [
    'employees_insert_policy',
    'employees_update_policy',
    'assignments_read_policy',
    'assignments_write_policy'
  ];
  const touchedPolicies = untouched.filter((name) =>
    new RegExp(`(DROP|CREATE)\\s+POLICY\\s+(IF\\s+EXISTS\\s+)?"?${name}"?`, 'i').test(migrationSql)
  );
  assert(
    touchedPolicies.length === 0,
    'migration does not touch employee INSERT/UPDATE or assignment read/write policies',
    `matched: ${touchedPolicies.join(', ')}`
  );

  // ---- 5b. Baseline correction: the FOR ALL write policy is split per command ----
  assert(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+"assignment_blocks_write_policy"\s+ON\s+public\.employee_assignment_blocks/i.test(migrationSql),
    'migration drops the baseline FOR ALL write policy on employee_assignment_blocks'
  );
  for (const cmd of ['insert', 'update', 'delete']) {
    assert(
      new RegExp(
        `CREATE\\s+POLICY\\s+"assignment_blocks_write_${cmd}_policy"\\s+ON\\s+public\\.employee_assignment_blocks\\s+FOR\\s+${cmd.toUpperCase()}`,
        'i'
      ).test(migrationSql),
      `migration recreates the write policy explicitly FOR ${cmd.toUpperCase()}`
    );
  }
  const splitIdx = migrationSql.indexOf('2b. EMPLOYEE ASSIGNMENT BLOCKS');
  const splitSql = splitIdx === -1 ? '' : migrationSql.slice(splitIdx);
  assert(splitSql.length > 0, 'baseline-correction section 2b located for static analysis');
  assert(
    !/FOR\s+ALL\s+TO\s+authenticated/i.test(splitSql),
    'the split introduces no FOR ALL policy (that would re-widen SELECT)'
  );
  assert(
    (splitSql.match(/auth_app_role\(\)\s+IN\s*\(\s*'super_admin'\s*,\s*'fc'\s*,\s*'pf'\s*,\s*'admin'\s*\)/g) || []).length === 4,
    'all three per-command policies preserve the tenant + role allowlist predicate verbatim (INSERT 1 + UPDATE 2 + DELETE 1)'
  );

  // ---- 6. Companion RPC recreate ----
  const rpc = findLastFunctionDefinition('create_employee_with_assignment');
  assert(!!rpc, 'create_employee_with_assignment definition found in migrations');
  assert(
    !!rpc && rpc.file >= MIGRATION_FILE,
    `effective create_employee_with_assignment is the P3-1 recreation or a later additive revision (>= ${MIGRATION_FILE})`,
    `effective file: ${rpc?.file}`
  );

  const rpcSql = rpc?.sql || '';
  const empInsertIdx = rpcSql.indexOf('INSERT INTO public.employees');
  const asgInsertIdx = rpcSql.indexOf('INSERT INTO public.employee_assignments');
  assert(empInsertIdx !== -1, 'recreated RPC still inserts the employee row');
  assert(asgInsertIdx !== -1, 'recreated RPC still inserts the assignment row');

  const empInsertSql = empInsertIdx === -1 ? '' : statementAt(rpcSql, empInsertIdx);
  const asgInsertSql = asgInsertIdx === -1 ? '' : statementAt(rpcSql, asgInsertIdx);

  assert(!/RETURNING/i.test(empInsertSql),
    'recreated RPC employees INSERT no longer uses RETURNING (scoped SELECT policy cannot abort creation)');
  assert(/INSERT INTO public\.employees\s*\(\s*id\s*,/i.test(empInsertSql),
    'recreated RPC employees INSERT supplies the id column explicitly');
  assert(/v_employee_id\s*:=\s*gen_random_uuid\(\)/i.test(rpcSql),
    'recreated RPC generates the employee id in-function');
  assert(/RETURNING\s+id\s+INTO\s+v_assignment_id/i.test(asgInsertSql),
    'recreated RPC assignment INSERT still uses RETURNING (row satisfies assignments_read_policy)');
  assert(/SECURITY INVOKER/i.test(rpcSql), 'recreated RPC remains SECURITY INVOKER');
  assert(/SET\s+search_path\s*=\s*''/i.test(rpcSql), "recreated RPC keeps SET search_path = ''");

  // P3-1 originally asserted a byte-identical signature. P6B-1 legitimately
  // appends ONE optional parameter, so the invariant is now explicit and
  // stricter: all 15 original parameters preserved verbatim in the same order,
  // exactly one additive optional p_block_ids parameter, return type unchanged.
  const paramsOf = (sql: string): string[] => {
    const start = sql.indexOf('(');
    const end = sql.indexOf(') RETURNS TABLE');
    if (start === -1 || end === -1) return [];
    return sql
      .slice(start + 1, end)
      .split(',')
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  };
  const returnsOf = (sql: string): string => {
    const m = /\)\s*RETURNS\s+TABLE\s*\(([^)]*)\)/i.exec(sql);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  };

  const originalRpc = findLastFunctionDefinitionFrom(RPC_MIGRATION_FILE, 'create_employee_with_assignment');
  const originalParams = paramsOf(originalRpc?.sql || '');
  const currentParams = paramsOf(rpcSql);

  assert(originalParams.length === 15,
    'original 20260929 RPC exposes exactly 15 parameters', `found ${originalParams.length}`);
  assert(
    currentParams.length >= 15 && currentParams.slice(0, 15).join(' | ') === originalParams.join(' | '),
    'all 15 original RPC parameters are preserved verbatim, in the same order',
    `original: ${originalParams.join(' | ')} ||| current: ${currentParams.slice(0, 15).join(' | ')}`
  );
  assert(
    currentParams.length === 16 && /^p_block_ids\s+text\[\]\s+DEFAULT\s+NULL$/i.test(currentParams[15]),
    'exactly one additive optional parameter (p_block_ids text[] DEFAULT NULL) is appended',
    `params: ${currentParams.length}, param16: ${currentParams[15]}`
  );
  assert(
    returnsOf(rpcSql).length > 0 && returnsOf(rpcSql) === returnsOf(originalRpc?.sql || ''),
    'RPC return type is unchanged (employee_id uuid, assignment_id uuid)',
    `original: ${returnsOf(originalRpc?.sql || '')} | current: ${returnsOf(rpcSql)}`
  );

  const preservedValidation = [
    'EMPLOYEE_VALIDATION_ERROR: staff_no required',
    'EMPLOYEE_VALIDATION_ERROR: full_name required',
    'EMPLOYEE_VALIDATION_ERROR: tenant/company/position required',
    'EMPLOYEE_VALIDATION_ERROR: estate_id required',
    'EMPLOYEE_TENANT_VIOLATION',
    'EMPLOYEE_ESTATE_VIOLATION'
  ];
  assert(preservedValidation.every((token) => rpcSql.includes(token)),
    'recreated RPC preserves all tenant/estate boundary and input validation guards');

  assert(
    /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_employee_with_assignment\([^)]*\)\s+FROM\s+PUBLIC/i.test(migrationSql) &&
    /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_employee_with_assignment\([^)]*\)\s+FROM\s+anon/i.test(migrationSql) &&
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_employee_with_assignment\([^)]*\)\s+TO\s+authenticated/i.test(migrationSql),
    'recreated RPC keeps its EXECUTE ACL (revoked from PUBLIC/anon, granted to authenticated only)'
  );

  // ---- 7. Rollback restores the previous state ----
  if (fs.existsSync(rollbackPath)) {
    const rollbackSql = normalize(fs.readFileSync(rollbackPath, 'utf-8'));
    assert(
      /USING\s*\(\s*tenant_id\s*=\s*public\.auth_tenant_id\(\)\s+OR\s+public\.auth_is_super_admin\(\)\s*\)/.test(rollbackSql),
      'rollback restores the tenant-wide employees / assignment-blocks read policies'
    );
    assert(
      /INSERT INTO public\.employees[\s\S]{0,400}?RETURNING\s+id\s+INTO\s+v_employee_id/i.test(rollbackSql),
      'rollback restores the original RETURNING-based RPC'
    );
  }

  // ---- 8. Predicate simulation ----
  const empA: SimEmployee = { id: 'emp-A', tenantId: DEFAULT_TENANT };
  const empB: SimEmployee = { id: 'emp-B', tenantId: DEFAULT_TENANT };

  const asgOnlyB: SimAssignment[] = [{ employeeId: 'emp-B', tenantId: DEFAULT_TENANT, estateId: 'FPM_KLEDANG' }];
  const asgOnlyA: SimAssignment[] = [{ employeeId: 'emp-A', tenantId: DEFAULT_TENANT, estateId: 'FPM_ADELA' }];
  const asgBoth: SimAssignment[] = [
    { employeeId: 'emp-A', tenantId: DEFAULT_TENANT, estateId: 'FPM_ADELA' },
    { employeeId: 'emp-A', tenantId: DEFAULT_TENANT, estateId: 'FPM_KLEDANG' }
  ];

  const estateAFc: SimIdentity = { appRole: 'fc', estateId: 'FPM_ADELA' };
  const estateBFc: SimIdentity = { appRole: 'fc', estateId: 'FPM_KLEDANG' };

  assert(
    canViewEmployee(estateAFc, empB, asgOnlyB) === false,
    'Estate A JWT CANNOT select an employee whose only assignment belongs to Estate B'
  );
  assert(
    canViewEmployee(estateBFc, empA, asgOnlyA) === false,
    'Estate B JWT CANNOT select an employee whose only assignment belongs to Estate A'
  );
  assert(
    canViewEmployee(estateAFc, empA, asgOnlyA) === true,
    'Estate A JWT CAN select an employee assigned to Estate A'
  );
  assert(
    canViewEmployee(estateAFc, empA, asgBoth) === true,
    'an employee assigned to both estates remains visible to Estate A'
  );
  assert(
    canViewEmployee(estateAFc, { id: 'emp-unassigned', tenantId: DEFAULT_TENANT }, []) === false,
    'unassigned employee rows are NOT tenant-visible (no loophole in the scoped policy)'
  );
  assert(
    canViewEmployee({ appRole: 'staff', estateId: 'FPM_TUNGGAL' }, empB, asgOnlyB) === false,
    'single-estate staff JWT CANNOT select another estate employee record'
  );
  assert(
    canViewEmployee({ appRole: 'rc', estateId: 'WILAYAH_JB' }, empB, asgOnlyB) === true,
    'rc retains documented cross-estate visibility'
  );
  assert(
    canViewEmployee({ appRole: 'oc', estateId: 'WILAYAH_JB' }, empB, asgOnlyB) === true,
    'oc retains documented cross-estate visibility'
  );
  assert(
    canViewEmployee({ appRole: 'superadmin', estateId: 'WILAYAH_JB' }, empB, asgOnlyB) === true,
    'superadmin alias retains cross-estate visibility (auth_is_super_admin)'
  );
  assert(
    canViewEmployee({ appRole: 'fc', estateId: 'FPM_TUNGGAL' }, empB, asgOnlyB) === true,
    'FC Tunggal retains cross-estate visibility (auth_is_super_admin)'
  );
  assert(
    canViewEmployee({ appRole: 'fc', estateId: null }, empB, asgOnlyB) === false,
    'a non-cross-estate identity with no estate claim is denied (no wildcard authority)'
  );
  assert(
    canViewEmployee({ appRole: 'rc', estateId: 'WILAYAH_JB', tenantId: '99999999-9999-4999-8999-999999999999' }, empB, asgOnlyB) === false,
    'cross-estate roles remain bounded by the tenant boundary'
  );

  return { passed, total, failedTests };
}

function findLastFunctionDefinitionFrom(file: string, name: string): { file: string; sql: string } | null {
  const raw = readMigrationRaw(file);
  if (!raw) return null;
  const sql = normalize(raw);
  const marker = `CREATE OR REPLACE FUNCTION public.${name}`;
  const idx = sql.indexOf(marker);
  if (idx === -1) return null;
  const end = sql.indexOf('$$;', idx);
  return { file, sql: end === -1 ? sql.slice(idx) : sql.slice(idx, end + 3) };
}
