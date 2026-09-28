/**
 * iPDS v4.1.0 — Test Module 30: P0-11-C Worker Mutation Authorization
 *
 * Verifies that worker/work-assignment mutation endpoints require the
 * elevated pf/fc role, reject unauthenticated and low-privilege callers,
 * and preserve tenant/estate isolation.
 */

import fs from 'fs';
import path from 'path';
import workersRoutes from '../../../src/server/routes/workers.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

type Method = 'post' | 'delete';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function findRoute(method: Method, exactPath: string) {
  const stack = (workersRoutes as any).stack || [];
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
    originalUrl: '/api/workers',
    url: '/api/workers',
    path: '/api/workers',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

const PIN_STAFF = authHeaders('123456');
const PIN_MANDUR = authHeaders('222222');
const PIN_EQI = authHeaders('999999');
const PIN_PF = authHeaders('888888');
const PIN_FC = authHeaders('2401199');
// FC Tunggal (2401199) is the designated cross-estate Super Admin; branch FCs
// (e.g. FC Adela 600300) are the true single-estate role used for isolation checks.
const PIN_FC_BRANCH = authHeaders('600300');

export async function runWorkersAuthzTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 30: P0-11-C WORKER MUTATION AUTHORIZATION');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 30.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 30.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 30.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const mutations: Array<[string, Method, string, string]> = [
    ['POST /workers', 'post', '/workers', 'POST'],
    ['DELETE /workers/:id', 'delete', '/workers/:id', 'DELETE'],
    ['DELETE /work-assignments', 'delete', '/work-assignments', 'DELETE']
  ];

  const resolved = mutations.map(([label, method, p, http]) => ({
    label,
    http,
    route: findRoute(method, p)
  }));

  assert(resolved.every((r) => !!r.route), 'All targeted worker mutation routes are registered');

  // Unauthenticated -> 401
  for (const { label, http, route } of resolved) {
    const result = await invokeHandlers(routeHandlers(route).slice(0, 1), buildReq(http));
    assert(result.status === 401, `Unauthenticated ${label} returns 401`, `got ${result.status}`);
  }

  // Low-privilege roles -> 403
  for (const [role, headers] of [['staff', PIN_STAFF], ['mandur', PIN_MANDUR], ['eqi', PIN_EQI]] as Array<[string, any]>) {
    for (const { label, http, route } of resolved) {
      const result = await invokeHandlers(routeHandlers(route).slice(0, 1), buildReq(http, { headers }));
      assert(result.status === 403, `Role '${role}' denied on ${label} (403)`, `got ${result.status}`);
    }
  }

  // Elevated roles -> allowed
  for (const [role, headers] of [['pf', PIN_PF], ['fc', PIN_FC]] as Array<[string, any]>) {
    for (const { label, http, route } of resolved) {
      const result = await invokeHandlers(routeHandlers(route).slice(0, 1), buildReq(http, { headers }));
      assert(result.allowed, `Role '${role}' allowed on ${label}`, `status=${result.status}`);
    }
  }

  // Tenant isolation: authorized single-estate branch fc cannot target another estate
  {
    const route = findRoute('delete', '/workers/:id');
    const result = await invokeHandlers(
      routeHandlers(route).slice(0, 1),
      buildReq('DELETE', { headers: PIN_FC_BRANCH, query: { estate_id: 'FPM_TUNGGAL' } })
    );
    assert(result.status === 403, 'Single-estate role cannot target another estate (403)', `got ${result.status}`);
  }

  // Source guards
  {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/workers.routes.ts'), 'utf-8');
    const writeGuards = (src.match(/router\.(post|delete)\('[^']*',\s*requireRole\(\['pf',\s*'fc'\]\)/g) || []).length;
    assert(writeGuards >= 3, 'Worker mutation routes use requireRole([pf, fc])', `found ${writeGuards}`);
    assert(!/router\.post\('\/workers',\s*requireAuth/.test(src) && !/router\.delete\('\/workers\/:id',\s*requireAuth/.test(src),
      'Worker mutations no longer use requireAuth only');
    // Read endpoints must remain unchanged (requireAuth)
    assert(/router\.get\('\/workers',\s*requireAuth/.test(src) && /router\.get\('\/work-assignments',\s*requireAuth/.test(src),
      'Worker read endpoints remain requireAuth');
  }

  console.log(`\nMODULE 30 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/workers_authz.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /workers_authz\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runWorkersAuthzTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-11-C workers authz suite execution error:', err);
      process.exit(1);
    });
}
