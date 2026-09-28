/**
 * iPDS v4.1.0 — Test Module 58: P1.1-C SEC-03 Scoped vs Privileged Supabase Client
 *
 * Proves:
 *   - a scoped request with a valid JWT builds an anon-key client (never service-role)
 *   - a scoped request without a JWT fails closed (null)
 *   - malformed / expired JWTs fail closed (null)
 *   - getScopedSupabase never silently returns the service-role client
 *   - the explicit privileged helper still works with the service-role key
 *   - when no anon key exists, scoped fails closed while privileged still works
 */

import crypto from 'crypto';
import { getScopedSupabase, getReadSupabase, getWriteSupabase, getPrivilegedSupabase, isUsableUserJwt } from '../../../src/server/db.js';
import { AuthService, UserSession } from '../../../src/server/services/auth.service.js';

function b64url(value: any): string {
  return Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeJwt(payload: any): string {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

function mintValidToken(): string {
  const session: UserSession = {
    sub: 'test-sub',
    session_id: crypto.randomUUID(),
    role: 'authenticated',
    app_metadata: {
      estate_id: 'FPM_TUNGGAL',
      kiosk_id: 'kiosk-test',
      app_role: 'staff',
      operator_id: 'STF-TGL-01'
    },
    user_metadata: { operator_name: 'Test', station_name: 'Test' }
  };
  return AuthService.generateToken(session);
}

export async function runP1_1CScopedClientTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 58: P1.1-C SEC-03 SCOPED VS PRIVILEGED SUPABASE CLIENT');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 58.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 58.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 58.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  const envKeys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_POOLED_URL', 'SUPABASE_POOLER_URL', 'SUPABASE_READ_REPLICA_URL', 'SUPABASE_JWT_SECRET', 'JWT_SECRET'];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];

  const ANON = 'anon-key-p1-1c-test';
  const SERVICE = 'service-role-key-p1-1c-test';

  try {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = ANON;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
    process.env.SUPABASE_POOLED_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_READ_REPLICA_URL;

    const validToken = mintValidToken();

    process.env.NODE_ENV = 'production';

    assert(isUsableUserJwt(validToken), 'valid minted JWT is accepted by the structural gate');

    const scoped = getScopedSupabase(validToken);
    assert(scoped !== null, 'scoped client built for a valid JWT');
    assert((scoped as any)?.supabaseKey === ANON, 'scoped client uses the anon key', `got ${(scoped as any)?.supabaseKey}`);
    assert((scoped as any)?.supabaseKey !== SERVICE, 'scoped client NEVER uses the service-role key');

    const scopedRead = getReadSupabase(validToken);
    const scopedWrite = getWriteSupabase(validToken);
    assert((scopedRead as any)?.supabaseKey === ANON, 'getReadSupabase uses anon key');
    assert((scopedWrite as any)?.supabaseKey === ANON, 'getWriteSupabase uses anon key');

    assert(getScopedSupabase(undefined) === null, 'scoped without JWT fails closed');
    assert(getScopedSupabase('') === null, 'scoped with empty token fails closed');
    assert(getScopedSupabase('not-a-jwt') === null, 'scoped with malformed token fails closed');
    assert(getScopedSupabase('aaa.bbb.ccc') === null, 'scoped with non-JSON payload fails closed');
    assert(isUsableUserJwt('aaa.bbb.ccc') === false, 'structural gate rejects non-JSON payload');

    const expired = makeJwt({ aud: 'authenticated', exp: Math.floor(Date.now() / 1000) - 60 });
    assert(isUsableUserJwt(expired) === false, 'structural gate rejects expired JWT');
    assert(getScopedSupabase(expired) === null, 'scoped with expired JWT fails closed');

    const privileged = getPrivilegedSupabase();
    assert(privileged !== null, 'explicit privileged helper still works');
    assert((privileged as any)?.supabaseKey === SERVICE, 'privileged helper uses the service-role key', `got ${(privileged as any)?.supabaseKey}`);

    // No anon key: scoped fails closed, privileged still works with service role.
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    assert(getScopedSupabase(validToken) === null, 'scoped fails closed when no anon key is configured even with service role present');
  } finally {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k] as string;
    }
  }

  return { passed, total, failedTests };
}
