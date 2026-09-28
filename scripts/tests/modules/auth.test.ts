import { AuthService } from '../../../src/server/services/auth.service.js';
import { extractUserFromRequest, COOKIE_NAME } from '../../../src/server/middleware/auth.js';
import { checkRateLimit, recordAttempt } from '../../../src/server/routes/auth.routes.js';
import jwt from 'jsonwebtoken';

export async function runAuthTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 1: AUTHENTICATION REGRESSION TESTS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 1.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 1.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Valid PIN verification
  const validUser = AuthService.verifyPin('123456');
  assert(validUser !== null && validUser.app_metadata.app_role === 'staff', 'Valid PIN 123456 returns Staff session object');

  // 2. Invalid PIN rejection
  const invalidUser = AuthService.verifyPin('000000');
  assert(invalidUser === null, 'Invalid PIN 000000 returns null');

  // 3. Token generation and decoding
  let token = '';
  if (validUser) {
    token = AuthService.generateToken(validUser);
    const mockReq: any = { cookies: { [COOKIE_NAME]: token }, headers: {} };
    const { user } = extractUserFromRequest(mockReq);
    assert(user !== null && user.sub === validUser.sub, 'Valid JWT token resolves to authenticated user session');
  } else {
    assert(false, 'Token generation skipped due to failed PIN verify');
  }

  // 4. Expired token rejection
  if (validUser) {
    const expiredToken = AuthService.generateToken(validUser, '-5s');
    const mockReq: any = { cookies: { [COOKIE_NAME]: expiredToken }, headers: {} };
    const { user } = extractUserFromRequest(mockReq);
    assert(user === null, 'Expired JWT token resolves to null user (Triggers relogin)');
  }

  // 5. Tampered token rejection
  const tamperedToken = jwt.sign(
    { sub: 'hacked_user', app_metadata: { app_role: 'fc' } },
    'forged_secret_key'
  );
  const mockReqTampered: any = { cookies: { [COOKIE_NAME]: tamperedToken }, headers: {} };
  const { user: tamperedUser } = extractUserFromRequest(mockReqTampered);
  assert(tamperedUser === null, 'Tampered JWT token with forged signature is rejected');

  // 6. Rate limiter tracking
  const testIp = '127.0.0.99';
  for (let i = 0; i < 11; i++) {
    recordAttempt(testIp, false);
  }
  const rateLimitCheck = checkRateLimit(testIp);
  assert(!rateLimitCheck.allowed && rateLimitCheck.remainingSec > 0, 'Rate limiter locks IP after 10 failed login attempts');
  
  // Clean up rate limit state for test IP
  recordAttempt(testIp, true);

  return { passed, total };
}
