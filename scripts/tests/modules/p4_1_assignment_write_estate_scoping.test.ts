/**
 * iPDS v4.2.1 — Test Module 67: P4-1 Employee Assignment Write Estate Scoping
 *
 * Proves, from migration configuration (no live database required), that:
 *
 *   1. public."assignments_write_policy" is estate-scoped for ordinary
 *      estate-level roles while keeping the tenant boundary and the existing
 *      role allowlist ('super_admin','fc','pf','admin').
 *   2. The estate restriction is present on BOTH USING (existing row) and
 *      WITH CHECK (new row), which is what prevents an estate reassignment
 *      (Estate A -> Estate B) as well as foreign-estate INSERT/UPDATE/DELETE.
 *   3. Approved cross-estate roles keep write access via
 *      auth_is_cross_estate_role() / auth_is_super_admin().
 *   4. `pf` and `executive_hq` are NOT broadened, and the auth_* helper
 *      definitions are not touched.
 *   5. The policy is not duplicated (DROP before CREATE + deploy-time guard)
 *      and the read policy is untouched.
 *   6. The rollback restores the previous tenant + role policy exactly.
 *   7. Predicate simulation: own-estate writes allowed for an allowed estate
 *      role; foreign-estate INSERT/UPDATE/DELETE denied; estate reassignment
 *      denied; cross-estate roles retain access.
 *
 * IMPORTANT LIMITATION: this module validates migration SQL and the policy
 * predicate logic. It is STATIC/predicate verification. It CANNOT prove live
 * PostgreSQL RLS behaviour — a staging database verification is still required.
 */

import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const ROLLBACKS_DIR = path.join(process.cwd(), 'supabase', 'rollbacks');
const MIGRATION_FILE = '20261005_employee_assignment_write_estate_scoping.sql';
const ROLLBACK_FILE = '20261005_employee_assignment_write_estate_scoping_rollback.sql';
const BASE_MIGRATION_FILE = '20260915_employee_master_data_foundation.sql';
const READ_POLICY_NAME = 'assignments_read_policy';
const WRITE_POLICY_NAME = 'assignments_write_policy';
// P4-1 baseline correction: the write policy is expressed per command instead of
// FOR ALL, because a FOR ALL policy also governs SELECT and would have been
// OR-combined with assignments_read_policy, silently widening reads across estates.
const WRITE_POLICY_INSERT = 'assignments_write_insert_policy';
const WRITE_POLICY_UPDATE = 'assignments_write_update_policy';
const WRITE_POLICY_DELETE = 'assignments_write_delete_policy';
const WRITE_POLICY_NAMES = [WRITE_POLICY_INSERT, WRITE_POLICY_UPDATE, WRITE_POLICY_DELETE];
const TABLE = 'employee_assignments';
const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';
const ESTATE_A = 'FPM_ADELA';
const ESTATE_B = 'FPM_KLEDANG';

function stripSqlComments(sql: string): string {
  // NOTE: split on /\r?\n/ (not '\n'): files created on Windows carry CRLF and
  // a trailing '\r' prevents /--.*$/ from matching, which would silently leave
  // header comments in the normalised statement text.
  return sql
    .split(/\r?\n/)
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

function findPolicyDefinitionInFile(file: string, name: string, table: string): string | null {
  const p = path.join(MIGRATIONS_DIR, file);
  if (!fs.existsSync(p)) return null;
  const sql = normalize(fs.readFileSync(p, 'utf-8'));
  const re = new RegExp(`CREATE\\s+POLICY\\s+"?${name}"?\\s+ON\\s+(?:public\\.)?${table}\\b`, 'i');
  const m = re.exec(sql);
  return m ? statementAt(sql, m.index) : null;
}

/* ---------------------------------------------------------------------------
 * Policy predicate simulation — mirrors the SQL in
 * 20261005_employee_assignment_write_estate_scoping.sql.
 *
 *   USING      -> which existing rows the command can act on
 *   WITH CHECK -> which resulting rows may be stored
 * ------------------------------------------------------------------------- */

const ROLE_ALLOWLIST = ['super_admin', 'fc', 'pf', 'admin'];
const CROSS_ESTATE_ROLES = ['rc', 'oc', 'admin', 'super_admin'];
const SUPER_ADMIN_ROLES = ['superadmin', 'super_admin', 'admin'];
const FC_TUNGGAL_ESTATES = ['FPM_TUNGGAL', '5155'];

interface SimIdentity {
  appRole: string;
  estateId: string | null;
  tenantId?: string;
}

interface SimRow {
  tenantId: string;
  estateId: string;
}

function tenantOf(identity: SimIdentity): string {
  return identity.tenantId || DEFAULT_TENANT;
}

function roleAllowed(identity: SimIdentity): boolean {
  return ROLE_ALLOWLIST.includes(identity.appRole);
}

function isCrossEstateRole(role: string): boolean {
  return CROSS_ESTATE_ROLES.includes(role);
}

function isSuperAdminIdentity(role: string, estateId: string | null): boolean {
  return SUPER_ADMIN_ROLES.includes(role) || (role === 'fc' && !!estateId && FC_TUNGGAL_ESTATES.includes(estateId));
}

function estateClausePasses(identity: SimIdentity, estateId: string): boolean {
  if (isCrossEstateRole(identity.appRole)) return true;
  if (isSuperAdminIdentity(identity.appRole, identity.estateId)) return true;
  return !!identity.estateId && estateId === identity.estateId;
}

/** WITH CHECK: may the resulting row be stored? */
function checkPasses(identity: SimIdentity, newRow: SimRow): boolean {
  if (newRow.tenantId !== tenantOf(identity)) return false;
  if (!roleAllowed(identity)) return false;
  return estateClausePasses(identity, newRow.estateId);
}

/** USING: can the command act on this existing row? */
function usingPasses(identity: SimIdentity, existingRow: SimRow): boolean {
  if (existingRow.tenantId !== tenantOf(identity)) return false;
  if (!roleAllowed(identity)) return false;
  return estateClausePasses(identity, existingRow.estateId);
}

function canInsert(identity: SimIdentity, newRow: SimRow): boolean {
  return checkPasses(identity, newRow);
}

function canUpdate(identity: SimIdentity, existingRow: SimRow, newRow: SimRow): boolean {
  return usingPasses(identity, existingRow) && checkPasses(identity, newRow);
}

function canDelete(identity: SimIdentity, existingRow: SimRow): boolean {
  return usingPasses(identity, existingRow);
}

export async function runP4_1AssignmentWriteEstateScopingTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 67: P4-1 EMPLOYEE ASSIGNMENT WRITE ESTATE SCOPING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 67.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 67.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 67.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // ---- 1. Artefacts ----
  const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
  const rollbackPath = path.join(ROLLBACKS_DIR, ROLLBACK_FILE);
  assert(fs.existsSync(migrationPath), `P4-1 migration ${MIGRATION_FILE} exists`);
  assert(fs.existsSync(rollbackPath), `P4-1 rollback ${ROLLBACK_FILE} exists`);

  const migrationSql = fs.existsSync(migrationPath) ? normalize(fs.readFileSync(migrationPath, 'utf-8')) : '';

  // ---- 2. Effective per-command write policies ----
  const writePolicies = WRITE_POLICY_NAMES.map((n) => findLastPolicyDefinition(n, TABLE));
  assert(writePolicies.every(Boolean), 'INSERT/UPDATE/DELETE write policies all found in migrations');
  assert(
    writePolicies.every((p) => !!p && p.file === MIGRATION_FILE),
    `effective per-command write policies are defined by ${MIGRATION_FILE}`,
    `effective files: ${writePolicies.map((p) => p?.file).join(', ')}`
  );

  const [insertSql, updateSql, deleteSql] = writePolicies.map((p) => p?.sql || '');

  // Each command must independently carry the tenant boundary + role allowlist.
  for (const [cmd, sql] of [['INSERT', insertSql], ['UPDATE', updateSql], ['DELETE', deleteSql]] as const) {
    assert(new RegExp(`FOR\\s+${cmd}\\s+TO\\s+authenticated`, 'i').test(sql),
      `${cmd} policy is scoped to the authenticated role for ${cmd} only`);
    assert(/tenant_id\s*=\s*public\.auth_tenant_id\(\)/.test(sql),
      `${cmd} policy preserves the tenant boundary`);
    assert(/public\.auth_app_role\(\)\s+IN\s*\(\s*'super_admin'\s*,\s*'fc'\s*,\s*'pf'\s*,\s*'admin'\s*\)/.test(sql),
      `${cmd} policy preserves the existing role allowlist verbatim`);
    assert(/public\.auth_is_cross_estate_role\(\)/.test(sql),
      `${cmd} policy preserves auth_is_cross_estate_role() access`);
    assert(/public\.auth_is_super_admin\(\)/.test(sql),
      `${cmd} policy preserves auth_is_super_admin() access`);
    assert(/estate_id\s*=\s*public\.auth_estate_id\(\)/.test(sql),
      `${cmd} policy confines ordinary roles to their own estate via estate_id = auth_estate_id()`);
  }

  // UPDATE must carry the estate clause in BOTH clauses (prevents A -> B moves),
  // and INSERT/DELETE must carry it in their single applicable clause.
  const usingClause = (/USING\s*\(([\s\S]*?)\)\s*WITH\s+CHECK/i.exec(updateSql) || [])[1] || '';
  const withCheckClause = (/WITH\s+CHECK\s*\(([\s\S]*?)\)\s*;?$/i.exec(updateSql) || [])[1] || '';
  assert(/estate_id\s*=\s*public\.auth_estate_id\(\)/.test(usingClause),
    'UPDATE USING carries the estate restriction (existing row must be in the caller estate)');
  assert(/estate_id\s*=\s*public\.auth_estate_id\(\)/.test(withCheckClause),
    'UPDATE WITH CHECK carries the estate restriction (resulting row must remain in the caller estate)');
  assert(/estate_id\s*=\s*public\.auth_estate_id\(\)/.test(insertSql),
    'INSERT WITH CHECK carries the estate restriction');
  assert(/estate_id\s*=\s*public\.auth_estate_id\(\)/.test(deleteSql),
    'DELETE USING carries the estate restriction');
  assert(!/FOR\s+ALL\s+TO\s+authenticated/i.test(migrationSql),
    'migration leaves no FOR ALL policy (OR semantics would re-widen SELECT)');

  // Not broadened: no new roles, helpers untouched
  assert(!/executive_hq/.test(migrationSql),
    'migration does not add executive_hq to the write role allowlist');
  assert(!/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.auth_/i.test(migrationSql),
    'migration does not modify any public.auth_* helper definition');

  // ---- 3. Before state (proves the gap existed) ----
  const originalSql = findPolicyDefinitionInFile(BASE_MIGRATION_FILE, WRITE_POLICY_NAME, TABLE);
  assert(!!originalSql, `original ${WRITE_POLICY_NAME} found in ${BASE_MIGRATION_FILE}`);
  assert(!!originalSql && !/auth_estate_id\(\)/.test(originalSql),
    'the original write policy had no estate restriction (documented "before" state)');

  // ---- 4. No duplication + guard ----
  assert(migrationSql.indexOf(`DROP POLICY IF EXISTS "${WRITE_POLICY_NAME}" ON public.${TABLE}`) !== -1,
    `migration DROPs the baseline ${WRITE_POLICY_NAME} before replacing it`);
  for (const name of WRITE_POLICY_NAMES) {
    const d = migrationSql.indexOf(`DROP POLICY IF EXISTS "${name}" ON public.${TABLE}`);
    const c = migrationSql.indexOf(`CREATE POLICY "${name}" ON public.${TABLE}`);
    assert(d !== -1 && c !== -1 && d < c,
      `migration DROPs ${name} before recreating it (idempotent, no duplicate permissive policy)`);
  }
  assert(/DUPLICATE_PERMISSIVE_POLICY_DETECTED/.test(migrationSql) &&
    /pg_catalog\.pg_policies/.test(migrationSql),
    'migration carries a deploy-time guard against duplicate permissive policies');

  // ---- 5. Read policy untouched ----
  const readPolicy = findLastPolicyDefinition(READ_POLICY_NAME, TABLE);
  assert(
    !!readPolicy && readPolicy.file === BASE_MIGRATION_FILE,
    `${READ_POLICY_NAME} is still defined by ${BASE_MIGRATION_FILE} (untouched by P4-1)`,
    `effective file: ${readPolicy?.file}`
  );
  assert(
    !new RegExp(`(DROP|CREATE)\\s+POLICY\\s+(IF\\s+EXISTS\\s+)?"?${READ_POLICY_NAME}"?`, 'i').test(migrationSql),
    'migration does not touch the read policy'
  );

  // ---- 6. Rollback restores the previous policy ----
  if (fs.existsSync(rollbackPath)) {
    const rollbackSql = normalize(fs.readFileSync(rollbackPath, 'utf-8'));
    assert(
      /CREATE POLICY "assignments_write_policy" ON public\.employee_assignments\s+FOR ALL TO authenticated/.test(rollbackSql),
      'rollback recreates the baseline FOR ALL assignments_write_policy'
    );
    assert(
      /tenant_id\s*=\s*public\.auth_tenant_id\(\)/.test(rollbackSql) &&
      /public\.auth_app_role\(\)\s+IN\s*\(\s*'super_admin'\s*,\s*'fc'\s*,\s*'pf'\s*,\s*'admin'\s*\)/.test(rollbackSql),
      'rollback restores the tenant boundary and role allowlist'
    );
    assert(
      !/auth_estate_id\(\)/.test(rollbackSql),
      'rollback removes the estate restriction (restores the exact previous policy)'
    );
    for (const name of WRITE_POLICY_NAMES) {
      assert(rollbackSql.includes(`DROP POLICY IF EXISTS "${name}" ON public.${TABLE}`),
        `rollback drops ${name} so the per-command shape cannot survive`);
    }
    const rbDrop = rollbackSql.indexOf(`DROP POLICY IF EXISTS "${WRITE_POLICY_NAME}" ON public.${TABLE}`);
    const rbCreate = rollbackSql.indexOf(`CREATE POLICY "${WRITE_POLICY_NAME}" ON public.${TABLE}`);
    assert(rbDrop !== -1 && rbCreate !== -1 && rbDrop < rbCreate,
      'rollback drops before recreating the baseline policy');
  }

  // ---- 7. Predicate simulation ----
  const rowA: SimRow = { tenantId: DEFAULT_TENANT, estateId: ESTATE_A };
  const rowB: SimRow = { tenantId: DEFAULT_TENANT, estateId: ESTATE_B };
  const estateAFc: SimIdentity = { appRole: 'fc', estateId: ESTATE_A };

  assert(canInsert(estateAFc, rowA) === true,
    'own-estate INSERT is permitted for an allowed estate role (fc)');
  assert(canInsert(estateAFc, rowB) === false,
    'foreign-estate INSERT is denied');
  assert(canUpdate(estateAFc, rowA, rowA) === true,
    'own-estate UPDATE is permitted for an allowed estate role');
  assert(canUpdate(estateAFc, rowB, rowB) === false,
    'foreign-estate UPDATE is denied');
  assert(canUpdate(estateAFc, rowA, rowB) === false,
    'estate reassignment by an ordinary estate role is denied (A -> B blocked by WITH CHECK)');
  assert(canUpdate(estateAFc, rowB, rowA) === false,
    'pulling a foreign-estate row into the caller estate is denied (B -> A blocked by USING)');
  assert(canDelete(estateAFc, rowB) === false,
    'foreign-estate DELETE is denied');
  assert(canDelete(estateAFc, rowA) === true,
    'own-estate DELETE is permitted for an allowed estate role');

  assert(canInsert({ appRole: 'pf', estateId: 'FPM_TUNGGAL' }, rowA) === false &&
    canInsert({ appRole: 'pf', estateId: 'FPM_TUNGGAL' }, { tenantId: DEFAULT_TENANT, estateId: 'FPM_TUNGGAL' }) === true,
    'pf is confined to its own estate (not broadened)');
  assert(canInsert({ appRole: 'rc', estateId: 'WILAYAH_JB' }, rowB) === false &&
    canInsert({ appRole: 'oc', estateId: 'WILAYAH_JB' }, rowB) === false,
    'rc/oc remain outside the write role allowlist (existing DB semantics preserved)');
  assert(canInsert({ appRole: 'executive_hq', estateId: 'WILAYAH_JB' }, rowB) === false,
    'executive_hq remains denied (not in the allowlist, no semantics change)');
  assert(canInsert({ appRole: 'staff', estateId: ESTATE_A }, rowA) === false,
    'non-allowed estate roles still cannot write assignments');

  assert(canInsert({ appRole: 'super_admin', estateId: 'WILAYAH_JB' }, rowB) === true &&
    canInsert({ appRole: 'admin', estateId: 'WILAYAH_JB' }, rowB) === true,
    'approved cross-estate aliases (super_admin/admin) retain cross-estate write access');
  assert(canInsert({ appRole: 'fc', estateId: 'FPM_TUNGGAL' }, rowB) === true,
    'FC Tunggal retains cross-estate write access (auth_is_super_admin)');
  assert(canUpdate({ appRole: 'fc', estateId: 'FPM_TUNGGAL' }, rowA, rowB) === true,
    'FC Tunggal can still reassign an assignment across estates');

  assert(
    canInsert({ appRole: 'fc', estateId: ESTATE_A, tenantId: '99999999-9999-4999-8999-999999999999' }, rowA) === false,
    'write policy remains bounded by the tenant boundary'
  );
  assert(canInsert({ appRole: 'fc', estateId: null }, rowA) === false,
    'an allowed role with no estate claim is denied (fail closed)');

  return { passed, total, failedTests };
}
