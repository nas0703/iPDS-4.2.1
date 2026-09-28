/**
 * iPDS v4.1.0 — Test Module 26: P0-09 AI Endpoint Authorization Hardening
 *
 * Verifies that privileged AI/RAG/vision/evaluation endpoints require
 * authentication (401) and appropriate role authorization (403), that the
 * estate-chat endpoint derives its estate from the authenticated session
 * (never client input), and that no privileged AI route uses optional auth.
 */

import fs from 'fs';
import path from 'path';
import estateChatRoutes from '../../../src/server/routes/ai/estateChat.routes.js';
import visionRoutes from '../../../src/server/routes/ai/vision.routes.js';
import ragRoutes from '../../../src/server/routes/ai/rag.routes.js';
import evaluationRoutes from '../../../src/server/routes/ai/evaluation.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

type HttpMethod = 'get' | 'post';

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

const GATE = 1; // single requireRole gate

const STAFF = authHeaders('123456'); // staff (not an admin/diagnostic role)
const FC = authHeaders('2401199');   // fc (admin/diagnostic role)
const RC = authHeaders('111111');    // rc (cross-estate)

export async function runAiEndpointSecurityTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 26: P0-09 AI ENDPOINT AUTHORIZATION HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 26.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 26.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 26.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // Route resolution
  const estateChat = findRoute(estateChatRoutes, 'post', ['/ai/estate-chat', '/estate-chat', '/ai/data-chat', '/data-chat']);
  const ocrReceipt = findRoute(visionRoutes, 'post', ['/', '/ocr-receipt', '/ai/ocr-receipt', '/api/ai/ocr-receipt', '/api/ocr-receipt']);
  const transcribe = findRoute(visionRoutes, 'post', ['/ai/transcribe-audio', '/transcribe-audio', '/api/ai/transcribe-audio', '/api/transcribe-audio']);
  const diagnoseWeed = findRoute(visionRoutes, 'post', ['/diagnose-weed-image', '/ai/diagnose-weed-image']);
  const manualRag = findRoute(ragRoutes, 'post', ['/ai/manual-rag', '/manual-rag']);
  const enterpriseRag = findRoute(ragRoutes, 'post', ['/ai/enterprise-rag', '/enterprise-rag']);
  const cacheClear = findRoute(ragRoutes, 'post', ['/ai/rag-cache-clear', '/rag-cache-clear']);
  const logsClear = findRoute(ragRoutes, 'post', ['/ai/rag-performance-logs/clear', '/rag-performance-logs/clear']);

  const privilegedRoutes: Array<[string, any]> = [
    ['POST /ai/estate-chat', estateChat],
    ['POST /ocr-receipt', ocrReceipt],
    ['POST /transcribe-audio', transcribe],
    ['POST /diagnose-weed-image', diagnoseWeed],
    ['POST /ai/manual-rag', manualRag],
    ['POST /ai/enterprise-rag', enterpriseRag],
    ['POST /ai/rag-cache-clear', cacheClear],
    ['POST /ai/rag-performance-logs/clear', logsClear]
  ];

  assert(privilegedRoutes.every(([, r]) => !!r), 'All targeted privileged AI routes are registered');

  // A. Authentication -> 401
  for (const [label, route] of privilegedRoutes) {
    const result = await invokeHandlers(routeHandlers(route).slice(0, GATE), buildReq('POST'));
    assert(result.status === 401, `Unauthenticated ${label} returns 401`, `got ${result.status}`);
  }

  // B. Authorization -> 403 for non-admin on admin mutations; allowed for admin
  {
    const nonAdmin = await invokeHandlers(routeHandlers(cacheClear).slice(0, GATE), buildReq('POST', { headers: STAFF }));
    assert(nonAdmin.status === 403, 'Non-authorized role cannot clear RAG cache (403)', `got ${nonAdmin.status}`);

    const nonAdminLogs = await invokeHandlers(routeHandlers(logsClear).slice(0, GATE), buildReq('POST', { headers: STAFF }));
    assert(nonAdminLogs.status === 403, 'Non-authorized role cannot clear RAG performance logs (403)', `got ${nonAdminLogs.status}`);

    const admin = await invokeHandlers(routeHandlers(cacheClear).slice(0, GATE), buildReq('POST', { headers: FC }));
    assert(admin.allowed, 'Authorized administrative role can clear RAG cache');

    const adminLogs = await invokeHandlers(routeHandlers(logsClear).slice(0, GATE), buildReq('POST', { headers: FC }));
    assert(adminLogs.allowed, 'Authorized administrative role can clear RAG performance logs');
  }

  // C. Estate isolation on estate-chat (auth gate is requireRole -> validateTenantAccess)
  {
    const bodyOverride = await invokeHandlers(
      routeHandlers(estateChat).slice(0, GATE),
      buildReq('POST', { headers: STAFF, body: { estate_id: 'FPM_ADELA' } })
    );
    assert(bodyOverride.status === 403, 'Single-estate user cannot override estate via body estate_id (403)', `got ${bodyOverride.status}`);

    const queryOverride = await invokeHandlers(
      routeHandlers(estateChat).slice(0, GATE),
      buildReq('POST', { headers: STAFF, query: { estate_id: 'FPM_ADELA' } })
    );
    assert(queryOverride.status === 403, 'Single-estate user cannot override estate via query estate_id (403)', `got ${queryOverride.status}`);

    const headerOverride = await invokeHandlers(
      routeHandlers(estateChat).slice(0, GATE),
      buildReq('POST', { headers: { ...STAFF, 'x-estate-id': 'FPM_ADELA' } })
    );
    assert(
      !headerOverride.allowed && (headerOverride.status === 401 || headerOverride.status === 403),
      'Single-estate user cannot override estate via x-estate-id (rejected)',
      `got ${headerOverride.status}`
    );

    const allEstate = await invokeHandlers(
      routeHandlers(estateChat).slice(0, GATE),
      buildReq('POST', { headers: STAFF, query: { estate_id: 'ALL' } })
    );
    assert(allEstate.status === 403, 'estateId=ALL rejected for single-estate role (403)', `got ${allEstate.status}`);

    const rcReq = buildReq('POST', { headers: { ...RC, 'x-estate-id': 'FPM_ADELA' } });
    const rcResult = await invokeHandlers(routeHandlers(estateChat).slice(0, GATE), rcReq);
    assert(
      rcResult.allowed && String(rcReq.estateId).toUpperCase() === 'FPM_ADELA',
      'Legitimate cross-estate role (rc) continues to work and binds to requested estate',
      `estateId=${rcReq.estateId}, status=${rcResult.status}`
    );
  }

  // D. Source guards
  {
    const estateChatSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/ai/estateChat.routes.ts'), 'utf-8');
    const visionSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/ai/vision.routes.ts'), 'utf-8');
    const ragSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/ai/rag.routes.ts'), 'utf-8');
    const evalSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/ai/evaluation.routes.ts'), 'utf-8');

    assert(!/authenticate\s*[,)]/.test(estateChatSrc) && estateChatSrc.includes('requireRole('),
      'estate-chat uses requireRole, not optional authenticate');

    assert(
      /diagnose-weed-image[^\n]*requireRole\(/.test(visionSrc) &&
      /ocr-receipt[^\n]*requireRole\(/.test(visionSrc) &&
      /transcribe-audio[^\n]*requireRole\(/.test(visionSrc),
      'vision OCR/transcribe/diagnose routes are registered with requireRole'
    );

    assert(
      /router\.post\(\['\/ai\/rag-cache-clear'[^\n]*requireRole\(/.test(ragSrc) &&
      /router\.post\(\['\/ai\/rag-performance-logs\/clear'[^\n]*requireRole\(/.test(ragSrc),
      'RAG cache/log clear routes require an admin role'
    );

    assert(
      (evalSrc.match(/requireRole\(/g) || []).length >= 4,
      'All evaluation endpoints are registered with requireRole'
    );

    // estate-chat must derive estate from req.estateId only
    assert(
      estateChatSrc.includes('req.estateId') &&
      !/req\.body\?\.estate_id/.test(estateChatSrc) &&
      !/req\.query\?\.estate_id/.test(estateChatSrc) &&
      !/req\.headers\?\.\['x-estate-id'\]/.test(estateChatSrc),
      'estate-chat derives estate from req.estateId only (no client estate override)'
    );

    // estate-chat backlog query must be estate-filtered
    assert(
      /from\('hasil_backlog_history'\)[\s\S]{0,200}?\.eq\('estate_id'/.test(estateChatSrc),
      'estate-chat filters hasil_backlog_history by authorized estate'
    );
  }

  console.log(`\nMODULE 26 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/ai_endpoint_security.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /ai_endpoint_security\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runAiEndpointSecurityTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-09 AI endpoint security suite execution error:', err);
      process.exit(1);
    });
}
