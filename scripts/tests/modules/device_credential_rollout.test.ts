/**
 * iPDS v4.1.0 — Test Module 48: P0-16C.4 Existing-Device Credential Rollout
 *
 * Verifies the controlled rollout that issues a CSPRNG credential to EXISTING
 * APPROVED devices (credential_hash = NULL), persisting only its SHA-256 hash:
 *   - CSPRNG generation, base64url, 256-bit entropy
 *   - only the hash is persisted; plaintext returned once
 *   - no credential material in logs / JWT / URL / audit
 *   - APPROVED allowed; PENDING/BLOCKED/REVOKED/unknown fail closed
 *   - unauthorized / wrong-estate actors denied
 *   - old credential invalidated; new credential verifies; version increments
 *   - status / estate_id / device_estate_access untouched; no grant-all
 *   - concurrent rotation never assigns duplicate/incorrect versions
 *   - DB failure fails closed
 */

import fs from 'fs';
import path from 'path';
import {
  issueExistingDeviceCredential,
  actorCanAdministerDeviceEstate,
  generateDeviceCredential,
  hashDeviceCredential,
  verifyDeviceCredential,
  type RegisteredDeviceRecord,
  type DeviceCredentialRolloutDeps
} from '../../../src/server/services/deviceSecurity.service.js';
import { scrubSensitiveData } from '../../../src/server/services/audit.service.js';
import devicesRoutes from '../../../src/server/routes/devices.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

const SERVICE_SRC = 'src/server/services/deviceSecurity.service.ts';
const ROUTES_SRC = 'src/server/routes/devices.routes.ts';
const AUTH_SERVICE_SRC = 'src/server/services/auth.service.ts';

function read(rel: string): string { return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8'); }

interface MockState {
  credential_hash: string | null;
  credential_version: number;
  credential_rotated_at: string | null;
}

function makeDeps(opts: {
  device?: RegisteredDeviceRecord | null;
  initialVersion?: number;
  casAlwaysFails?: boolean;
  readVersionNull?: boolean;
  now?: () => string;
} = {}) {
  const state: MockState = {
    credential_hash: null,
    credential_version: opts.initialVersion ?? 1,
    credential_rotated_at: null
  };
  const deps: DeviceCredentialRolloutDeps = {
    findDevice: async () => (opts.device ? { ...opts.device, credential_version: state.credential_version } : null),
    readVersion: async () => (opts.readVersionNull ? null : (opts.device ? state.credential_version : null)),
    casUpdate: async (_deviceId, expected, hash, rotatedAt) => {
      if (opts.casAlwaysFails) return null;
      if (expected !== state.credential_version) return null;
      state.credential_version += 1;
      state.credential_hash = hash;
      state.credential_rotated_at = rotatedAt;
      return state.credential_version;
    },
    generateCredential: generateDeviceCredential,
    hashCredential: hashDeviceCredential,
    now: opts.now ?? (() => '2026-09-14T00:00:00.000Z')
  };
  return { deps, state };
}

const APPROVED_DEVICE: RegisteredDeviceRecord = {
  device_id: 'DEV-ROLLOUT-1',
  device_name: 'Peranti Ujian',
  estate_id: 'FPM_TUNGGAL',
  status: 'APPROVED'
};

// Canonical cross-estate actor: FC Tunggal (FPM_TUNGGAL) is the only Super Admin.
const ACTOR_CROSS = { name: 'FC Tunggal', role: 'fc', estateId: 'FPM_TUNGGAL' };
// Single-estate device administrator: PF of FPM_TUNGGAL (NOT a Super Admin).
const ACTOR_SAME = { name: 'PF Tunggal', role: 'pf', estateId: 'FPM_TUNGGAL' };
const ACTOR_WRONG_ESTATE = { name: 'FC Adela', role: 'fc', estateId: 'FPM_ADELA' };
const ACTOR_NON_ADMIN = { name: 'Staf', role: 'staff', estateId: 'FPM_TUNGGAL' };

type Method = 'get' | 'post' | 'delete';
interface MockResult { status: number; body: any; allowed: boolean; }

function findRoute(method: Method, exactPath: string) {
  const stack = (devicesRoutes as any).stack || [];
  return stack.find((l: any) => {
    const p = l.route?.path;
    const paths = Array.isArray(p) ? p : [p];
    return l.route?.methods?.[method] && paths.includes(exactPath);
  });
}
function routeHandlers(route: any): any[] {
  return (route?.route?.stack || []).map((s: any) => s.handle);
}
function invokeHandlers(handlers: any[], req: any): Promise<MockResult> {
  return new Promise((resolve) => {
    let status = 200; let body: any = null; let settled = false;
    const finish = (allowed = false) => { if (!settled) { settled = true; resolve({ status, body, allowed }); } };
    const res: any = {
      status(code: number) { status = code; return res; },
      json(data: any) { body = data; finish(false); return res; },
      send(data: any) { body = data; finish(false); return res; },
      setHeader() { return res; },
      getHeader() { return undefined; },
      end() { finish(false); return res; }
    };
    let i = 0;
    const next = (err?: any) => {
      if (err) { status = 500; body = { error: String(err?.message || err) }; finish(false); return; }
      if (i >= handlers.length) { finish(true); return; }
      const handler = handlers[i++];
      try { handler(req, res, next); }
      catch (e: any) { status = 500; body = { error: e?.message || e }; finish(false); }
    };
    next();
  });
}
function buildReq(method: string, opts: { headers?: Record<string, string>; query?: any; body?: any } = {}): any {
  return {
    method, headers: opts.headers || {}, cookies: {}, query: opts.query || {}, body: opts.body || {},
    ip: '127.0.0.1', originalUrl: '/api/devices', url: '/api/devices', path: '/api/devices', baseUrl: '',
    get(name: string) { return this.headers[String(name).toLowerCase()]; }
  };
}

export async function runDeviceCredentialRolloutTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 48: P0-16C.4 EXISTING-DEVICE CREDENTIAL ROLLOUT');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 48.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 48.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 48.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  const service = read(SERVICE_SRC);
  const routes = read(ROUTES_SRC);
  const c4Marker = service.indexOf('P0-16C.4: existing-device credential rollout');
  const ROLLOUT_BLOCK = service.slice(
    c4Marker >= 0 ? service.lastIndexOf('/**', c4Marker) : 0,
    service.indexOf('P0-16C.2: explicit device')
  );
  const ROUTE_BLOCK = routes.slice(
    routes.indexOf("'/rotate-credential'"),
    routes.indexOf('export default router;')
  );
  // Comment-stripped views so documentation that NAMES forbidden tables/grants
  // does not trip the "does not touch X" guards.
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const ROLLOUT_CODE = stripComments(ROLLOUT_BLOCK);
  const ROUTE_CODE = stripComments(ROUTE_BLOCK);

  // A/B/C — CSPRNG generation, entropy, base64url
  {
    assert(/crypto\.randomBytes\(DEVICE_CREDENTIAL_BYTES\)/.test(service) && /DEVICE_CREDENTIAL_BYTES = 32/.test(service), 'credential generated with crypto.randomBytes(32) CSPRNG');
    assert(!/Math\.random|Date\.now\(\)\s*\.toString/.test(ROLLOUT_BLOCK), 'rollout never derives credentials from Math.random/Date.now');
    const c = generateDeviceCredential();
    assert(c.length >= 43, 'credential carries >= 256 bits base64url entropy', `len=${c.length}`);
    assert(/^[A-Za-z0-9_-]+$/.test(c), 'credential uses base64url charset');
    assert(c !== generateDeviceCredential(), 'two generated credentials differ');
    assert(!c.includes(APPROVED_DEVICE.device_id), 'credential is not derived from the device_id label');
  }

  // D/E — only the SHA-256 hash is persisted; plaintext never stored
  {
    const { deps, state } = makeDeps({ device: APPROVED_DEVICE });
    const result = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_CROSS, deps);
    assert(result.ok && !!result.credential, 'APPROVED device can be rotated');
    assert(/^[0-9a-f]{64}$/.test(state.credential_hash || ''), 'persisted value is a 64-char SHA-256 hex hash');
    assert(state.credential_hash !== result.credential, 'persisted hash != plaintext credential');
    assert(!JSON.stringify(state).includes(result.credential!), 'plaintext credential never appears in the persisted record');
    assert(hashDeviceCredential(result.credential!) === state.credential_hash, 'persisted hash matches SHA-256 of the issued credential');
  }

  // F/G/H — no credential leakage (logs / JWT / URL)
  {
    assert(!/console\.[a-z]+\([^)]*credential\b/i.test(ROLLOUT_BLOCK + ROUTE_BLOCK), 'plaintext credential is never logged');
    const authService = read(AUTH_SERVICE_SRC);
    const tokenBlock = authService.slice(authService.indexOf('static generateToken'), authService.indexOf('static generateToken') + 600);
    assert(!/deviceCredential|credential_hash|device_credential/i.test(tokenBlock), 'credential is never placed in the JWT');
    assert(!/rotate-credential\?[^'"`]*credential/i.test(routes), 'credential is never placed in a URL/query string');
    assert(!/[?&]credential=/.test(routes), 'no credential query parameter exists');
  }

  // I/J/K/L/M — device status matrix
  {
    const ok = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_CROSS, makeDeps({ device: APPROVED_DEVICE }).deps);
    assert(ok.ok && ok.code === 'OK', 'APPROVED -> OK');

    for (const status of ['PENDING', 'BLOCKED', 'REVOKED'] as const) {
      const r = await issueExistingDeviceCredential('DEV-ROLLOUT-X', ACTOR_CROSS, makeDeps({ device: { ...APPROVED_DEVICE, status } }).deps);
      assert(!r.ok && r.code === 'DEVICE_NOT_APPROVED' && r.credential === undefined, `${status} -> rejected (fail-closed)`, JSON.stringify(r));
    }

    const unknown = await issueExistingDeviceCredential('DEV-ROLLOUT-UNKNOWN', ACTOR_CROSS, makeDeps({ device: null }).deps);
    assert(!unknown.ok && unknown.code === 'UNKNOWN_DEVICE', 'unknown device -> rejected');
    assert(!(await issueExistingDeviceCredential('', ACTOR_CROSS, makeDeps({ device: APPROVED_DEVICE }).deps)).ok, 'empty deviceId -> rejected');
  }

  // N/O — actor authorization boundary
  {
    const nonAdmin = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_NON_ADMIN, makeDeps({ device: APPROVED_DEVICE }).deps);
    assert(!nonAdmin.ok && nonAdmin.code === 'UNAUTHORIZED_ACTOR', 'non-admin actor -> rejected');

    const wrongEstate = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_WRONG_ESTATE, makeDeps({ device: APPROVED_DEVICE }).deps);
    assert(!wrongEstate.ok && wrongEstate.code === 'UNAUTHORIZED_ACTOR', 'wrong-estate actor -> rejected');

    const sameEstate = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_SAME, makeDeps({ device: APPROVED_DEVICE }).deps);
    assert(sameEstate.ok, 'same-estate admin -> allowed');

    assert(actorCanAdministerDeviceEstate(ACTOR_CROSS, 'FPM_ADELA') === true, 'FC Tunggal (Super Admin) passes any estate');
    assert(actorCanAdministerDeviceEstate(ACTOR_SAME, 'FPM_TUNGGAL') === true, 'same-estate role passes its own estate');
    assert(actorCanAdministerDeviceEstate(ACTOR_SAME, 'FPM_ADELA') === false, 'same-estate role fails another estate');
    assert(actorCanAdministerDeviceEstate(ACTOR_WRONG_ESTATE, 'FPM_TUNGGAL') === false, 'branch FC fails another estate');
    assert(actorCanAdministerDeviceEstate(ACTOR_NON_ADMIN, 'FPM_TUNGGAL') === false, 'non-admin role fails');
    assert(actorCanAdministerDeviceEstate(null, 'FPM_TUNGGAL') === false, 'null actor fails closed');

    // P0-ADMIN: RC/OC/PF must NOT carry cross-estate device authority.
    assert(actorCanAdministerDeviceEstate({ role: 'rc', estateId: 'WILAYAH_JB' }, 'FPM_ADELA') === false, 'RC is not a cross-estate device admin');
    assert(actorCanAdministerDeviceEstate({ role: 'oc', estateId: 'WILAYAH_JB' }, 'FPM_ADELA') === false, 'OC is not a cross-estate device admin');
    assert(actorCanAdministerDeviceEstate({ role: 'pf', estateId: 'FPM_TUNGGAL' }, 'FPM_ADELA') === false, 'PF is not a cross-estate device admin');
    assert(actorCanAdministerDeviceEstate({ role: 'rc' }, '*') === false, 'RC without an estate fails closed (no wildcard authority)');
  }

  // P/Q/R/S — rotation semantics
  {
    const { deps, state } = makeDeps({ device: APPROVED_DEVICE, initialVersion: 1 });
    const first = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_CROSS, deps);
    const second = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_CROSS, deps);
    assert(first.ok && second.ok, 'two sequential rotations both succeed');
    assert(first.credential !== second.credential, 'two rotations generate two DIFFERENT credentials');
    assert(verifyDeviceCredential(first.credential!, state.credential_hash!) === false, 'old credential no longer verifies after rotation');
    assert(verifyDeviceCredential(second.credential!, state.credential_hash!) === true, 'new credential verifies after rotation');
    assert(first.credentialVersion === 2 && second.credentialVersion === 3, 'credential_version increments by one each rotation', `${first.credentialVersion}/${second.credentialVersion}`);
    assert(state.credential_version === 3, 'persisted credential_version reflects the last rotation');
    assert(state.credential_rotated_at === '2026-09-14T00:00:00.000Z' && second.rotatedAt === '2026-09-14T00:00:00.000Z', 'credential_rotated_at is stamped');
  }

  // T/U/V/W — no collateral mutation / no grant-all
  {
    const { deps, state } = makeDeps({ device: APPROVED_DEVICE });
    const result = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_CROSS, deps);
    assert(result.ok && APPROVED_DEVICE.status === 'APPROVED', 'device status remains APPROVED');
    assert(APPROVED_DEVICE.estate_id === 'FPM_TUNGGAL' && result.estateId === 'FPM_TUNGGAL', 'estate_id remains unchanged');
    assert(state.credential_hash !== null && !('status' in state) && !('estate_id' in state), 'rollout persists credential fields only');

    assert(!/\.update\(\{[^}]*\bstatus\b/.test(ROLLOUT_CODE), 'rollout code never updates device status');
    assert(!/\.update\(\{[^}]*estate_id/.test(ROLLOUT_CODE), 'rollout code never updates estate_id');
    assert(!/device_estate_access/.test(ROLLOUT_CODE + ROUTE_CODE), 'rollout never touches device_estate_access');
    assert(!/grantDeviceEstateAccess/.test(ROLLOUT_CODE + ROUTE_CODE), 'rollout never creates estate grants (no grant-all)');
    assert(!/for\s*\([^)]*estate/i.test(ROLLOUT_CODE), 'rollout does not iterate a global estate list');
  }

  // X — concurrency: no duplicate/incorrect versions
  {
    const { deps, state } = makeDeps({ device: APPROVED_DEVICE, initialVersion: 1 });
    const [r1, r2] = await Promise.all([
      issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_CROSS, deps),
      issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_CROSS, deps)
    ]);
    assert(r1.ok && r2.ok, 'concurrent rotations both resolve safely');
    const versions = [r1.credentialVersion, r2.credentialVersion].sort((a, b) => Number(a) - Number(b));
    assert(versions[0] === 2 && versions[1] === 3, 'concurrent rotations assign distinct sequential versions (2,3)', JSON.stringify(versions));
    assert(r1.credential !== r2.credential, 'concurrent rotations produce different credentials');
    const v1 = verifyDeviceCredential(r1.credential!, state.credential_hash!);
    const v2 = verifyDeviceCredential(r2.credential!, state.credential_hash!);
    assert(v1 !== v2 && (v1 || v2), 'exactly one concurrent credential matches the persisted hash');
  }

  // Y — database failure fails closed
  {
    const dbDown = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_CROSS, makeDeps({ device: APPROVED_DEVICE, readVersionNull: true }).deps);
    assert(!dbDown.ok && dbDown.code === 'DB_UNAVAILABLE' && dbDown.credential === undefined, 'DB unavailable -> fails closed');

    const conflict = await issueExistingDeviceCredential(APPROVED_DEVICE.device_id, ACTOR_CROSS, makeDeps({ device: APPROVED_DEVICE, casAlwaysFails: true }).deps);
    assert(!conflict.ok && conflict.code === 'CONFLICT' && conflict.credential === undefined, 'unresolvable CAS conflict -> fails closed');
  }

  // Z — no credential material in audit data
  {
    assert(/details:\s*\{\s*credentialVersion:/.test(ROUTE_BLOCK), 'audit details record only credentialVersion');
    assert(!/\bcredential\s*:/.test(ROUTE_BLOCK), 'audit payload has no plaintext credential key');
    const scrubbed = scrubSensitiveData({ credential: 'PLAINTEXT-SECRET', credentialVersion: 2, deviceId: 'DEV-1' });
    assert(scrubbed.credential === '[REDACTED]', 'audit scrubbing redacts any credential field');
    assert(scrubbed.credentialVersion === 2 && scrubbed.deviceId === 'DEV-1', 'audit scrubbing preserves non-secret metadata');
  }

  // Route registration + middleware gating
  {
    const route = findRoute('post', '/rotate-credential');
    assert(!!route, 'POST /api/devices/rotate-credential route registered');

    if (route) {
      const unauth = await invokeHandlers(routeHandlers(route).slice(0, 1), buildReq('POST'));
      assert(unauth.status === 401, 'unauthenticated rotation returns 401', `got ${unauth.status}`);

      const staff = await invokeHandlers(routeHandlers(route).slice(0, 2), buildReq('POST', { headers: authHeaders('123456'), body: { deviceId: APPROVED_DEVICE.device_id } }));
      assert(staff.status === 403, 'non-admin role denied rotation (403)', `got ${staff.status}`);

      const fc = await invokeHandlers(routeHandlers(route).slice(0, 2), buildReq('POST', { headers: authHeaders('2401199'), body: { deviceId: APPROVED_DEVICE.device_id } }));
      assert(fc.allowed, 'device admin passes auth + admin middleware', `status=${fc.status}`);

      assert(/requireAuth,\s*requireDeviceAdmin/.test(routes.slice(routes.indexOf("'/rotate-credential'"), routes.indexOf("'/rotate-credential'") + 120)), 'rotate route requires auth + device admin');
    }
  }

  console.log(`\nMODULE 48 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_credential_rollout\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceCredentialRolloutTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16C.4 device credential rollout suite execution error:', err); process.exit(1); });
}
