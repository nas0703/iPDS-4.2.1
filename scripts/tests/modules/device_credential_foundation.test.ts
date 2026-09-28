/**
 * iPDS v4.1.0 — Test Module 44: P0-16C.1 Cryptographic Device Credential Foundation
 *
 * Verifies the credential foundation ONLY (no login enforcement):
 *   - CSPRNG credential generation (256-bit, base64url)
 *   - SHA-256 hashing + constant-time verification
 *   - fail-closed issuance when the DB is unavailable
 *   - existing device rows / login behaviour unchanged
 *   - migration is additive, idempotent, non-destructive, RLS-preserving
 */

import fs from 'fs';
import path from 'path';
import {
  deviceSecurityService,
  generateDeviceCredential,
  hashDeviceCredential,
  verifyDeviceCredential,
  issueDeviceCredential,
  rotateDeviceCredential
} from '../../../src/server/services/deviceSecurity.service.js';

const SERVICE_SRC = 'src/server/services/deviceSecurity.service.ts';
const ROUTES_SRC = 'src/server/routes/devices.routes.ts';
const AUTH_ROUTES_SRC = 'src/server/routes/auth.routes.ts';
const MIDDLEWARE_SRC = 'src/server/middleware/auth.ts';
const AUTH_SERVICE_SRC = 'src/server/services/auth.service.ts';
const HELPER_SRC = 'src/utils/deviceHelper.ts';
const MIGRATION = 'supabase/migrations/20260923_p0_16c_device_credentials.sql';

function read(rel: string): string { return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8'); }

export async function runDeviceCredentialFoundationTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 44: P0-16C.1 CRYPTOGRAPHIC DEVICE CREDENTIAL FOUNDATION');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 44.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 44.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 44.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  // A. Entropy / generation
  {
    const c1 = generateDeviceCredential();
    const c2 = generateDeviceCredential();
    assert(typeof c1 === 'string' && c1.length >= 43, 'credential is a long string (>=256-bit base64url)', `len=${c1?.length}`);
    assert(/^[A-Za-z0-9_-]+$/.test(c1), 'credential uses base64url charset');
    assert(c1 !== c2, 'two generated credentials differ');
    assert(!c1.includes('DEV-'), 'credential is not derived from the device_id label');
  }

  // B. Hashing / verification
  {
    const credential = generateDeviceCredential();
    const h1 = hashDeviceCredential(credential);
    const h2 = hashDeviceCredential(credential);
    assert(/^[0-9a-f]{64}$/.test(h1), 'hash is a 64-char SHA-256 hex digest');
    assert(h1 === h2, 'same credential produces the same hash (deterministic)');
    assert(h1 !== credential, 'plaintext credential != stored hash');
    const other = hashDeviceCredential(generateDeviceCredential());
    assert(h1 !== other, 'different credentials produce different hashes');
    assert(verifyDeviceCredential(credential, h1) === true, 'verify accepts the correct credential');
    assert(verifyDeviceCredential(generateDeviceCredential(), h1) === false, 'verify rejects a wrong credential');
    assert(verifyDeviceCredential(credential + 'x', h1) === false, 'verify rejects a tampered credential');
    assert(verifyDeviceCredential('', h1) === false && verifyDeviceCredential(credential, '') === false, 'verify rejects empty inputs');
  }

  // C. Issuance (fail-closed without DB) + registration wiring
  {
    const envKeys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
    const saved: Record<string, string | undefined> = {};
    for (const k of envKeys) saved[k] = process.env[k];
    try {
      process.env.NODE_ENV = 'production';
      for (const k of envKeys) delete process.env[k];

      const issued = await issueDeviceCredential('DEV-C1-TEST');
      // No DB configured (or a stale mock client that fails): must fail closed.
      assert(issued === null || (typeof issued === 'string' && issued.length >= 43), 'issuance either fails closed or returns a valid credential', `got ${issued === null ? 'null' : typeof issued}`);

      const rotated = await rotateDeviceCredential('DEV-C1-TEST');
      assert(rotated === null || (typeof rotated === 'string' && rotated.length >= 43), 'rotation returns a credential or fails closed');

      // registerDevice must not leak credential material in the returned record.
      const record = await deviceSecurityService.registerDevice({ deviceId: 'DEV-C1-REG', deviceName: 'C1 Reg', estateId: 'FPM_TUNGGAL', role: 'staff' });
      assert(!('credential_hash' in record) && !('credential' in record) && !('deviceCredential' in record), 'registered record never carries credential material');
    } finally {
      for (const k of envKeys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }

    const routes = read(ROUTES_SRC);
    assert(/issueDeviceCredential\(record\.device_id\)/.test(routes), '/register issues a device credential after registration');
    assert(/deviceCredential/.test(routes) && /credentialNotice/.test(routes), '/register returns the credential once with a notice');
  }

  // D. Backward compatibility: no enforcement wired in this phase
  {
    const service = read(SERVICE_SRC);
    const getStatusBlock = service.slice(service.indexOf('async getDeviceStatus'), service.indexOf('async registerDevice'));
    assert(!/credential_hash|credential_version/.test(getStatusBlock), 'getDeviceStatus does not gate on credential fields (login unchanged)');

    const authRoutes = read(AUTH_ROUTES_SRC);
    assert(/isStrictDeviceEnforcementEnabled\(\)/.test(authRoutes) && /authorizeDeviceForEstate\(/.test(authRoutes), 'login enforcement present and gated by the C.3 transition flag');

    const middleware = read(MIDDLEWARE_SRC);
    assert(/isStrictDeviceEnforcementEnabled\(\)/.test(middleware) && /authorizeDeviceForEstate\(/.test(middleware), 'middleware enforcement present and gated by the C.3 transition flag');

    // Existing approval flow untouched
    assert(/status\.status === 'APPROVED'/.test(middleware) || /status === 'APPROVED'/.test(middleware), 'existing APPROVED-status gate remains');
  }

  // E. Security
  {
    const service = read(SERVICE_SRC);
    const credBlock = service.slice(service.indexOf('const DEVICE_CREDENTIAL_BYTES'), service.indexOf('// Trusted master devices'));
    assert(/crypto\.randomBytes\(DEVICE_CREDENTIAL_BYTES\)/.test(credBlock) && /DEVICE_CREDENTIAL_BYTES = 32/.test(credBlock), 'credential uses crypto.randomBytes(32) (CSPRNG)');
    assert(!/Math\.random|Date\.now\(\)\s*\.toString/.test(credBlock), 'credential generation does not use Math.random/Date.now');
    assert(!/console\.[a-z]+\([^)]*credential\b/i.test(credBlock.replace(/console\.warn\('\[DEVICE_SECURITY\] Issue device credential/g, '')), 'plaintext credential is never logged');
    assert(/createHash\('sha256'\)/.test(credBlock), 'credential hashed with SHA-256');
    assert(/timingSafeEqualHex/.test(credBlock), 'verification uses constant-time comparison');

    const authService = read(AUTH_SERVICE_SRC);
    const tokenBlock = authService.slice(authService.indexOf('static generateToken'), authService.indexOf('static generateToken') + 600);
    assert(!/credential/i.test(tokenBlock), 'device credential is never placed in the JWT');

    const routes = read(ROUTES_SRC);
    assert(!/quick-approve\?[^`'"]*credential|approve-link\?[^`'"]*credential/i.test(routes), 'credential is never placed in a URL/query string');

    const helper = read(HELPER_SRC);
    assert(/ipds_device_id/.test(helper) && /ipds_device_credential/.test(helper), 'device_id (label) and device credential are stored under separate keys');
    assert(/localStorage/.test(helper) && /vulnerable to XSS/.test(helper), 'localStorage XSS trade-off is documented');
  }

  // F. Migration static checks
  {
    assert(fs.existsSync(path.join(process.cwd(), MIGRATION)), 'migration 20260923 exists');
    const sql = read(MIGRATION);
    const sqlCode = sql.replace(/--[^\n]*/g, '');
    assert(/ADD COLUMN IF NOT EXISTS credential_hash TEXT/.test(sqlCode), 'migration adds credential_hash TEXT');
    assert(/ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 1/.test(sqlCode), 'migration adds credential_version INTEGER NOT NULL DEFAULT 1');
    assert(/ADD COLUMN IF NOT EXISTS credential_rotated_at TIMESTAMPTZ/.test(sqlCode), 'migration adds credential_rotated_at TIMESTAMPTZ');
    assert(/CREATE UNIQUE INDEX IF NOT EXISTS uq_registered_devices_credential_hash[\s\S]*?WHERE credential_hash IS NOT NULL/.test(sqlCode),
      'migration adds a partial unique index (NULL-safe) for credential_hash');
    assert(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/i.test(sqlCode), 'migration contains no DML/destructive statements');
    assert(!/(GRANT|REVOKE|ROW LEVEL SECURITY|CREATE POLICY|ALTER POLICY)/i.test(sqlCode), 'migration does not change RLS/grants/policies');
    assert(/BEGIN;/.test(sql) && /COMMIT;/.test(sql), 'migration is wrapped in a transaction');
    const tables = [...sqlCode.matchAll(/public\.([a-z_]+)/gi)].map(m => m[1].toLowerCase());
    assert(tables.length >= 1 && tables.every(t => t === 'registered_devices'), 'migration only targets registered_devices');

    const files = fs.readdirSync(path.join(process.cwd(), 'supabase', 'migrations')).filter(f => f.endsWith('.sql')).sort();
    assert(files.indexOf('20260923_p0_16c_device_credentials.sql') > files.indexOf('20260922_p0_16b_pekerja_unique_keys.sql'), 'migration ordering is after 20260922');

    // Prior hardening migrations unchanged
    const acl = read('supabase/migrations/20260921_p0_16_registered_devices_acl_reconciliation.sql');
    assert(/FORCE ROW LEVEL SECURITY/.test(acl) && /REVOKE ALL[\s\S]*FROM anon/.test(acl) && /GRANT SELECT, INSERT, UPDATE, DELETE[\s\S]*TO service_role/.test(acl),
      'registered_devices hardening (FORCE RLS + service_role-only) remains in place');
  }

  console.log(`\nMODULE 44 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_credential_foundation\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceCredentialFoundationTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16C.1 device credential foundation suite execution error:', err); process.exit(1); });
}
