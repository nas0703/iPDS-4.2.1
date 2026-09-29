/**
 * iPDS v4.1.0 — Test Module 36: P0-14 Security Integration Release Gate
 *
 * Cross-cutting invariants that must hold once P0-09 through P0-13 are
 * integrated together (guards against regressions introduced by merge
 * resolution):
 *   - no client-facing raw error-message disclosure remains
 *   - the settings logo handler performs no server-side fetch
 *   - the hujan read route requires auth and derives estate from req.estateId
 *   - the auth middleware enforces device approval for PIN-based auth
 *   - privileged AI endpoints use requireRole
 *   - worker/telemetry mutations use requireRole
 */

import fs from 'fs';
import path from 'path';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listRouteFiles(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

export async function runSecurityIntegrationGateTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 36: P0-14 SECURITY INTEGRATION RELEASE GATE');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 36.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 36.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 36.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // 1. No client-facing raw error-message disclosure anywhere in route handlers
  {
    const offenders: string[] = [];
    for (const f of listRouteFiles(path.join(process.cwd(), 'src/server/routes'))) {
      const src = fs.readFileSync(f, 'utf-8');
      if (/(error|details|message):\s*(err|e|error)\??\.message/.test(src)) {
        offenders.push(path.relative(process.cwd(), f));
      }
      if (/json\(\{[^}]*getErrorMessage/.test(src)) {
        offenders.push(path.relative(process.cwd(), f));
      }
    }
    assert(offenders.length === 0, 'No client-facing raw error-message disclosure remains', offenders.join(', '));
  }

  // 2. Settings logo handler performs no server-side fetch
  {
    const src = read('src/server/routes/settings.routes.ts');
    assert(!/fetch\s*\(/.test(src), 'settings.routes.ts performs no server-side fetch (SSRF)');
    assert(src.includes('parseLogoDataUri') && src.includes('INVALID_LOGO_FORMAT'), 'settings logo uses SSRF-safe validation');
  }

  // 3. Hujan read route: requireAuth + req.estateId only
  {
    const src = read('src/server/routes/hujan.routes.ts');
    assert(/router\.get\(\['\/hujan', '\/api\/hujan'\], requireAuth/.test(src), 'GET /hujan requires auth');
    assert(src.includes('req.estateId') && !/req\.query\??\.estate_id|req\.headers\??\.\['x-estate-id'\]/.test(src),
      'GET /hujan derives estate from req.estateId only');
  }

  // 4. API middleware accepts signed JWT sessions, not raw PIN credentials
  {
    const src = read('src/server/middleware/auth.ts');
    assert(!/x-auth-pin|x-kiosk-pin|x-pin|AuthService\.verifyPin/.test(src),
      'auth middleware does not create sessions from raw PIN credentials');
    assert(src.includes('AuthService.verifyToken') && src.includes('validateTenantAccess'),
      'auth middleware retains signed JWT and tenant validation');
  }

  // 5. Privileged AI endpoints use requireRole
  {
    const estateChat = read('src/server/routes/ai/estateChat.routes.ts');
    assert(/\/ai\/estate-chat'[^\n]*requireRole\(/.test(estateChat), 'estate-chat uses requireRole');
    const vision = read('src/server/routes/ai/vision.routes.ts');
    assert(/ocr-receipt'[^\n]*requireRole\(/.test(vision) && /transcribe-audio'[^\n]*requireRole\(/.test(vision),
      'vision OCR/transcribe use requireRole');
    const rag = read('src/server/routes/ai/rag.routes.ts');
    assert(/rag-cache-clear'[^\n]*requireRole\(/.test(rag) && /manual-rag'[^\n]*requireRole\(/.test(rag),
      'RAG chat/cache endpoints use requireRole');
  }

  // 6. Worker + telemetry mutations use requireRole
  {
    const workers = read('src/server/routes/workers.routes.ts');
    assert((workers.match(/requireRole\(\['pf', 'fc'\]\)/g) || []).length >= 3, 'worker mutations use requireRole([pf, fc])');
    const telemetry = read('src/server/routes/telemetry.routes.ts');
    assert(/router\.post\('\/thresholds',\s*requireRole\(\['pf', 'fc', 'oc', 'rc'\]\)/.test(telemetry),
      'telemetry thresholds use requireRole([pf, fc, oc, rc])');
  }

  // 7. Operational read + error hardening invariants
  {
    const merumput = read('src/server/routes/merumput.routes.ts');
    assert(/router\.get\("\/merumput\/progress", requireAuth/.test(merumput), 'merumput reads require auth');
    const pruning = read('src/server/routes/pruning.routes.ts');
    assert(/router\.get\("\/pruning", requireAuth/.test(pruning), 'pruning reads require auth');
    const penggredan = read('src/server/routes/penggredan.routes.ts');
    assert(/router\.get\('\/penggredan', requireAuth/.test(penggredan), 'penggredan reads require auth');
    const errorUtils = read('src/server/utils/errorUtils.ts');
    assert((errorUtils.match(/export function getSafeErrorMessage/g) || []).length === 1,
      'exactly one getSafeErrorMessage definition after merge resolution');
  }

  console.log(`\nMODULE 36 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/security_integration_gate.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /security_integration_gate\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runSecurityIntegrationGateTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-14 security integration gate suite execution error:', err);
      process.exit(1);
    });
}
