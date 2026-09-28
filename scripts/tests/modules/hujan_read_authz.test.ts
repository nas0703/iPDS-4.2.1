/**
 * iPDS v4.1.0 — Test Module 32: P0-11-E Hujan Read Authorization
 *
 * Verifies that GET rainfall endpoints require mandatory authentication,
 * derive the estate exclusively from the validated session (req.estateId),
 * enforce tenant isolation, and that the effective Express/serverless route
 * aliases are protected (routing caveat /api/hujan vs /api/hujan/hujan).
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import hujanRoutes from '../../../src/server/routes/hujan.routes.js';
import { requireAuth } from '../../../src/server/middleware/auth.js';
import { authHeaders } from '../helpers/authTestTokens.js';

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
    setTimeout(() => finish(false), 5000);
  });
}

function buildReq(headers: Record<string, string> = {}, query: any = {}): any {
  return {
    method: 'GET',
    headers,
    cookies: {},
    query,
    body: {},
    ip: '127.0.0.1',
    originalUrl: '/api/hujan',
    url: '/api/hujan',
    path: '/api/hujan',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

function httpGet(port: number, requestPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    http
      .get({ host: '127.0.0.1', port, path: requestPath }, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => resolve({ status: r.statusCode || 0, body: d }));
      })
      .on('error', (e) => resolve({ status: 0, body: String(e.message) }));
  });
}

const PIN_STAFF = authHeaders('123456');
const PIN_RC = authHeaders('111111');

export async function runHujanReadAuthzTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 32: P0-11-E HUJAN READ AUTHORIZATION');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 32.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 32.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 32.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // 1. Route registration guard
  {
    const stack = (hujanRoutes as any).stack || [];
    const route = stack.find((l: any) => {
      const p = l.route?.path;
      const paths = Array.isArray(p) ? p : [p];
      return l.route?.methods?.get && paths.includes('/hujan');
    });
    assert(!!route, 'GET /hujan route is registered');
    const handlers = (route?.route?.stack || []).map((s: any) => s.handle);
    assert(handlers[0]?.name === 'requireAuth', 'GET /hujan is guarded by requireAuth (first handler)');
  }

  // 2. Effective-route harness (mirrors serverless mounts): proves which aliases are reachable/secured
  {
    const app = express();
    const apiRouter = express.Router();
    apiRouter.use('/hujan', hujanRoutes);
    app.use('/api', apiRouter);
    app.use('/', apiRouter);

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const port = (server.address() as any).port;

    try {
      const results: Array<[string, number]> = [];
      for (const p of ['/api/hujan', '/api/hujan/hujan', '/hujan/hujan', '/hujan/api/hujan', '/api/hujan/api/hujan']) {
        const r = await httpGet(port, p);
        results.push([p, r.status]);
      }
      const map = new Map(results);
      assert(map.get('/api/hujan') === 404, 'Routing caveat: /api/hujan is not matched (404)', `got ${map.get('/api/hujan')}`);
      assert(map.get('/api/hujan/hujan') === 401, 'Effective route /api/hujan/hujan requires auth (401)', `got ${map.get('/api/hujan/hujan')}`);
      assert(map.get('/hujan/hujan') === 401, 'Effective route /hujan/hujan requires auth (401)', `got ${map.get('/hujan/hujan')}`);
      assert(map.get('/hujan/api/hujan') === 401, 'Effective route /hujan/api/hujan requires auth (401)', `got ${map.get('/hujan/api/hujan')}`);
      assert(map.get('/api/hujan/api/hujan') === 401, 'Effective route /api/hujan/api/hujan requires auth (401)', `got ${map.get('/api/hujan/api/hujan')}`);
    } finally {
      server.close();
    }
  }

  // 3. Middleware auth + estate isolation
  {
    const unauth = await invokeMiddleware(requireAuth, buildReq());
    assert(unauth.status === 401, 'Unauthenticated GET /hujan returns 401', `got ${unauth.status}`);

    const staff = await invokeMiddleware(requireAuth, buildReq(PIN_STAFF));
    assert(staff.allowed, 'Authenticated single-estate user is allowed', `status=${staff.status}`);

    const queryOverride = await invokeMiddleware(requireAuth, buildReq(PIN_STAFF, { estate_id: 'FPM_ADELA' }));
    assert(queryOverride.status === 403, 'Single-estate user cannot override estate via query estate_id (403)', `got ${queryOverride.status}`);

    const queryIdOverride = await invokeMiddleware(requireAuth, buildReq(PIN_STAFF, { estateId: 'FPM_ADELA' }));
    assert(queryIdOverride.status === 403, 'Single-estate user cannot override estate via query estateId (403)', `got ${queryIdOverride.status}`);

    const headerOverride = await invokeMiddleware(requireAuth, buildReq({ ...PIN_STAFF, 'x-estate-id': 'FPM_ADELA' }));
    assert(
      !headerOverride.allowed && (headerOverride.status === 401 || headerOverride.status === 403),
      'Single-estate user cannot override estate via x-estate-id (rejected)',
      `got ${headerOverride.status}`
    );

    const allEstate = await invokeMiddleware(requireAuth, buildReq(PIN_STAFF, { estate_id: 'ALL' }));
    assert(allEstate.status === 403, 'estateId=ALL rejected for single-estate role (403)', `got ${allEstate.status}`);

    const rcReq = buildReq({ ...PIN_RC, 'x-estate-id': 'FPM_ADELA' });
    const rcResult = await invokeMiddleware(requireAuth, rcReq);
    assert(
      rcResult.allowed && String(rcReq.estateId).toUpperCase() === 'FPM_ADELA',
      'Cross-estate role (rc) is bound to the requested estate',
      `estateId=${rcReq.estateId}, status=${rcResult.status}`
    );
  }

  // 4. Source guards
  {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/hujan.routes.ts'), 'utf-8');
    assert(/router\.get\(\['\/hujan', '\/api\/hujan'\], requireAuth/.test(src), 'GET /hujan is registered with requireAuth');
    assert(!/extractUserFromRequest/.test(src), 'hujan routes no longer use optional extractUserFromRequest');
    assert(src.includes('req.estateId'), 'hujan read derives estate from req.estateId');
    assert(!/req\.query\??\.estate_id|req\.query\??\.estateId|req\.headers\??\.\['x-estate-id'\]/.test(src), 'hujan read does not trust client estate identifiers');
  }

  console.log(`\nMODULE 32 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/hujan_read_authz.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /hujan_read_authz\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runHujanReadAuthzTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-11-E hujan read authz suite execution error:', err);
      process.exit(1);
    });
}
