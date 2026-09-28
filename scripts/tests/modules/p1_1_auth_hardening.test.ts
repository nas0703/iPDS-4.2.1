/**
 * iPDS v4.1.0 — Test Module 55: P1.1 Emergency Auth Hardening
 *
 * Verifies:
 *   - /api/employees requires authentication and elevated write roles
 *   - the universal master-password fallback is removed (server + client)
 *   - legitimate registry password login still works
 *   - hujan/penggredan no longer fall back to the privileged service-role client
 *   - employees reads/writes are estate-scoped
 */

import fs from 'fs';
import path from 'path';
import employeesRoutes from '../../../src/server/routes/employees.routes.js';
import { AuthService } from '../../../src/server/services/auth.service.js';
import { authHeaders } from '../helpers/authTestTokens.js';

type Method = 'get' | 'post' | 'put' | 'delete' | 'patch';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function routeHandlers(route: any): any[] {
  return (route?.route?.stack || []).map((s: any) => s.handle);
}

function findRoute(method: Method, exactPath: string) {
  const stack = (employeesRoutes as any).stack || [];
  return stack.find((l: any) => {
    const p = l.route?.path;
    const paths = Array.isArray(p) ? p : [p];
    return l.route?.methods?.[method] && paths.includes(exactPath);
  });
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
        finish(true);
        return;
      }
      const handler = handlers[i++];
      try {
        handler(req, res, next);
      } catch (e: any) {
        status = 500;
        body = { error: e?.message || e };
        finish(false);
      }
    };

    next();
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
    originalUrl: '/api/employees',
    url: '/api/employees',
    path: '/api/employees',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

export async function runP1_1AuthHardeningTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 55: P1.1 EMERGENCY AUTH HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 55.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 55.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 55.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const envKeys = [
    'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'IPDS_IDENTITY_OVERRIDES_JSON'
  ];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];
  for (const k of envKeys) delete process.env[k];

  try {
    const getRoute = findRoute('get', '/employees');
    const postRoute = findRoute('post', '/employees');
    const putRoute = findRoute('put', '/employees/:id');
    const deleteRoute = findRoute('delete', '/employees/:id');

    assert(!!getRoute && !!postRoute && !!putRoute && !!deleteRoute, 'employees GET/POST/PUT/DELETE routes are registered');

    const employeesSrc = read('src/server/routes/employees.routes.ts');
    assert(/router\.get\('\/employees',\s*requireAuth/.test(employeesSrc), 'employees GET requires authentication');
    assert(/router\.post\('\/employees',\s*requireRole/.test(employeesSrc), 'employees POST requires an elevated role');
    assert(/router\.put\('\/employees\/:id',\s*requireRole/.test(employeesSrc), 'employees PUT requires an elevated role');
    assert(/router\.delete\('\/employees\/:id',\s*requireRole/.test(employeesSrc), 'employees DELETE requires an elevated role');

    const staff = authHeaders('123456');
    const staffReqHeaders = { authorization: staff.authorization, 'content-type': 'application/json' };

    for (const [label, route, method] of [
      ['GET /employees', getRoute, 'GET'],
      ['POST /employees', postRoute, 'POST'],
      ['PUT /employees/:id', putRoute, 'PUT'],
      ['DELETE /employees/:id', deleteRoute, 'DELETE']
    ] as Array<[string, any, string]>) {
      const result = await invokeHandlers(routeHandlers(route).slice(0, 1), buildReq(method));
      assert(result.status === 401, `Unauthenticated ${label} returns 401`, `got ${result.status}`);
    }

    const postAsStaff = await invokeHandlers(routeHandlers(postRoute).slice(0, 1), buildReq('POST', { headers: staffReqHeaders, body: { staff_no: 'X', full_name: 'Y' } }));
    assert(postAsStaff.status === 403, 'Low-privilege staff cannot POST employees', `got ${postAsStaff.status}`);

    const getAsStaff = await invokeHandlers(routeHandlers(getRoute).slice(0, 1), buildReq('GET', { headers: { authorization: staff.authorization } }));
    assert(getAsStaff.allowed === true && getAsStaff.status === 200, 'Authenticated staff may read employees (estate-scoped)', `status=${getAsStaff.status} allowed=${getAsStaff.allowed}`);

    assert(/\.eq\('estate_id',\s*scopeEstate\)/.test(employeesSrc), 'employees read is scoped by validated estate');
    assert(/estate_id:\s*estateId/.test(employeesSrc), 'employees write forces estate_id from validated session');
    assert(/FORBIDDEN_ESTATE/.test(employeesSrc), 'employees mutation enforces cross-estate guard');

    const universalOne = AuthService.verifyPassword('unknown_identity_p1_1', 'Ipds#2026!');
    const universalTwo = AuthService.verifyPassword('unknown_identity_p1_1', 'Ipds#2026Admin!');
    assert(universalOne === null, 'Universal master password "Ipds#2026!" no longer authenticates', 'expected null');
    assert(universalTwo === null, 'Universal master password "Ipds#2026Admin!" no longer authenticates', 'expected null');

    const legitLogin = AuthService.verifyPassword('admin', 'Ipds#2026Admin!');
    assert(legitLogin !== null, 'Legitimate registry password login remains functional');

    const authSrc = read('src/server/services/auth.service.ts');
    assert(!/cleanPass === "Ipds#2026Admin!"/.test(authSrc), 'auth.service.ts no longer contains the master-password fallback branch');

    const useAuthSrc = read('src/features/auth/hooks/useAuth.ts');
    assert(!/cleanPass === "Ipds#2026Admin!"/.test(useAuthSrc) && !/cleanPass === "Ipds#2026!"/.test(useAuthSrc), 'useAuth.ts no longer contains the client master-password fallback');

    assert(!/getSupabase\(\)/.test(read('src/server/routes/hujan.routes.ts')), 'hujan.routes.ts no longer falls back to the privileged client');
    assert(!/getSupabase\(\)/.test(read('src/server/routes/penggredan.routes.ts')), 'penggredan.routes.ts no longer falls back to the privileged client');
  } finally {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k] as string;
    }
  }

  return { passed, total, failedTests };
}
