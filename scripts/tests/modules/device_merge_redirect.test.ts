/**
 * iPDS v4.1.0 — P1 Device Soft-Merge: redirect + migration/script safeguards
 *
 * Focused tests for the NEW merge-redirect behavior and the merge artifacts:
 *   - a merged duplicate device never authenticates; it returns DEVICE_MERGED
 *     with the canonical device_id
 *   - a normal APPROVED device is unaffected
 *   - the merge-tracking migration exists and is locked down
 *   - the merge script never deletes rows, never copies/overwrites credential_hash,
 *     and never selects credential_hash values
 *   - server + client wiring for canonical adoption exists
 */

import fs from 'fs';
import path from 'path';
import { authorizeDeviceForEstate, type RegisteredDeviceRecord, type DeviceAuthorizationDeps } from '../../../src/server/services/deviceSecurity.service.js';

const MIGRATION = 'supabase/migrations/20260926_p1_device_merge_tracking.sql';
const MERGE_SQL = 'scripts/device_merge/merge_devices.sql';
const AUTH_ROUTES = 'src/server/routes/auth.routes.ts';
const DEVICE_HELPER = 'src/utils/deviceHelper.ts';
const USE_AUTH = 'src/features/auth/hooks/useAuth.ts';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

function depsFor(device: RegisteredDeviceRecord | null, estateAccess: 'ACTIVE' | 'REVOKED' | null = 'ACTIVE'): DeviceAuthorizationDeps {
  return {
    findDeviceByCredentialHash: async () => device,
    getEstateAccess: async (deviceId, estateId) =>
      estateAccess ? { device_id: deviceId, estate_id: estateId, status: estateAccess } : null
  };
}

export async function runDeviceMergeRedirectTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 51: P1 DEVICE SOFT-MERGE REDIRECT & SAFEGUARDS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 51.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 51.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 51.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // 1. Merged duplicate -> DEVICE_MERGED with canonical id, never allowed.
  {
    const merged: RegisteredDeviceRecord = { device_id: 'DEV-DUP', status: 'REVOKED', merged_into: 'DEV-CANON' } as RegisteredDeviceRecord;
    const r = await authorizeDeviceForEstate({ credential: 'any-credential', requestedEstateId: 'FPM_TUNGGAL' }, depsFor(merged));
    assert(r.allowed === false && r.code === 'DEVICE_MERGED', 'merged duplicate returns DEVICE_MERGED (not allowed)', JSON.stringify(r));
    assert(r.mergedInto === 'DEV-CANON', 'merged duplicate returns the canonical device_id for adoption');
  }

  // 2. Merged detection takes precedence even if status were APPROVED.
  {
    const mergedApproved: RegisteredDeviceRecord = { device_id: 'DEV-DUP2', status: 'APPROVED', merged_into: 'DEV-CANON' } as RegisteredDeviceRecord;
    const r = await authorizeDeviceForEstate({ credential: 'x', requestedEstateId: 'FPM_TUNGGAL' }, depsFor(mergedApproved));
    assert(r.code === 'DEVICE_MERGED', 'merged check precedes status check');
  }

  // 3. Normal APPROVED device unaffected.
  {
    const normal: RegisteredDeviceRecord = { device_id: 'DEV-OK', status: 'APPROVED' } as RegisteredDeviceRecord;
    const r = await authorizeDeviceForEstate({ credential: 'x', requestedEstateId: 'FPM_TUNGGAL' }, depsFor(normal));
    assert(r.allowed === true && r.code === 'OK' && r.mergedInto === undefined, 'non-merged APPROVED device still authorizes normally');
  }

  // 4. Migration exists with the required columns + archive lockdown.
  {
    const exists = fs.existsSync(path.join(process.cwd(), MIGRATION));
    assert(exists, 'merge-tracking migration file exists');
    if (exists) {
      const sql = read(MIGRATION);
      assert(/ADD COLUMN IF NOT EXISTS merged_into TEXT/.test(sql), 'migration adds merged_into TEXT');
      assert(/ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ/.test(sql), 'migration adds merged_at');
      assert(/ADD COLUMN IF NOT EXISTS merge_operation_id TEXT/.test(sql), 'migration adds merge_operation_id');
      assert(/CREATE TABLE IF NOT EXISTS public\.registered_devices_archive/.test(sql), 'migration creates the archive table');
      assert(/ALTER TABLE public\.registered_devices_archive ENABLE ROW LEVEL SECURITY/.test(sql)
        && /FORCE ROW LEVEL SECURITY/.test(sql), 'archive table has ENABLE + FORCE RLS');
      assert(/REVOKE ALL ON public\.registered_devices_archive FROM PUBLIC/.test(sql)
        && /REVOKE ALL ON public\.registered_devices_archive FROM anon/.test(sql)
        && /REVOKE ALL ON public\.registered_devices_archive FROM authenticated/.test(sql), 'archive table revoked from PUBLIC/anon/authenticated');
      assert(/GRANT [^;]*ON public\.registered_devices_archive TO service_role/.test(sql), 'archive table granted to service_role only');
      assert(!/\bDELETE\s+FROM\b/i.test(sql) && !/\bDROP\s+TABLE\b/i.test(sql), 'migration performs no DELETE/DROP');
    }
  }

  // 5. Merge script safeguards.
  {
    const exists = fs.existsSync(path.join(process.cwd(), MERGE_SQL));
    assert(exists, 'merge script file exists');
    if (exists) {
      const sql = read(MERGE_SQL);
      assert(/\bBEGIN;/.test(sql) && /\bCOMMIT;/.test(sql), 'merge script is transactional (BEGIN/COMMIT)');
      assert(/RAISE EXCEPTION 'MERGE_ABORT/.test(sql), 'merge script has abort guards');
      assert(/merged_into\s*=\s*m\.canonical_device_id/.test(sql), 'merge script sets merged_into to the canonical id');
      assert(/status\s*=\s*'REVOKED'/.test(sql), 'merge script revokes the duplicate status (no delete)');
      assert(!/\bDELETE\s+FROM\s+public\.registered_devices\b/i.test(sql), 'merge script never DELETEs registered_devices rows');
      assert(!/credential_hash\s*=/.test(sql), 'merge script never assigns/copies credential_hash');
      assert(!/SELECT\s+credential_hash\b/i.test(sql.replace(/--[^\n]*/g, '')), 'merge script never SELECTs credential_hash values');
      assert(/same estate_id/i.test(sql) || /estate_id IS DISTINCT FROM/.test(sql), 'merge script enforces same-estate');
    }
  }

  // 6. Server + client wiring for canonical adoption.
  {
    const routes = read(AUTH_ROUTES);
    assert(/function redirectMergedDevice/.test(routes) && /code: 'DEVICE_MERGED'/.test(routes), 'auth routes emit DEVICE_MERGED with canonicalDeviceId');
    assert(/canonicalDeviceId: canonical/.test(routes), 'auth routes return the canonical device id');

    const helper = read(DEVICE_HELPER);
    assert(/export function setClientDeviceId/.test(helper), 'deviceHelper exposes setClientDeviceId');

    const useAuth = read(USE_AUTH);
    assert(/setClientDeviceId/.test(useAuth) && /adoptCanonicalDeviceId/.test(useAuth), 'client adopts the server-provided canonical device id');
  }

  console.log(`\nMODULE 51 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_merge_redirect\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceMergeRedirectTests()
    .then((res) => process.exit(res.passed === res.total ? 0 : 1))
    .catch((err) => { console.error('P1 device merge redirect suite execution error:', err); process.exit(1); });
}
