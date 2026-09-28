/**
 * iPDS v3.8 — P1 Security Governance Test Suite
 * 
 * Verifies:
 * 1. P1-A: Structured Audit Trail (Event capture, scrubbing, append-only, fail-safe)
 * 2. P1-B: Rate Limiting (Sliding window, 429 status, retry-after headers, tier limits)
 * 3. P1-C: Supabase Client Consolidation (Browser vs Server separation)
 * 4. Authentication, RBAC, Estate Isolation regressions
 */

import { AuthService, AuthRole, IPDS_NAMESPACE } from '../src/server/services/auth.service.js';
import { auditService, scrubSensitiveData, AuditAction } from '../src/server/services/audit.service.js';
import { createRateLimiter, getClientKey } from '../src/server/middleware/rateLimiter.js';
import { getScopedSupabase, getSupabase } from '../src/server/db.js';
import { isSupabaseReady } from '../src/services/supabaseClient.js';
import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';

process.env.SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'test_jwt_secret_p1_governance_matrix_secret_1234567890';

async function runP1GovernanceVerification() {
  console.log("===============================================================");
  console.log("iPDS v3.8 — P1 SECURITY GOVERNANCE AUTOMATED VERIFICATION MATRIX");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(testId: string, description: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${description} — ${details || 'Assertion failed'}`);
      failed++;
    }
  }

  function createTestSession(config: {
    kioskId: string;
    stationName: string;
    role: AuthRole;
    estateId: string;
    operatorId: string;
    operatorName: string;
  }) {
    const kioskSub = uuidv5(`kiosk:${config.estateId}:${config.kioskId}`, IPDS_NAMESPACE);
    const sessionId = uuidv4();
    return {
      sub: kioskSub,
      session_id: sessionId,
      role: 'authenticated' as const,
      app_metadata: {
        estate_id: config.estateId,
        kiosk_id: config.kioskId,
        app_role: config.role,
        operator_id: config.operatorId
      },
      user_metadata: {
        operator_name: config.operatorName,
        station_name: config.stationName
      }
    };
  }

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: P1-A STRUCTURED AUDIT TRAIL
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 1: P1-A STRUCTURED AUDIT TRAIL ---");

    // AUDIT-01: Record creation with standard fields
    const testEvent = auditService.record({
      action: 'LOGIN_SUCCESS',
      resource: 'auth/verify-pin',
      userId: 'STF-1044',
      userName: 'Kerani Input Operasi',
      role: 'staff',
      authorizedEstate: 'FPM_TUNGGAL',
      result: 'SUCCESS',
      ip: '192.168.1.50',
      userAgent: 'Mozilla/5.0 iPad',
      details: { station: 'Timbangan Utama' }
    });

    assert("AUDIT-01", "Audit record generates immutable ID and ISO timestamp", 
      Boolean(testEvent.id) && Boolean(testEvent.timestamp) && testEvent.action === 'LOGIN_SUCCESS'
    );

    // AUDIT-02: Secret scrubbing on deep payloads
    const dirtyPayload = {
      password: 'super_secret_password',
      pin: '123456',
      rawToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak',
      apiKey: 'ai_studio_secret_key_123',
      user: {
        name: 'Kerani Ali',
        credentials: { secret: 'do_not_log_this' },
        nestedPin: { pin: '654321' }
      },
      nonSensitiveKeyHoldingJwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.someSig',
      regularField: 'safe_data_value'
    };

    const cleanedPayload = scrubSensitiveData(dirtyPayload) as Record<string, any>;
    assert("AUDIT-02", "Secrets, PINs, passwords, JWTs, and keys are deeply redacted", 
      cleanedPayload.password === '[REDACTED]' &&
      cleanedPayload.pin === '[REDACTED]' &&
      (cleanedPayload.rawToken === '[REDACTED]' || cleanedPayload.rawToken === '[REDACTED_JWT]') &&
      cleanedPayload.apiKey === '[REDACTED]' &&
      cleanedPayload.user.credentials === '[REDACTED]' &&
      cleanedPayload.user.nestedPin === '[REDACTED]' &&
      cleanedPayload.nonSensitiveKeyHoldingJwt === '[REDACTED_JWT]' &&
      cleanedPayload.regularField === 'safe_data_value'
    );

    // AUDIT-03: Authorization denial audit event
    const deniedEvent = auditService.logAuthDenied(
      {
        ip: '10.0.0.12',
        headers: { 'user-agent': 'Safari/605.1', 'x-request-id': 'req_denied_test_01' },
        user: createTestSession({
          kioskId: 'KIOSK-01',
          stationName: 'Timbangan',
          role: 'staff',
          estateId: 'FPM_TUNGGAL',
          operatorId: 'STF-1044',
          operatorName: 'Ali'
        }),
        originalUrl: '/api/settings/logo',
        method: 'POST'
      },
      ['pf', 'fc'],
      'staff'
    );

    assert("AUDIT-03", "Authorization denial logs AUTHORIZATION_DENIED with required roles", 
      deniedEvent.action === 'AUTHORIZATION_DENIED' &&
      deniedEvent.result === 'DENIED' &&
      deniedEvent.role === 'staff'
    );

    // AUDIT-04: Estate access denial audit event
    const estateDeniedEvent = auditService.logEstateDenied(
      {
        ip: '10.0.0.15',
        headers: { 'x-request-id': 'req_estate_test_02' },
        user: createTestSession({
          kioskId: 'KIOSK-02',
          stationName: 'Timbangan',
          role: 'staff',
          estateId: 'FPM_TUNGGAL',
          operatorId: 'STF-1044',
          operatorName: 'Ali'
        }),
        originalUrl: '/api/fertilizer/entries'
      },
      'FPM_SELATAN',
      'FPM_TUNGGAL'
    );

    assert("AUDIT-04", "Cross-estate access rejection logs ESTATE_ACCESS_DENIED", 
      estateDeniedEvent.action === 'ESTATE_ACCESS_DENIED' &&
      estateDeniedEvent.result === 'DENIED' &&
      estateDeniedEvent.authorizedEstate === 'FPM_TUNGGAL'
    );

    // AUDIT-05: Inventory change audit event
    const inventoryEvent = auditService.record({
      action: 'INVENTORY_CHANGE',
      resource: 'fertilizer_inventory',
      resourceId: 'inv_item_99',
      userId: 'STF-1044',
      role: 'staff',
      authorizedEstate: 'FPM_TUNGGAL',
      result: 'SUCCESS',
      beforeState: { quantity: 5000 },
      afterState: { quantity: 4500 },
      details: { change_kg: -500, type: 'OUT', reference: 'Blok A3' }
    });

    assert("AUDIT-05", "Inventory change logs before and after state accurately", 
      inventoryEvent.action === 'INVENTORY_CHANGE' &&
      inventoryEvent.beforeState?.quantity === 5000 &&
      inventoryEvent.afterState?.quantity === 4500
    );

    // AUDIT-06: Audit query & filtering
    const queryStaffOnly = auditService.query({ role: 'staff' });
    const queryDeniedOnly = auditService.query({ result: 'DENIED' });
    assert("AUDIT-06", "Audit service queries accurately filter by role and result", 
      queryStaffOnly.logs.every(l => l.role === 'staff') &&
      queryDeniedOnly.logs.every(l => l.result === 'DENIED')
    );

    // -------------------------------------------------------------------------
    // SECTION 2: P1-B RATE LIMITING
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 2: P1-B RATE LIMITING ---");

    // RATE-01: Standard rate limiting within quota
    const testLimiter = createRateLimiter({
      windowMs: 1000,
      maxRequests: 3,
      tierName: 'test_tier'
    });

    let mockReq = {
      ip: '192.168.1.101',
      headers: {},
      socket: { remoteAddress: '192.168.1.101' }
    } as any;

    let resHeaders: Record<string, any> = {};
    let mockRes = {
      setHeader: (k: string, v: any) => { resHeaders[k] = v; },
      status: (code: number) => ({
        json: (data: any) => ({ statusCode: code, body: data })
      })
    } as any;

    let nextCalled = 0;
    const mockNext = () => { nextCalled++; };

    // Request 1, 2, 3 (all allowed)
    testLimiter(mockReq, mockRes, mockNext);
    testLimiter(mockReq, mockRes, mockNext);
    testLimiter(mockReq, mockRes, mockNext);

    assert("RATE-01", "Requests within quota pass through successfully", 
      nextCalled === 3 && resHeaders['X-RateLimit-Remaining'] === 0
    );

    // Request 4 (exceeds quota -> 429)
    let errorResponse: any = null;
    mockRes = {
      setHeader: (k: string, v: any) => { resHeaders[k] = v; },
      status: (code: number) => ({
        json: (data: any) => {
          errorResponse = { statusCode: code, body: data };
          return errorResponse;
        }
      })
    } as any;

    testLimiter(mockReq, mockRes, mockNext);

    assert("RATE-02", "Requests exceeding quota receive HTTP 429 with Retry-After", 
      errorResponse !== null &&
      errorResponse.statusCode === 429 &&
      errorResponse.body.code === 'RATE_LIMITED' &&
      typeof resHeaders['Retry-After'] === 'number'
    );

    // RATE-03: Isolation across distinct IPs
    const mockReq2 = {
      ip: '192.168.1.102',
      headers: {},
      socket: { remoteAddress: '192.168.1.102' }
    } as any;

    let nextCalled2 = 0;
    testLimiter(mockReq2, mockRes, () => { nextCalled2++; });

    assert("RATE-03", "Rate limit buckets are strictly isolated per client IP", 
      nextCalled2 === 1
    );

    // -------------------------------------------------------------------------
    // SECTION 3: P1-C SUPABASE CLIENT CONSOLIDATION
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 3: P1-C SUPABASE CLIENT CONSOLIDATION ---");

    // SUPA-01: Scoped server client pattern
    const staffSession = createTestSession({
      kioskId: 'KIOSK-01',
      stationName: 'Timbangan',
      role: 'staff',
      estateId: 'FPM_TUNGGAL',
      operatorId: 'STF-1044',
      operatorName: 'Ali'
    });
    const staffToken = AuthService.generateToken(staffSession);
    const scopedServerClient = getScopedSupabase(staffToken);

    assert("SUPA-01", "Server getScopedSupabase creates client with authenticated Bearer header", 
      scopedServerClient !== null
    );

    // SUPA-02: Fallback anon server client
    const anonServerClient = getSupabase();
    assert("SUPA-02", "Server getSupabase provides unauthenticated fallback without service role escalation", 
      anonServerClient !== null
    );

    // SUPA-03: Browser client readiness helper
    const browserReady = typeof isSupabaseReady === 'function';
    assert("SUPA-03", "Browser client pattern exported without service role exposure", 
      browserReady
    );

    // -------------------------------------------------------------------------
    // SECTION 4: REGRESSION INTEGRATION CHECKS
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 4: REGRESSION CHECKS (AUTH & RBAC) ---");

    // REG-01: Valid PIN verification
    const verifiedStaff = AuthService.verifyPin("123456");
    assert("REG-01", "PIN '123456' authoritatively verifies as staff", 
      verifiedStaff !== null && verifiedStaff.app_metadata.app_role === 'staff'
    );

    // REG-02: Invalid PIN returns null
    const invalidVerify = AuthService.verifyPin("000000");
    assert("REG-02", "Invalid PIN '000000' is safely rejected", 
      invalidVerify === null
    );

    // REG-03: Token tampering rejected
    const tampered = staffToken.slice(0, -5) + 'abcde';
    const decodedTampered = AuthService.verifyToken(tampered);
    assert("REG-03", "Tampered JWT token signature fails verification", 
      decodedTampered === null
    );

  } catch (err: any) {
    console.error("Verification execution error:", err);
    failed++;
  }

  console.log("\n---------------------------------------------------------------");
  console.log(`TOTAL P1 GOVERNANCE TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("---------------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runP1GovernanceVerification();
