/**
 * iPDS v4.1.0 — Test Module 37: P0-16 Secure Device Bootstrap & Persistence
 *
 * Verifies:
 *   - the registered_devices table is provisioned with RLS + service_role-only
 *     access (no PUBLIC/anon/authenticated);
 *   - approveDevice upserts (cannot silently update zero rows);
 *   - the secure bootstrap token is fail-closed and constant-time;
 *   - registration is PENDING by default and only APPROVED with a valid
 *     server-configured bootstrap token (never from a PIN/master PIN);
 *   - the login flow forwards the bootstrap token.
 */

import fs from 'fs';
import path from 'path';
import {
  deviceSecurityService,
  verifyBootstrapToken
} from '../../../src/server/services/deviceSecurity.service.js';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

const MIGRATION = 'supabase/migrations/20260918_p0_16_registered_devices.sql';
const SERVICE_SRC = 'src/server/services/deviceSecurity.service.ts';
const AUTH_SRC = 'src/server/routes/auth.routes.ts';

export async function runDeviceBootstrapTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 37: P0-16 SECURE DEVICE BOOTSTRAP & PERSISTENCE');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 37.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 37.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 37.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // 1. Migration / schema guards
  {
    const exists = fs.existsSync(path.join(process.cwd(), MIGRATION));
    assert(exists, 'P0-16 registered_devices migration exists');
    if (exists) {
      const sql = read(MIGRATION);
      assert(/CREATE TABLE IF NOT EXISTS public\.registered_devices/i.test(sql), 'migration creates public.registered_devices');
      assert(/ENABLE ROW LEVEL SECURITY/i.test(sql) && /FORCE ROW LEVEL SECURITY/i.test(sql), 'RLS enabled and forced');
      assert(/REVOKE ALL ON public\.registered_devices FROM PUBLIC/i.test(sql), 'PUBLIC revoked');
      assert(/REVOKE ALL ON public\.registered_devices FROM anon/i.test(sql), 'anon revoked');
      assert(/REVOKE ALL ON public\.registered_devices FROM authenticated/i.test(sql), 'authenticated revoked');
      assert(/GRANT [^;]*ON public\.registered_devices TO service_role/i.test(sql), 'service_role granted');
    }
  }

  // 2. approveDevice upsert guard
  {
    const src = read(SERVICE_SRC);
    assert(/Approve device upsert/.test(src) && /\.upsert\(\s*\{/.test(src), 'approveDevice upserts (cannot silently update zero rows)');
    assert(!/\.update\(\{\s*status: 'APPROVED'/.test(src), 'approveDevice no longer uses a status-only update');
    assert(!/\b(2401199|888888|654321)\b/.test(src), 'no hardcoded master PIN in device security service');
  }

  // 3. verifyBootstrapToken unit behavior (fail-closed, constant-time)
  {
    const saved = process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN;
    try {
      delete process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN;
      assert(verifyBootstrapToken('anything') === false, 'bootstrap disabled when env token unset');
      assert(verifyBootstrapToken(undefined) === false, 'undefined token rejected');
      assert(verifyBootstrapToken('') === false, 'empty token rejected');

      process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN = 'unit-test-bootstrap-secret-value';
      assert(verifyBootstrapToken('unit-test-bootstrap-secret-value') === true, 'correct bootstrap token accepted');
      assert(verifyBootstrapToken('unit-test-bootstrap-secret-valuX') === false, 'wrong (same length) token rejected');
      assert(verifyBootstrapToken('short') === false, 'wrong-length token rejected');
      assert(verifyBootstrapToken(undefined) === false, 'missing token rejected when configured');
    } finally {
      if (saved === undefined) delete process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN;
      else process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN = saved;
    }
  }

  // 4. Runtime registration: PENDING by default, APPROVED only with the token
  {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedUrl = process.env.SUPABASE_URL;
    const savedViteUrl = process.env.VITE_SUPABASE_URL;
    const savedNextUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const savedAnon = process.env.SUPABASE_ANON_KEY;
    const savedViteAnon = process.env.VITE_SUPABASE_ANON_KEY;
    const savedNextAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const savedService = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const savedToken = process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN;

    try {
      // Production + no credentials => getSupabase() returns null (no network).
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.VITE_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.VITE_SUPABASE_ANON_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const base = {
        deviceName: 'P0-16 Test Device',
        estateId: 'FPM_TUNGGAL',
        pin: '2401199',
        operatorName: 'Test Operator',
        role: 'fc',
        ip: '127.0.0.1',
        userAgent: 'p0-16-test'
      };

      delete process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN;
      const noToken = await deviceSecurityService.registerDevice({ ...base, deviceId: 'DEV-P016-NOTOKEN' });
      assert(noToken.status === 'PENDING', 'registration without token is PENDING', `got ${noToken.status}`);

      const masterPinOnly = await deviceSecurityService.registerDevice({ ...base, deviceId: 'DEV-P016-MASTERPIN' });
      assert(masterPinOnly.status === 'PENDING', 'master PIN alone does NOT auto-approve (no regression)', `got ${masterPinOnly.status}`);

      process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN = 'runtime-bootstrap-secret';
      const wrong = await deviceSecurityService.registerDevice({ ...base, deviceId: 'DEV-P016-WRONG', bootstrapToken: 'nope' });
      assert(wrong.status === 'PENDING', 'wrong bootstrap token is PENDING', `got ${wrong.status}`);

      const approved = await deviceSecurityService.registerDevice({ ...base, deviceId: 'DEV-P016-OK', bootstrapToken: 'runtime-bootstrap-secret' });
      assert(approved.status === 'APPROVED' && approved.approved_by === 'BOOTSTRAP_TOKEN',
        'valid bootstrap token APPROVES the device', `status=${approved.status} approved_by=${approved.approved_by}`);

      // 5. approveDevice on an unknown device creates an APPROVED record (upsert path, memory)
      const approvedUnknown = await deviceSecurityService.approveDevice('DEV-P016-UNKNOWN', 'Admin', 'fc');
      assert(!!approvedUnknown && approvedUnknown.status === 'APPROVED', 'approveDevice approves an unknown device (no silent 0-row update)');
      const fetched = await deviceSecurityService.getDeviceStatus('DEV-P016-UNKNOWN');
      assert(!!fetched && fetched.status === 'APPROVED', 'approved unknown device is retrievable as APPROVED');
    } finally {
      const restore = (key: string, value: string | undefined) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      };
      restore('NODE_ENV', savedNodeEnv);
      restore('SUPABASE_URL', savedUrl);
      restore('VITE_SUPABASE_URL', savedViteUrl);
      restore('NEXT_PUBLIC_SUPABASE_URL', savedNextUrl);
      restore('SUPABASE_ANON_KEY', savedAnon);
      restore('VITE_SUPABASE_ANON_KEY', savedViteAnon);
      restore('NEXT_PUBLIC_SUPABASE_ANON_KEY', savedNextAnon);
      restore('SUPABASE_SERVICE_ROLE_KEY', savedService);
      restore('IPDS_DEVICE_BOOTSTRAP_TOKEN', savedToken);
    }
  }

  // 6. Login flow forwards the bootstrap token
  {
    const auth = read(AUTH_SRC);
    const staffRoute = auth.slice(auth.indexOf("router.post(['/verify-staff"), auth.indexOf("router.post(['/verify-password"));
    assert(staffRoute.includes('x-device-bootstrap-token') && staffRoute.includes('verifyBootstrapToken'),
      'kiosk login forwards and validates the bootstrap token');
    assert((staffRoute.match(/bootstrapToken/g) || []).length >= 2, 'kiosk login passes bootstrapToken through device registration');
  }

  // 7. Preserve P0-11-A device-gate behavior
  {
    const mw = read('src/server/middleware/auth.ts');
    assert(!/x-auth-pin|x-kiosk-pin|x-pin|AuthService\.verifyPin/.test(mw),
      'generic raw-PIN API authentication remains disabled');
  }

  console.log(`\nMODULE 37 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/device_bootstrap.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_bootstrap\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceBootstrapTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-16 device bootstrap suite execution error:', err);
      process.exit(1);
    });
}
