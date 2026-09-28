/**
 * iPDS v4.1.0 — Test Module 29: P0-11-B Telemetry Threshold Authorization
 *
 * Verifies that POST /api/telemetry/thresholds requires an elevated role
 * (pf/fc/oc/rc) and is no longer callable by any authenticated low-privilege
 * role, while preserving the existing handler behavior.
 */

import fs from 'fs';
import path from 'path';
import telemetryRoutes from '../../../src/server/routes/telemetry.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function findRoute(method: 'post', exactPath: string) {
  const stack = (telemetryRoutes as any).stack || [];
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

function buildReq(headers: Record<string, string> = {}, body: any = {}): any {
  return {
    method: 'POST',
    headers,
    cookies: {},
    query: {},
    body,
    ip: '127.0.0.1',
    originalUrl: '/api/telemetry/thresholds',
    url: '/api/telemetry/thresholds',
    path: '/api/telemetry/thresholds',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

// PIN -> role mapping from the server SSOT (origin/main auth.service PIN_USERS_CONFIG)
const PIN_STAFF = authHeaders('123456');  // staff
const PIN_MANDUR = authHeaders('222222'); // mandur
const PIN_EQI = authHeaders('999999');    // eqi
const PIN_PF = authHeaders('888888');     // pf
const PIN_FC = authHeaders('2401199');    // fc
const PIN_OC = authHeaders('333333');     // oc
const PIN_RC = authHeaders('111111');     // rc

export async function runTelemetryAuthzTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 29: P0-11-B TELEMETRY THRESHOLD AUTHORIZATION');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 29.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 29.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 29.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const route = findRoute('post', '/thresholds');
  assert(!!route, 'POST /api/telemetry/thresholds route is registered');

  const gate = routeHandlers(route).slice(0, 1); // requireRole

  // 1. Unauthenticated -> 401
  {
    const result = await invokeHandlers(gate, buildReq());
    assert(result.status === 401, 'Unauthenticated threshold update returns 401', `got ${result.status}`);
  }

  // 2. Low-privilege roles -> 403
  {
    const denied: Array<[string, Record<string, string>]> = [
      ['staff', PIN_STAFF],
      ['mandur', PIN_MANDUR],
      ['eqi', PIN_EQI]
    ];
    for (const [label, headers] of denied) {
      const result = await invokeHandlers(gate, buildReq(headers));
      assert(result.status === 403, `Low-privilege role '${label}' is denied (403)`, `got ${result.status}`);
    }
  }

  // 3. Elevated roles -> allowed
  {
    const allowedRoles: Array<[string, Record<string, string>]> = [
      ['pf', PIN_PF],
      ['fc', PIN_FC],
      ['oc', PIN_OC],
      ['rc', PIN_RC]
    ];
    for (const [label, headers] of allowedRoles) {
      const result = await invokeHandlers(gate, buildReq(headers, { errorRate5xxCrit: 50 }));
      assert(result.allowed, `Elevated role '${label}' is allowed`, `status=${result.status}`);
    }
  }

  // 4. Source guard: the route is registered with requireRole(['pf','fc','oc','rc'])
  {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/telemetry.routes.ts'), 'utf-8');
    assert(
      /router\.post\('\/thresholds',\s*requireRole\(\[[^\]]*'pf'[^\]]*'fc'[^\]]*'oc'[^\]]*'rc'[^\]]*\]\)/.test(src),
      "POST /thresholds is guarded by requireRole(['pf','fc','oc','rc'])"
    );
    assert(
      !/router\.post\('\/thresholds',\s*requireAuth/.test(src),
      'POST /thresholds no longer uses requireAuth only'
    );
  }

  console.log(`\nMODULE 29 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/telemetry_authz.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /telemetry_authz\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runTelemetryAuthzTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-11-B telemetry authz suite execution error:', err);
      process.exit(1);
    });
}
