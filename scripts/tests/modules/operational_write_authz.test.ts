/**
 * iPDS v4.1.0 — Test Module 25: P0-08 Optional-Auth Write Hardening
 *
 * Verifies that the fertilizer operational endpoints and POST /hasil/backlog
 * now require mandatory authentication (401) and role authorization (403),
 * and that client-supplied estate values cannot override the authenticated
 * user's validated estate.
 */

import fs from 'fs';
import path from 'path';
import fertilizerRoutes from '../../../src/server/routes/fertilizer.routes.js';
import hasilRoutes from '../../../src/server/routes/hasil.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

type HttpMethod = 'get' | 'post' | 'put' | 'delete';

function findRoute(router: any, method: HttpMethod, exactPaths: string[]) {
  const stack = router?.stack || [];
  return stack.find((l: any) => {
    const p = l.route?.path;
    const paths = Array.isArray(p) ? p : [p];
    return l.route?.methods?.[method] && paths.some((x: string) => exactPaths.includes(x));
  });
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
    originalUrl: '/api',
    url: '/api',
    path: '/api',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

// Gate middleware count (single gate on all audited routes: requireAuth OR requireRole)
const GATE = 1;

const STAFF = authHeaders('123456'); // staff, FPM_TUNGGAL
const EQI = authHeaders('999999');   // eqi (not an operational write role)
const RC = authHeaders('111111');    // rc (cross-estate)

export async function runOperationalWriteAuthzTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 25: P0-08 OPTIONAL-AUTH WRITE HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 25.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 25.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 25.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const writeRoutes: Array<[string, HttpMethod, string[]]> = [
    ['POST /fertilizer/entries', 'post', ['/fertilizer/entries', '/entries']],
    ['PUT /fertilizer/entries/:id', 'put', ['/fertilizer/entries/:id', '/entries/:id']],
    ['DELETE /fertilizer/entries/:id', 'delete', ['/fertilizer/entries/:id', '/entries/:id']],
    ['POST /fertilizer/entries/batch', 'post', ['/fertilizer/entries/batch', '/entries/batch']],
    ['POST /fertilizer/master/batch', 'post', ['/fertilizer/master/batch', '/master/batch']],
    ['POST /fertilizer/inventory', 'post', ['/fertilizer/inventory', '/inventory']],
    ['POST /fertilizer/inventory/:id/transaction', 'post', ['/fertilizer/inventory/:id/transaction', '/inventory/:id/transaction', '/:id/transaction']],
    ['DELETE /fertilizer/inventory/transactions/:id', 'delete', ['/fertilizer/inventory/transactions/:id', '/inventory/transactions/:id', '/transactions/:id']],
    ['POST /hasil/backlog', 'post', ['/hasil/backlog']]
  ];

  const readRoutes: Array<[string, HttpMethod, string[]]> = [
    ['GET /fertilizer/entries', 'get', ['/fertilizer/entries', '/entries']],
    ['GET /fertilizer/inventory', 'get', ['/fertilizer/inventory', '/inventory']],
    ['GET /hasil/backlog', 'get', ['/hasil/backlog']]
  ];

  // Resolve routes
  const resolvedWrites = writeRoutes.map(([label, method, paths]) => {
    const router = paths[0].startsWith('/hasil') ? hasilRoutes : fertilizerRoutes;
    return { label, method, route: findRoute(router, method, paths) };
  });
  const resolvedReads = readRoutes.map(([label, method, paths]) => {
    const router = paths[0].startsWith('/hasil') ? hasilRoutes : fertilizerRoutes;
    return { label, method, route: findRoute(router, method, paths) };
  });

  assert(resolvedWrites.every((r) => !!r.route) && resolvedReads.every((r) => !!r.route),
    'All targeted fertilizer/hasil routes are registered');

  // Unauthenticated writes -> 401
  for (const { label, method, route } of resolvedWrites) {
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq(method));
    assert(result.status === 401, `Unauthenticated ${label} returns 401`, `got ${result.status}`);
  }

  // Unauthenticated reads -> 401
  for (const { label, method, route } of resolvedReads) {
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq(method));
    assert(result.status === 401, `Unauthenticated ${label} returns 401`, `got ${result.status}`);
  }

  // Non-authorized role (eqi) writes -> 403
  for (const { label, method, route } of resolvedWrites) {
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq(method, { headers: EQI }));
    assert(result.status === 403, `Non-authorized role cannot ${label} (403)`, `got ${result.status}`);
  }

  // Authorized operational role (staff) writes -> allowed
  for (const { label, method, route } of resolvedWrites) {
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq(method, { headers: STAFF }));
    assert(result.allowed, `Authorized role passes gate for ${label}`);
  }

  // Authorized reads (staff) -> allowed
  for (const { label, method, route } of resolvedReads) {
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq(method, { headers: STAFF }));
    assert(result.allowed, `Authenticated read allowed for ${label}`);
  }

  // Estate tampering: single-estate staff cannot target another estate.
  // (The PIN-header estate mismatch is rejected as 401 by the auth extractor;
  //  the JWT path is rejected as 403 by validateTenantAccess. Either is a block.)
  {
    const route = findRoute(fertilizerRoutes, 'post', ['/fertilizer/entries', '/entries']);
    const req = buildReq('POST', { headers: { ...STAFF, 'x-estate-id': 'FPM_ADELA' }, body: { estate_id: 'FPM_ADELA' } });
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), req);
    assert(
      !result.allowed && (result.status === 401 || result.status === 403),
      'Single-estate user cannot write to another estate (rejected)',
      `got ${result.status}`
    );
  }

  // estateId=ALL rejected for single-estate role
  {
    const route = findRoute(fertilizerRoutes, 'post', ['/fertilizer/entries', '/entries']);
    const req = buildReq('POST', { headers: STAFF, query: { estate_id: 'ALL' } });
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), req);
    assert(result.status === 403, 'estateId=ALL rejected for single-estate role (403)', `got ${result.status}`);
  }

  // Cross-estate role (rc) can target another estate and req.estateId is bound to it
  {
    const route = findRoute(fertilizerRoutes, 'post', ['/fertilizer/entries', '/entries']);
    const req = buildReq('POST', { headers: { ...RC, 'x-estate-id': 'FPM_ADELA' }, body: { estate_id: 'FPM_ADELA' } });
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), req);
    assert(result.allowed && String(req.estateId).toUpperCase() === 'FPM_ADELA',
      'Cross-estate role (rc) is bound to the requested estate', `estateId=${req.estateId}, status=${result.status}`);
  }

  // Estate binding: authenticated single-estate staff without override -> own estate
  {
    const route = findRoute(fertilizerRoutes, 'post', ['/fertilizer/entries', '/entries']);
    const req = buildReq('POST', { headers: STAFF, body: { estate_id: 'FPM_ADELA' } });
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), req);
    // Body-supplied FPM_ADELA must be rejected for a FPM_TUNGGAL staff member
    assert(result.status === 403, 'Client body estate_id cannot override session estate (403)', `got ${result.status}`);
  }

  // Source-level guards
  {
    const fertSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/fertilizer.routes.ts'), 'utf-8');
    const hasilSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/hasil.routes.ts'), 'utf-8');

    assert(!/\bauthenticate\b/.test(fertSrc), 'fertilizer routes no longer use optional authenticate');
    assert(!/\bauthenticate\b/.test(hasilSrc), 'hasil routes no longer use optional authenticate');
    assert(fertSrc.includes('requireRole(FERTILIZER_WRITE_ROLES)'), 'fertilizer writes are gated by requireRole');
    assert(fertSrc.includes('requireAuth'), 'fertilizer reads are gated by requireAuth');
    assert(/router\.post\("\/hasil\/backlog",\s*requireRole\(/.test(hasilSrc), 'POST /hasil/backlog is gated by requireRole');

    const clientEstateOverride = /(body\?\.estate_id|query\?\.estate_id|query\?\.estateId|payload\.estate_id|x-estate-id'\] as string)/.test(fertSrc)
      || /(body\?\.estate_id|query\?\.estate_id|x-estate-id'\] as string)/.test(hasilSrc);
    assert(!clientEstateOverride, 'Handlers derive estate from req.estateId only (no client override)');
  }

  console.log(`\nMODULE 25 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/operational_write_authz.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /operational_write_authz\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runOperationalWriteAuthzTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-08 operational write authz suite execution error:', err);
      process.exit(1);
    });
}
