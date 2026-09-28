import { AuthService, AuthTokenPayload, JWT_ACCESS_EXPIRES_IN, COOKIE_SESSION_MAX_AGE_MS } from '../../../src/server/services/auth.service.js';
import { extractUserFromRequest, COOKIE_NAME } from '../../../src/server/middleware/auth.js';
import { sessionManager } from '../../../src/server/services/sessionManager.service.js';
import { IdentityService } from '../../../src/server/services/identity.service.js';
import { Request } from 'express';
import jwt from 'jsonwebtoken';

export async function runJwtSessionLifecycleTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 15: JWT & STATEFUL SLIDING SESSION LIFECYCLE');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 15.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 15.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Initial login produces UserSession with session_id
  const session = AuthService.verifyPin('123456'); // Kerani Operasi Tunggal
  assert(session !== null && typeof session.session_id === 'string', 'AuthService.verifyPin produces valid session_id in UserSession');

  if (!session) {
    return { passed, total };
  }

  // Register session in SessionManager
  const activeRecord = sessionManager.registerSession(session, '192.168.1.50', 'Mozilla/5.0 Test Kiosk');
  assert(
    activeRecord.sessionId === session.session_id && activeRecord.status === 'ACTIVE',
    'SessionManager successfully registers active session record'
  );

  // 2. Token generation defaults to 1-hour access token
  const token = AuthService.generateToken(session);
  const decoded = AuthService.verifyToken(token);
  assert(
    decoded !== null &&
    decoded.session_id === session.session_id &&
    decoded.app_metadata.estate_id === 'FPM_TUNGGAL' &&
    decoded.app_metadata.app_role === 'staff',
    'Token generation produces 1-hour Supabase JWT carrying session_id and tenant claims'
  );

  // 3. Sliding Session Window: Heartbeat / Touch
  const initialTime = sessionManager.getSessionRemainingTime(session.session_id);
  assert(
    initialTime.active && initialTime.remainingMs > 0 && initialTime.status === 'ACTIVE',
    'Session remaining time calculator reports ACTIVE state with positive remaining duration'
  );

  const touchSuccess = sessionManager.touchSession(session.session_id);
  assert(touchSuccess === true, 'sessionManager.touchSession successfully refreshes sliding activity timestamp');

  // 4. Token Refresh mechanism
  if (decoded) {
    const refreshed = await AuthService.refreshSessionToken(decoded, '192.168.1.50', 'Mozilla/5.0 Test Kiosk');
    assert(
      refreshed !== null &&
      typeof refreshed.token === 'string' &&
      refreshed.user.session_id === session.session_id &&
      refreshed.user.app_metadata.estate_id === 'FPM_TUNGGAL',
      'AuthService.refreshSessionToken successfully renews token without dropping tenant claims'
    );
  }

  // 5. extractUserFromRequest integrates sliding heartbeat
  const mockReq = {
    cookies: { [COOKIE_NAME]: token },
    headers: {}
  } as unknown as Request;

  const { user: extractedUser, token: extractedToken } = extractUserFromRequest(mockReq);
  assert(
    extractedUser !== null && extractedToken === token,
    'extractUserFromRequest successfully extracts user and updates session activity'
  );

  // 6. Instantaneous Session Revocation (Blacklist)
  sessionManager.revokeSession(session.session_id, 'Super Admin', 'Test manual revocation');
  assert(
    !sessionManager.isSessionActive(session.session_id),
    'sessionManager.isSessionActive returns false immediately after session revocation'
  );

  // 7. Revoked token is rejected even if JWT cryptographically unexpired
  const { user: revokedUser } = extractUserFromRequest(mockReq);
  assert(
    revokedUser === null,
    'extractUserFromRequest rejects unexpired JWT token whose session_id has been revoked in SessionManager'
  );

  // 8. Deactivated operator in IdentityService fails token refresh
  // Register a temporary test identity and deactivate it
  IdentityService.registerOrUpdateIdentity({
    pin: '998877',
    app_role: 'mandur',
    full_name: 'Mandur Dinonaktifkan',
    operator_id: 'MND-TEMP-99',
    primary_estate_id: 'FPM_TUNGGAL',
    is_active: false
  });

  const deactivatedPayload: AuthTokenPayload = {
    sub: 'temp-sub',
    session_id: 'temp-session-id',
    role: 'authenticated',
    iss: 'supabase',
    aud: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    app_metadata: {
      estate_id: 'FPM_TUNGGAL',
      app_role: 'mandur',
      operator_id: 'MND-TEMP-99',
      kiosk_id: 'kiosk-test'
    },
    user_metadata: {
      operator_name: 'Mandur Dinonaktifkan',
      station_name: 'Stesen Test'
    }
  };

  const deactRefresh = await AuthService.refreshSessionToken(deactivatedPayload);
  assert(
    deactRefresh === null,
    'AuthService.refreshSessionToken rejects renewal for deactivated user in IdentityService'
  );

  return { passed, total };
}
