/**
 * iPDS v4.1.0 — P1 Operational Bulk Device-Credential Rotation
 *
 * Focused tests for the NEW operational behavior only:
 *   - same operation_id never rotates twice (idempotent)
 *   - a different operation_id rotates again
 *   - lost-response retry returns the recorded outcome (no second rotation)
 *   - crash between rotation and idempotency-record is detected via the
 *     durable credential_version anchor (no double rotation)
 *   - partial batch failure is isolated per device
 *   - resume after failure retries only non-rotated devices
 *   - explicit device list is respected; nothing outside it is touched
 *   - systemic failure (DB down / unexpected) aborts instead of continuing
 *   - plaintext credential is never persisted in the idempotency record/audit
 *   - route exists and reuses requireAuth + requireDeviceAdmin
 */

import {
  runBulkDeviceCredentialRotation,
  type BulkRotationDeps,
  type BulkRotationOperationRecord,
  type BulkRotationStore
} from '../../../src/server/services/deviceBulkRotation.service.js';
import type { RegisteredDeviceRecord, IssuedExistingDeviceCredential } from '../../../src/server/services/deviceSecurity.service.js';
import devicesRoutes from '../../../src/server/routes/devices.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

class FakeStore implements BulkRotationStore {
  private map = new Map<string, BulkRotationOperationRecord>();
  public saves = 0;
  public failSavePredicate: ((record: BulkRotationOperationRecord) => boolean) | null = null;

  async get(operationId: string): Promise<BulkRotationOperationRecord | null> {
    const value = this.map.get(operationId);
    return value ? (JSON.parse(JSON.stringify(value)) as BulkRotationOperationRecord) : null;
  }

  async save(record: BulkRotationOperationRecord): Promise<void> {
    this.saves++;
    if (this.failSavePredicate && this.failSavePredicate(record)) {
      this.failSavePredicate = null;
      throw new Error('simulated store save failure');
    }
    this.map.set(record.operationId, JSON.parse(JSON.stringify(record)));
  }

  snapshot(operationId: string): BulkRotationOperationRecord | undefined {
    const value = this.map.get(operationId);
    return value ? (JSON.parse(JSON.stringify(value)) as BulkRotationOperationRecord) : undefined;
  }
}

const ACTOR = { name: 'FC Tunggal', role: 'fc', estateId: 'FPM_TUNGGAL' };

function makeHarness(opts: {
  devices: RegisteredDeviceRecord[];
  grants?: string[];
  rotateOverride?: (deviceId: string) => IssuedExistingDeviceCredential | null;
  store?: FakeStore;
} = { devices: [] }) {
  const store = opts.store || new FakeStore();
  const devices = new Map(opts.devices.map((d) => [d.device_id, { ...d }]));
  const grants = new Set(opts.grants || []);
  const rotateCalls: string[] = [];
  const audits: Array<{ operationId: string; deviceId: string }> = [];
  const versionCounter = new Map<string, number>();

  const deps: BulkRotationDeps = {
    rotate: async (deviceId): Promise<IssuedExistingDeviceCredential> => {
      rotateCalls.push(deviceId);
      if (opts.rotateOverride) {
        const overridden = opts.rotateOverride(deviceId);
        if (overridden) return overridden;
      }
      const next = (versionCounter.get(deviceId) || 0) + 1;
      versionCounter.set(deviceId, next);
      const row = devices.get(deviceId);
      if (row) {
        row.credential_version = next;
        row.credential_hash = `hash-${deviceId}-${next}`;
        row.credential_rotated_at = '2026-09-17T00:00:00.000Z';
      }
      return {
        ok: true,
        code: 'OK',
        deviceId,
        estateId: row?.estate_id,
        credential: `plaintext-${deviceId}-v${next}`,
        credentialVersion: next,
        rotatedAt: '2026-09-17T00:00:00.000Z'
      };
    },
    findDevice: async (id) => devices.get(id) || null,
    isEstateGranted: async (id, estate) => grants.has(`${id}::${estate}`),
    store,
    now: () => '2026-09-17T00:00:00.000Z',
    enforcementActive: () => false,
    auditRotated: (info) => { audits.push({ operationId: info.operationId, deviceId: info.deviceId }); }
  };

  return { store, devices, grants, rotateCalls, audits, deps };
}

function device(id: string, estate = 'FPM_TUNGGAL'): RegisteredDeviceRecord {
  return { device_id: id, device_name: id, estate_id: estate, status: 'APPROVED' };
}

export async function runDeviceBulkRotationTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 50: P1 BULK DEVICE-CREDENTIAL ROTATION (IDEMPOTENT)');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 50.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 50.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 50.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // 1. Same operation_id does not rotate twice.
  {
    const h = makeHarness({ devices: [device('DEV-A')], grants: ['DEV-A::FPM_TUNGGAL'] });
    const first = await runBulkDeviceCredentialRotation({ operationId: 'op-aaaa1111', deviceIds: ['DEV-A'], actor: ACTOR }, h.deps);
    const second = await runBulkDeviceCredentialRotation({ operationId: 'op-aaaa1111', deviceIds: ['DEV-A'], actor: ACTOR }, h.deps);
    assert(first.ok && first.results[0]?.status === 'ROTATED' && !!first.results[0]?.credential, 'first request rotates and returns plaintext once');
    assert(h.rotateCalls.length === 1, 'same operation_id does NOT rotate again', `rotateCalls=${h.rotateCalls.length}`);
    assert(second.results[0]?.status === 'ALREADY_ROTATED' && second.results[0]?.credential === undefined, 'retry returns ALREADY_ROTATED without plaintext');
    assert(second.results[0]?.credentialRecoverable === false, 'retry clearly marks plaintext as non-recoverable');
  }

  // 2. Different operation_id rotates again.
  {
    const h = makeHarness({ devices: [device('DEV-A')], grants: ['DEV-A::FPM_TUNGGAL'] });
    await runBulkDeviceCredentialRotation({ operationId: 'op-aaaa1111', deviceIds: ['DEV-A'], actor: ACTOR }, h.deps);
    const second = await runBulkDeviceCredentialRotation({ operationId: 'op-bbbb2222', deviceIds: ['DEV-A'], actor: ACTOR }, h.deps);
    assert(second.results[0]?.status === 'ROTATED', 'a new operation_id legitimately rotates again');
    assert(h.rotateCalls.length === 2, 'second operation performs a second rotation', `rotateCalls=${h.rotateCalls.length}`);
  }

  // 3. Lost-response retry is an idempotent no-op (covered) + different scope rejected.
  {
    const h = makeHarness({ devices: [device('DEV-A'), device('DEV-B')], grants: ['DEV-A::FPM_TUNGGAL', 'DEV-B::FPM_TUNGGAL'] });
    const first = await runBulkDeviceCredentialRotation({ operationId: 'op-scope0001', deviceIds: ['DEV-A'], actor: ACTOR }, h.deps);
    assert(first.ok, 'initial operation succeeds');
    const mismatch = await runBulkDeviceCredentialRotation({ operationId: 'op-scope0001', deviceIds: ['DEV-A', 'DEV-B'], actor: ACTOR }, h.deps);
    assert(mismatch.ok === false && mismatch.code === 'OPERATION_SCOPE_MISMATCH', 'reusing an operation_id with a different device list is rejected');
  }

  // 4. Crash between rotation and idempotency-record -> version anchor prevents double rotation.
  {
    const store = new FakeStore();
    const h = makeHarness({ devices: [device('DEV-C')], grants: ['DEV-C::FPM_TUNGGAL'], store });
    // Fail the save that would record the ROTATED status, simulating a crash after rotation.
    store.failSavePredicate = (record) => record.devices['DEV-C']?.status === 'ROTATED';
    const first = await runBulkDeviceCredentialRotation({ operationId: 'op-crash0001', deviceIds: ['DEV-C'], actor: ACTOR }, h.deps);
    assert(first.ok && first.results[0]?.status === 'ROTATED', 'rotation result is still delivered even when the post-rotation record save fails');
    assert(first.aborted && first.idempotencyRecorded === false, 'system clearly reports the idempotency record could not be persisted');

    const rotateCallsBefore = h.rotateCalls.length;
    const retry = await runBulkDeviceCredentialRotation({ operationId: 'op-crash0001', deviceIds: ['DEV-C'], actor: ACTOR }, h.deps);
    assert(h.rotateCalls.length === rotateCallsBefore, 'retry does NOT rotate again (durable version anchor detected the prior rotation)');
    assert(retry.results[0]?.status === 'ALREADY_ROTATED' && retry.results[0]?.code === 'ROTATED_UNVERIFIED', 'retry reports ALREADY_ROTATED (unverified plaintext)');
  }

  // 5. Partial batch failure is isolated per device.
  {
    const h = makeHarness({
      devices: [device('DEV-A'), { ...device('DEV-B'), status: 'PENDING' }],
      grants: ['DEV-A::FPM_TUNGGAL', 'DEV-B::FPM_TUNGGAL']
    });
    const result = await runBulkDeviceCredentialRotation({ operationId: 'op-partial01', deviceIds: ['DEV-A', 'DEV-B'], actor: ACTOR }, h.deps);
    const a = result.results.find((r) => r.deviceId === 'DEV-A');
    const b = result.results.find((r) => r.deviceId === 'DEV-B');
    assert(a?.status === 'ROTATED', 'approved device rotates in a partial batch');
    assert(b?.status === 'FAILED' && b?.code === 'DEVICE_NOT_APPROVED', 'non-approved device fails with a clear code');
    assert(result.aborted === false, 'per-device failure does not abort the whole batch');
  }

  // 6. Resume after failure retries only the non-rotated device.
  {
    const h = makeHarness({ devices: [device('DEV-A'), device('DEV-B')], grants: ['DEV-A::FPM_TUNGGAL'] });
    const first = await runBulkDeviceCredentialRotation({ operationId: 'op-resume001', deviceIds: ['DEV-A', 'DEV-B'], actor: ACTOR }, h.deps);
    assert(first.results.find((r) => r.deviceId === 'DEV-B')?.code === 'ESTATE_GRANT_MISSING', 'missing estate grant fails clearly (no auto-repair)');
    assert(h.rotateCalls.filter((d) => d === 'DEV-A').length === 1, 'DEV-A rotated once');

    h.grants.add('DEV-B::FPM_TUNGGAL');
    const resumed = await runBulkDeviceCredentialRotation({ operationId: 'op-resume001', deviceIds: ['DEV-A', 'DEV-B'], actor: ACTOR }, h.deps);
    assert(resumed.resumed === true, 'retry is reported as a resume');
    assert(resumed.results.find((r) => r.deviceId === 'DEV-A')?.status === 'ALREADY_ROTATED', 'already-rotated device is skipped on resume');
    assert(resumed.results.find((r) => r.deviceId === 'DEV-B')?.status === 'ROTATED', 'previously failed device rotates after the blocker is fixed');
    assert(h.rotateCalls.filter((d) => d === 'DEV-A').length === 1, 'skipped device is not re-rotated');
  }

  // 7. Explicit device list enforced; nothing outside the list is touched.
  {
    const h = makeHarness({
      devices: [device('DEV-A'), device('DEV-B'), device('DEV-Z')],
      grants: ['DEV-A::FPM_TUNGGAL', 'DEV-B::FPM_TUNGGAL', 'DEV-Z::FPM_TUNGGAL']
    });
    await runBulkDeviceCredentialRotation({ operationId: 'op-list0001', deviceIds: ['DEV-A', 'DEV-B'], actor: ACTOR }, h.deps);
    assert(h.rotateCalls.join(',') === 'DEV-A,DEV-B', 'only requested devices are rotated (in list order)', h.rotateCalls.join(','));
    const record = h.store.snapshot('op-list0001');
    assert(!!record && record.requestedDeviceIds.join(',') === 'DEV-A,DEV-B', 'operation record contains only the requested list');
    assert(!h.rotateCalls.includes('DEV-Z'), 'device outside the list is never touched');
  }

  // 8. Systemic failure aborts instead of silently continuing.
  {
    const h = makeHarness({
      devices: [device('DEV-A'), device('DEV-B'), device('DEV-C')],
      grants: ['DEV-A::FPM_TUNGGAL', 'DEV-B::FPM_TUNGGAL', 'DEV-C::FPM_TUNGGAL'],
      rotateOverride: (deviceId) => (deviceId === 'DEV-B' ? { ok: false, code: 'DB_UNAVAILABLE' } : null)
    });
    const result = await runBulkDeviceCredentialRotation({ operationId: 'op-abort001', deviceIds: ['DEV-A', 'DEV-B', 'DEV-C'], actor: ACTOR }, h.deps);
    assert(result.aborted === true && result.abortReason === 'DB_UNAVAILABLE', 'systemic DB failure aborts the operation');
    assert(h.rotateCalls.join(',') === 'DEV-A,DEV-B', 'processing stops immediately; DEV-C is not attempted', h.rotateCalls.join(','));
    assert(
      result.summary?.pending === 2 && result.results.find((r) => r.deviceId === 'DEV-C') === undefined,
      'aborted device (DEV-B) and unprocessed device (DEV-C) remain PENDING for a later resume',
      `pending=${result.summary?.pending}`
    );
  }

  // 9. Store unavailable fails closed (no rotation).
  {
    const store = new FakeStore();
    let getCalls = 0;
    const broken: BulkRotationStore = {
      get: async () => { getCalls++; throw new Error('down'); },
      save: async () => { throw new Error('down'); }
    };
    const h = makeHarness({ devices: [device('DEV-A')], grants: ['DEV-A::FPM_TUNGGAL'], store });
    const result = await runBulkDeviceCredentialRotation({ operationId: 'op-store001', deviceIds: ['DEV-A'], actor: ACTOR }, { ...h.deps, store: broken });
    assert(result.ok === false && result.code === 'STORE_UNAVAILABLE', 'idempotency store unavailable -> fail closed');
    assert(h.rotateCalls.length === 0 && getCalls === 1, 'no rotation attempted when the store is unavailable');
  }

  // 10. Plaintext is never persisted in the idempotency record or audit.
  {
    const h = makeHarness({ devices: [device('DEV-A')], grants: ['DEV-A::FPM_TUNGGAL'] });
    const result = await runBulkDeviceCredentialRotation({ operationId: 'op-secret001', deviceIds: ['DEV-A'], actor: ACTOR }, h.deps);
    const plaintext = result.results[0]?.credential as string;
    const recordJson = JSON.stringify(h.store.snapshot('op-secret001') || {});
    assert(!!plaintext && !recordJson.includes(plaintext), 'plaintext credential is never stored in the idempotency record');
    assert(!/credential"\s*:/.test(recordJson), 'no credential field is written to the idempotency record');
    assert(!JSON.stringify(h.audits).includes(plaintext), 'plaintext credential never appears in audit metadata');
  }

  // 11. Input validation.
  {
    const h = makeHarness({ devices: [device('DEV-A')], grants: ['DEV-A::FPM_TUNGGAL'] });
    const badOp = await runBulkDeviceCredentialRotation({ operationId: 'x', deviceIds: ['DEV-A'], actor: ACTOR }, h.deps);
    assert(badOp.ok === false && badOp.code === 'INVALID_OPERATION_ID', 'short/invalid operation_id is rejected');
    const badList = await runBulkDeviceCredentialRotation({ operationId: 'op-valid0001', deviceIds: [], actor: ACTOR }, h.deps);
    assert(badList.ok === false && badList.code === 'INVALID_DEVICE_LIST', 'empty device list is rejected');
    assert(h.rotateCalls.length === 0, 'no rotation occurs for invalid input');
  }

  // 12. Route registered and protected by existing authorization middleware.
  {
    const stack = (devicesRoutes as any).stack || [];
    const route = stack.find((l: any) => {
      const p = l.route?.path;
      const paths = Array.isArray(p) ? p : [p];
      return l.route?.methods?.post && paths.includes('/rotate-credential-bulk');
    });
    assert(!!route, 'POST /api/devices/rotate-credential-bulk route is registered');

    if (route) {
      const names = (route.route.stack || []).map((s: any) => s.handle.name);
      assert(
        names.includes('requireAuth') && names.includes('requireDeviceAdmin'),
        'bulk route reuses requireAuth + requireDeviceAdmin (no new role, no weakened authz)',
        names.join(', ')
      );

      const invoke = (handlers: any[], req: any) => new Promise<number>((resolve) => {
        let status = 200; let i = 0; let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(status); } };
        const res: any = {
          status(c: number) { status = c; return res; },
          json() { done(); return res; },
          send() { done(); return res; },
          setHeader() { return res; },
          end() { done(); return res; }
        };
        const next = (err?: any) => {
          if (err) { status = 500; return done(); }
          if (i >= handlers.length) return done();
          handlers[i++](req, res, next);
        };
        next();
      });
      const handlers = (route.route.stack || []).map((s: any) => s.handle);
      const baseReq: any = { method: 'POST', headers: {}, cookies: {}, query: {}, body: { operationId: 'op-route0001', deviceIds: ['DEV-A'] }, ip: '127.0.0.1', get() { return undefined; } };

      const unauth = await invoke(handlers.slice(0, 1), { ...baseReq });
      assert(unauth === 401, 'bulk route returns 401 without credentials', `got ${unauth}`);

      const staff = await invoke(handlers.slice(0, 2), { ...baseReq, headers: authHeaders('123456') });
      assert(staff === 403, 'bulk route denies non-admin roles (403)', `got ${staff}`);
    }
  }

  console.log(`\nMODULE 50 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_bulk_rotation\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceBulkRotationTests()
    .then((res) => process.exit(res.passed === res.total ? 0 : 1))
    .catch((err) => { console.error('P1 bulk device rotation suite execution error:', err); process.exit(1); });
}
