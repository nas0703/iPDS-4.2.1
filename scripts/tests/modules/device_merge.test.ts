/**
 * iPDS v4.1.0 — P1 Device Merge (service + API + migration safeguards)
 *
 * Focused tests for the operator-driven soft-merge:
 *   - successful merge (archives + revokes duplicates via the RPC)
 *   - same-estate enforcement / cross-estate rejection
 *   - non-APPROVED rejection (canonical + duplicate)
 *   - already-merged rejection
 *   - self-merge rejection
 *   - canonical already-a-duplicate rejection
 *   - transaction failure mapping (rollback surface)
 *   - idempotent double-submit / concurrent protection
 *   - DEVICE_MERGED redirect idempotency fields
 *   - credential_hash never returned by the safe candidate mapper
 *   - no DELETE and no credential copying in the merge migration
 *   - route registration + guards
 */

import fs from 'fs';
import path from 'path';
import {
  mergeDevices,
  validateMergeSelection,
  toSafeMergeCandidate,
  type DeviceMergeDeps
} from '../../../src/server/services/deviceMerge.service.js';
import type { RegisteredDeviceRecord } from '../../../src/server/services/deviceSecurity.service.js';
import devicesRoutes from '../../../src/server/routes/devices.routes.js';

const MERGE_FN_MIGRATION = 'supabase/migrations/20260927_p1_device_merge_function.sql';
const TRACKING_MIGRATION = 'supabase/migrations/20260926_p1_device_merge_tracking.sql';
const MERGE_SQL = 'scripts/device_merge/merge_devices.sql';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

function dev(id: string, estate = 'FPM_TUNGGAL', status: RegisteredDeviceRecord['status'] = 'APPROVED', merged_into?: string): RegisteredDeviceRecord {
  return { device_id: id, device_name: id, estate_id: estate, status, merged_into: merged_into ?? null } as RegisteredDeviceRecord;
}

function makeDeps(devices: RegisteredDeviceRecord[], rpcResult?: { data: any; error: any }) {
  const audits: any[] = [];
  let rpcCalls = 0;
  const deps: DeviceMergeDeps = {
    getDevice: async (id: string) => devices.find((d) => d.device_id === id) || null,
    rpcMerge: async (args) => {
      rpcCalls++;
      if (rpcResult) return rpcResult;
      return {
        data: {
          status: 'OK',
          operation_id: args.p_operation_id,
          canonical_device_id: args.p_canonical_device_id,
          estate_id: devices.find((d) => d.device_id === args.p_canonical_device_id)?.estate_id,
          merged_duplicate_ids: args.p_duplicate_device_ids,
          already_merged_ids: [],
          merged_at: '2026-09-17T00:00:00.000Z'
        },
        error: null
      };
    },
    audit: (info) => audits.push(info),
    now: () => '2026-09-17T00:00:00.000Z'
  };
  return { deps, audits, rpcCalls: () => rpcCalls };
}

const OP = 'MERGE-2026-0901-0001';

export async function runDeviceMergeTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 52: P1 DEVICE MERGE (OPERATOR-DRIVEN SOFT-MERGE)');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 52.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 52.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 52.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // 1. Successful merge.
  {
    const devices = [dev('DEV-CANON'), dev('DEV-DUP')];
    const { deps, audits, rpcCalls } = makeDeps(devices);
    const r = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-DUP'] }, deps);
    assert(r.ok && r.canonicalDeviceId === 'DEV-CANON' && (r.mergedDuplicateIds || []).includes('DEV-DUP'), 'successful merge returns canonical + merged duplicate');
    assert(rpcCalls() === 1, 'authoritative SQL RPC invoked exactly once');
    assert(audits.length === 1 && audits[0].mergedDuplicateIds.includes('DEV-DUP'), 'DEVICE_MERGE audit recorded with device ids');
    assert(!JSON.stringify(audits).includes('credential'), 'audit payload contains no credential material');
  }

  // 2. Same-estate enforcement / cross-estate rejection.
  {
    const devices = [dev('DEV-CANON', 'FPM_TUNGGAL'), dev('DEV-DUP', 'FPM_ADELA')];
    const { deps, rpcCalls } = makeDeps(devices);
    const r = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-DUP'] }, deps);
    assert(!r.ok && r.code === 'CROSS_ESTATE', 'cross-estate merge rejected', `code=${r.code}`);
    assert(rpcCalls() === 0, 'no RPC call when pre-validation fails');
  }

  // 3. Non-APPROVED canonical + duplicate rejection.
  {
    const d1 = makeDeps([dev('DEV-CANON', 'FPM_TUNGGAL', 'PENDING'), dev('DEV-DUP')]);
    const r1 = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-DUP'] }, d1.deps);
    assert(!r1.ok && r1.code === 'CANONICAL_NOT_APPROVED', 'non-APPROVED canonical rejected');

    const d2 = makeDeps([dev('DEV-CANON'), dev('DEV-DUP', 'FPM_TUNGGAL', 'REVOKED')]);
    const r2 = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-DUP'] }, d2.deps);
    assert(!r2.ok && r2.code === 'DUPLICATE_NOT_APPROVED', 'non-APPROVED duplicate rejected');
  }

  // 4. Already-merged rejection.
  {
    const { deps } = makeDeps([dev('DEV-CANON'), dev('DEV-DUP', 'FPM_TUNGGAL', 'REVOKED', 'DEV-OTHER')]);
    const r = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-DUP'] }, deps);
    assert(!r.ok && r.code === 'DUPLICATE_ALREADY_MERGED', 'already-merged duplicate rejected');
  }

  // 5. Self-merge rejection.
  {
    const { deps, rpcCalls } = makeDeps([dev('DEV-CANON')]);
    const r = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-CANON'] }, deps);
    assert(!r.ok && r.code === 'SELF_MERGE', 'self-merge rejected');
    assert(rpcCalls() === 0, 'no RPC for self-merge');
  }

  // 6. Canonical already a duplicate rejection.
  {
    const { deps } = makeDeps([dev('DEV-CANON', 'FPM_TUNGGAL', 'APPROVED', 'DEV-ROOT'), dev('DEV-DUP')]);
    const r = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-DUP'] }, deps);
    assert(!r.ok && r.code === 'CANONICAL_IS_DUPLICATE', 'canonical that is itself a duplicate rejected');
  }

  // 7. Transaction failure mapping (rollback surface).
  {
    const { deps, audits } = makeDeps([dev('DEV-CANON'), dev('DEV-DUP')], { data: null, error: { message: 'MERGE_CROSS_ESTATE: DEV-DUP' } });
    const r = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-DUP'] }, deps);
    assert(!r.ok && r.code === 'CROSS_ESTATE', 'SQL guard failure mapped to a rejection code');
    assert(audits.length === 0, 'no success audit when the transaction rejects');
  }

  // 8. Idempotent double-submit / concurrent protection.
  {
    const { deps } = makeDeps([dev('DEV-CANON'), dev('DEV-DUP', 'FPM_TUNGGAL', 'REVOKED', 'DEV-CANON')], {
      data: {
        status: 'OK',
        operation_id: OP,
        canonical_device_id: 'DEV-CANON',
        estate_id: 'FPM_TUNGGAL',
        merged_duplicate_ids: [],
        already_merged_ids: ['DEV-DUP'],
        merged_at: '2026-09-17T00:00:00.000Z'
      },
      error: null
    });
    // Pre-validation would reject already-merged; bypass by presenting the dup as APPROVED pre-merge
    // and simulating the RPC reporting it as already merged for the same operation.
    const devices = [dev('DEV-CANON'), dev('DEV-DUP')];
    const d = makeDeps(devices, {
      data: {
        status: 'OK',
        operation_id: OP,
        canonical_device_id: 'DEV-CANON',
        estate_id: 'FPM_TUNGGAL',
        merged_duplicate_ids: [],
        already_merged_ids: ['DEV-DUP'],
        merged_at: '2026-09-17T00:00:00.000Z'
      },
      error: null
    });
    const r = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-DUP'] }, d.deps);
    assert(r.ok && r.idempotent === true && (r.alreadyMergedIds || []).includes('DEV-DUP'), 'same operation_id resubmission is idempotent (no second merge)');
    void deps;
  }

  // 9. Invalid operation id.
  {
    const { deps, rpcCalls } = makeDeps([dev('DEV-CANON'), dev('DEV-DUP')]);
    const r = await mergeDevices({ operationId: 'x', canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: ['DEV-DUP'] }, deps);
    assert(!r.ok && r.code === 'INVALID_OPERATION_ID', 'invalid operation_id rejected');
    assert(rpcCalls() === 0, 'no RPC for invalid operation id');
  }

  // 10. validateMergeSelection is pure and rejects duplicates list empty (service-level DUPLICATES_REQUIRED).
  {
    const { deps } = makeDeps([dev('DEV-CANON')]);
    const r = await mergeDevices({ operationId: OP, canonicalDeviceId: 'DEV-CANON', duplicateDeviceIds: [] }, deps);
    assert(!r.ok && r.code === 'DUPLICATES_REQUIRED', 'empty duplicate list rejected');
    const pure = validateMergeSelection(dev('DEV-CANON'), ['DEV-DUP'], new Map([['DEV-DUP', dev('DEV-DUP', 'FPM_ADELA')]]));
    assert(!pure.ok && pure.code === 'CROSS_ESTATE', 'pure validator enforces same-estate');
  }

  // 11. credential_hash never returned by the safe candidate mapper.
  {
    const record = { ...dev('DEV-A'), credential_hash: 'SUPER-SECRET-HASH', credential_version: 3 } as RegisteredDeviceRecord;
    const safe = toSafeMergeCandidate(record);
    assert(!('credential_hash' in safe), 'safe candidate omits credential_hash');
    assert(safe.credential_present === true, 'safe candidate exposes credential_present boolean only');
    assert(!JSON.stringify(safe).includes('SUPER-SECRET-HASH'), 'safe candidate JSON never contains the hash value');
  }

  // 12. Routes registered + guarded.
  {
    const stack = (devicesRoutes as any).stack || [];
    const find = (method: string, p: string) =>
      stack.find((l: any) => {
        const paths = Array.isArray(l.route?.path) ? l.route.path : [l.route?.path];
        return l.route?.methods?.[method] && paths.includes(p);
      });
    const mergeRoute = find('post', '/merge');
    const candidatesRoute = find('get', '/merge-candidates');
    assert(!!mergeRoute && !!candidatesRoute, 'merge + merge-candidates routes registered');
    if (mergeRoute) {
      const names = (mergeRoute.route.stack || []).map((s: any) => s.handle.name);
      assert(names.includes('requireAuth') && names.includes('requireDeviceAdmin'), 'POST /merge guarded by requireAuth + requireDeviceAdmin', names.join(','));
    }
    if (candidatesRoute) {
      const names = (candidatesRoute.route.stack || []).map((s: any) => s.handle.name);
      assert(names.includes('requireAuth') && names.includes('requireDeviceAdmin'), 'GET /merge-candidates guarded by requireAuth + requireDeviceAdmin', names.join(','));
    }
  }

  // 13. Migration + script safeguards (no DELETE, no credential copy, transactional RPC).
  {
    assert(fs.existsSync(path.join(process.cwd(), MERGE_FN_MIGRATION)), 'merge RPC migration exists');
    const fn = read(MERGE_FN_MIGRATION);
    assert(/CREATE OR REPLACE FUNCTION public\.merge_registered_devices/.test(fn), 'defines merge_registered_devices');
    assert(/SECURITY INVOKER/.test(fn), 'RPC is SECURITY INVOKER (no privilege escalation)');
    assert(/FOR UPDATE/.test(fn), 'RPC locks rows with FOR UPDATE');
    assert(/GRANT EXECUTE[\s\S]*TO service_role/.test(fn) && /REVOKE ALL[\s\S]*FROM authenticated/.test(fn), 'RPC execute restricted to service_role');
    assert(!/\bDELETE\s+FROM\b/i.test(fn), 'RPC migration performs no DELETE');
    assert(!/credential_hash\s*=/.test(fn), 'RPC never assigns/copies credential_hash');
    assert(!/SELECT\s+credential_hash\b/i.test(fn.replace(/--[^\n]*/g, '')), 'RPC never selects credential_hash values');

    const tracking = read(TRACKING_MIGRATION);
    assert(/registered_devices_archive/.test(tracking), 'archive table defined in tracking migration');

    const script = read(MERGE_SQL);
    assert(!/\bDELETE\s+FROM\s+public\.registered_devices\b/i.test(script), 'merge script never deletes registered_devices rows');
    assert(!/credential_hash\s*=/.test(script), 'merge script never copies credential_hash');
  }

  console.log(`\nMODULE 52 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_merge\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceMergeTests()
    .then((res) => process.exit(res.passed === res.total ? 0 : 1))
    .catch((err) => { console.error('P1 device merge suite execution error:', err); process.exit(1); });
}
