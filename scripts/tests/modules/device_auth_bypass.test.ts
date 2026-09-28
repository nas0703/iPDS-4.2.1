/**
 * iPDS v4.1.0 — Test Module 28: P0-11-A Device-Whitelist Bypass Hardening
 *
 * Proves that raw-PIN bearer/header authentication (Authorization: Bearer <PIN>,
 * x-access-token, x-auth-pin) can no longer bypass the device whitelist on
 * requireAuth()/requireRole() endpoints, while signed session tokens continue
 * to work and approved devices are still allowed.
 */

import fs from 'fs';
import path from 'path';
import { requireAuth, requireRole, isPinAuthRequest } from '../../../src/server/middleware/auth.js';
import { deviceSecurityService } from '../../../src/server/services/deviceSecurity.service.js';
import { AuthService } from '../../../src/server/services/auth.service.js';
import { sessionManager } from '../../../src/server/services/sessionManager.service.js';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function invokeMiddleware(mw: any, req: any): Promise<MockResult> {
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
      mw(req, res, () => finish(true));
    } catch (e: any) {
      status = 500;
      body = { error: e?.message || String(e) };
      finish(false);
    }

    // Safety timeout so a stuck middleware cannot hang the suite.
    setTimeout(() => finish(false), 5000);
  });
}

function buildReq(headers: Record<string, string> = {}, body: any = {}, query: any = {}): any {
  return {
    method: 'GET',
    headers,
    cookies: {},
    query,
    body,
    ip: '127.0.0.1',
    originalUrl: '/api/test',
    url: '/api/test',
    path: '/api/test',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

const APPROVED_DEVICE = 'DEV-P011-APPROVED';

export async function runDeviceAuthBypassTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 28: P0-11-A DEVICE-WHITELIST BYPASS HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 28.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 28.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 28.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // Stub the device service to avoid network I/O; only APPROVED_DEVICE is approved.
  const originalGetStatus = deviceSecurityService.getDeviceStatus.bind(deviceSecurityService);
  (deviceSecurityService as any).getDeviceStatus = async (deviceId: string) =>
    deviceId === APPROVED_DEVICE
      ? { device_id: APPROVED_DEVICE, status: 'APPROVED', estate_id: 'FPM_TUNGGAL' }
      : null;

  try {
    // 1. isPinAuthRequest classification
    {
      assert(isPinAuthRequest(buildReq({ 'x-auth-pin': '123456' })), 'x-auth-pin digits classified as PIN auth');
      assert(isPinAuthRequest(buildReq({ authorization: 'Bearer 123456' })), 'Bearer <PIN> classified as PIN auth');
      assert(isPinAuthRequest(buildReq({ 'x-access-token': '2401199' })), 'x-access-token <PIN> classified as PIN auth');

      const jwtLike = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.abc';
      assert(!isPinAuthRequest(buildReq({ authorization: `Bearer ${jwtLike}` })), 'Signed JWT is NOT classified as PIN auth');
    }

    // 2. requireAuth: unapproved device via PIN -> 403 DEVICE_NOT_APPROVED
    {
      const result = await invokeMiddleware(requireAuth, buildReq({ 'x-auth-pin': '123456' }));
      assert(
        result.status === 403 && result.body?.code === 'DEVICE_NOT_APPROVED',
        'requireAuth rejects PIN auth from an unapproved device (403 DEVICE_NOT_APPROVED)',
        `got ${result.status} ${JSON.stringify(result.body)}`
      );
    }

    // 3. requireAuth: no credential -> 401
    {
      const result = await invokeMiddleware(requireAuth, buildReq());
      assert(result.status === 401, 'requireAuth rejects missing credentials (401)', `got ${result.status}`);
    }

    // 4. requireAuth: PIN + approved device -> allowed
    {
      const result = await invokeMiddleware(
        requireAuth,
        buildReq({ 'x-auth-pin': '123456', 'x-device-id': APPROVED_DEVICE })
      );
      assert(result.allowed, 'requireAuth allows PIN auth from an approved device', `status=${result.status}`);
    }

    // 5. requireRole: unapproved device via PIN -> 403 DEVICE_NOT_APPROVED
    {
      const mw = requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs']);
      const result = await invokeMiddleware(mw, buildReq({ 'x-auth-pin': '123456' }));
      assert(
        result.status === 403 && result.body?.code === 'DEVICE_NOT_APPROVED',
        'requireRole rejects PIN auth from an unapproved device (403 DEVICE_NOT_APPROVED)',
        `got ${result.status} ${JSON.stringify(result.body)}`
      );
    }

    // 6. requireRole: PIN + approved device -> allowed
    {
      const mw = requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs']);
      const result = await invokeMiddleware(
        mw,
        buildReq({ 'x-auth-pin': '123456', 'x-device-id': APPROVED_DEVICE })
      );
      assert(result.allowed, 'requireRole allows PIN auth from an approved device', `status=${result.status}`);
    }

    // 7. Signed session token (no device header) -> not blocked by the device gate
    {
      const session = AuthService.verifyPin('123456');
      let token = '';
      if (session) {
        sessionManager.registerSession(session, '127.0.0.1', 'p0-11-a-test');
        token = AuthService.generateToken(session);
      }
      const result = await invokeMiddleware(requireAuth, buildReq({ authorization: `Bearer ${token}` }));
      assert(
        result.allowed,
        'Signed session token remains allowed without a device header',
        `status=${result.status} ${JSON.stringify(result.body)}`
      );
    }

    // 8. Source guards
    {
      const src = fs.readFileSync(path.join(process.cwd(), 'src/server/middleware/auth.ts'), 'utf-8');
      assert(src.includes('isPinAuthDeviceApproved') && src.includes('deviceSecurityService.getDeviceStatus'),
        'auth middleware enforces device approval for PIN auth');
      assert(!/\b(2401199|888888|654321)\b/.test(src), 'auth middleware contains no hardcoded master PIN fallback');
    }
  } finally {
    (deviceSecurityService as any).getDeviceStatus = originalGetStatus;
  }

  console.log(`\nMODULE 28 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/device_auth_bypass.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_auth_bypass\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceAuthBypassTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-11-A device auth bypass suite execution error:', err);
      process.exit(1);
    });
}
