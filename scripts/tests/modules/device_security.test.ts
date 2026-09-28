/**
 * iPDS v4.1.0 — Test Module 24: P0-07 Device Security Hardening
 *
 * Verifies that device endpoints are no longer unauthenticated / unbound:
 *   - approval, revocation, registration, FC-contact mutation, pending-count
 *     and device-check require authentication (401) and an authorized
 *     device-admin role (403 for non-admins);
 *   - estateId=ALL is rejected for single-estate roles;
 *   - hardcoded master PINs are removed from device-security authorization;
 *   - verify-pin / verify-staff no longer auto-approve devices from static
 *     master PINs.
 */

import fs from 'fs';
import path from 'path';
import devicesRoutes from '../../../src/server/routes/devices.routes.js';
import { deviceSecurityService } from '../../../src/server/services/deviceSecurity.service.js';
import { authHeaders } from '../helpers/authTestTokens.js';

function routePathMatches(layer: any, needle: string): boolean {
  const p = layer?.route?.path;
  const paths = Array.isArray(p) ? p : [p];
  return paths.some((x) => typeof x === 'string' && x === needle);
}

function findRoute(method: 'get' | 'post', needle: string) {
  const stack = (devicesRoutes as any).stack || [];
  return stack.find((l: any) => routePathMatches(l, needle) && l.route?.methods?.[method]);
}

function routeHandlers(route: any): any[] {
  return (route?.route?.stack || []).map((s: any) => s.handle);
}

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function invokeHandlers(handlers: any[], req: any): Promise<MockResult> {
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

    let i = 0;
    const next = (err?: any) => {
      if (err) {
        status = 500;
        body = { error: String(err?.message || err) };
        finish(false);
        return;
      }
      if (i >= handlers.length) {
        // All provided (gate) handlers passed without responding => allowed.
        finish(true);
        return;
      }
      const handler = handlers[i++];
      try {
        handler(req, res, next);
      } catch (e: any) {
        status = 500;
        body = { error: e?.message || String(e) };
        finish(false);
      }
    };

    next();
  });
}

function buildReq(method: 'GET' | 'POST', opts: { headers?: Record<string, string>; query?: any; body?: any } = {}): any {
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

const GATE = 2; // requireAuth + requireDeviceAdmin

export async function runDeviceSecurityTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 24: P0-07 DEVICE SECURITY HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 24.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 24.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 24.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const approveDirect = findRoute('post', '/approve-direct');
  const revoke = findRoute('post', '/revoke');
  const approve = findRoute('post', '/approve');
  const register = findRoute('post', '/register');
  const fcContactPost = findRoute('post', '/fc-contact');
  const pendingCount = findRoute('get', '/pending-count');
  const check = findRoute('get', '/check');

  assert(!!approveDirect && !!revoke && !!register && !!fcContactPost && !!pendingCount && !!check,
    'All targeted device routes are registered');

  // Unauthenticated -> 401
  {
    const cases: Array<[string, any, 'GET' | 'POST', any]> = [
      ['approve-direct', approveDirect, 'POST', {}],
      ['revoke', revoke, 'POST', {}],
      ['register (no credential)', register, 'POST', { deviceId: 'DEV-TEST-001' }],
      ['fc-contact mutation', fcContactPost, 'POST', {}],
      ['pending-count', pendingCount, 'GET', {}],
      ['device-check', check, 'GET', {}]
    ];
    for (const [label, route, method, body] of cases) {
      const result = await invokeHandlers(routeHandlers(route), buildReq(method, { body }));
      assert(result.status === 401, `Unauthenticated ${label} returns 401`, `got ${result.status}`);
    }
  }

  // Non-admin (staff) -> 403
  {
    const cases: Array<[string, any, 'GET' | 'POST']> = [
      ['approve-direct', approveDirect, 'POST'],
      ['approve', approve, 'POST'],
      ['revoke', revoke, 'POST'],
      ['fc-contact mutation', fcContactPost, 'POST'],
      ['pending-count', pendingCount, 'GET'],
      ['device-check', check, 'GET']
    ];
    for (const [label, route, method] of cases) {
      const result = await invokeHandlers(
        routeHandlers(route).slice(0, GATE),
        buildReq(method, { headers: authHeaders('123456') })
      );
      assert(result.status === 403, `Non-admin cannot ${label} (403)`, `got ${result.status}`);
    }
  }

  // Authorized admin passes the auth gate
  {
    const result = await invokeHandlers(
      routeHandlers(pendingCount).slice(0, GATE),
      buildReq('GET', { headers: authHeaders('2401199') })
    );
    assert(result.allowed && result.status === 200, 'Authorized device admin passes the auth gate');
  }

  const listRoute = findRoute('get', '/list');

  // Seed a device in another estate (in-memory) so cross-estate device
  // administration attempts are evaluated against a real target estate.
  await deviceSecurityService.registerDevice({
    deviceId: 'DEV-ADMIN-ADELA',
    deviceName: 'Peranti Ujian Adela',
    estateId: 'FPM_ADELA',
    operatorName: 'Ujian',
    role: 'staff'
  });

  // P0-ADMIN: RC/OC/PF may NOT administer devices cross-estate or use estateId=ALL (403)
  {
    const denied: Array<[string, any, 'GET' | 'POST', Record<string, string>, any, any]> = [
      ['RC list cross-estate', listRoute, 'GET', authHeaders('111111'), { estateId: 'FPM_ADELA' }, {}],
      ['OC list cross-estate', listRoute, 'GET', authHeaders('333333'), { estateId: 'FPM_ADELA' }, {}],
      ['PF list cross-estate', listRoute, 'GET', authHeaders('888888'), { estateId: 'FPM_ADELA' }, {}],
      ['RC estateId=ALL', pendingCount, 'GET', authHeaders('111111'), { estateId: 'ALL' }, {}],
      ['RC approve cross-estate', approve, 'POST', authHeaders('111111'), undefined, { deviceId: 'DEV-ADMIN-ADELA' }],
      ['RC revoke cross-estate', revoke, 'POST', authHeaders('111111'), undefined, { deviceId: 'DEV-ADMIN-ADELA' }]
    ];
    for (const [label, route, method, headers, query, body] of denied) {
      const result = await invokeHandlers(routeHandlers(route), buildReq(method, { headers, query, body }));
      assert(result.status === 403, `${label} is denied (403)`, `got ${result.status}`);
    }
  }

  // P0-ADMIN: authorized same-estate branch FC and FC Tunggal cross-estate are allowed
  {
    const branchOwn = await invokeHandlers(
      routeHandlers(pendingCount),
      buildReq('GET', { headers: authHeaders('600300'), query: { estateId: 'FPM_ADELA' } })
    );
    assert(branchOwn.status === 200, 'Branch FC administering its own estate is allowed (200)', `got ${branchOwn.status}`);

    const fcTunggalCross = await invokeHandlers(
      routeHandlers(pendingCount),
      buildReq('GET', { headers: authHeaders('2401199'), query: { estateId: 'FPM_ADELA' } })
    );
    assert(fcTunggalCross.status === 200, 'FC Tunggal cross-estate device listing is allowed (200)', `got ${fcTunggalCross.status}`);
  }

  // Source-level: hardcoded master PINs removed from device-security authorization
  {
    const files = [
      'src/server/routes/devices.routes.ts',
      'src/server/services/deviceSecurity.service.ts',
      'src/server/routes/auth.routes.ts'
    ];
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf-8');
      if (/\b(2401199|888888|654321)\b/.test(src)) offenders.push(f);
    }
    assert(offenders.length === 0, 'Hardcoded master PINs are absent from device-security authorization', offenders.join(', '));
  }

  // Source-level: no auto-approval from static master PINs
  {
    const authSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/auth.routes.ts'), 'utf-8');
    const serviceSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/services/deviceSecurity.service.ts'), 'utf-8');
    assert(!authSrc.includes('autoApproveMaster'), 'verify-pin/verify-staff no longer request master auto-approval');
    assert(!serviceSrc.includes('isMasterPin') && !serviceSrc.includes('DEVICE_AUTO_APPROVED'),
      'device service no longer contains master-PIN auto-approval logic');
    assert(serviceSrc.includes('verifyBootstrapToken') && serviceSrc.includes("bootstrapApproved ? 'APPROVED' : 'PENDING'"),
      'P0-16: registration is PENDING unless a valid server bootstrap token is presented');
  }

  console.log(`\nMODULE 24 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/device_security.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_security\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceSecurityTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-07 device security suite execution error:', err);
      process.exit(1);
    });
}
