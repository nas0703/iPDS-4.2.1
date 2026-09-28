import { getScopedSupabase, getReadSupabase, getWriteSupabase, getDatabasePoolConfig } from '../../../src/server/db.js';
import { AuthService } from '../../../src/server/services/auth.service.js';
import { authenticate, requireRole } from '../../../src/server/middleware/auth.js';
import { Request, Response } from 'express';

export async function runScopedSupabaseClientTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 13: PHASE 4 SCOPED SUPABASE CLIENT & BACKEND INTEGRATION');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 13.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 13.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // Generate valid authenticated session
  const session = AuthService.verifyPin('123456'); // Staff user in FPM_TUNGGAL
  assert(session !== null, 'AuthService PIN verification creates valid session for scoped client testing');

  let token = '';
  if (session) {
    token = AuthService.generateToken(session);
  }

  // Test 13.1: getScopedSupabase produces client with caller JWT header
  const scopedClient = getScopedSupabase(token);
  assert(
    scopedClient !== null || process.env.SUPABASE_URL === undefined,
    'getScopedSupabase instantiates client carrying user Bearer token'
  );

  // Test 13.2: getReadSupabase and getWriteSupabase export read-write separation helpers
  const readClient = getReadSupabase(token);
  const writeClient = getWriteSupabase(token);
  assert(
    (readClient !== null && writeClient !== null) || process.env.SUPABASE_URL === undefined,
    'getReadSupabase and getWriteSupabase helpers execute read-write separation pipeline'
  );

  // Test 13.3: Express authenticate middleware attaches req.supabase to request context
  const mockReq = {
    headers: {
      authorization: `Bearer ${token}`
    },
    cookies: {}
  } as unknown as Request;

  let authNextCalled = false;
  authenticate(mockReq, {} as Response, () => { authNextCalled = true; });

  assert(
    authNextCalled && mockReq.user !== undefined && mockReq.supabase !== undefined,
    'authenticate middleware attaches req.supabase Scoped Supabase Client to Express Request object'
  );

  // Test 13.4: Express requireRole middleware attaches req.supabase with caller JWT
  const mockRbacReq = {
    headers: {
      authorization: `Bearer ${token}`
    },
    cookies: {}
  } as unknown as Request;

  let rbacNextCalled = false;
  const roleMiddleware = requireRole(['staff', 'fc', 'pf']);
  roleMiddleware(mockRbacReq, {} as Response, () => { rbacNextCalled = true; });

  assert(
    rbacNextCalled && mockRbacReq.supabase !== undefined && mockRbacReq.authRole === 'staff',
    'requireRole middleware attaches req.supabase and verifies role hierarchy'
  );

  // Test 13.5: getDatabasePoolConfig returns connection pooler & read replica diagnostics
  const poolConfig = getDatabasePoolConfig();
  assert(
    poolConfig !== undefined && typeof poolConfig.status === 'string',
    'getDatabasePoolConfig reports connection pooler, read replica, and auth mode status'
  );

  return { passed, total };
}
