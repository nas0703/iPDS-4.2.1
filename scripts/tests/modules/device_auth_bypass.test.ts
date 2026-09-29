/**
 * iPDS v4.1.0 — Test Module 28: P0-11-A Device-Whitelist Bypass Hardening
 *
 * Proves that raw-PIN bearer/header authentication cannot create an API session,
 * while valid signed JWTs continue to work on requireAuth()/requireRole().
 */

import fs from 'fs';
import path from 'path';
import { requireAuth, requireRole } from '../../../src/server/middleware/auth.js';
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

  for (const headers of [
    { 'x-auth-pin': '123456' },
    { 'x-kiosk-pin': '123456' },
    { 'x-pin': '123456' },
    { authorization: 'Bearer 123456' },
    { 'x-access-token': '123456' }
  ]) {
    const result = await invokeMiddleware(requireAuth, buildReq(headers));
    assert(result.status === 401, 'Raw PIN headers/tokens cannot create an API session', `got ${result.status}`);
  }

  const noCredential = await invokeMiddleware(requireAuth, buildReq());
  assert(noCredential.status === 401, 'requireAuth rejects missing credentials (401)', `got ${noCredential.status}`);

  const session = AuthService.verifyPin('123456');
  let token = '';
  if (session) {
    sessionManager.registerSession(session, '127.0.0.1', 'jwt-only-auth-test');
    token = AuthService.generateToken(session);
  }
  const jwtHeaders = { authorization: `Bearer ${token}` };
  const signedAuth = await invokeMiddleware(requireAuth, buildReq(jwtHeaders));
  assert(signedAuth.allowed, 'A valid active signed JWT remains accepted by requireAuth', `got ${signedAuth.status}`);
  const signedRole = await invokeMiddleware(requireRole(['staff']), buildReq(jwtHeaders));
  assert(signedRole.allowed, 'A valid active signed JWT remains accepted by requireRole', `got ${signedRole.status}`);

  const source = fs.readFileSync(path.join(process.cwd(), 'src/server/middleware/auth.ts'), 'utf-8');
  assert(!/x-auth-pin|x-kiosk-pin|x-pin|verifyEstateStaffLogin|AuthService\.verifyPin/.test(source),
    'API auth middleware contains no raw-PIN session creation path');
  assert(!/\b(2401199|888888|654321)\b/.test(source), 'auth middleware contains no hardcoded PIN fallback');

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
