/**
 * iPDS v4.2.1 — Test Module 71: P7-1 org_divisions Master-Data Seed
 *
 * Static verification of 20261009_org_divisions_master_data_seed.sql:
 *   - exactly the 8 authoritative rows identified in Task B, nothing invented
 *   - required ids / estate relationships / names
 *   - primary-key uniqueness expectation + idempotent ON CONFLICT upsert
 *   - fail-closed precondition and post-check guards
 *   - rollback coverage with a referential-integrity guard
 *   - no schema / policy / grant / function change
 *
 * No database connection is made; this is a static analysis module.
 */

import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const ROLLBACKS_DIR = path.join(process.cwd(), 'supabase', 'rollbacks');
const MIGRATION_FILE = '20261009_org_divisions_master_data_seed.sql';
const ROLLBACK_FILE = '20261009_org_divisions_master_data_seed_rollback.sql';

interface AssertResult { passed: number; total: number; failedTests: string[]; }

// Authoritative source: scripts/apply_employee_schema.ts lines 41-49
// (the repository's own DB provisioning seed).
const EXPECTED: Array<[string, string, string]> = [
  ['DIV_TGL_P1', 'FPM_TUNGGAL', 'Peringkat 1 (Blok 1 - 9)'],
  ['DIV_TGL_P2', 'FPM_TUNGGAL', 'Peringkat 2 (Blok 10 - 18)'],
  ['DIV_ADL_P1', 'FPM_ADELA', 'Peringkat 1 (Blok 1 - 11)'],
  ['DIV_ADL_P2', 'FPM_ADELA', 'Peringkat 2 (Blok 12 - 17)'],
  ['DIV_KLD_P1', 'FPM_KLEDANG', 'Peringkat 1'],
  ['DIV_KLD_P2', 'FPM_KLEDANG', 'Peringkat 2'],
  ['DIV_SNG_P1', 'FPM_SENING', 'Peringkat 1'],
  ['DIV_SNG_P2', 'FPM_SENING', 'Peringkat 2']
];

export async function runP7_1OrgDivisionsSeedTests(): Promise<AssertResult> {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 71: P7-1 org_divisions MASTER-DATA SEED');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 71.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 71.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 71.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
  const rollbackPath = path.join(ROLLBACKS_DIR, ROLLBACK_FILE);
  assert(fs.existsSync(migrationPath), `P7-1 migration ${MIGRATION_FILE} exists`);
  assert(fs.existsSync(rollbackPath), `P7-1 rollback ${ROLLBACK_FILE} exists`);

  const raw = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf-8') : '';
  const sql = raw
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

  assert(/BEGIN;/.test(raw) && /COMMIT;/.test(raw), 'migration is wrapped in a transaction');

  // ---- 1. Exactly the 8 authoritative rows ----
  // Scope the count to the CTE seed block only: the post-check guard also lists
  // the same ids inside IN (...) predicates, which must not be counted as rows.
  const seedStart = sql.indexOf('WITH seed');
  const seedEnd = sql.indexOf('ON CONFLICT');
  const seedBlockClean = seedStart !== -1 && seedEnd > seedStart ? sql.slice(seedStart, seedEnd) : '';
  assert(seedBlockClean.length > 0, 'CTE seed block located for static analysis');

  const valueRows = seedBlockClean.match(/\(\s*'DIV_[A-Z0-9_]+'\s*,/g) || [];
  assert(valueRows.length === 8, 'seed contains exactly 8 division rows', `found ${valueRows.length}`);

  for (const [id, estate, name] of EXPECTED) {
    const re = new RegExp(`\\(\\s*'${id}'\\s*,\\s*'${estate}'\\s*,\\s*'${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*\\)`);
    assert(re.test(seedBlockClean), `${id} is seeded with its authoritative estate and name`);
    assert((sql.match(new RegExp(`'${id}'`, 'g')) || []).length >= 1, `${id} appears in the migration`);
  }

  // ---- 2. No invented identifiers ----
  const allIds = Array.from(new Set((sql.match(/'DIV_[A-Z0-9_]+'/g) || []).map((s) => s.replace(/'/g, ''))));
  const expectedIds = EXPECTED.map(([id]) => id);
  const extra = allIds.filter((id) => !expectedIds.includes(id));
  assert(extra.length === 0, 'no division id outside the authoritative 8 is introduced', `extra: ${extra.join(', ')}`);
  assert(!/'DIV_WJB_HQ'/.test(sql),
    'DIV_WJB_HQ is NOT seeded (its estate row does not exist; no authoritative op_zone_id)');
  assert(expectedIds.every((id) => allIds.includes(id)), 'all 8 authoritative division ids are present');

  // ---- 3. Estate relationships ----
  const allowedEstates = ['FPM_TUNGGAL', 'FPM_ADELA', 'FPM_KLEDANG', 'FPM_SENING'];
  assert(allowedEstates.every((e) => sql.includes(`'${e}'`)), 'all four target estates are referenced');
  assert(!/'WILAYAH_JB'/.test(sql), 'WILAYAH_JB is not referenced by this seed');
  assert(!/'FPM_TUNGGAL'\s*,\s*'DIV_/.test(sql), 'column order is (id, estate_id, name) — not reversed');

  // ---- 4. Uniqueness + idempotency ----
  assert(/INSERT INTO public\.org_divisions \(id, estate_id, name\)/i.test(sql),
    'insert targets public.org_divisions (id, estate_id, name)');
  assert(/ON CONFLICT \(id\) DO UPDATE/i.test(sql),
    'seed is idempotent via ON CONFLICT (id) DO UPDATE (primary-key keyed)');
  assert(/SET estate_id = EXCLUDED\.estate_id/i.test(sql) && /name\s*=\s*EXCLUDED\.name/i.test(sql),
    'upsert converges estate_id and name to the authoritative values');

  // ---- 5. Fail-closed guards ----
  assert(/DIVISIONS_SEED_PRECONDITION_FAILED/.test(sql),
    'precondition guard fails closed when a required org_estates row is missing');
  assert(/FROM public\.org_estates/.test(sql), 'precondition guard checks public.org_estates');
  assert(/DIVISIONS_SEED_VERIFICATION_FAILED/.test(sql),
    'post-check guard verifies the seeded result');
  assert(/<> 8/.test(sql), 'post-check guard requires exactly 8 authoritative rows');
  assert(/USING ERRCODE = '42501'/.test(sql), 'guards raise a structured SQLSTATE (42501)');

  // ---- 6. Scope: data only ----
  assert(!/ALTER\s+TABLE/i.test(sql), 'migration does not ALTER any table');
  assert(!/CREATE\s+(POLICY|TABLE|FUNCTION|INDEX)/i.test(sql),
    'migration creates no policy/table/function/index (data-only seed)');
  assert(!/DROP\s+POLICY/i.test(sql) && !/GRANT\b/i.test(sql) && !/REVOKE\b/i.test(sql),
    'migration does not touch policies or grants');
  assert(!/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql), 'migration never disables RLS');

  // ---- 7. Rollback coverage ----
  if (fs.existsSync(rollbackPath)) {
    const rbRaw = fs.readFileSync(rollbackPath, 'utf-8');
    const rb = rbRaw.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n');
    assert(/BEGIN;/.test(rbRaw) && /COMMIT;/.test(rbRaw), 'rollback is wrapped in a transaction');
    assert(/DELETE FROM public\.org_divisions/i.test(rb), 'rollback deletes from public.org_divisions');
    for (const [id] of EXPECTED) {
      assert(rb.includes(`'${id}'`), `rollback targets the seeded row ${id}`);
    }
    assert(!/DELETE FROM public\.org_estates/i.test(rb), 'rollback does not delete org_estates rows');
    assert(!/DELETE FROM public\.org_blocks/i.test(rb), 'rollback does not delete org_blocks rows');
    assert(!/FROM public\.org_divisions\s*;/i.test(rb),
      'rollback is not an unbounded delete (explicit id list only)');
    assert(/DIVISIONS_SEED_ROLLBACK_BLOCKED/.test(rb) &&
      /employee_assignments/.test(rb) && /org_blocks/.test(rb),
      'rollback refuses to remove divisions still referenced by live data (fail closed)');
  }

  return { passed, total, failedTests };
}
