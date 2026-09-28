/**
 * iPDS v4.1.0 — Test Module 31: P0-11-D Logo SSRF Hardening
 *
 * Verifies that POST /api/settings/logo no longer accepts/fetches client-supplied
 * http(s) URLs, that only inline data:image/* payloads are accepted, that the
 * FC authorization gate is preserved, and that no server-side fetch of
 * client-controlled URLs remains.
 */

import fs from 'fs';
import path from 'path';
import settingsRoutes, { parseLogoDataUri, LOGO_MAX_BYTES } from '../../../src/server/routes/settings.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function findRoute(method: 'post' | 'delete', exactPath: string) {
  const stack = (settingsRoutes as any).stack || [];
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
    originalUrl: '/api/settings/logo',
    url: '/api/settings/logo',
    path: '/api/settings/logo',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

const PIN_STAFF = authHeaders('123456');
const PIN_FC = authHeaders('2401199');

const VALID_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

export async function runLogoSSRFTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 31: P0-11-D LOGO SSRF HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 31.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 31.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 31.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const route = findRoute('post', '/logo');
  assert(!!route, 'POST /api/settings/logo route is registered');

  const gate = routeHandlers(route).slice(0, 1); // requireRole(['fc'])

  // 1. Authorization gate preserved
  {
    const unauth = await invokeHandlers(gate, buildReq('POST'));
    assert(unauth.status === 401, 'Unauthenticated logo update returns 401', `got ${unauth.status}`);

    const staff = await invokeHandlers(gate, buildReq('POST', PIN_STAFF));
    assert(staff.status === 403, 'Non-FC role is denied (403)', `got ${staff.status}`);

    const fc = await invokeHandlers(gate, buildReq('POST', PIN_FC));
    assert(fc.allowed, 'FC role passes the authorization gate', `status=${fc.status}`);
  }

  // 2. SSRF URL rejection (parseLogoDataUri)
  {
    const rejected = [
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
      'http://localhost:3000/internal.png',
      'http://127.0.0.1/logo.png',
      'http://10.0.0.5/logo.png',
      'http://192.168.1.1/logo.png',
      'https://evil.example.com/logo.png',
      '//evil.example.com/logo.png',
      'file:///etc/passwd',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='.replace('image/svg+xml', 'text/plain')
    ];
    for (const value of rejected) {
      assert(parseLogoDataUri(value) === null, `Rejected non-data/non-image logo input: ${value.slice(0, 40)}`);
    }
  }

  // 3. Valid data:image acceptance
  {
    const parsed = parseLogoDataUri(VALID_PNG);
    assert(!!parsed && parsed.mime === 'image/png' && parsed.buffer.length > 0,
      'Valid data:image/png is accepted');
    assert(parseLogoDataUri('data:image/jpeg;base64,/9j/4AAQSkZJRg==') !== null, 'Valid data:image/jpeg is accepted');
  }

  // 4. Oversized payload rejection
  {
    const oversized = 'data:image/png;base64,' + 'A'.repeat(LOGO_MAX_BYTES * 2);
    assert(parseLogoDataUri(oversized) === null, 'Oversized base64 logo payload is rejected');
  }

  // 5. Handler rejects a client-supplied URL (full chain, no side effects)
  {
    const result = await invokeHandlers(
      routeHandlers(route),
      buildReq('POST', PIN_FC, { logoUrl: 'http://169.254.169.254/latest/meta-data/' })
    );
    assert(
      result.status === 400 && result.body?.code === 'INVALID_LOGO_FORMAT',
      'Handler rejects SSRF URL with 400 INVALID_LOGO_FORMAT',
      `got ${result.status} ${JSON.stringify(result.body)}`
    );
  }

  // 6. Source guard: no server-side fetch of client-controlled URLs
  {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/settings.routes.ts'), 'utf-8');
    assert(!/fetch\s*\(/.test(src), 'settings.routes.ts contains no server-side fetch()');
    assert(src.includes('parseLogoDataUri') && src.includes('INVALID_LOGO_FORMAT'),
      'settings.routes.ts uses SSRF-safe logo parsing/validation');
    assert(!/startsWith\('http'\)/.test(src), 'No client-supplied http URL branch remains in logo generation');
  }

  console.log(`\nMODULE 31 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/logo_ssrf.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /logo_ssrf\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runLogoSSRFTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-11-D logo SSRF suite execution error:', err);
      process.exit(1);
    });
}
