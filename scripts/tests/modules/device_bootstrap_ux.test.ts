/**
 * iPDS v4.1.0 — Test Module 38: P0-16 Device Bootstrap UX Fix
 *
 * Verifies the fix for the Preview device-approval deadlock:
 *   - the pre-auth, rate-limited /enrollment-status probe returns status only;
 *   - /bootstrap requires BOTH the server bootstrap secret and a valid PIN and
 *     approves via the P0-16 mechanism;
 *   - management endpoints (/check etc.) remain requireAuth + requireDeviceAdmin;
 *   - the browser client no longer calls the auth-protected /check while
 *     unauthenticated, and never handles the bootstrap secret.
 */

import fs from 'fs';
import path from 'path';
import devicesRoutes from '../../../src/server/routes/devices.routes.js';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function findRoute(method: 'get' | 'post', exactPath: string) {
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

function invokeHandler(handler: any, req: any): Promise<MockResult> {
  return new Promise((resolve) => {
    let status = 200;
    let body: any = null;
    let settled = false;

    const finish = (allowed = false) => {
      if (!settled) {
        settled = true;
        resolve({ status, body, allowed });
      }
    };

    const res: any = {
      status(code: number) {
        status = code;
        return res;
      },
      json(data: any) {
        body = data;
        finish(false);
        return res;
      },
      send(data: any) {
        body = data;
        finish(false);
        return res;
      },
      setHeader() {
        return res;
      },
      getHeader() {
        return undefined;
      },
      end() {
        finish(false);
        return res;
      }
    };

    try {
      handler(req, res, () => finish(true));
    } catch (e: any) {
      status = 500;
      body = { error: e?.message || String(e) };
      finish(false);
    }
    setTimeout(() => finish(false), 5000);
  });
}

function buildReq(method: string, opts: { headers?: Record<string, string>; query?: any; body?: any } = {}): any {
  return {
    method,
    headers: opts.headers || {},
    cookies: {},
    query: opts.query || {},
    body: opts.body || {},
    ip: '127.0.0.1',
    originalUrl: '/api/devices',
    url: '/api/devices',
    path: '/api/devices',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

export async function runDeviceBootstrapUxTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 38: P0-16 DEVICE BOOTSTRAP UX FIX');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 38.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 38.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 38.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const routesSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/devices.routes.ts'), 'utf-8');
  const modalSrc = fs.readFileSync(path.join(process.cwd(), 'src/features/auth/components/DeviceApprovalModal.tsx'), 'utf-8');
  const statusServiceSrc = fs.readFileSync(path.join(process.cwd(), 'src/features/auth/services/deviceApprovalStatus.ts'), 'utf-8');

  // 1. Source guards: endpoints and wiring
  {
    assert(/router\.get\('\/enrollment-status',\s*authRateLimiter/.test(routesSrc), '/enrollment-status is pre-auth + rate-limited');
    assert(/router\.post\('\/bootstrap',\s*authRateLimiter/.test(routesSrc), '/bootstrap is pre-auth + rate-limited');
    assert(routesSrc.includes('verifyBootstrapToken') && routesSrc.includes('AuthService.verifyPin'), '/bootstrap requires the server secret + valid PIN');
    assert(/router\.get\(\['\/check', '\/status'\], requireAuth, requireDeviceAdmin/.test(routesSrc), '/check remains requireAuth + requireDeviceAdmin');
    assert(!routesSrc.includes("headers['x-device-bootstrap-token']") || !/return res\.json\(\{[^}]*bootstrapToken/.test(routesSrc),
      'bootstrap secret is never returned in a response');
  }

  // 2. Client guards
  {
    assert(!/\/api\/devices\/check/.test(modalSrc), 'client no longer calls the auth-protected /check');
    // P0-16 fix: polling moved into the shared deviceApprovalStatus service
    // (used by both the manual button and the auto poll). The modal must use it.
    assert(/\/api\/devices\/enrollment-status/.test(statusServiceSrc), 'client polls /enrollment-status');
    assert(/runDeviceApprovalCheck/.test(modalSrc) && /from '\.\.\/services\/deviceApprovalStatus'/.test(modalSrc),
      'modal uses the shared /enrollment-status status-check');
    assert(!/\/api\/devices\/check/.test(statusServiceSrc), 'shared status-check does not call the auth-protected /check');
    assert(!/IPDS_DEVICE_BOOTSTRAP_TOKEN/.test(modalSrc), 'client does not reference the bootstrap secret');
    // Ensure the secret name is not present anywhere in browser-side code.
    let clientSecretLeak = false;
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name)) {
          const s = fs.readFileSync(full, 'utf-8');
          if (s.includes('IPDS_DEVICE_BOOTSTRAP_TOKEN')) clientSecretLeak = true;
        }
      }
    };
    walk(path.join(process.cwd(), 'src'));
    // server files are under src/server; exclude them
    clientSecretLeak = false;
    const walkClient = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (full.includes(path.join('src', 'server'))) continue;
        if (e.isDirectory()) walkClient(full);
        else if (/\.(ts|tsx)$/.test(e.name)) {
          const s = fs.readFileSync(full, 'utf-8');
          if (s.includes('IPDS_DEVICE_BOOTSTRAP_TOKEN')) clientSecretLeak = true;
        }
      }
    };
    walkClient(path.join(process.cwd(), 'src'));
    assert(!clientSecretLeak, 'bootstrap secret name absent from browser-side code');
  }

  // 3. Runtime: /enrollment-status returns status only (production + no creds => no network)
  const saved: Record<string, string | undefined> = {};
  const keys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'IPDS_DEVICE_BOOTSTRAP_TOKEN'];
  for (const k of keys) saved[k] = process.env[k];

  try {
    process.env.NODE_ENV = 'production';
    for (const k of keys.filter((x) => x.startsWith('SUPABASE') || x.startsWith('VITE_') || x.startsWith('NEXT_PUBLIC_'))) delete process.env[k];

    const enrollRoute = findRoute('get', '/enrollment-status');
    const enrollHandler = routeHandlers(enrollRoute).slice(-1)[0];
    const enroll = await invokeHandler(enrollHandler, buildReq('GET', { query: { deviceId: 'DEV-UX-STATUS' } }));
    assert(enroll.status === 200 && enroll.body?.success === true, '/enrollment-status returns 200', `got ${enroll.status}`);
    assert(typeof enroll.body?.status === 'string', '/enrollment-status returns a status string');
    assert(!('operator_name' in (enroll.body || {})) && !('operatorName' in (enroll.body || {})),
      '/enrollment-status exposes no operator/PII');

    // 4. Runtime: /bootstrap gating
    const bootstrapRoute = findRoute('post', '/bootstrap');
    const bootstrapHandler = routeHandlers(bootstrapRoute).slice(-1)[0];

    delete process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN;
    const noToken = await invokeHandler(bootstrapHandler, buildReq('POST', { body: { deviceId: 'DEV-UX-1', pin: '2401199' } }));
    assert(noToken.status === 403 && noToken.body?.code === 'INVALID_BOOTSTRAP_TOKEN', 'bootstrap without token is rejected (403)', `got ${noToken.status}`);

    process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN = 'ux-bootstrap-secret';
    const wrongToken = await invokeHandler(bootstrapHandler, buildReq('POST', { headers: { 'x-device-bootstrap-token': 'wrong' }, body: { deviceId: 'DEV-UX-2', pin: '2401199' } }));
    assert(wrongToken.status === 403 && wrongToken.body?.code === 'INVALID_BOOTSTRAP_TOKEN', 'bootstrap with wrong token is rejected (403)', `got ${wrongToken.status}`);

    const badPin = await invokeHandler(bootstrapHandler, buildReq('POST', { headers: { 'x-device-bootstrap-token': 'ux-bootstrap-secret' }, body: { deviceId: 'DEV-UX-3', pin: '000000' } }));
    assert(badPin.status === 401 && badPin.body?.code === 'INVALID_PIN', 'bootstrap with valid token but invalid PIN is rejected (401)', `got ${badPin.status}`);

    const ok = await invokeHandler(bootstrapHandler, buildReq('POST', { headers: { 'x-device-bootstrap-token': 'ux-bootstrap-secret' }, body: { deviceId: 'DEV-UX-OK', pin: '2401199' } }));
    assert(ok.status === 200 && ok.body?.success === true && ok.body?.device?.status === 'APPROVED',
      'bootstrap with valid secret + valid PIN approves the device', `got ${ok.status} ${JSON.stringify(ok.body)}`);
    assert(!JSON.stringify(ok.body).includes('ux-bootstrap-secret'), 'bootstrap response does not echo the secret');
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }

  // 5. Preserve P0-11-A + whitelist
  {
    const mw = fs.readFileSync(path.join(process.cwd(), 'src/server/middleware/auth.ts'), 'utf-8');
    assert(mw.includes('isPinAuthDeviceApproved') && mw.includes('DEVICE_NOT_APPROVED'), 'P0-11-A PIN/device gate intact');
    const svc = fs.readFileSync(path.join(process.cwd(), 'src/server/services/deviceSecurity.service.ts'), 'utf-8');
    assert(!/\b(2401199|888888|654321)\b/.test(svc), 'no hardcoded master PIN in device service');
  }

  console.log(`\nMODULE 38 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/device_bootstrap_ux.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_bootstrap_ux\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceBootstrapUxTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-16 device bootstrap UX suite execution error:', err);
      process.exit(1);
    });
}
