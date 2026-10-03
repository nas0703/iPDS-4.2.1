/**
 * iPDS v4.2.1 — Test Module 69: P6A-1 org_blocks Master-Data Seed
 *
 * Proves, from migration configuration (no live database required), that:
 *
 *   1. Every seeded block row is transcribed EXACTLY from the existing
 *      client-side SSOT src/config/estateRegistry.ts — no fabricated values
 *      (set equality in both directions, exact hectarage).
 *   2. Every seeded block uses the client's own block_code derivation
 *      (`'B' + padStart(blok, 2)`), so the codes the UI submits can resolve.
 *   3. Every seeded estate_id exists in the org_estates seed of the existing
 *      migrations, so the org_blocks.estate_id FK is satisfiable.
 *   4. Estates with zero registry blocks are NOT seeded (nothing invented).
 *   5. There are no duplicate (estate_id, block_code) pairs.
 *   6. The id is a deterministic, reproducible UUID (no invented literals).
 *   7. Fields the registry cannot supply (division_id, crop_type, planting_year)
 *      are NOT populated — the schema default / NULL applies.
 *   8. The seed is idempotent (ON CONFLICT on the existing unique key).
 *   9. The existing org_blocks schema and RLS policies remain intact.
 *
 * IMPORTANT LIMITATION: STATIC verification only. It cannot prove live
 * PostgreSQL behaviour (constraint enforcement, trigger behaviour, actual row
 * counts in a deployed database).
 */

import fs from 'fs';
import path from 'path';
import { ESTATES_REGISTRY } from '../../../src/config/estateRegistry.js';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const MIGRATION_FILE = '20261007_org_blocks_master_data_seed.sql';
const ORG_ESTATES_SEED_FILES = [
  '20260901_ipds_enterprise_rls_blueprint.sql',
  '20260904_phase1_multi_tenant_schema.sql',
  '20260906_phase5_unified_identity_profiles.sql'
];
const SEEDED_ESTATES = ['FPM_TUNGGAL', 'FPM_ADELA'];
const TARGET_BLOCK_ESTATES = ['FPM_TUNGGAL', 'FPM_ADELA'];
const ID_NAMESPACE = 'ipds:org_block:v1:';

function stripSqlComments(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

function normalize(sql: string): string {
  return stripSqlComments(sql).replace(/\s+/g, ' ').trim();
}

function readMigration(file: string): string {
  const p = path.join(MIGRATIONS_DIR, file);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

/** Expected rows derived from the registry using the client's own derivation. */
function expectedRows(): Array<{ estate: string; code: string; hectarage: number }> {
  const out: Array<{ estate: string; code: string; hectarage: number }> = [];
  for (const estate of TARGET_BLOCK_ESTATES) {
    const cfg: any = (ESTATES_REGISTRY as any)[estate];
    for (const b of Object.values(cfg?.blocks ?? {}) as any[]) {
      out.push({
        estate,
        code: `B${String(b.blok).padStart(2, '0')}`,
        hectarage: Math.round(Number(b.luas) * 100) / 100
      });
    }
  }
  return out;
}

function parseSeededRows(sql: string): Array<{ estate: string; code: string; hectarage: number }> {
  const normalized = normalize(sql);
  const start = normalized.indexOf('WITH seed(estate_id, block_code, hectarage) AS (');
  const end = normalized.indexOf(') INSERT INTO public.org_blocks', start);
  const block = start === -1 ? '' : normalized.slice(start, end === -1 ? undefined : end);
  const rowRe = /\('(FPM_[A-Z0-9_]+)', '([A-Z0-9]+)', ([0-9]+\.[0-9]{2})\)/g;
  const rows: Array<{ estate: string; code: string; hectarage: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(block)) !== null) {
    rows.push({ estate: m[1], code: m[2], hectarage: Number(m[3]) });
  }
  return rows;
}

function orgEstatesSeededIds(): Set<string> {
  const ids = new Set<string>();
  const re = /\('([A-Z0-9_]+)', '(?:OP_ZONE|ZON)_[A-Z_]+', '[^']*', [0-9.]+\)/g;
  for (const file of ORG_ESTATES_SEED_FILES) {
    const sql = normalize(readMigration(file));
    const idx = sql.indexOf('INSERT INTO public.org_estates');
    if (idx === -1) continue;
    const seg = sql.slice(idx, idx + 800);
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg)) !== null) ids.add(m[1]);
  }
  return ids;
}

export async function runP6A_1OrgBlocksSeedTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 69: P6A-1 org_blocks MASTER-DATA SEED');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 69.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 69.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 69.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const raw = readMigration(MIGRATION_FILE);
  assert(raw.length > 0, `P6A-1 migration ${MIGRATION_FILE} exists`);

  const sql = normalize(raw);
  const seeded = parseSeededRows(raw);
  const expected = expectedRows();

  // ---- 1. Coverage ----
  assert(seeded.length === 45, 'migration seeds exactly 45 blocks', `parsed ${seeded.length}`);
  assert(
    seeded.filter((r) => r.estate === 'FPM_TUNGGAL').length === 23 &&
    seeded.filter((r) => r.estate === 'FPM_ADELA').length === 22,
    'seed split is 23 (FPM_TUNGGAL) + 22 (FPM_ADELA)'
  );
  assert(expected.length === 45, 'registry still yields 45 blocks for the two estates', `derived ${expected.length}`);

  // ---- 2. No fabricated values: set equality both ways ----
  const key = (r: { estate: string; code: string; hectarage: number }) => `${r.estate}::${r.code}::${r.hectarage.toFixed(2)}`;
  const seededKeys = new Set(seeded.map(key));
  const expectedKeys = new Set(expected.map(key));
  const missing = [...expectedKeys].filter((k) => !seededKeys.has(k));
  const extra = [...seededKeys].filter((k) => !expectedKeys.has(k));
  assert(
    missing.length === 0,
    'every registry block is seeded (no omissions)',
    `missing: ${missing.slice(0, 5).join(', ')}`
  );
  assert(
    extra.length === 0,
    'no seeded block is absent from the registry (no fabricated rows)',
    `unexpected: ${extra.slice(0, 5).join(', ')}`
  );

  // ---- 3. block_code derivation ----
  const badCode = seeded.filter((r) => !/^B[A-Z0-9]{1,4}$/.test(r.code));
  assert(badCode.length === 0, 'every block_code matches the client derivation pattern', `bad: ${badCode.map((b) => b.code).join(',')}`);
  const seededCodes = new Set(seeded.map((r) => r.code));
  assert(
    seededCodes.has('B01') && seededCodes.has('B09') && seededCodes.has('B88') && seededCodes.has('B1F') && seededCodes.has('B125Y'),
    'block_code values use the client derivation for zero-padded, outlier and non-numeric labels alike'
  );

  // ---- 4. No duplicates on the natural key ----
  const pairSeen = new Map<string, number>();
  for (const r of seeded) {
    const k = `${r.estate}::${r.code}`;
    pairSeen.set(k, (pairSeen.get(k) ?? 0) + 1);
  }
  const dupes = [...pairSeen.entries()].filter(([, n]) => n > 1);
  assert(dupes.length === 0, 'no duplicate (estate_id, block_code) pair in the seed', `dupes: ${dupes.map((d) => d[0]).join(', ')}`);
  assert(new Set(seeded.map((r) => r.estate)).size === 2, 'seed touches exactly the two estates that have registry blocks');

  // ---- 5. FK satisfiability + no invented estates ----
  const orgEstates = orgEstatesSeededIds();
  assert(orgEstates.size >= 4, 'org_estates seed parsed from existing migrations', `found ${orgEstates.size}: ${[...orgEstates].join(', ')}`);
  const unknownEstate = [...new Set(seeded.map((r) => r.estate))].filter((e) => !orgEstates.has(e));
  assert(unknownEstate.length === 0, 'every seeded estate_id exists in the org_estates seed (FK satisfiable)', `unknown: ${unknownEstate.join(', ')}`);

  const zeroBlockEstates = Object.entries(ESTATES_REGISTRY as any)
    .filter(([, cfg]: [string, any]) => Object.keys(cfg?.blocks ?? {}).length === 0)
    .map(([k]) => k);
  assert(
    zeroBlockEstates.includes('FPM_KLEDANG') && zeroBlockEstates.includes('FPM_SENING'),
    'FPM_KLEDANG and FPM_SENING have zero registry blocks (nothing invented for them)'
  );
  assert(
    !seeded.some((r) => zeroBlockEstates.includes(r.estate)),
    'no blocks were invented for estates that have none in the registry',
    `seeded for: ${[...new Set(seeded.map((r) => r.estate))].join(', ')}`
  );

  // ---- 6. Deterministic identity, no invented literals ----
  assert(
    sql.includes(`md5('${ID_NAMESPACE}' || s.estate_id || ':' || s.block_code)::uuid`),
    'id is derived deterministically via the documented md5 namespace expression cast to uuid'
  );
  const uuidLiterals = (sql.match(/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/gi) || []);
  assert(
    uuidLiterals.length === 1 && uuidLiterals[0].includes('00000000-0000-0000-0000-000000000001'),
    'the only hard-coded UUID literal is the seeded tenant id (no invented block ids)',
    `literals: ${uuidLiterals.join(', ')}`
  );

  // ---- 7. Fields the registry cannot supply are NOT populated ----
  const cols = /INSERT INTO public\.org_blocks \(([^)]*)\)/i.exec(sql)?.[1] ?? '';
  assert(/id/.test(cols) && /tenant_id/.test(cols) && /estate_id/.test(cols) && /block_code/.test(cols) && /hectarage/.test(cols),
    'INSERT populates the required columns plus hectarage',
    `cols: ${cols}`);
  assert(!/division_id/.test(cols), 'division_id is NOT populated (org_divisions has no migration seed)');
  assert(!/crop_type/.test(cols), 'crop_type is NOT populated (registry has no crop data; column default applies)');
  assert(!/planting_year/.test(cols), 'planting_year is NOT populated (registry has no planting-year data)');
  assert(!/planting_year|plantingYear|tahun_tanam/i.test(JSON.stringify(ESTATES_REGISTRY)),
    'registry genuinely contains no planting-year field (non-population is justified, not an oversight)');
  assert(!/OIL_PALM/i.test(stripSqlComments(raw)),
    'migration does not assert a crop_type value (no fabricated crop data)');

  // ---- 8. Idempotency ----
  assert(
    /ON CONFLICT \(estate_id, block_code\) DO UPDATE/i.test(sql),
    'seed is idempotent via ON CONFLICT on the existing unique key (estate_id, block_code)'
  );
  assert(
    /SET hectarage = EXCLUDED\.hectarage/i.test(sql) && !/SET id = /i.test(sql),
    'conflict update refreshes hectarage and never rewrites the primary key'
  );

  // ---- 9. Schema / RLS untouched ----
  assert(
    !/CREATE TABLE|ALTER TABLE|DROP TABLE/i.test(stripSqlComments(raw)),
    'migration does not alter the org_blocks schema'
  );
  assert(
    !/(CREATE|DROP|ALTER)\s+POLICY|ROW LEVEL SECURITY|REVOKE|GRANT/i.test(stripSqlComments(raw)),
    'migration does not touch RLS policies or grants'
  );
  assert(
    /INSERT INTO public\.employee_assignment_blocks/i.test(stripSqlComments(raw)) === false &&
    /create_employee_with_assignment/i.test(stripSqlComments(raw)) === false,
    'migration does not modify employee_assignment_blocks or the create RPC'
  );

  // ---- 10. Guardrails + transaction ----
  assert(/BEGIN;/.test(raw) && /COMMIT;/.test(raw), 'migration is wrapped in a transaction');
  assert(/ORG_BLOCKS_SEED_PRECONDITION_FAILED/.test(sql), 'preflight guard fails fast when a referenced estate is missing');
  assert(/ORG_BLOCKS_SEED_VERIFICATION_FAILED/.test(sql), 'post-check guard verifies seeded coverage');
  assert(
    seeded.length > 0 && seeded.every((r) => Number.isFinite(r.hectarage) && r.hectarage > 0),
    'every seeded hectarage is a positive finite 2-decimal value'
  );

  return { passed, total, failedTests };
}
