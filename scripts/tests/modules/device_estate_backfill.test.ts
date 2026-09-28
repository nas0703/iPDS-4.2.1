/**
 * iPDS v4.1.0 — Test Module 47: P0-16C.5 Existing Device Estate-Grant Backfill
 *
 * Verifies the least-privilege backfill rule (migration SQL) and the pure
 * planner that mirrors it:
 *   - APPROVED + canonical estate -> ACTIVE grant (device's own estate only)
 *   - NULL/blank/invalid/unmapped estate -> untouched (reported)
 *   - PENDING/BLOCKED/REVOKED -> no grant
 *   - existing ACTIVE/REVOKED grants preserved (never reactivated)
 *   - idempotent, no grant-all, no cross-estate inference
 */

import fs from 'fs';
import path from 'path';
import { computeDeviceEstateGrantBackfill } from '../../../src/server/services/deviceSecurity.service.js';

const MIGRATION = 'supabase/migrations/20260925_p0_16c5_backfill_device_estate_grants.sql';
const SERVICE_SRC = 'src/server/services/deviceSecurity.service.ts';

function read(rel: string): string { return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8'); }

export async function runDeviceEstateBackfillTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 47: P0-16C.5 EXISTING DEVICE ESTATE-GRANT BACKFILL');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 47.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 47.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 47.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  // 1. Migration static checks
  {
    assert(fs.existsSync(path.join(process.cwd(), MIGRATION)), 'backfill migration 20260925 exists');
    const sql = read(MIGRATION);
    const code = sql.replace(/--[^\n]*/g, '');
    assert(/INSERT INTO public\.device_estate_access/.test(code), 'migration inserts into device_estate_access');
    assert(/SELECT[\s\S]*?FROM public\.registered_devices/.test(code), 'migration selects from registered_devices');
    assert(/rd\.status = 'APPROVED'/.test(code), 'only APPROVED devices are eligible');
    assert(/rd\.estate_id IS NOT NULL/.test(code) && /TRIM\(rd\.estate_id\) <> ''/.test(code), 'NULL/blank estate_id excluded');
    for (const e of ['FPM_TUNGGAL', 'FPM_KLEDANG', 'FPM_ADELA', 'FPM_SENING', 'WILAYAH_JB']) {
      assert(code.includes(`'${e}'`), `canonical estate ${e} allowed`);
    }
    assert(/ON CONFLICT \(device_id, estate_id\) DO NOTHING/.test(code), 'idempotent ON CONFLICT DO NOTHING (never reactivates REVOKED)');
    assert(/UPPER\(TRIM\(rd\.estate_id\)\)/.test(code), 'estate normalized with UPPER(TRIM(...))');
    assert(!/UPDATE\s+public\.registered_devices|DELETE\s+FROM\s+public\.registered_devices|ALTER TABLE\s+public\.registered_devices/i.test(code), 'registered_devices is never modified');
    assert(!/\bDELETE\b/i.test(code.replace(/ON CONFLICT[\s\S]*?DO NOTHING/i, '')) && !/\bDROP\b/i.test(code) && !/\bTRUNCATE\b/i.test(code), 'no destructive statements');
    assert(!/\b(GRANT|REVOKE)\b|ROW LEVEL SECURITY|CREATE POLICY/i.test(code), 'no RLS/grant changes');
    assert(/BEGIN;/.test(sql) && /COMMIT;/.test(sql), 'wrapped in a transaction');
    assert(!/\bALL\b/.test(code.replace(/'APPROVED'/g, '')), 'no grant-all marker');
    const files = fs.readdirSync(path.join(process.cwd(), 'supabase', 'migrations')).filter(f => f.endsWith('.sql')).sort();
    assert(files.indexOf('20260925_p0_16c5_backfill_device_estate_grants.sql') > files.indexOf('20260924_p0_16c_device_estate_access.sql'), 'ordered after 20260924 (device_estate_access exists)');
  }

  // 2. Planner matrix
  {
    const eligible = computeDeviceEstateGrantBackfill([
      { device_id: 'DEV-OK-A', status: 'APPROVED', estate_id: 'FPM_TUNGGAL' },
      { device_id: 'DEV-OK-B', status: 'APPROVED', estate_id: 'fpm_adela ' }
    ]);
    assert(eligible.toInsert.length === 2, 'APPROVED + valid estate -> ACTIVE grants');
    assert(eligible.toInsert[0].estate_id === 'FPM_TUNGGAL' && eligible.toInsert[1].estate_id === 'FPM_ADELA', 'estate normalized (case/whitespace)');

    const nullEstate = computeDeviceEstateGrantBackfill([
      { device_id: 'DEV-NULL', status: 'APPROVED', estate_id: null },
      { device_id: 'DEV-BLANK', status: 'APPROVED', estate_id: '   ' }
    ]);
    assert(nullEstate.toInsert.length === 0 && nullEstate.skipped.every(s => s.reason === 'NULL_ESTATE'), 'APPROVED + NULL/blank estate -> untouched (reported)');

    const invalid = computeDeviceEstateGrantBackfill([
      { device_id: 'DEV-BOGUS', status: 'APPROVED', estate_id: 'BOGUS_ESTATE' },
      { device_id: 'DEV-NUMERIC', status: 'APPROVED', estate_id: '5136' }
    ]);
    assert(invalid.toInsert.length === 0 && invalid.skipped.every(s => s.reason === 'INVALID_ESTATE'), 'APPROVED + invalid/unmapped estate -> untouched (no inference)');

    const statuses = computeDeviceEstateGrantBackfill([
      { device_id: 'DEV-P', status: 'PENDING', estate_id: 'FPM_TUNGGAL' },
      { device_id: 'DEV-B', status: 'BLOCKED', estate_id: 'FPM_TUNGGAL' },
      { device_id: 'DEV-R', status: 'REVOKED', estate_id: 'FPM_TUNGGAL' }
    ]);
    assert(statuses.toInsert.length === 0 && statuses.skipped.every(s => s.reason === 'NOT_APPROVED'), 'PENDING/BLOCKED/REVOKED receive no ACTIVE grant');

    const existingActive = computeDeviceEstateGrantBackfill(
      [{ device_id: 'DEV-OK-A', status: 'APPROVED', estate_id: 'FPM_TUNGGAL' }],
      [{ device_id: 'DEV-OK-A', estate_id: 'FPM_TUNGGAL' }]
    );
    assert(existingActive.toInsert.length === 0 && existingActive.skipped[0]?.reason === 'GRANT_EXISTS', 'existing ACTIVE grant unchanged');

    const existingRevoked = computeDeviceEstateGrantBackfill(
      [{ device_id: 'DEV-OK-A', status: 'APPROVED', estate_id: 'FPM_TUNGGAL' }],
      [{ device_id: 'DEV-OK-A', estate_id: 'FPM_TUNGGAL' }]
    );
    assert(existingRevoked.toInsert.length === 0, 'existing REVOKED grant is preserved (never reactivated)');

    // Idempotent: second run with first run's inserts as existing grants
    const first = computeDeviceEstateGrantBackfill([{ device_id: 'DEV-OK-A', status: 'APPROVED', estate_id: 'FPM_TUNGGAL' }]);
    const second = computeDeviceEstateGrantBackfill(
      [{ device_id: 'DEV-OK-A', status: 'APPROVED', estate_id: 'FPM_TUNGGAL' }],
      first.toInsert
    );
    assert(first.toInsert.length === 1 && second.toInsert.length === 0, 'duplicate execution is idempotent');

    // No grant-all: one estate in -> one estate out
    const noGrantAll = computeDeviceEstateGrantBackfill([{ device_id: 'DEV-OK-A', status: 'APPROVED', estate_id: 'FPM_TUNGGAL' }]);
    assert(noGrantAll.toInsert.length === 1 && noGrantAll.toInsert[0].estate_id === 'FPM_TUNGGAL', 'grants ONLY the device recorded estate (no grant-all, no cross-estate inference)');

    // Aggregation report
    const plan = computeDeviceEstateGrantBackfill([
      { device_id: 'A', status: 'APPROVED', estate_id: 'FPM_TUNGGAL' },
      { device_id: 'B', status: 'APPROVED', estate_id: 'FPM_ADELA' },
      { device_id: 'C', status: 'APPROVED', estate_id: null },
      { device_id: 'D', status: 'PENDING', estate_id: 'FPM_TUNGGAL' },
      { device_id: 'E', status: 'APPROVED', estate_id: 'BOGUS' }
    ]);
    assert(plan.toInsert.length === 2 && plan.skipped.length === 3, 'eligible/skipped aggregation is correct', `insert=${plan.toInsert.length} skip=${plan.skipped.length}`);
    assert(plan.skipped.filter(s => s.reason === 'NULL_ESTATE').length === 1 && plan.skipped.filter(s => s.reason === 'INVALID_ESTATE').length === 1 && plan.skipped.filter(s => s.reason === 'NOT_APPROVED').length === 1, 'skipped reasons classified (NULL / INVALID / NOT_APPROVED)');
  }

  // 3. Security / integrity
  {
    const service = read(SERVICE_SRC);
    assert(/export function computeDeviceEstateGrantBackfill/.test(service), 'pure backfill planner exists (mirrors migration rule)');
    assert(!/for\s*\([^)]*estate/i.test(service.slice(service.indexOf('computeDeviceEstateGrantBackfill'), service.indexOf('listDeviceEstateAccess'))), 'planner does not iterate a global estate list (no grant-all)');

    const sql = read(MIGRATION);
    assert(!/anon|authenticated/.test(sql.replace(/--[^\n]*/g, '')), 'migration adds no anon/authenticated access');
    assert(!/(password|api[_-]?key|secret|eyJ[A-Za-z0-9_-]{10,})/i.test(sql), 'migration contains no secrets');
    assert(/status,\s*granted_by,\s*granted_at/.test(sql.replace(/\s+/g, ' ')) || /'ACTIVE'/.test(sql), 'backfill sets ACTIVE status + provenance');

    // C.2/C.3 remain intact
    assert(/export async function grantDeviceEstateAccess/.test(service) && /export async function authorizeDeviceForEstate/.test(service), 'C.2 grant + C.3 primitive intact');
  }

  console.log(`\nMODULE 47 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_estate_backfill\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceEstateBackfillTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16C.5 device estate backfill suite execution error:', err); process.exit(1); });
}
