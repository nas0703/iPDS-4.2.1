/**
 * iPDS v4.1.0 — Test Module 33: P0-11-F Error-Message Disclosure Hardening
 *
 * Proves that API handlers no longer serialize raw internal exception text to
 * clients, that getSafeErrorMessage() maps unexpected errors to a generic
 * message while preserving operational AppError messages, and that the
 * hardened route files no longer build responses from raw err.message.
 */

import fs from 'fs';
import path from 'path';
import { getSafeErrorMessage, AppError } from '../../../src/server/utils/errorUtils.js';
import jobsRoutes from '../../../src/server/routes/jobs.routes.js';
import { jobQueueService } from '../../../src/server/services/jobQueue.service.js';
import { authHeaders } from '../helpers/authTestTokens.js';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function findRoute(method: 'post', exactPath: string) {
  const stack = (jobsRoutes as any).stack || [];
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
    originalUrl: '/api/jobs/dispatch',
    url: '/api/jobs/dispatch',
    path: '/api/jobs/dispatch',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

const PIN_STAFF = authHeaders('123456');
const SENSITIVE = 'SECRET_INTERNAL_SQL_ERROR_relation_users_does_not_exist';

const HARDENED_FILES = [
  'src/server/routes/hujan.routes.ts',
  'src/server/routes/penggredan.routes.ts',
  'src/server/routes/settings.routes.ts',
  'src/server/routes/slides.routes.ts',
  'src/server/routes/jobs.routes.ts'
];

export async function runErrorMessageHardeningTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 33: P0-11-F ERROR-MESSAGE DISCLOSURE HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 33.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 33.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 33.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // 1. getSafeErrorMessage behavior
  {
    assert(getSafeErrorMessage(new Error(SENSITIVE)) === 'Ralat dalaman pelayan. Sila cuba lagi.',
      'Unexpected Error is mapped to the generic fallback');
    assert(getSafeErrorMessage(new Error(SENSITIVE), 'Custom fallback.') === 'Custom fallback.',
      'Custom fallback is honored for unexpected errors');
    assert(getSafeErrorMessage(SENSITIVE) === 'Ralat dalaman pelayan. Sila cuba lagi.',
      'String throwables are mapped to the generic fallback');
    assert(getSafeErrorMessage(null) === 'Ralat dalaman pelayan. Sila cuba lagi.',
      'Null/undefined errors are mapped to the generic fallback');
    assert(getSafeErrorMessage(new AppError('Sesi tamat', 401, 'UNAUTHORIZED')) === 'Sesi tamat',
      'Operational AppError message is preserved');
    assert(!getSafeErrorMessage(new Error(SENSITIVE)).includes('SECRET'), 'Generic message does not leak the raw error text');
  }

  // 2. Runtime handler proof: a real handler's catch path returns a generic message
  {
    const route = findRoute('post', '/jobs/dispatch');
    assert(!!route, 'POST /jobs/dispatch route is registered');

    const originalDispatch = jobQueueService.dispatchJob.bind(jobQueueService);
    (jobQueueService as any).dispatchJob = async () => {
      throw new Error(SENSITIVE);
    };

    try {
      const result = await invokeHandlers(
        routeHandlers(route),
        buildReq('POST', PIN_STAFF, { type: 'TEST_ERROR_HARDENING' })
      );
      const serialized = JSON.stringify(result.body || {});
      assert(result.status === 500, 'Handler returns 500 on internal error', `got ${result.status}`);
      assert(
        result.body?.error === 'Gagal mendaftarkan tugasan latar belakang.',
        'Handler returns the generic fallback message',
        `got ${JSON.stringify(result.body)}`
      );
      assert(!serialized.includes('SECRET') && !serialized.includes(SENSITIVE),
        'Handler response does not expose raw internal error text');
    } finally {
      (jobQueueService as any).dispatchJob = originalDispatch;
    }
  }

  // 3. Source guards: hardened files no longer serialize raw err.message
  {
    for (const f of HARDENED_FILES) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf-8');
      const rawInResponse = /error:\s*(err|e)\??\.message|error:\s*getErrorMessage\((err|e)\)|message:\s*(err|e)\??\.message/.test(src);
      assert(!rawInResponse, `${f} does not build responses from raw err.message`);
      assert(src.includes('getSafeErrorMessage'), `${f} uses getSafeErrorMessage`);
    }
  }

  console.log(`\nMODULE 33 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/error_message_hardening.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /error_message_hardening\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runErrorMessageHardeningTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-11-F error message hardening suite execution error:', err);
      process.exit(1);
    });
}
