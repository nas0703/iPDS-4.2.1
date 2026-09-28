/**
 * iPDS v4.1.0 — Test Module 39: P0-16A One-Time Device Approval Capability
 *
 * Verifies the capability model for the FC WhatsApp approval link:
 *   - 256-bit random capability; only its SHA-256 hash is stored;
 *   - single-use, short-lived (10–15 min), bound to one device+estate;
 *   - GET /approve-link renders confirmation only; POST consumes + approves;
 *   - no PIN/JWT/deviceId/estateId/PII in the URL; no capability logging;
 *   - quick-approve/approve-direct remain requireAuth + requireDeviceAdmin;
 *   - enrollment-status detects APPROVED; login proceeds after approval.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  deviceSecurityService,
  createApprovalCapability,
  consumeApprovalCapability
} from '../../../src/server/services/deviceSecurity.service.js';
import devicesRoutes from '../../../src/server/routes/devices.routes.js';
import authRoutes from '../../../src/server/routes/auth.routes.js';

interface MockResult { status: number; body: any; allowed: boolean; }

function findRoute(router: any, method: 'get' | 'post', exactPath: string) {
  const stack = (router as any).stack || [];
  return stack.find((l: any) => {
    const p = l.route?.path;
    const paths = Array.isArray(p) ? p : [p];
    return l.route?.methods?.[method] && paths.includes(exactPath);
  });
}
function routeHandlers(route: any): any[] {
  return (route?.route?.stack || []).map((s: any) => s.handle);
}
function invokeHandler(handler: any, req: any): Promise<MockResult> {
  return new Promise((resolve) => {
    let status = 200; let body: any = null; let settled = false;
    const finish = (allowed = false) => { if (!settled) { settled = true; resolve({ status, body, allowed }); } };
    const res: any = {
      status(code: number) { status = code; return res; },
      json(data: any) { body = data; finish(false); return res; },
      send(data: any) { body = data; finish(false); return res; },
      setHeader() { return res; },
      cookie() { return res; },
      getHeader() { return undefined; },
      end() { finish(false); return res; }
    };
    try { handler(req, res, () => finish(true)); }
    catch (e: any) { status = 500; body = { error: e?.message || String(e) }; finish(false); }
    setTimeout(() => finish(false), 5000);
  });
}
function buildReq(method: string, opts: { headers?: Record<string, string>; query?: any; body?: any } = {}): any {
  return {
    method, headers: opts.headers || {}, cookies: {}, query: opts.query || {}, body: opts.body || {},
    ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' },
    originalUrl: '/api/devices', url: '/api/devices', path: '/api/devices', baseUrl: '',
    get(name: string) { return this.headers[String(name).toLowerCase()]; }
  };
}
function read(rel: string): string { return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8'); }

const MIGRATION = 'supabase/migrations/20260919_p0_16a_device_approval_capabilities.sql';
const SERVICE_SRC = 'src/server/services/deviceSecurity.service.ts';
const DEVICES_SRC = 'src/server/routes/devices.routes.ts';
const AUTH_SRC = 'src/server/routes/auth.routes.ts';
const MODAL_SRC = 'src/features/auth/components/DeviceApprovalModal.tsx';

export async function runDeviceApprovalCapabilityTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 39: P0-16A ONE-TIME DEVICE APPROVAL CAPABILITY');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 39.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 39.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 39.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  // 1. Migration / schema
  {
    const exists = fs.existsSync(path.join(process.cwd(), MIGRATION));
    assert(exists, 'P0-16A capabilities migration exists');
    if (exists) {
      const sql = read(MIGRATION);
      for (const col of ['device_id', 'estate_id', 'token_hash', 'expires_at', 'used_at', 'created_by', 'created_at']) {
        assert(new RegExp(`\\b${col}\\b`).test(sql), `migration defines column ${col}`);
      }
      assert(/ENABLE ROW LEVEL SECURITY/i.test(sql) && /FORCE ROW LEVEL SECURITY/i.test(sql), 'RLS enabled and forced');
      assert(/REVOKE ALL[^;]*FROM PUBLIC/i.test(sql) && /REVOKE ALL[^;]*FROM anon/i.test(sql) && /REVOKE ALL[^;]*FROM authenticated/i.test(sql), 'PUBLIC/anon/authenticated revoked');
      assert(/GRANT[^;]*TO service_role/i.test(sql), 'service_role granted');
      assert(/token_hash TEXT NOT NULL UNIQUE/i.test(sql), 'token_hash is unique (hash only, no raw capability)');
    }
  }

  // 2. Service source guards
  {
    const src = read(SERVICE_SRC);
    assert(/createHash\('sha256'\)/.test(src), 'capability is hashed with SHA-256');
    assert(/randomBytes\(32\)/.test(src), 'capability is 256-bit random');
    assert(!/console\.[a-z]+\([^)]*\bcapability\b\s*[,)]/.test(src), 'service does not log the capability');
    assert(/timingSafeEqual/.test(src), 'constant-time comparison used');
    assert(/APPROVAL_CAPABILITY_TTL_MS = 12 \* 60 \* 1000/.test(src), 'capability TTL is 12 minutes (10–15 range)');
  }

  // 3. Capability unit behavior (in-memory; no DB creds)
  const envKeys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET'];
  const saved: Record<string, string | undefined> = {};
  for (const k of envKeys) saved[k] = process.env[k];

  try {
    process.env.NODE_ENV = 'production';
    for (const k of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k];

    const created = await createApprovalCapability({ deviceId: 'DEV-CAP-A', estateId: 'FPM_TUNGGAL', createdBy: 'test' });
    assert(typeof created.capability === 'string' && created.capability.length >= 40, 'capability is a long random string');
    assert(!created.capability.includes('DEV-CAP-A'), 'capability does not embed the device id');
    assert(new Date(created.expiresAt).getTime() - Date.now() > 9 * 60 * 1000, 'capability TTL is ~10–15 minutes');

    // consuming with the raw capability works; consuming with its hash does not
    const hashOnly = crypto.createHash('sha256').update(created.capability, 'utf8').digest('hex');
    const hashConsume = await consumeApprovalCapability(hashOnly);
    assert(hashConsume.ok === false, 'consuming the hash (not the raw capability) fails');

    const consumed = await consumeApprovalCapability(created.capability);
    assert(consumed.ok === true && consumed.deviceId === 'DEV-CAP-A' && consumed.estateId === 'FPM_TUNGGAL',
      'valid capability is consumed and bound to its device+estate', JSON.stringify(consumed));

    const reuse = await consumeApprovalCapability(created.capability);
    assert(reuse.ok === false && reuse.reason === 'used', 'capability reuse is rejected');

    const tampered = await consumeApprovalCapability('tampered-capability-value');
    assert(tampered.ok === false && tampered.reason === 'invalid', 'tampered capability is rejected');

    // expired
    const exp = await createApprovalCapability({ deviceId: 'DEV-CAP-EXP', estateId: 'FPM_TUNGGAL' });
    const realNow = Date.now;
    Date.now = () => realNow() + 20 * 60 * 1000;
    try {
      const expired = await consumeApprovalCapability(exp.capability);
      assert(expired.ok === false && expired.reason === 'expired', 'expired capability is rejected');
    } finally {
      Date.now = realNow;
    }

    // 4. Route: GET renders only (no mutation); POST approves
    const getRoute = findRoute(devicesRoutes, 'get', '/approve-link');
    const postRoute = findRoute(devicesRoutes, 'post', '/approve-link');
    assert(!!getRoute && !!postRoute, 'GET/POST /approve-link routes registered');
    assert(/router\.get\('\/approve-link',\s*authRateLimiter/.test(read(DEVICES_SRC)) && /router\.post\('\/approve-link',\s*authRateLimiter/.test(read(DEVICES_SRC)),
      '/approve-link GET and POST are rate-limited');

    await deviceSecurityService.registerDevice({ deviceId: 'DEV-CAP-ROUTE', deviceName: 'Cap Route', estateId: 'FPM_TUNGGAL', role: 'staff' });
    const cap2 = await createApprovalCapability({ deviceId: 'DEV-CAP-ROUTE', estateId: 'FPM_TUNGGAL' });

    const getHandler = routeHandlers(getRoute).slice(-1)[0];
    const getRes = await invokeHandler(getHandler, buildReq('GET', { query: { cap: cap2.capability } }));
    assert(getRes.status === 200 && typeof getRes.body === 'string' && getRes.body.includes('Luluskan'), 'GET /approve-link renders a confirmation page');
    const stillPending = await deviceSecurityService.getDeviceStatus('DEV-CAP-ROUTE');
    assert(stillPending?.status === 'PENDING', 'GET /approve-link does not mutate device state');

    const postHandler = routeHandlers(postRoute).slice(-1)[0];
    const postRes = await invokeHandler(postHandler, buildReq('POST', { body: { cap: cap2.capability, deviceId: 'SOME-OTHER-DEVICE', estateId: 'FPM_ADELA' } }));
    assert(postRes.status === 200 && String(postRes.body).includes('Diluluskan'), 'POST /approve-link approves the capability device', `got ${postRes.status}`);
    const approved = await deviceSecurityService.getDeviceStatus('DEV-CAP-ROUTE');
    assert(approved?.status === 'APPROVED', 'capability device is APPROVED and persisted', `got ${approved?.status}`);

    const reuseRes = await invokeHandler(postHandler, buildReq('POST', { body: { cap: cap2.capability } }));
    assert(reuseRes.status === 409, 'POST /approve-link rejects a reused capability (409)', `got ${reuseRes.status}`);

    const badRes = await invokeHandler(postHandler, buildReq('POST', { body: { cap: 'invalid-cap' } }));
    assert(badRes.status === 400, 'POST /approve-link rejects an invalid capability (400)', `got ${badRes.status}`);

    // 5. enrollment-status detects APPROVED
    const enrollRoute = findRoute(devicesRoutes, 'get', '/enrollment-status');
    const enrollHandler = routeHandlers(enrollRoute).slice(-1)[0];
    const enroll = await invokeHandler(enrollHandler, buildReq('GET', { query: { deviceId: 'DEV-CAP-ROUTE' } }));
    assert(enroll.body?.status === 'APPROVED', 'enrollment-status detects APPROVED', JSON.stringify(enroll.body));

    // 6. Normal login proceeds after approval (verify-pin gate passes)
    process.env.SUPABASE_JWT_SECRET = 'p0-16a-test-secret';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    const verifyRoute = findRoute(authRoutes, 'post', '/verify-pin');
    const verifyHandler = routeHandlers(verifyRoute).slice(-1)[0];
    const verifyRes = await invokeHandler(verifyHandler, buildReq('POST', { body: { pin: '2401199', deviceId: 'DEV-CAP-ROUTE', deviceName: 'Cap Route' } }));
    assert(!(verifyRes.status === 403 && verifyRes.body?.code === 'DEVICE_NOT_APPROVED'),
      'login is no longer blocked by DEVICE_NOT_APPROVED after approval', `got ${verifyRes.status} ${JSON.stringify(verifyRes.body)?.slice(0,120)}`);
  } finally {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }

  // 7. Client / URL / logging guards (FIX 1: approvalUrl is never returned to client in verify-pin response)
  {
    const auth = read(AUTH_SRC);
    assert(!/res\.status\(403\)\.json\([^)]*approvalUrl/s.test(auth),
      'DEVICE_NOT_APPROVED never returns approvalUrl to client (FIX 1 self-bypass remediation)');
    assert(!/approvalUrl[^`]*\$\{[^}]*(deviceId|estateId|estate_id|pin|token\b)/i.test(auth), 'approvalUrl contains no device/estate/PIN/JWT data');

    const modal = read(MODAL_SRC);
    assert(modal.includes('approvalUrl') && /new URL\(approvalUrl/.test(modal), 'client uses the capability approval link');
    assert(!/console\.[a-z]+\([^)]*capability/i.test(modal), 'client does not log the capability');

    const devices = read(DEVICES_SRC);
    assert(/router\.get\('\/quick-approve',\s*requireAuth,\s*requireDeviceAdmin/.test(devices) && /router\.post\('\/approve-direct',\s*requireAuth,\s*requireDeviceAdmin/.test(devices),
      'quick-approve/approve-direct remain requireAuth + requireDeviceAdmin');
    assert(/router\.get\('\/enrollment-status',\s*authRateLimiter/.test(devices), 'enrollment-status remains pre-auth and status-only');
    assert(!/console\.[a-z]+\([^)]*\bcap\b/i.test(devices), 'routes do not log the capability');
    assert(!/\b(2401199|888888|654321)\b/.test(devices), 'no master PIN auto-approval in device routes');
  }

  console.log(`\nMODULE 39 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_approval_capability\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceApprovalCapabilityTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16A device approval capability suite execution error:', err); process.exit(1); });
}
