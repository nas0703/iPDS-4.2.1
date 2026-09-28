/**
 * iPDS v4.1.0 — Test Module 35: P0-13 Final Error-Message Sweep
 *
 * Verifies the remaining client-facing raw error disclosures in the hasil,
 * pruning and vision route handlers were removed, using getSafeErrorMessage,
 * and that the real handlers return a generic message on internal failure.
 */

import fs from 'fs';
import path from 'path';
import { getSafeErrorMessage, AppError } from '../../../src/server/utils/errorUtils.js';
import hasilRoutes from '../../../src/server/routes/hasil.routes.js';
import pruningRoutes from '../../../src/server/routes/pruning.routes.js';
import visionRoutes from '../../../src/server/routes/ai/vision.routes.js';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function findRoute(router: any, method: 'get' | 'post', exactPath: string) {
  const stack = (router as any).stack || [];
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

function throwingProxy(): any {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(SENSITIVE);
      }
    }
  );
}

function buildReq(overrides: Partial<Record<string, any>> = {}): any {
  return {
    method: 'GET',
    headers: {},
    cookies: {},
    query: {},
    body: {},
    ip: '127.0.0.1',
    originalUrl: '/api',
    url: '/api',
    path: '/api',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    },
    ...overrides
  };
}

const SENSITIVE = 'SECRET_INTERNAL_SQL_ERROR_relation_xyz_does_not_exist';
const GENERIC = 'Ralat dalaman pelayan. Sila cuba lagi.';

const SWEPT_FILES = [
  'src/server/routes/hasil.routes.ts',
  'src/server/routes/pruning.routes.ts',
  'src/server/routes/ai/vision.routes.ts'
];

export async function runErrorMessageFinalSweepTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 35: P0-13 FINAL ERROR-MESSAGE SWEEP');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 35.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 35.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 35.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // 1. getSafeErrorMessage behavior
  {
    assert(getSafeErrorMessage(new Error(SENSITIVE)) === GENERIC, 'Unexpected Error maps to the generic fallback');
    assert(getSafeErrorMessage(new AppError('Sesi tamat', 401, 'UNAUTHORIZED')) === 'Sesi tamat', 'AppError message is preserved');
    assert(!getSafeErrorMessage(new Error(SENSITIVE)).includes('SECRET'), 'Generic message does not leak raw text');
  }

  // 2. Source guards
  {
    for (const f of SWEPT_FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf-8');
      const rawInResponse = /(error|details|message):\s*(err|e|error)\??\.message|getErrorMessage\(/.test(src);
      assert(!rawInResponse, `${f} contains no client-facing raw error disclosure`);
      assert(src.includes('getSafeErrorMessage'), `${f} uses getSafeErrorMessage`);
    }
  }

  // 3. Runtime handler error-path proofs (force an internal throw inside the handler)
  {
    const cases: Array<[string, any, 'get' | 'post', string, string, string, 'query' | 'body' | 'estateId']> = [
      ['GET /hasil/abw', hasilRoutes, 'get', '/hasil/abw', 'error', 'Ralat memproses data hasil.', 'estateId'],
      ['POST /pruning/batch', pruningRoutes, 'post', '/pruning/batch', 'error', 'Ralat memproses data pruning.', 'body'],
      ['POST /diagnose-weed-image', visionRoutes, 'post', '/diagnose-weed-image', 'details', GENERIC, 'body']
    ];

    for (const [label, router, method, routePath, field, expected, source] of cases) {
      const route = findRoute(router, method, routePath);
      assert(!!route, `${label} route is registered`);
      const handler = routeHandlers(route).slice(-1); // the handler only
      let req: any;
      if (source === 'body') {
        req = buildReq({ method: 'POST', body: throwingProxy() });
      } else if (source === 'estateId') {
        req = buildReq();
        Object.defineProperty(req, 'estateId', {
          configurable: true,
          get() {
            throw new Error(SENSITIVE);
          }
        });
      } else {
        req = buildReq({ query: throwingProxy() });
      }

      const result = await invokeHandlers(handler, req);
      const serialized = JSON.stringify(result.body || {});
      assert(result.status === 500, `${label} returns 500 on internal error`, `got ${result.status}`);
      assert(
        result.body?.[field] === expected,
        `${label} returns the generic message in '${field}'`,
        `got ${JSON.stringify(result.body)}`
      );
      assert(!serialized.includes('SECRET'), `${label} response does not expose raw internal error text`);
    }
  }

  console.log(`\nMODULE 35 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/error_message_final_sweep.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /error_message_final_sweep\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runErrorMessageFinalSweepTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-13 error message final sweep suite execution error:', err);
      process.exit(1);
    });
}
