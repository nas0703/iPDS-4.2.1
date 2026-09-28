/**
 * iPDS v4.1.0 — Test Module 34: P0-12 Error-Message Disclosure Sweep
 *
 * Verifies the remaining same-class raw-error disclosures were removed from the
 * fertilizer, merumput, workers, telemetry, RAG and cron route handlers, and
 * that representative handlers return a generic message (not internal details).
 */

import fs from 'fs';
import path from 'path';
import cronRoutes from '../../../src/server/routes/cron.routes.js';
import telemetryRoutes from '../../../src/server/routes/telemetry.routes.js';
import { jobQueueService } from '../../../src/server/services/jobQueue.service.js';
import { alertManager } from '../../../src/server/observability/alerts.js';
import { DEV_DEFAULT_CRON_SECRET } from '../../../src/server/middleware/cronAuth.js';
import { authHeaders } from '../helpers/authTestTokens.js';

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

function buildReq(method: string, headers: Record<string, string> = {}, body: any = {}): any {
  return {
    method,
    headers,
    cookies: {},
    query: {},
    body,
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

const SENSITIVE = 'SECRET_INTERNAL_SQL_ERROR_relation_xyz_does_not_exist';
const PIN_STAFF = authHeaders('123456');

const SWEPT_FILES = [
  'src/server/routes/fertilizer.routes.ts',
  'src/server/routes/merumput.routes.ts',
  'src/server/routes/workers.routes.ts',
  'src/server/routes/telemetry.routes.ts',
  'src/server/routes/ai/rag.routes.ts',
  'src/server/routes/cron.routes.ts'
];

export async function runErrorMessageSweepTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 34: P0-12 ERROR-MESSAGE DISCLOSURE SWEEP');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 34.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 34.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 34.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // 1. Source guards for every swept file
  {
    for (const f of SWEPT_FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf-8');
      const rawInResponse = /(error|details|message):\s*(err|e|error)\??\.message/.test(src);
      assert(!rawInResponse, `${f} does not build responses from raw err.message`);
      assert(src.includes('getSafeErrorMessage'), `${f} uses getSafeErrorMessage`);
    }
  }

  // 2. Runtime: cron handler catch returns a generic message
  {
    const route = findRoute(cronRoutes, 'get', '/cron/process-jobs');
    assert(!!route, 'GET /cron/process-jobs route is registered');

    const originalProcessBatch = jobQueueService.processBatch.bind(jobQueueService);
    (jobQueueService as any).processBatch = async () => {
      throw new Error(SENSITIVE);
    };

    try {
      const result = await invokeHandlers(
        routeHandlers(route),
        buildReq('GET', { 'x-cron-secret': DEV_DEFAULT_CRON_SECRET })
      );
      const serialized = JSON.stringify(result.body || {});
      assert(result.status === 500, 'Cron handler returns 500 on internal error', `got ${result.status}`);
      assert(result.body?.message === 'Internal processing exception',
        'Cron handler returns the generic message', `got ${JSON.stringify(result.body)}`);
      assert(!serialized.includes('SECRET'), 'Cron response does not expose raw internal error text');
    } finally {
      (jobQueueService as any).processBatch = originalProcessBatch;
    }
  }

  // 3. Runtime: telemetry alerts/test handler catch returns a generic message
  {
    const route = findRoute(telemetryRoutes, 'post', '/alerts/test');
    assert(!!route, 'POST /telemetry/alerts/test route is registered');

    const originalDispatch = alertManager.dispatchTestNotification.bind(alertManager);
    (alertManager as any).dispatchTestNotification = async () => {
      throw new Error(SENSITIVE);
    };

    try {
      const result = await invokeHandlers(
        routeHandlers(route),
        buildReq('POST', PIN_STAFF, { reason: 'test' })
      );
      const serialized = JSON.stringify(result.body || {});
      assert(result.status === 500, 'Telemetry alerts/test returns 500 on internal error', `got ${result.status}`);
      assert(result.body?.message === 'Ralat dalaman pelayan. Sila cuba lagi.',
        'Telemetry alerts/test returns the generic message', `got ${JSON.stringify(result.body)}`);
      assert(!serialized.includes('SECRET'), 'Telemetry response does not expose raw internal error text');
    } finally {
      (alertManager as any).dispatchTestNotification = originalDispatch;
    }
  }

  console.log(`\nMODULE 34 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/error_message_sweep.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /error_message_sweep\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runErrorMessageSweepTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-12 error message sweep suite execution error:', err);
      process.exit(1);
    });
}
