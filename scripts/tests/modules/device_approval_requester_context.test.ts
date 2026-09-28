/**
 * iPDS v4.1.0 — Test Module 40: P0-16B Device Approval Requester Context
 *
 * Verifies the FC approval UX improvement:
 *   - requester metadata (name, staff id, device name) is stored server-side
 *     and is NOT in the approval URL;
 *   - GET /approve-link validates + displays requester identity and device/
 *     estate context, still pre-auth, rate-limited, read-only (no approval);
 *   - POST approves ONLY the capability-bound device + estate;
 *   - Reject/Cancel consumes the capability without approving anything;
 *   - single-use / expiry / tamper / constant-time / 256-bit / SHA-256 / TTL
 *     security properties are preserved;
 *   - existing P0-16A behaviour is unchanged.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  deviceSecurityService,
  createApprovalCapability,
  consumeApprovalCapability,
  peekApprovalCapability
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

const MIGRATION = 'supabase/migrations/20260920_p0_16b_device_approval_requester_context.sql';
const SERVICE_SRC = 'src/server/services/deviceSecurity.service.ts';
const DEVICES_SRC = 'src/server/routes/devices.routes.ts';
const AUTH_SRC = 'src/server/routes/auth.routes.ts';

const REQUESTER_NAME = 'NURUL AINA BINTI TEST';
const REQUESTER_STAFF_ID = 'STF-P016B-9001';
const DEVICE_A = 'DEV-P0-16B-A';
const DEVICE_B = 'DEV-P0-16B-B';
const DEVICE_NAME_A = 'Peranti Ujian P016B Alpha';
const ESTATE_A = 'FPM_TUNGGAL';

export async function runDeviceApprovalRequesterContextTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 40: P0-16B DEVICE APPROVAL REQUESTER CONTEXT');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 40.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 40.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 40.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  // 1. Migration / schema
  {
    const exists = fs.existsSync(path.join(process.cwd(), MIGRATION));
    assert(exists, 'P0-16B requester-context migration exists');
    if (exists) {
      const sql = read(MIGRATION);
      assert(/\brequester_name\b/.test(sql), 'migration defines column requester_name');
      assert(/\brequester_staff_id\b/.test(sql), 'migration defines column requester_staff_id');
      assert(/\bdevice_name\b/.test(sql), 'migration defines column device_name');
      assert(/ADD COLUMN IF NOT EXISTS/i.test(sql), 'migration extends the table idempotently');
      assert(!/DROP POLICY/i.test(sql) && !/DISABLE ROW LEVEL SECURITY/i.test(sql) && !/REVOKE/i.test(sql),
        'migration does not weaken existing RLS/grants');
      assert(!/\bcapability\b\s+TEXT/i.test(sql), 'migration does not add a raw-capability column');
    }
  }

  // 2. Service source guards
  {
    const src = read(SERVICE_SRC);
    assert(/requesterName\?:\s*string \| null/.test(src) && /requesterStaffId\?:\s*string \| null/.test(src) && /deviceName\?:\s*string \| null/.test(src),
      'createApprovalCapability accepts requester/device metadata');
    assert(/requester_name:\s*params\.requesterName/.test(src) && /requester_staff_id:\s*params\.requesterStaffId/.test(src) && /device_name:\s*params\.deviceName/.test(src),
      'requester metadata is persisted server-side');
    assert(/export async function peekApprovalCapability/.test(src), 'read-only peekApprovalCapability exported');
    assert(/timingSafeEqual/.test(src), 'constant-time comparison preserved');
    assert(/createHash\('sha256'\)/.test(src), 'SHA-256 hashing preserved');
    assert(/randomBytes\(32\)/.test(src), '256-bit random capability preserved');
    assert(/APPROVAL_CAPABILITY_TTL_MS = 12 \* 60 \* 1000/.test(src), 'TTL remains 12 minutes (10–15 range)');
    assert(!/console\.[a-z]+\([^)]*requester/i.test(src), 'service does not log requester metadata');
    assert(!/console\.[a-z]+\([^)]*\bcapability\b\s*[,)]/.test(src), 'service does not log the raw capability');
  }

  const envKeys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET'];
  const saved: Record<string, string | undefined> = {};
  for (const k of envKeys) saved[k] = process.env[k];

  try {
    process.env.NODE_ENV = 'production';
    for (const k of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k];

    // 3. Capability unit behaviour (in-memory; no DB creds)
    const cap = await createApprovalCapability({
      deviceId: DEVICE_A,
      estateId: ESTATE_A,
      createdBy: REQUESTER_NAME,
      requesterName: REQUESTER_NAME,
      requesterStaffId: REQUESTER_STAFF_ID,
      deviceName: DEVICE_NAME_A
    });
    assert(typeof cap.capability === 'string' && cap.capability.length >= 40, 'capability remains a long random string');
    assert(!cap.capability.includes(REQUESTER_NAME) && !cap.capability.includes(REQUESTER_STAFF_ID) && !cap.capability.includes(DEVICE_A),
      'capability embeds no requester/device metadata');

    const peeked = await peekApprovalCapability(cap.capability);
    assert(peeked.ok === true && peeked.requesterName === REQUESTER_NAME && peeked.requesterStaffId === REQUESTER_STAFF_ID &&
      peeked.deviceName === DEVICE_NAME_A && peeked.deviceId === DEVICE_A && peeked.estateId === ESTATE_A,
      'requester metadata is stored server-side and readable', JSON.stringify(peeked));

    const peekAgain = await peekApprovalCapability(cap.capability);
    assert(peekAgain.ok === true, 'peek is read-only (does not consume)');

    const consumed = await consumeApprovalCapability(cap.capability);
    assert(consumed.ok === true && consumed.requesterName === REQUESTER_NAME && consumed.requesterStaffId === REQUESTER_STAFF_ID && consumed.deviceName === DEVICE_NAME_A,
      'consume returns the stored requester metadata', JSON.stringify(consumed));

    const reuse = await consumeApprovalCapability(cap.capability);
    assert(reuse.ok === false && reuse.reason === 'used', 'capability cannot be reused');

    const hashOnly = crypto.createHash('sha256').update(cap.capability, 'utf8').digest('hex');
    const hashPeek = await peekApprovalCapability(hashOnly);
    assert(hashPeek.ok === false && hashPeek.reason === 'invalid', 'hash-only value cannot be peeked');

    const tampered = await peekApprovalCapability('tampered-capability-value');
    assert(tampered.ok === false && tampered.reason === 'invalid', 'tampered capability rejected');

    const exp = await createApprovalCapability({ deviceId: DEVICE_A, estateId: ESTATE_A, requesterName: REQUESTER_NAME });
    const realNow = Date.now;
    Date.now = () => realNow() + 20 * 60 * 1000;
    try {
      const expPeek = await peekApprovalCapability(exp.capability);
      const expConsume = await consumeApprovalCapability(exp.capability);
      assert(expPeek.ok === false && expPeek.reason === 'expired' && expConsume.ok === false && expConsume.reason === 'expired',
        'expired capability rejected by peek and consume');
    } finally {
      Date.now = realNow;
    }

    // 4. Routes: GET shows requester context (read-only); POST approves bound device
    const getRoute = findRoute(devicesRoutes, 'get', '/approve-link');
    const postRoute = findRoute(devicesRoutes, 'post', '/approve-link');
    assert(!!getRoute && !!postRoute, 'GET/POST /approve-link routes registered');
    assert(/router\.get\('\/approve-link',\s*authRateLimiter/.test(read(DEVICES_SRC)) && /router\.post\('\/approve-link',\s*authRateLimiter/.test(read(DEVICES_SRC)),
      '/approve-link GET and POST remain rate-limited');

    await deviceSecurityService.registerDevice({ deviceId: DEVICE_A, deviceName: DEVICE_NAME_A, estateId: ESTATE_A, role: 'staff' });
    const routeCap = await createApprovalCapability({
      deviceId: DEVICE_A, estateId: ESTATE_A, requesterName: REQUESTER_NAME, requesterStaffId: REQUESTER_STAFF_ID, deviceName: DEVICE_NAME_A
    });

    const getHandler = routeHandlers(getRoute).slice(-1)[0];
    const getRes = await invokeHandler(getHandler, buildReq('GET', { query: { cap: routeCap.capability } }));
    const page = String(getRes.body || '');
    assert(getRes.status === 200 && page.includes(REQUESTER_NAME), 'approval page displays requester name', `status ${getRes.status}`);
    assert(page.includes(REQUESTER_STAFF_ID), 'approval page displays No. Kakitangan');
    assert(page.includes(DEVICE_A), 'approval page displays device id');
    assert(page.includes(DEVICE_NAME_A), 'approval page displays device name');
    assert(page.includes(ESTATE_A), 'approval page displays estate');
    assert(page.includes('Masa Permohonan'), 'approval page displays request time');
    assert(page.includes('Sila pastikan maklumat pemohon adalah betul sebelum meluluskan peranti.'), 'approval page shows the confirmation warning');
    assert(page.includes('Luluskan Peranti Ini'), 'approval page offers an approve action');
    assert(page.includes('Tolak') && /name="action" value="reject"/.test(page), 'approval page offers a reject/cancel action');
    assert(!page.includes('FPM_ADELA'), 'approval page does not expose unrelated tenant data');

    const stillPending = await deviceSecurityService.getDeviceStatus(DEVICE_A);
    assert(stillPending?.status === 'PENDING', 'GET does not approve the device');

    const noCap = await invokeHandler(getHandler, buildReq('GET', { query: {} }));
    assert(noCap.status === 400, 'GET without a capability is rejected (400)');
    const badCap = await invokeHandler(getHandler, buildReq('GET', { query: { cap: 'invalid-cap' } }));
    assert(badCap.status === 400, 'GET with an invalid capability is rejected (400)');

    const postHandler = routeHandlers(postRoute).slice(-1)[0];

    // 4a. Reject consumes the capability but approves nothing
    const rejectCap = await createApprovalCapability({ deviceId: DEVICE_A, estateId: ESTATE_A, requesterName: REQUESTER_NAME });
    const rejectRes = await invokeHandler(postHandler, buildReq('POST', { body: { cap: rejectCap.capability, action: 'reject' } }));
    assert(rejectRes.status === 200 && String(rejectRes.body).includes('Ditolak'), 'POST reject shows rejection', `got ${rejectRes.status}`);
    const afterReject = await deviceSecurityService.getDeviceStatus(DEVICE_A);
    assert(afterReject?.status === 'PENDING', 'reject does not approve the device');
    const rejectReuse = await invokeHandler(postHandler, buildReq('POST', { body: { cap: rejectCap.capability, action: 'reject' } }));
    assert(rejectReuse.status === 409, 'rejected capability cannot be reused', `got ${rejectReuse.status}`);

    // 4b. Approve approves ONLY the capability-bound device + estate
    await deviceSecurityService.registerDevice({ deviceId: DEVICE_B, deviceName: 'Peranti Ujian P016B Beta', estateId: ESTATE_A, role: 'staff' });
    const approveCap = await createApprovalCapability({ deviceId: DEVICE_B, estateId: ESTATE_A, requesterName: REQUESTER_NAME });
    const approveRes = await invokeHandler(postHandler, buildReq('POST', {
      body: { cap: approveCap.capability, action: 'approve', deviceId: 'DEV-P0-16B-OTHER', estateId: 'FPM_ADELA' }
    }));
    assert(approveRes.status === 200 && String(approveRes.body).includes('Diluluskan'), 'POST approves the capability device', `got ${approveRes.status}`);
    const approvedB = await deviceSecurityService.getDeviceStatus(DEVICE_B);
    assert(approvedB?.status === 'APPROVED', 'capability-bound device is APPROVED', `got ${approvedB?.status}`);
    const otherDevice = await deviceSecurityService.getDeviceStatus('DEV-P0-16B-OTHER');
    assert(otherDevice?.status !== 'APPROVED', 'body device override is ignored (no cross-device approval)');

    const approveReuse = await invokeHandler(postHandler, buildReq('POST', { body: { cap: approveCap.capability } }));
    assert(approveReuse.status === 409, 'approved capability cannot be reused', `got ${approveReuse.status}`);

    // 4c. Expired capability rejected at the route
    const routeExp = await createApprovalCapability({ deviceId: DEVICE_A, estateId: ESTATE_A, requesterName: REQUESTER_NAME });
    Date.now = () => realNow() + 20 * 60 * 1000;
    try {
      const getExp = await invokeHandler(getHandler, buildReq('GET', { query: { cap: routeExp.capability } }));
      const postExp = await invokeHandler(postHandler, buildReq('POST', { body: { cap: routeExp.capability } }));
      assert(getExp.status === 410 && postExp.status === 410, 'expired capability rejected at route (410)', `GET ${getExp.status} POST ${postExp.status}`);
    } finally {
      Date.now = realNow;
    }

    // 4d. enrollment-status still detects APPROVED
    const enrollRoute = findRoute(devicesRoutes, 'get', '/enrollment-status');
    const enrollHandler = routeHandlers(enrollRoute).slice(-1)[0];
    const enroll = await invokeHandler(enrollHandler, buildReq('GET', { query: { deviceId: DEVICE_B } }));
    assert(enroll.body?.status === 'APPROVED', 'enrollment-status still detects APPROVED', JSON.stringify(enroll.body));

    // 5. Runtime: raw capability / requester PII never logged
    const logs: string[] = [];
    const origWarn = console.warn, origError = console.error, origLog = console.log;
    let logCap = ''; let logConsumeOk = false;
    console.warn = (...a: any[]) => { logs.push(a.map(String).join(' ')); };
    console.error = (...a: any[]) => { logs.push(a.map(String).join(' ')); };
    console.log = (...a: any[]) => { logs.push(a.map(String).join(' ')); };
    try {
      const logCapRes = await createApprovalCapability({
        deviceId: DEVICE_A, estateId: ESTATE_A, requesterName: REQUESTER_NAME, requesterStaffId: REQUESTER_STAFF_ID, deviceName: DEVICE_NAME_A
      });
      logCap = logCapRes.capability;
      await peekApprovalCapability(logCap);
      logConsumeOk = (await consumeApprovalCapability(logCap)).ok === true;
    } finally {
      console.warn = origWarn; console.error = origError; console.log = origLog;
    }
    assert(logConsumeOk, 'logging-check capability consumed successfully');
    assert(!logs.some(l => l.includes(logCap)), 'raw capability is never written to logs');
    assert(!logs.some(l => l.includes(REQUESTER_NAME)) && !logs.some(l => l.includes(REQUESTER_STAFF_ID)), 'requester PII is never written to logs');

    // 6. URL / PII + preserved security posture (FIX 1: approvalUrl is never returned to client)
    const auth = read(AUTH_SRC);
    assert(!/res\.status\(403\)\.json\([^)]*approvalUrl/s.test(auth),
      'DEVICE_NOT_APPROVED never returns approvalUrl to client (FIX 1 self-bypass remediation)');
    assert(!/approvalUrl[^`]*\$\{[^}]*(deviceId|estateId|estate_id|requester|staff|operator|pin|token\b)/i.test(auth),
      'approvalUrl contains no requester/device/estate/PIN/token data');

    const devices = read(DEVICES_SRC);
    assert(/router\.get\('\/quick-approve',\s*requireAuth,\s*requireDeviceAdmin/.test(devices) && /router\.post\('\/approve-direct',\s*requireAuth,\s*requireDeviceAdmin/.test(devices),
      'quick-approve/approve-direct remain requireAuth + requireDeviceAdmin');
    assert(/router\.get\('\/enrollment-status',\s*authRateLimiter/.test(devices), 'enrollment-status remains pre-auth and status-only');
    assert(!/\b(2401199|888888|654321)\b/.test(devices), 'no master PIN auto-approval in device routes');
    assert(!/console\.[a-z]+\([^)]*\bcap\b/i.test(devices), 'routes do not log the capability');
    assert(!/console\.[a-z]+\([^)]*requester/i.test(devices), 'routes do not log requester metadata');
  } finally {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }

  console.log(`\nMODULE 40 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_approval_requester_context\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceApprovalRequesterContextTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16B device approval requester-context suite execution error:', err); process.exit(1); });
}
