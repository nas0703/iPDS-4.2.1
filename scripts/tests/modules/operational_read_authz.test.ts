/**
 * iPDS v4.1.0 — Test Module 27: P0-10 Operational Read Authorization Hardening
 *
 * Verifies that operational read endpoints (merumput, pruning, penggredan,
 * hantaran, slides) and sensitive health endpoints (/db, /backup) require
 * mandatory authentication (401) and appropriate role authorization (403),
 * and that client-supplied estate values cannot override the authenticated
 * session estate.
 */

import fs from 'fs';
import path from 'path';
import merumputRoutes from '../../../src/server/routes/merumput.routes.js';
import pruningRoutes from '../../../src/server/routes/pruning.routes.js';
import penggredanRoutes from '../../../src/server/routes/penggredan.routes.js';
import hantaranRoutes from '../../../src/server/routes/hantaran.routes.js';
import slidesRoutes from '../../../src/server/routes/slides.routes.js';
import healthRoutes from '../../../src/server/routes/health.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

type HttpMethod = 'get';

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

const GATE = 1;
const STAFF = authHeaders('123456'); // staff, FPM_TUNGGAL
const FC = authHeaders('2401199');   // fc (admin role for health)
const RC = authHeaders('111111');    // rc (cross-estate)

export async function runOperationalReadAuthzTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 27: P0-10 OPERATIONAL READ AUTHORIZATION HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 27.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 27.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 27.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const operational: Array<[string, any]> = [
    ['GET /merumput/progress', findRoute(merumputRoutes, 'get', ['/merumput/progress'])],
    ['GET /merumput/inventory', findRoute(merumputRoutes, 'get', ['/merumput/inventory'])],
    ['GET /merumput/inventory/transactions', findRoute(merumputRoutes, 'get', ['/merumput/inventory/transactions'])],
    ['GET /pruning', findRoute(pruningRoutes, 'get', ['/pruning'])],
    ['GET /penggredan', findRoute(penggredanRoutes, 'get', ['/penggredan'])],
    ['GET /hantaran', findRoute(hantaranRoutes, 'get', ['/hantaran'])],
    ['GET /annual-yield', findRoute(hantaranRoutes, 'get', ['/annual-yield'])],
    ['GET /block-annual-yields', findRoute(hantaranRoutes, 'get', ['/block-annual-yields'])],
    ['GET /slides/decks', findRoute(slidesRoutes, 'get', ['/slides/decks'])]
  ];

  const health: Array<[string, any]> = [
    ['GET /health/db', findRoute(healthRoutes, 'get', ['/db'])],
    ['GET /health/backup', findRoute(healthRoutes, 'get', ['/backup'])]
  ];

  assert(operational.every(([, r]) => !!r) && health.every(([, r]) => !!r),
    'All targeted operational read + health routes are registered');

  // 1. Unauthenticated -> 401
  for (const [label, route] of [...operational, ...health]) {
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq('GET'));
    assert(result.status === 401, `Unauthenticated ${label} returns 401`, `got ${result.status}`);
  }

  // 2. Authorized users -> allowed (operational reads, staff)
  for (const [label, route] of operational) {
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq('GET', { headers: STAFF }));
    assert(result.allowed, `Authenticated user allowed for ${label}`, `status=${result.status}`);
  }

  // 3. Health endpoints require elevated role: staff 403, admin allowed
  for (const [label, route] of health) {
    const denied = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq('GET', { headers: STAFF }));
    assert(denied.status === 403, `Non-admin cannot access ${label} (403)`, `got ${denied.status}`);

    const allowed = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq('GET', { headers: FC }));
    assert(allowed.allowed, `Authorized admin can access ${label}`);
  }

  // 4. Estate isolation on hantaran read (staff)
  {
    const route = findRoute(hantaranRoutes, 'get', ['/hantaran']);

    const queryOverride = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq('GET', { headers: STAFF, query: { estate_id: 'FPM_ADELA' } }));
    assert(queryOverride.status === 403, 'Single-estate user cannot override estate via query estate_id (403)', `got ${queryOverride.status}`);

    const queryIdOverride = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq('GET', { headers: STAFF, query: { estateId: 'FPM_ADELA' } }));
    assert(queryIdOverride.status === 403, 'Single-estate user cannot override estate via query estateId (403)', `got ${queryIdOverride.status}`);

    const headerOverride = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq('GET', { headers: { ...STAFF, 'x-estate-id': 'FPM_ADELA' } }));
    assert(
      !headerOverride.allowed && (headerOverride.status === 401 || headerOverride.status === 403),
      'Single-estate user cannot override estate via x-estate-id (rejected)',
      `got ${headerOverride.status}`
    );

    const allEstate = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq('GET', { headers: STAFF, query: { estate_id: 'ALL' } }));
    assert(allEstate.status === 403, 'estateId=ALL rejected for single-estate role (403)', `got ${allEstate.status}`);
  }

  // 5. Legitimate cross-estate role (rc) can request another estate
  {
    const route = findRoute(hantaranRoutes, 'get', ['/hantaran']);
    const req = buildReq('GET', { headers: { ...RC, 'x-estate-id': 'FPM_ADELA' } });
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), req);
    assert(
      result.allowed && String(req.estateId).toUpperCase() === 'FPM_ADELA',
      'Cross-estate role (rc) can access permitted estate and binds to it',
      `estateId=${req.estateId}, status=${result.status}`
    );
  }

  // 6. Source guards
  {
    const files = [
      'src/server/routes/merumput.routes.ts',
      'src/server/routes/pruning.routes.ts',
      'src/server/routes/penggredan.routes.ts',
      'src/server/routes/hantaran.routes.ts',
      'src/server/routes/slides.routes.ts'
    ];
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf-8');
      if (/\bauthenticate\b/.test(src)) offenders.push(f);
    }
    assert(offenders.length === 0, 'Operational read route files no longer use optional authenticate', offenders.join(', '));

    const healthSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/health.routes.ts'), 'utf-8');
    assert(
      /router\.get\('\/db',\s*requireRole\(/.test(healthSrc) &&
      /router\.get\('\/backup',\s*requireRole\(/.test(healthSrc),
      'Health /db and /backup require an elevated role'
    );
    assert(/router\.get\('\/live'/.test(healthSrc) || /router\.get\('\/'/.test(healthSrc),
      'Harmless health endpoints remain available (liveness)');
  }

  console.log(`\nMODULE 27 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/operational_read_authz.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /operational_read_authz\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runOperationalReadAuthzTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-10 operational read authz suite execution error:', err);
      process.exit(1);
    });
}
