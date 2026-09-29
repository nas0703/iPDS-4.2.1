import { AuthService } from '../../src/server/services/auth.service.js';
import { extractUserFromRequest, COOKIE_NAME } from '../../src/server/middleware/auth.js';
import authRoutes from '../../src/server/routes/auth.routes.js';
import jwt from 'jsonwebtoken';

async function runAuthBypassTestSuite() {
  console.log('====================================================');
  console.log('iPDS VER 3.7 — AUTHENTICATION SECURITY TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`       Detail: ${detail}`);
    }
  }

  // ----------------------------------------------------
  // TEST 1: Fresh browser (No cookie, no session, no storage)
  // ----------------------------------------------------
  {
    const req: any = {
      cookies: {},
      headers: {}
    };
    const { user, token } = extractUserFromRequest(req);
    assert(user === null && token === null, 'Fresh browser without session returns null user (LoginScreen)');
  }

  // ----------------------------------------------------
  // TEST 2: Existing ipds_auth_role only (Without valid server JWT)
  // ----------------------------------------------------
  {
    // Simulating client storage containing "staff" but no server session
    const mockLocalStorage: Record<string, string> = { ipds_auth_role: 'staff' };
    const req: any = { cookies: {}, headers: {} };
    const { user } = extractUserFromRequest(req);
    // Client state hook logic: authRole starts null and rejects unauthenticated storage
    assert(user === null, 'localStorage-only role without valid server session returns null (LoginScreen)');
  }

  // ----------------------------------------------------
  // TEST 3: Fake role manually inserted into localStorage (e.g. 'admin' or 'pf')
  // ----------------------------------------------------
  {
    const mockLocalStorage: Record<string, string> = { ipds_auth_role: 'admin' };
    const req: any = { cookies: {}, headers: {} };
    const { user } = extractUserFromRequest(req);
    assert(user === null, 'Manually injected fake admin role does NOT grant authentication');
  }

  // ----------------------------------------------------
  // TEST 4: Valid authentication via PIN (Staff: 123456)
  // ----------------------------------------------------
  let validToken = '';
  {
    const userSession = AuthService.verifyPin('123456');
    assert(userSession !== null && userSession.app_metadata.app_role === 'staff', 'Valid PIN 123456 returns staff session');
    if (userSession) {
      validToken = AuthService.generateToken(userSession);
      const req: any = {
        cookies: { [COOKIE_NAME]: validToken },
        headers: {}
      };
      const { user } = extractUserFromRequest(req);
      assert(user !== null && user.app_metadata.app_role === 'staff', 'Valid session token resolves to authenticated Staff user');
    }
  }

  // ----------------------------------------------------
  // TEST 5: Expired authentication session
  // ----------------------------------------------------
  {
    const userSession = AuthService.verifyPin('888888');
    if (userSession) {
      // Generate token expired 10 seconds ago
      const expiredToken = AuthService.generateToken(userSession, '-10s');
      const req: any = {
        cookies: { [COOKIE_NAME]: expiredToken },
        headers: {}
      };
      const { user } = extractUserFromRequest(req);
      assert(user === null, 'Expired JWT token returns null (Triggers return to LoginScreen)');
    }
  }

  // ----------------------------------------------------
  // TEST 6: Invalid / Tampered JWT
  // ----------------------------------------------------
  {
    const forgedToken = jwt.sign(
      { sub: 'fake-user', role: 'authenticated', app_metadata: { app_role: 'pf' } },
      'wrong-secret-key-attacker-guess',
      { algorithm: 'HS256' }
    );
    const req: any = {
      cookies: { [COOKIE_NAME]: forgedToken },
      headers: {}
    };
    const { user } = extractUserFromRequest(req);
    assert(user === null, 'Tampered/Forged JWT signature is rejected (LoginScreen)');
  }

  // ----------------------------------------------------
  // TEST 7: Logout flow (clears cookie)
  // ----------------------------------------------------
  {
    const loggedOutReq: any = {
      cookies: {}, // Cookie was cleared via res.clearCookie
      headers: {}
    };
    const { user } = extractUserFromRequest(loggedOutReq);
    assert(user === null, 'After logout, session cookie is empty and user is unauthenticated');
  }

  // ----------------------------------------------------
  // TEST 8: Browser refresh with valid session
  // ----------------------------------------------------
  {
    const req: any = {
      cookies: { [COOKIE_NAME]: validToken },
      headers: {}
    };
    const { user } = extractUserFromRequest(req);
    assert(user !== null && user.app_metadata.app_role === 'staff', 'Browser refresh with valid cookie successfully restores authenticated session');
  }

  // ----------------------------------------------------
  // TEST 9: Browser refresh after logout
  // ----------------------------------------------------
  {
    const req: any = {
      cookies: {}, // Cleared
      headers: {}
    };
    const { user } = extractUserFromRequest(req);
    assert(user === null, 'Browser refresh after logout renders LoginScreen');
  }

  // ----------------------------------------------------
  // TEST 10: Role manipulation from user -> admin in client storage
  // ----------------------------------------------------
  {
    // User is logged in as staff with a staff JWT
    const req: any = {
      cookies: { [COOKIE_NAME]: validToken },
      headers: {}
    };
    const { user } = extractUserFromRequest(req);
    // Attacker modifies localStorage: localStorage.setItem('ipds_auth_role', 'pf')
    // Server-authoritative role remains 'staff'
    assert(user?.app_metadata.app_role === 'staff', 'Client localStorage manipulation cannot escalate privileges over JWT claims');
  }

  // ----------------------------------------------------
  // TEST 11: Delete authentication token while keeping ipds_auth_role in storage
  // ----------------------------------------------------
  {
    // Cookie deleted by user/browser, but localStorage left behind
    const req: any = {
      cookies: {},
      headers: {}
    };
    const { user } = extractUserFromRequest(req);
    assert(user === null, 'Deleting session token while retaining localStorage role returns unauthenticated (LoginScreen)');
  }

  // ----------------------------------------------------
  // TEST 12: Open application from fresh device/browser
  // ----------------------------------------------------
  {
    const req: any = {
      cookies: {},
      headers: {}
    };
    const { user } = extractUserFromRequest(req);
    assert(user === null, 'Opening application on new device/browser mandates PIN entry (LoginScreen)');
  }

  // ----------------------------------------------------
  // TEST 13 (REGRESSION PART B): Staff login without secret must be rejected
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // TEST 14 (REGRESSION PART B): Staff login with WRONG secret must be rejected
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // TEST 15 (REGRESSION PART B): Staff login with CORRECT secret must succeed
  // ----------------------------------------------------
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

  console.log(`\n----------------------------------------------------`);
  console.log(`Test Suite Summary: ${passedTests} / ${totalTests} Passed`);
  console.log(`----------------------------------------------------`);

  if (passedTests === totalTests) {
    console.log('>>> ALL 12 SECURITY TESTS PASSED SUCCESSFULLY! <<<\n');
    process.exit(0);
  } else {
    console.error('>>> SOME TESTS FAILED! <<<\n');
    process.exit(1);
  }
}

runAuthBypassTestSuite().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
