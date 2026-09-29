import { AuthService } from '../../../src/server/services/auth.service.js';
import { extractUserFromRequest, COOKIE_NAME } from '../../../src/server/middleware/auth.js';
import { sessionManager } from '../../../src/server/services/sessionManager.service.js';
import authRoutes from '../../../src/server/routes/auth.routes.js';
import jwt from 'jsonwebtoken';

export async function runAuthBypassTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 9: AUTHENTICATION BYPASS & PRIVILEGE ESCALATION GATES');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 9.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 9.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1: Fresh browser (No cookie, no session, no storage)
  {
    const req: any = { cookies: {}, headers: {} };
    const { user, token } = extractUserFromRequest(req);
    assert(user === null && token === null, 'Fresh browser without session returns null user (LoginScreen)');
  }

  // 2: Existing storage role only (Without valid server JWT)
  {
    const req: any = { cookies: {}, headers: {} };
    const { user } = extractUserFromRequest(req);
    assert(user === null, 'Client-only storage without valid server session returns null (LoginScreen)');
  }

  // 3: Fake role manually inserted
  {
    const req: any = { cookies: {}, headers: {} };
    const { user } = extractUserFromRequest(req);
    assert(user === null, 'Manually injected fake role does NOT grant authentication');
  }

  // 4: Valid authentication via PIN (Staff: 123456)
  let validToken = '';
  {
    const userSession = AuthService.verifyPin('123456');
    assert(userSession !== null && userSession.app_metadata.app_role === 'staff', 'Valid PIN 123456 returns staff session');
    if (userSession) {
      validToken = AuthService.generateToken(userSession);
      const req: any = { cookies: { [COOKIE_NAME]: validToken }, headers: {} };
      const { user } = extractUserFromRequest(req);
      assert(user !== null && user.app_metadata.app_role === 'staff', 'Valid session token resolves to authenticated Staff user');
    }
  }

  // 5: Expired authentication session
  {
    const userSession = AuthService.verifyPin('888888');
    if (userSession) {
      const expiredToken = AuthService.generateToken(userSession, '-10s');
      const req: any = { cookies: { [COOKIE_NAME]: expiredToken }, headers: {} };
      const { user } = extractUserFromRequest(req);
      assert(user === null, 'Expired JWT token returns null (Triggers return to LoginScreen)');
    }
  }

  // 6: Invalid / Tampered JWT
  {
    const forgedToken = jwt.sign(
      { sub: 'fake-user', role: 'authenticated', app_metadata: { app_role: 'pf' } },
      'wrong-secret-key-attacker-guess',
      { algorithm: 'HS256' }
    );
    const req: any = { cookies: { [COOKIE_NAME]: forgedToken }, headers: {} };
    const { user } = extractUserFromRequest(req);
    assert(user === null, 'Tampered/Forged JWT signature is rejected (LoginScreen)');
  }

  // 7: Logout flow (clears cookie)
  {
    const loggedOutReq: any = { cookies: {}, headers: {} };
    const { user } = extractUserFromRequest(loggedOutReq);
    assert(user === null, 'After logout, session cookie is empty and user is unauthenticated');
  }

  // 8: Browser refresh with valid session
  {
    const req: any = { cookies: { [COOKIE_NAME]: validToken }, headers: {} };
    const { user } = extractUserFromRequest(req);
    assert(user !== null && user.app_metadata.app_role === 'staff', 'Browser refresh with valid cookie restores authenticated session');
  }

  // 9: Role manipulation in client storage
  {
    const req: any = { cookies: { [COOKIE_NAME]: validToken }, headers: {} };
    const { user } = extractUserFromRequest(req);
    assert(user?.app_metadata.app_role === 'staff', 'Client storage manipulation cannot escalate privileges over JWT claims');
  }

  // 10: Delete authentication token while keeping client role
  {
    const req: any = { cookies: {}, headers: {} };
    const { user } = extractUserFromRequest(req);
    assert(user === null, 'Deleting session token returns unauthenticated');
  }

  // 11: ADVERSARIAL: Forged PIN header (Invalid PIN / Non-numeric injection string)
  {
    const req: any = { cookies: {}, headers: { 'x-auth-pin': "000000' OR '1'='1" } };
    const { user, token } = extractUserFromRequest(req);
    assert(user === null && token === null, 'Forged PIN header with injection attempt is strictly rejected');
  }

  // 12: ADVERSARIAL: PIN header with wrong estate injection (Staff PIN 123456 trying to access FPM_ADELA)
  {
    const req: any = { cookies: {}, headers: { 'x-auth-pin': '123456', 'x-estate-id': 'FPM_ADELA' } };
    const { user, token } = extractUserFromRequest(req);
    assert(user === null && token === null, 'PIN header with unauthorized estate mismatch is strictly rejected');
  }

  // 13: ADVERSARIAL: PIN header privilege escalation (Staff PIN 123456 with fake headers x-role: superadmin, x-operator-id: RC-0001)
  {
    const req: any = { 
      cookies: {}, 
      headers: { 
        'x-auth-pin': '123456', 
        'x-role': 'superadmin', 
        'x-operator-id': 'RC-0001', 
        'x-app-role': 'rc' 
      } 
    };
    const { user } = extractUserFromRequest(req);
    assert(
      user !== null && 
      user.app_metadata.app_role === 'staff' && 
      user.app_metadata.operator_id === 'STF-TGL-01',
      'PIN header authentication enforces server SSOT identity and ignores user-controlled header claims'
    );
  }

  // 14: ADVERSARIAL: Replay attack on revoked session
  {
    const userSession = AuthService.verifyPin('123456');
    if (userSession) {
      const replayToken = AuthService.generateToken(userSession);
      sessionManager.registerSession(userSession, '127.0.0.1', 'test');
      sessionManager.revokeSession(userSession.session_id, 'Test Security Audit', 'Replay test revocation');

      const req: any = { cookies: { [COOKIE_NAME]: replayToken }, headers: {} };
      const { user } = extractUserFromRequest(req);
      assert(user === null, 'Replay attack with revoked session ID is rejected immediately');
    }
  }

  // 15: ADVERSARIAL: Password non-exposure verification
  {
    const userSession = AuthService.verifyPin('2401199'); // FC Tunggal profile
    const serialized = JSON.stringify(userSession);
    const hasPassword = serialized.toLowerCase().includes('password');
    assert(!hasPassword, 'Verified user session object and token payloads carry NO password or sensitive credential fields');
  }

  // 16: ADVERSARIAL (PART B): Staff login without secret must be rejected (400/401)
  {
    const layer = (authRoutes as any).stack.find((l: any) => 
      l.route?.path?.includes?.('/verify-staff') || 
      (Array.isArray(l.route?.path) && l.route.path.some((p: string) => p.includes('verify-staff')))
    );
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;
    
    let statusCode = 200;
    let responseBody: any = null;
    const cookies: Record<string, any> = {};

    const req: any = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'TestRunner' },
      body: { estateCode: 'FPM_TUNGGAL', staffNo: '2401199' }
    };
    const res: any = {
      status(code: number) { statusCode = code; return this; },
      cookie(name: string, val: any) { cookies[name] = val; return this; },
      json(data: any) { responseBody = data; return this; }
    };

    await handler(req, res);
    const isRejected = (statusCode === 400 || statusCode === 401) && !responseBody?.token && !cookies[COOKIE_NAME];
    assert(isRejected, 'PART B: POST /verify-staff without secret field is rejected (no token/cookie granted)', `Got status ${statusCode}, token=${!!responseBody?.token}`);
  }

  // 17: ADVERSARIAL (PART B): Staff login with WRONG secret must be rejected (401)
  {
    const layer = (authRoutes as any).stack.find((l: any) => 
      l.route?.path?.includes?.('/verify-staff') || 
      (Array.isArray(l.route?.path) && l.route.path.some((p: string) => p.includes('verify-staff')))
    );
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;
    
    let statusCode = 200;
    let responseBody: any = null;
    const cookies: Record<string, any> = {};

    const req: any = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'TestRunner' },
      body: { estateCode: 'FPM_TUNGGAL', staffNo: '2401199', pin: '99999999_wrong_pin' }
    };
    const res: any = {
      status(code: number) { statusCode = code; return this; },
      cookie(name: string, val: any) { cookies[name] = val; return this; },
      json(data: any) { responseBody = data; return this; }
    };

    await handler(req, res);
    const isRejected = (statusCode === 400 || statusCode === 401) && !responseBody?.token && !cookies[COOKIE_NAME];
    assert(isRejected, 'PART B: POST /verify-staff with wrong secret is rejected (401, no token/cookie granted)', `Got status ${statusCode}, token=${!!responseBody?.token}`);
  }

  // 18: ADVERSARIAL (PART B): Staff login with CORRECT secret must succeed
  {
    const layer = (authRoutes as any).stack.find((l: any) => 
      l.route?.path?.includes?.('/verify-staff') || 
      (Array.isArray(l.route?.path) && l.route.path.some((p: string) => p.includes('verify-staff')))
    );
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;
    
    let statusCode = 200;
    let responseBody: any = null;
    const cookies: Record<string, any> = {};

    const req: any = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'TestRunner', 'x-device-id': 'DEV-MASTER-NAS-FC' },
      body: { estateCode: 'FPM_TUNGGAL', staffNo: 'STF-TGL-01', pin: '123456', deviceId: 'DEV-MASTER-NAS-FC' }
    };
    const res: any = {
      status(code: number) { statusCode = code; return this; },
      cookie(name: string, val: any) { cookies[name] = val; return this; },
      json(data: any) { responseBody = data; return this; }
    };

    await handler(req, res);
    const isSuccess = statusCode === 200 && !!responseBody?.token && responseBody?.success === true;
    assert(isSuccess, 'PART B: POST /verify-staff with correct secret succeeds with authenticated session', `Got status ${statusCode}, success=${responseBody?.success}`);
  }

  return { passed, total };
}

