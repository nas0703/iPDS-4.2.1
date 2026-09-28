/**
 * iPDS v4.1.0 — Test Module 23: P0-06 RBAC Endpoint Authorization Hardening
 *
 * Verifies that the RBAC registry endpoints:
 *   - GET  /api/rbac  & /api/settings/rbac
 *   - POST /api/rbac  & /api/settings/rbac
 * require authentication (401 when missing), require an authorized admin
 * role (403 for non-admins), and never serialize credential material
 * (password / PIN / secrets / tokens / hashes) in the response.
 *
 * Also verifies the RBAC paths were removed from the CSRF exemption list.
 */

import fs from 'fs';
import path from 'path';
import settingsRoutes, { sanitizeRbacRegistryForResponse } from '../../../src/server/routes/settings.routes.js';
import { authHeaders, authHeadersForRole } from '../helpers/authTestTokens.js';

function routePathMatches(layer: any, needle: string): boolean {
  const p = layer?.route?.path;
  const paths = Array.isArray(p) ? p : [p];
  return paths.some((x) => typeof x === 'string' && x.includes(needle));
}

function findRbacRoute(method: 'get' | 'post') {
  const stack = (settingsRoutes as any).stack || [];
  return stack.find((l: any) => routePathMatches(l, '/rbac') && l.route?.methods?.[method]);
}

interface MockResult {
  status: number;
  body: any;
}

function invokeHandlers(handlers: any[], req: any): Promise<MockResult> {
  return new Promise((resolve) => {
    let status = 200;
    let body: any = null;
    let settled = false;

    const finish = () => {
      if (!settled) {
        settled = true;
        resolve({ status, body });
      }
    };

    const res: any = {
      status(code: number) {
        status = code;
        return res;
      },
      json(data: any) {
        body = data;
        finish();
        return res;
      },
      send(data: any) {
        body = data;
        finish();
        return res;
      },
      setHeader() {
        return res;
      },
      getHeader() {
        return undefined;
      },
      end() {
        finish();
        return res;
      }
    };

    let i = 0;
    const next = (err?: any) => {
      if (err) {
        status = 500;
        body = { error: String(err?.message || err) };
        finish();
        return;
      }
      if (i >= handlers.length) {
        finish();
        return;
      }
      const handler = handlers[i++];
      try {
        handler(req, res, next);
      } catch (e: any) {
        status = 500;
        body = { error: e?.message || String(e) };
        finish();
      }
    };

    next();
  });
}

function buildReq(method: 'GET' | 'POST', headers: Record<string, string> = {}): any {
  return {
    method,
    headers,
    cookies: {},
    query: {},
    body: {},
    ip: '127.0.0.1',
    originalUrl: '/api/rbac',
    url: '/api/rbac',
    path: '/api/rbac',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

function routeHandlers(route: any): any[] {
  return (route?.route?.stack || []).map((s: any) => s.handle);
}

function entryHasCredentialField(entry: any): string | null {
  if (!entry || typeof entry !== 'object') return null;
  for (const field of Object.keys(entry)) {
    if (/pass(word)?|pin|secret|token|credential|hash/i.test(field)) return field;
  }
  return null;
}

export async function runRbacEndpointSecurityTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 23: P0-06 RBAC ENDPOINT AUTHORIZATION HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 23.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 23.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 23.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const getRoute = findRbacRoute('get');
  const postRoute = findRbacRoute('post');

  // Test 23.1 / 23.2: routes exist
  assert(!!getRoute, 'GET /api/rbac route is registered');
  assert(!!postRoute, 'POST /api/rbac route is registered');

  // Test 23.3: GET route is wired with requireAuth + requireRbacAdmin
  {
    const handlers = routeHandlers(getRoute);
    const names = handlers.map((h: any) => h.name);
    assert(
      names.includes('requireAuth') && names.includes('requireRbacAdmin'),
      'GET /api/rbac is guarded by requireAuth + requireRbacAdmin',
      `handlers: ${names.join(', ')}`
    );
  }

  // Test 23.4: POST route is wired with requireAuth + requireRbacAdmin
  {
    const handlers = routeHandlers(postRoute);
    const names = handlers.map((h: any) => h.name);
    assert(
      names.includes('requireAuth') && names.includes('requireRbacAdmin'),
      'POST /api/rbac is guarded by requireAuth + requireRbacAdmin',
      `handlers: ${names.join(', ')}`
    );
  }

  // Test 23.5: GET without credentials -> 401
  {
    const result = await invokeHandlers(routeHandlers(getRoute), buildReq('GET'));
    assert(result.status === 401, 'GET /api/rbac without credentials returns 401', `got ${result.status}`);
  }

  // Test 23.6: POST without credentials -> 401
  {
    const result = await invokeHandlers(routeHandlers(postRoute), buildReq('POST'));
    assert(result.status === 401, 'POST /api/rbac without credentials returns 401', `got ${result.status}`);
  }

  // Test 23.7: GET as authenticated non-admin (staff) -> 403
  {
    const result = await invokeHandlers(routeHandlers(getRoute), buildReq('GET', authHeaders('123456')));
    assert(result.status === 403, 'GET /api/rbac as non-admin (staff) returns 403', `got ${result.status}`);
  }

  // Test 23.8: POST as authenticated non-admin (staff) -> 403
  {
    const result = await invokeHandlers(routeHandlers(postRoute), buildReq('POST', authHeaders('123456')));
    assert(result.status === 403, 'POST /api/rbac as non-admin (staff) returns 403', `got ${result.status}`);
  }

  // Test 23.9 (P0-ADMIN): RBAC least-privilege — RC/OC/PF/HQ Executive/branch FC denied (403)
  {
    const deniedActors: Array<[string, Record<string, string>]> = [
      ['rc', authHeaders('111111')],
      ['oc', authHeaders('333333')],
      ['pf', authHeaders('888888')],
      ['executive_hq', authHeadersForRole('executive_hq', 'WILAYAH_JB')],
      ['branch FC (FPM_ADELA)', authHeaders('600300')]
    ];
    for (const [label, headers] of deniedActors) {
      const getResult = await invokeHandlers(routeHandlers(getRoute), buildReq('GET', headers));
      assert(getResult.status === 403, `GET /api/rbac as ${label} returns 403`, `got ${getResult.status}`);

      const postResult = await invokeHandlers(routeHandlers(postRoute), buildReq('POST', headers));
      assert(postResult.status === 403, `POST /api/rbac as ${label} returns 403`, `got ${postResult.status}`);
    }
  }

  // Test 23.10 (P0-ADMIN): canonical Super Admin identities are authorized.
  // GET returns 200; POST passes the authorization gate (the handler itself
  // requires a registry payload, which is exercised in the authorized test below).
  {
    const adminGet = await invokeHandlers(routeHandlers(getRoute), buildReq('GET', authHeadersForRole('admin')));
    assert(adminGet.status === 200, 'GET /api/rbac as admin alias returns 200', `got ${adminGet.status}`);

    const adminPostGate = await invokeHandlers(routeHandlers(postRoute).slice(0, 2), buildReq('POST', authHeadersForRole('admin')));
    assert(adminPostGate.status === 200 && adminPostGate.body === null, 'POST /api/rbac as admin alias passes the authorization gate');

    const fcGet = await invokeHandlers(routeHandlers(getRoute), buildReq('GET', authHeaders('2401199')));
    assert(fcGet.status === 200, 'GET /api/rbac as FC Tunggal returns 200', `got ${fcGet.status}`);

    const fcPostGate = await invokeHandlers(routeHandlers(postRoute).slice(0, 2), buildReq('POST', authHeaders('2401199')));
    assert(fcPostGate.status === 200 && fcPostGate.body === null, 'POST /api/rbac as FC Tunggal passes the authorization gate');
  }

  // Test 23.11 (P0-ADMIN): every registered RBAC mutation route carries the gate.
  {
    const mutationMethods = ['post', 'patch', 'put', 'delete'] as const;
    const mutationRoutes = ((settingsRoutes as any).stack || []).filter(
      (l: any) =>
        routePathMatches(l, '/rbac') &&
        mutationMethods.some((m) => l.route?.methods?.[m])
    );
    for (const route of mutationRoutes) {
      const names = routeHandlers(route).map((h: any) => h.name);
      assert(
        names.includes('requireAuth') && names.includes('requireRbacAdmin'),
        `RBAC mutation ${Object.keys(route.route.methods).join(',')} is guarded by requireAuth + requireRbacAdmin`,
        `handlers: ${names.join(', ')}`
      );
    }
  }

  // Test 23.12 / 23.13 / 23.14: GET as authorized admin returns registry without credentials
  {
    const result = await invokeHandlers(routeHandlers(getRoute), buildReq('GET', authHeaders('2401199')));
    assert(result.status === 200, 'GET /api/rbac as authorized admin returns 200', `got ${result.status}`);

    const registry = result.body?.registry;
    assert(
      !!registry && typeof registry === 'object' && Object.keys(registry).length > 0,
      'Authorized RBAC response preserves registry functionality (non-empty)',
      `keys: ${registry ? Object.keys(registry).length : 'n/a'}`
    );

    const offenders: string[] = [];
    for (const [key, entry] of Object.entries(registry || {})) {
      const bad = entryHasCredentialField(entry);
      if (bad) offenders.push(`${key}.${bad}`);
    }
    assert(
      offenders.length === 0,
      'RBAC response contains no password/PIN/secret/token/credential/hash fields',
      offenders.join(', ')
    );

    const serialized = JSON.stringify(result.body || {});
    assert(
      !serialized.includes('Ipds#2026Admin!') && !serialized.includes('FcTunggal#2026!') && !serialized.includes('"password"'),
      'RBAC response contains no known credential literals or password field'
    );
  }

  // Test 23.12: sanitizer strips credential fields but keeps operational fields
  {
    const dirty = {
      '111111': {
        id: 'role_rc',
        pin: '111111',
        role: 'rc',
        label: 'Regional Controller',
        estate_id: 'FPM_TUNGGAL',
        password: 'Ipds#2026Admin!',
        username: 'admin',
        allowedModules: ['dashboard']
      }
    };
    const clean: any = sanitizeRbacRegistryForResponse(dirty);
    const entry = clean['111111'];
    assert(
      !!entry &&
        entry.role === 'rc' &&
        entry.estate_id === 'FPM_TUNGGAL' &&
        !('pin' in entry) &&
        !('password' in entry),
      'sanitizeRbacRegistryForResponse removes pin/password and preserves role/estate'
    );
  }

  // Test 23.13: CSRF exemption list no longer contains the RBAC paths
  {
    const csrfSource = fs.readFileSync(
      path.join(process.cwd(), 'src/server/middleware/csrf.ts'),
      'utf-8'
    );
    const exemptsRbac =
      csrfSource.includes("'/api/settings/rbac'") ||
      csrfSource.includes("'/settings/rbac'") ||
      csrfSource.includes("'/api/rbac'") ||
      csrfSource.includes("'/rbac'");
    assert(!exemptsRbac, 'CSRF exemption list no longer contains RBAC paths');
  }

  console.log(`\nMODULE 23 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/rbac_endpoint_security.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /rbac_endpoint_security\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runRbacEndpointSecurityTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-06 RBAC endpoint security suite execution error:', err);
      process.exit(1);
    });
}
