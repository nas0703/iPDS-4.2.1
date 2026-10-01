/**
 * iPDS v4.2.1 — Test Module 68: P5-1 Employee Assignment Block Write Estate Scoping
 *
 * Proves, from migration configuration (no live database required), that:
 *
 *   1. public."assignment_blocks_write_policy" is estate-scoped for ordinary
 *      estate-level roles while keeping the tenant boundary and the existing
 *      role allowlist ('super_admin','fc','pf','admin') verbatim.
 *   2. The estate dimension is resolved through the PARENT assignment
 *      (public.employee_assignment_blocks has no estate_id column of its own),
 *      on BOTH USING and WITH CHECK — which is what prevents foreign-estate
 *      INSERT/UPDATE/DELETE and repointing a block row at another estate's
 *      assignment.
 *   3. Approved cross-estate roles keep write access via
 *      auth_is_cross_estate_role() / auth_is_super_admin().
 *   4. `pf` is confined (not broadened) and `rc` / `oc` / `executive_hq` gain
 *      nothing; the auth_* helper definitions are not touched.
 *   5. The policy is not duplicated (DROP before CREATE + deploy-time guard)
 *      and the read policy is untouched.
 *   6. The rollback restores the previous tenant + role policy exactly.
 *   7. Predicate simulation: same-estate INSERT/UPDATE/DELETE allowed for an
 *      allowed estate role; foreign-estate INSERT/UPDATE/DELETE denied;
 *      cross-estate reassignment denied; tenant mismatch denied; no estate
 *      claim fails closed.
 *
 * IMPORTANT LIMITATION: this module validates migration SQL and the policy
 * predicate logic. It is STATIC/predicate verification. It CANNOT prove live
 * PostgreSQL RLS behaviour — a staging database verification is still required.
 */

import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const ROLLBACKS_DIR = path.join(process.cwd(), 'supabase', 'rollbacks');
const MIGRATION_FILE = '20261006_employee_assignment_block_write_estate_scoping.sql';
const ROLLBACK_FILE = '20261006_employee_assignment_block_write_estate_scoping_rollback.sql';
const BASE_MIGRATION_FILE = '20260915_employee_master_data_foundation.sql';
const READ_POLICY_MIGRATION_FILE = '20261004_employee_master_rls_estate_scoping.sql';
const READ_POLICY_NAME = 'assignment_blocks_read_policy';
const WRITE_POLICY_NAME = 'assignment_blocks_write_policy';
// P5-1 baseline correction: the write policy is expressed per command instead of
// FOR ALL, because a FOR ALL policy also governs SELECT and would have been
// OR-combined with assignment_blocks_read_policy, silently widening reads.
const WRITE_POLICY_INSERT = 'assignment_blocks_write_insert_policy';
const WRITE_POLICY_UPDATE = 'assignment_blocks_write_update_policy';
const WRITE_POLICY_DELETE = 'assignment_blocks_write_delete_policy';
const WRITE_POLICY_NAMES = [WRITE_POLICY_INSERT, WRITE_POLICY_UPDATE, WRITE_POLICY_DELETE];
const TABLE = 'employee_assignment_blocks';
const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';
const ESTATE_A = 'FPM_ADELA';
const ESTATE_B = 'FPM_KLEDANG';

function stripSqlComments(sql: string): string {
  // Split on /\r?\n/: Windows CRLF leaves a trailing '\r' that prevents
  // /--.*$/ from matching, which would silently keep header comments in the
  // normalised statement text.
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
 * 20261006_employee_assignment_block_write_estate_scoping.sql.
 *
 * The block table has no estate_id: the estate clause resolves through the
 * parent assignment, which is itself subject to "assignments_read_policy" when
 * the policy expression is evaluated as the caller.
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

interface SimAssignment {
  id: string;
  tenantId: string;
  estateId: string;
}

interface SimBlockRow {
  tenantId: string;
  assignmentId: string;
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

function isPrivileged(identity: SimIdentity): boolean {
  return isCrossEstateRole(identity.appRole) || isSuperAdminIdentity(identity.appRole, identity.estateId);
}

/** Mirrors the EXISTS subquery: can the caller reach the parent assignment in their estate? */
function estateClausePasses(identity: SimIdentity, row: SimBlockRow, assignments: SimAssignment[]): boolean {
  if (isPrivileged(identity)) return true;
  if (!identity.estateId) return false;

  const parent = assignments.find((a) => a.id === row.assignmentId);
  if (!parent) return false;
  if (parent.tenantId !== tenantOf(identity)) return false;
  // "assignments_read_policy" is applied to the subquery as the caller
  return parent.estateId === identity.estateId;
}

/** WITH CHECK: may the resulting block row be stored? */
function checkPasses(identity: SimIdentity, newRow: SimBlockRow, assignments: SimAssignment[]): boolean {
  if (newRow.tenantId !== tenantOf(identity)) return false;
  if (!roleAllowed(identity)) return false;
  return estateClausePasses(identity, newRow, assignments);
}

/** USING: can the command act on this existing block row? */
function usingPasses(identity: SimIdentity, existingRow: SimBlockRow, assignments: SimAssignment[]): boolean {
  if (existingRow.tenantId !== tenantOf(identity)) return false;
  if (!roleAllowed(identity)) return false;
  return estateClausePasses(identity, existingRow, assignments);
}

function canInsertBlock(identity: SimIdentity, newRow: SimBlockRow, assignments: SimAssignment[]): boolean {
  return checkPasses(identity, newRow, assignments);
}

function canUpdateBlock(
  identity: SimIdentity,
  existingRow: SimBlockRow,
  newRow: SimBlockRow,
  assignments: SimAssignment[]
): boolean {
  return usingPasses(identity, existingRow, assignments) && checkPasses(identity, newRow, assignments);
}

function canDeleteBlock(identity: SimIdentity, existingRow: SimBlockRow, assignments: SimAssignment[]): boolean {
  return usingPasses(identity, existingRow, assignments);
}

export async function runP5_1AssignmentBlockWriteEstateScopingTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 68: P5-1 EMPLOYEE ASSIGNMENT BLOCK WRITE ESTATE SCOPING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 68.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 68.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 68.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // ---- 1. Artefacts ----
  const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
  const rollbackPath = path.join(ROLLBACKS_DIR, ROLLBACK_FILE);
  assert(fs.existsSync(migrationPath), `P5-1 migration ${MIGRATION_FILE} exists`);
  assert(fs.existsSync(rollbackPath), `P5-1 rollback ${ROLLBACK_FILE} exists`);

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
    // The estate dimension must come from the PARENT assignment (no estate_id column here)
    assert(/FROM\s+public\.employee_assignments\s+ea/i.test(sql) &&
      /ea\.id\s*=\s*employee_assignment_blocks\.assignment_id/.test(sql),
      `${cmd} policy resolves the estate through the parent employee_assignments row`);
    assert(/ea\.estate_id\s*=\s*public\.auth_estate_id\(\)/.test(sql),
      `${cmd} policy confines ordinary roles to assignments in their own estate`);
    assert(!/employee_assignment_blocks\.estate_id/.test(sql),
      `${cmd} policy does not reference a non-existent estate_id column on the block table`);
  }

  // UPDATE must carry the parent-estate clause in BOTH clauses; INSERT/DELETE in
  // their single applicable clause.
  const usingClause = (/USING\s*\(([\s\S]*?)\)\s*WITH\s+CHECK/i.exec(updateSql) || [])[1] || '';
  const withCheckClause = (/WITH\s+CHECK\s*\(([\s\S]*?)\)\s*;?$/i.exec(updateSql) || [])[1] || '';
  assert(/ea\.estate_id\s*=\s*public\.auth_estate_id\(\)/.test(usingClause),
    'UPDATE USING carries the parent-estate restriction (existing row must be in the caller estate)');
  assert(/ea\.estate_id\s*=\s*public\.auth_estate_id\(\)/.test(withCheckClause),
    'UPDATE WITH CHECK carries the parent-estate restriction (resulting row must stay in the caller estate)');
  assert(/ea\.estate_id\s*=\s*public\.auth_estate_id\(\)/.test(insertSql),
    'INSERT WITH CHECK carries the parent-estate restriction');
  assert(/ea\.estate_id\s*=\s*public\.auth_estate_id\(\)/.test(deleteSql),
    'DELETE USING carries the parent-estate restriction');
  assert(!/FOR\s+ALL\s+TO\s+authenticated/i.test(migrationSql),
    'migration leaves no FOR ALL policy (OR semantics would re-widen SELECT)');

  // Not broadened
  assert(!/executive_hq/.test(migrationSql),
    'migration does not add executive_hq to the write role allowlist');
  assert(!/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.auth_/i.test(migrationSql),
    'migration does not modify any public.auth_* helper definition');

  // ---- 3. Before state ----
  const originalSql = findPolicyDefinitionInFile(BASE_MIGRATION_FILE, WRITE_POLICY_NAME, TABLE);
  assert(!!originalSql, `original ${WRITE_POLICY_NAME} found in ${BASE_MIGRATION_FILE}`);
  assert(!!originalSql && !/auth_estate_id\(\)/.test(originalSql),
    'the original write policy had no estate restriction (documented "before" state)');

  // ---- 4. Exactly one permissive policy per command + guard ----
  assert(migrationSql.indexOf(`DROP POLICY IF EXISTS "${WRITE_POLICY_NAME}" ON public.${TABLE}`) !== -1,
    `migration DROPs the baseline ${WRITE_POLICY_NAME} before replacing it`);
  for (const name of WRITE_POLICY_NAMES) {
    const d = migrationSql.indexOf(`DROP POLICY IF EXISTS "${name}" ON public.${TABLE}`);
    const c = migrationSql.indexOf(`CREATE POLICY "${name}" ON public.${TABLE}`);
    assert(d !== -1 && c !== -1 && d < c,
      `migration DROPs ${name} before recreating it (idempotent, no duplicate permissive policy)`);
    assert((migrationSql.match(new RegExp(`CREATE POLICY "${name}"`, 'g')) || []).length === 1,
      `exactly one CREATE POLICY for ${name} in this migration`);
  }
  assert(/DUPLICATE_PERMISSIVE_POLICY_DETECTED/.test(migrationSql) &&
    /pg_catalog\.pg_policies/.test(migrationSql),
    'migration carries a deploy-time guard against duplicate permissive policies');

  // ---- 5. Read policy untouched ----
  const readPolicy = findLastPolicyDefinition(READ_POLICY_NAME, TABLE);
  assert(
    !!readPolicy && readPolicy.file === READ_POLICY_MIGRATION_FILE,
    `${READ_POLICY_NAME} is still defined by ${READ_POLICY_MIGRATION_FILE} (untouched by P5-1)`,
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
      new RegExp(`CREATE POLICY "${WRITE_POLICY_NAME}" ON public\\.${TABLE}\\s+FOR ALL TO authenticated`).test(rollbackSql),
      'rollback recreates the baseline FOR ALL assignment_blocks_write_policy'
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
  const asgA: SimAssignment = { id: 'asg-A', tenantId: DEFAULT_TENANT, estateId: ESTATE_A };
  const asgB: SimAssignment = { id: 'asg-B', tenantId: DEFAULT_TENANT, estateId: ESTATE_B };
  const assignments: SimAssignment[] = [asgA, asgB];

  const blockOnA: SimBlockRow = { tenantId: DEFAULT_TENANT, assignmentId: 'asg-A' };
  const blockOnB: SimBlockRow = { tenantId: DEFAULT_TENANT, assignmentId: 'asg-B' };
  const estateAFc: SimIdentity = { appRole: 'fc', estateId: ESTATE_A };

  assert(canInsertBlock(estateAFc, blockOnA, assignments) === true,
    'same-estate INSERT is permitted for an allowed estate role');
  assert(canInsertBlock(estateAFc, blockOnB, assignments) === false,
    'foreign-estate INSERT is denied');
  assert(canUpdateBlock(estateAFc, blockOnA, blockOnA, assignments) === true,
    'same-estate UPDATE is permitted for an allowed estate role');
  assert(canUpdateBlock(estateAFc, blockOnB, blockOnB, assignments) === false,
    'foreign-estate UPDATE is denied');
  assert(canUpdateBlock(estateAFc, blockOnA, blockOnB, assignments) === false,
    'cross-estate reassignment (repointing the block at another estate assignment) is denied');
  assert(canUpdateBlock(estateAFc, blockOnB, blockOnA, assignments) === false,
    'pulling a foreign-estate block into the caller estate is denied');
  assert(canDeleteBlock(estateAFc, blockOnB, assignments) === false,
    'foreign-estate DELETE is denied');
  assert(canDeleteBlock(estateAFc, blockOnA, assignments) === true,
    'same-estate DELETE is permitted for an allowed estate role');

  assert(canInsertBlock({ appRole: 'pf', estateId: 'FPM_TUNGGAL' }, blockOnA, assignments) === false &&
    canInsertBlock(
      { appRole: 'pf', estateId: 'FPM_TUNGGAL' },
      { tenantId: DEFAULT_TENANT, assignmentId: 'asg-T' },
      [...assignments, { id: 'asg-T', tenantId: DEFAULT_TENANT, estateId: 'FPM_TUNGGAL' }]
    ) === true,
    'pf is confined to its own estate (not broadened)');
  assert(canInsertBlock({ appRole: 'rc', estateId: 'WILAYAH_JB' }, blockOnB, assignments) === false &&
    canInsertBlock({ appRole: 'oc', estateId: 'WILAYAH_JB' }, blockOnB, assignments) === false,
    'rc/oc remain outside the write role allowlist (no broadening)');
  assert(canInsertBlock({ appRole: 'executive_hq', estateId: 'WILAYAH_JB' }, blockOnB, assignments) === false,
    'executive_hq remains denied (not in the allowlist, no semantics change)');
  assert(canInsertBlock({ appRole: 'staff', estateId: ESTATE_A }, blockOnA, assignments) === false,
    'non-allowed estate roles still cannot write block rows');

  assert(canInsertBlock({ appRole: 'super_admin', estateId: 'WILAYAH_JB' }, blockOnB, assignments) === true &&
    canInsertBlock({ appRole: 'admin', estateId: 'WILAYAH_JB' }, blockOnB, assignments) === true,
    'approved cross-estate aliases (super_admin/admin) retain cross-estate write access');
  assert(canInsertBlock({ appRole: 'fc', estateId: 'FPM_TUNGGAL' }, blockOnB, assignments) === true,
    'FC Tunggal retains cross-estate write access (auth_is_super_admin)');
  assert(canUpdateBlock({ appRole: 'fc', estateId: 'FPM_TUNGGAL' }, blockOnA, blockOnB, assignments) === true,
    'FC Tunggal can still repoint a block row across estates');

  assert(
    canInsertBlock({ appRole: 'fc', estateId: ESTATE_A, tenantId: '99999999-9999-4999-8999-999999999999' }, blockOnA, assignments) === false,
    'write policy remains bounded by the tenant boundary'
  );
  assert(canInsertBlock({ appRole: 'fc', estateId: null }, blockOnA, assignments) === false,
    'an allowed role with no estate claim is denied (fail closed)');

  // Parent assignment that the caller cannot read (foreign estate) must fail closed
  assert(
    canInsertBlock(estateAFc, { tenantId: DEFAULT_TENANT, assignmentId: 'asg-missing' }, assignments) === false,
    'a block row whose parent assignment is unreachable fails closed'
  );

  return { passed, total, failedTests };
}
