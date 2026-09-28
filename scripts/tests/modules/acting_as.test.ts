/**
 * iPDS v4.1.0 — P1 Administrative Acting-As Regression Suite
 *
 * Proves the NEW explicit Acting-As mechanism and its P1 hardening:
 *   1. Super Admin can initiate Acting-As.
 *   2. Non-Super Admin (RC/OC/PF/branch FC/staff) cannot.
 *   3. actor_id remains the Super Admin.
 *   4. subject_id is the target user.
 *   5. Client cannot override actor_id / subject / role / estate.
 *   6. Acting-As cannot exceed the target's authorized estate.
 *   7. IMPERSONATION_START is audited.
 *   8. IMPERSONATION_END is audited.
 *   9. No credential secret appears in the audit payload.
 *  10. Legacy PIN authentication is unchanged and never reinterpreted.
 *  A. Replay after /end is rejected.
 *  B. Replay through /api/auth/refresh is rejected.
 *  C. Deactivated actor cannot refresh an Acting-As session.
 *  D. Actor that loses Super Admin status cannot refresh an Acting-As session.
 *  E. Target/body fields never override server-derived actor/subject/role.
 *  F. Legacy PIN auth regression.
 *  G. /end endpoint behavior (401 / 400 / success / replay).
 *  H. Durable store fallback is a no-op when not configured.
 */

import { ActingAsService } from '../../../src/server/services/actingAs.service.js';
import { AuthService } from '../../../src/server/services/auth.service.js';
import { IdentityService } from '../../../src/server/services/identity.service.js';
import { sessionManager } from '../../../src/server/services/sessionManager.service.js';
import { auditService } from '../../../src/server/services/audit.service.js';
import {
  isActingAsSessionDurableActive,
  isDurableSessionStoreConfigured,
  getDurableSessionStatus
} from '../../../src/server/services/durableSessionStore.service.js';
import { COOKIE_NAME } from '../../../src/server/middleware/auth.js';
import authRoutes from '../../../src/server/routes/auth.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

function routePathMatches(layer: any, needle: string): boolean {
  const p = layer?.route?.path;
  const paths = Array.isArray(p) ? p : [p];
  return paths.some((x) => typeof x === 'string' && x.includes(needle));
}

function findAuthRoute(method: 'get' | 'post', needle: string) {
  const stack = (authRoutes as any).stack || [];
  return stack.find((l: any) => routePathMatches(l, needle) && l.route?.methods?.[method]);
}

function routeHandlers(route: any): any[] {
  return (route?.route?.stack || []).map((s: any) => s.handle);
}

function buildReq(
  method: 'POST',
  headers: Record<string, string> = {},
  body: any = {},
  cookies: Record<string, string> = {}
): any {
  return {
    method,
    headers,
    cookies,
    query: {},
    body,
    ip: '127.0.0.1',
    originalUrl: '/api/auth/acting-as',
    url: '/api/auth/acting-as',
    path: '/api/auth/acting-as',
    baseUrl: '',
    get(name: string) {
      return this.headers[String(name).toLowerCase()];
    }
  };
}

function invokeHandlers(handlers: any[], req: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    let status = 200;
    let body: any = null;
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve({ status, body });
      }
    };
    const res: any = {
      status(code: number) {
        status = code;
        return res;
      },
      json(data: any) {
        body = data;
        finish();
        return res;
      },
      cookie() {
        return res;
      },
      clearCookie() {
        return res;
      },
      setHeader() {
        return res;
      },
      getHeader() {
        return undefined;
      },
      end() {
        finish();
        return res;
      }
    };
    let i = 0;
    const next = (err?: any) => {
      if (err) {
        status = 500;
        body = { error: String(err?.message || err) };
        finish();
        return;
      }
      if (i >= handlers.length) {
        finish();
        return;
      }
      const handler = handlers[i++];
      try {
        const maybe = handler(req, res, next);
        if (maybe && typeof maybe.catch === 'function') {
          maybe.catch(() => {
            status = 500;
            finish();
          });
        }
      } catch (e: any) {
        status = 500;
        body = { error: e?.message || String(e) };
        finish();
      }
    };
    next();
  });
}

export async function runActingAsTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 49: P1 ADMINISTRATIVE ACTING-AS (ACTOR/SUBJECT)');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 49.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 49.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 49.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // Isolate Supabase environment credentials so test exercises pure in-memory contract
  const envKeys = [
    'SUPABASE_URL',
    'VITE_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];
  for (const k of envKeys) delete process.env[k];

  try {
  const adminActor: any = AuthService.verifyPin('2401199');
  const staffActor: any = AuthService.verifyPin('123456');
  const originalActorProfile = IdentityService.getAllProfiles().find((p) => p.operator_id === 'FC-2401199');

  assert(!!adminActor && !!staffActor, 'Fixture SSOT identities resolve (FC Tunggal + staff)');
  assert(!!originalActorProfile, 'Fixture original Super Admin profile captured for restore');

  // 1 / 3 / 4. Super Admin initiates; actor_id is Super Admin; subject_id is target.
  const start = await ActingAsService.startActingAs({
    actor: adminActor,
    targetOperatorId: 'STF-TGL-01',
    reason: 'unit-test-start',
    ip: '10.20.1.45',
    userAgent: 'UnitTest/1.0'
  });

  assert(
    start.success === true && start.token !== undefined,
    'Test: Super Admin can initiate NEW Acting-As session',
    `code=${start.code}`
  );
  assert(start.actor_id === 'FC-2401199', 'Test: actor_id remains the authenticated Super Admin', `actor_id=${start.actor_id}`);
  assert(start.subject_id === 'STF-TGL-01', 'Test: subject_id is the selected target user', `subject_id=${start.subject_id}`);

  const actingToken = start.token as string;
  const decoded: any = AuthService.verifyToken(actingToken);
  assert(
    !!decoded &&
      decoded.app_metadata.acting_as === true &&
      decoded.app_metadata.actor_id === 'FC-2401199' &&
      decoded.app_metadata.subject_id === 'STF-TGL-01',
    'Test: Acting-As JWT carries server-trusted actor_id/subject_id'
  );
  assert(
    !!decoded &&
      decoded.app_metadata.operator_id === 'STF-TGL-01' &&
      decoded.app_metadata.app_role === 'staff' &&
      decoded.app_metadata.estate_id === 'FPM_TUNGGAL' &&
      !!decoded.app_metadata.user_id &&
      !!decoded.app_metadata.kiosk_id,
    'Test: Acting-As preserves target user_id/operator_id/app_role/estate_id/kiosk_id'
  );
  assert(
    sessionManager.getSession(decoded.session_id)?.ip === '10.20.1.45' &&
      sessionManager.getSession(decoded.session_id)?.userAgent === 'UnitTest/1.0',
    'Test (#4): real client IP / user-agent captured on the Acting-As session'
  );

  // 2. Non-Super Admin cannot initiate (service layer).
  const deniedActors: Array<[string, any]> = [
    ['staff', staffActor],
    ['rc', AuthService.verifyPin('111111')],
    ['oc', AuthService.verifyPin('333333')],
    ['pf', AuthService.verifyPin('888888')],
    ['branch FC (Adela)', AuthService.verifyPin('600300')]
  ];
  for (const [label, actor] of deniedActors) {
    const denied = await ActingAsService.startActingAs({ actor, targetOperatorId: 'STF-TGL-01' });
    assert(
      denied.success === false && denied.code === 'SUPER_ADMIN_REQUIRED',
      `Test: non-Super Admin (${label}) cannot initiate Acting-As`,
      `code=${denied.code}`
    );
  }

  // 5 / E. Client cannot override actor/subject/role/estate.
  const spoof = await ActingAsService.startActingAs({
    actor: adminActor,
    targetOperatorId: 'STF-TGL-01',
    actor_id: 'STF-TGL-01',
    subject_id: 'ATTACKER',
    role: 'superadmin',
    app_metadata: { operator_id: 'STF-TGL-01', app_role: 'superadmin', estate_id: 'WILAYAH_JB' },
    reason: 'spoof-attempt'
  } as any);
  assert(
    spoof.success === true && spoof.actor_id === 'FC-2401199' && spoof.subject_id === 'STF-TGL-01',
    'Test: client-supplied actor_id/subject_id are ignored (actor from session only)',
    `actor_id=${spoof.actor_id} subject_id=${spoof.subject_id}`
  );
  const spoofDecoded: any = AuthService.verifyToken(spoof.token as string);
  assert(
    !!spoofDecoded &&
      spoofDecoded.app_metadata.app_role === 'staff' &&
      spoofDecoded.app_metadata.estate_id === 'FPM_TUNGGAL',
    'Test (E): body role/estate cannot override server-derived subject role/estate',
    `role=${spoofDecoded?.app_metadata?.app_role} estate=${spoofDecoded?.app_metadata?.estate_id}`
  );

  // 6. Acting-As cannot cross the target's authorization boundary.
  const crossEstate = await ActingAsService.startActingAs({
    actor: adminActor,
    targetOperatorId: 'STF-ADL-01',
    targetEstateId: 'FPM_KLEDANG'
  });
  assert(
    crossEstate.success === false && crossEstate.code === 'TARGET_ESTATE_DENIED',
    'Test: Acting-As cannot place a single-estate target into another estate',
    `code=${crossEstate.code}`
  );

  const invalidEstate = await ActingAsService.startActingAs({
    actor: adminActor,
    targetOperatorId: 'STF-TGL-01',
    targetEstateId: 'MARS'
  });
  assert(
    invalidEstate.success === false && invalidEstate.code === 'INVALID_ESTATE',
    'Test: Acting-As rejects invalid estate context',
    `code=${invalidEstate.code}`
  );

  const selfTarget = await ActingAsService.startActingAs({ actor: adminActor, targetOperatorId: 'FC-2401199' });
  assert(
    selfTarget.success === false && selfTarget.code === 'TARGET_IS_ACTOR',
    'Test: Acting-As rejects self-target (actor must differ from subject)',
    `code=${selfTarget.code}`
  );

  const unknownTarget = await ActingAsService.startActingAs({ actor: adminActor, targetOperatorId: 'NO-SUCH-OP' });
  assert(
    unknownTarget.success === false && unknownTarget.code === 'TARGET_NOT_FOUND',
    'Test: arbitrary operator id cannot be impersonated (target must exist)',
    `code=${unknownTarget.code}`
  );

  // 7. IMPERSONATION_START audited.
  const startEvents = auditService.query({ action: 'IMPERSONATION_START' }).logs;
  const firstStart: any = startEvents[0];
  assert(
    startEvents.length > 0 &&
      firstStart?.details?.actor_id === 'FC-2401199' &&
      firstStart?.details?.subject_id === 'STF-TGL-01' &&
      firstStart?.result === 'SUCCESS',
    'Test: IMPERSONATION_START is audited with actor_id + subject_id',
    `events=${startEvents.length}`
  );
  assert(
    !!firstStart?.timestamp && firstStart?.userId === 'FC-2401199' && !!firstStart?.authorizedEstate,
    'Test: IMPERSONATION_START audit carries actor attribution + estate context'
  );

  // 9. No credential secret in audit payload.
  const serializedStart = JSON.stringify(firstStart || {});
  assert(
    !serializedStart.includes('123456') &&
      !serializedStart.includes('"pin"') &&
      !serializedStart.includes('"password"') &&
      !serializedStart.toLowerCase().includes('credential'),
    'Test: no PIN/password/credential secret appears in IMPERSONATION_START audit'
  );

  // G. Start route authorization.
  const startRoute = findAuthRoute('post', '/acting-as/start');
  const endRoute = findAuthRoute('post', '/acting-as/end');
  assert(!!startRoute && !!endRoute, 'Test: acting-as start/end routes are registered');

  if (startRoute && endRoute) {
    const startNames = routeHandlers(startRoute).map((h: any) => h.name);
    const endNames = routeHandlers(endRoute).map((h: any) => h.name);
    assert(
      startNames.includes('requireAuth') && startNames.includes('requireSuperAdmin'),
      'Test: POST /acting-as/start is guarded by requireAuth + requireSuperAdmin',
      `handlers: ${startNames.join(', ')}`
    );
    assert(
      endNames.includes('requireAuth'),
      'Test: POST /acting-as/end is guarded by requireAuth (actor re-verified server-side)',
      `handlers: ${endNames.join(', ')}`
    );

    const noAuth = await invokeHandlers(routeHandlers(startRoute), buildReq('POST', {}, { targetOperatorId: 'STF-TGL-01' }));
    assert(noAuth.status === 401, 'Test: start without credentials returns 401', `got ${noAuth.status}`);

    const staffAttempt = await invokeHandlers(
      routeHandlers(startRoute),
      buildReq('POST', authHeaders('123456'), { targetOperatorId: 'STF-TGL-01' })
    );
    assert(staffAttempt.status === 403, 'Test: start as non-Super Admin returns 403', `got ${staffAttempt.status}`);

    const adminAttempt = await invokeHandlers(
      routeHandlers(startRoute),
      buildReq('POST', authHeaders('2401199'), { targetOperatorId: 'STF-TGL-01', reason: 'route-test' })
    );
    assert(
      adminAttempt.status === 200 &&
        adminAttempt.body?.success === true &&
        adminAttempt.body?.actor_id === 'FC-2401199' &&
        adminAttempt.body?.subject_id === 'STF-TGL-01',
      'Test: start as Super Admin returns 200 with actor_id/subject_id',
      `status=${adminAttempt.status} body=${JSON.stringify(adminAttempt.body)}`
    );

    // G. /end endpoint behavior.
    const endNoAuth = await invokeHandlers(routeHandlers(endRoute), buildReq('POST', {}, {}));
    assert(endNoAuth.status === 401, 'Test (G): unauthenticated /end returns 401', `got ${endNoAuth.status}`);

    const endNonActing = await invokeHandlers(
      routeHandlers(endRoute),
      buildReq('POST', authHeaders('123456'), {}, { [COOKIE_NAME]: '' })
    );
    assert(
      endNonActing.status === 400 && endNonActing.body?.code === 'NOT_ACTING_AS',
      'Test (G): normal non-acting session /end returns 400 NOT_ACTING_AS',
      `status=${endNonActing.status} code=${endNonActing.body?.code}`
    );

    const endValid = await invokeHandlers(
      routeHandlers(endRoute),
      buildReq('POST', {}, { reason: 'route-end' }, { [COOKIE_NAME]: actingToken })
    );
    assert(
      endValid.status === 200 &&
        endValid.body?.success === true &&
        endValid.body?.actor_id === 'FC-2401199' &&
        endValid.body?.subject_id === 'STF-TGL-01',
      'Test (G): valid Acting-As /end returns 200',
      `status=${endValid.status} body=${JSON.stringify(endValid.body)}`
    );

    const endReplay = await invokeHandlers(
      routeHandlers(endRoute),
      buildReq('POST', {}, { reason: 'route-end-replay' }, { [COOKIE_NAME]: actingToken })
    );
    assert(endReplay.status === 401, 'Test (G): replay /end with old token is rejected (401)', `got ${endReplay.status}`);
  }

  // A. Replay after /end is rejected (authenticated request with old token).
  const actingToken2 = (
    await ActingAsService.startActingAs({
      actor: adminActor,
      targetOperatorId: 'STF-TGL-01',
      reason: 'replay-test'
    })
  ).token as string;
  const decoded2: any = AuthService.verifyToken(actingToken2);
  await ActingAsService.endActingAs({ actingAsUser: decoded2, reason: 'replay-test-end' });
  assert(
    !sessionManager.isSessionActive(decoded2.session_id),
    'Test (A): Acting-As session is revoked after /end'
  );

  // B. Replay through /api/auth/refresh is rejected.
  const refreshRoute = findAuthRoute('post', '/refresh');
  if (refreshRoute) {
    const refreshReplay = await invokeHandlers(
      routeHandlers(refreshRoute),
      buildReq('POST', {}, {}, { [COOKIE_NAME]: actingToken2 })
    );
    assert(refreshReplay.status === 401, 'Test (B): /refresh with ended Acting-As token is rejected (401)', `got ${refreshReplay.status}`);
  } else {
    assert(false, 'Test (B): /refresh route is registered');
  }

  // C. Deactivated actor cannot refresh an Acting-As session.
  const actingForActor = await ActingAsService.startActingAs({
    actor: adminActor,
    targetOperatorId: 'STF-TGL-01',
    reason: 'actor-liveness'
  });
  const decodedForActor: any = AuthService.verifyToken(actingForActor.token as string);

  if (originalActorProfile) {
    IdentityService.registerOrUpdateIdentity({
      operator_id: originalActorProfile.operator_id,
      full_name: originalActorProfile.full_name,
      username: originalActorProfile.username,
      email: originalActorProfile.email,
      pin: originalActorProfile.pin,
      app_role: originalActorProfile.app_role,
      primary_estate_id: originalActorProfile.primary_estate_id,
      station_name: originalActorProfile.station_name,
      kiosk_id: originalActorProfile.kiosk_id,
      is_active: false
    });
  }
  const deactivatedRefresh = await AuthService.refreshSessionToken(decodedForActor);
  assert(deactivatedRefresh === null, 'Test (C): deactivated actor cannot refresh Acting-As session');

  // D. Actor loses Super Admin status -> refresh rejected.
  if (originalActorProfile) {
    IdentityService.registerOrUpdateIdentity({
      operator_id: originalActorProfile.operator_id,
      full_name: originalActorProfile.full_name,
      username: originalActorProfile.username,
      email: originalActorProfile.email,
      pin: originalActorProfile.pin,
      app_role: 'staff',
      primary_estate_id: originalActorProfile.primary_estate_id,
      station_name: originalActorProfile.station_name,
      kiosk_id: originalActorProfile.kiosk_id,
      is_active: true
    });
  }
  const demotedRefresh = await AuthService.refreshSessionToken(decodedForActor);
  assert(demotedRefresh === null, 'Test (D): actor that lost Super Admin status cannot refresh Acting-As session');

  // Restore actor to canonical Super Admin.
  if (originalActorProfile) {
    IdentityService.registerOrUpdateIdentity({
      operator_id: originalActorProfile.operator_id,
      full_name: originalActorProfile.full_name,
      username: originalActorProfile.username,
      email: originalActorProfile.email,
      pin: originalActorProfile.pin,
      app_role: originalActorProfile.app_role,
      primary_estate_id: originalActorProfile.primary_estate_id,
      station_name: originalActorProfile.station_name,
      kiosk_id: originalActorProfile.kiosk_id,
      is_active: true
    });
  }
  const restoredRefresh = await AuthService.refreshSessionToken(decodedForActor);
  assert(
    restoredRefresh !== null && restoredRefresh.user.app_metadata.acting_as === true,
    'Test (D): valid actor can still refresh Acting-As session (normal path intact)'
  );

  // 8. IMPERSONATION_END audited + actor session preserved.
  const endResult = await ActingAsService.endActingAs({ actingAsUser: decodedForActor, reason: 'unit-test-end' });
  assert(
    endResult.success === true && endResult.actor_id === 'FC-2401199' && endResult.subject_id === 'STF-TGL-01',
    'Test: Super Admin can end Acting-As and returns actor_id/subject_id',
    `code=${endResult.code}`
  );
  assert(!sessionManager.isSessionActive(decodedForActor.session_id), 'Test: Acting-As subject session is revoked on end');
  assert(sessionManager.isSessionActive(adminActor.session_id), 'Test: Super Admin own session remains ACTIVE after Acting-As end');

  const endEvents = auditService.query({ action: 'IMPERSONATION_END' }).logs;
  const firstEnd: any = endEvents[0];
  assert(
    endEvents.length > 0 &&
      firstEnd?.details?.actor_id === 'FC-2401199' &&
      firstEnd?.details?.subject_id === 'STF-TGL-01',
    'Test: IMPERSONATION_END is audited with actor_id + subject_id',
    `events=${endEvents.length}`
  );
  assert(!!firstEnd?.timestamp && firstEnd?.result === 'SUCCESS', 'Test: IMPERSONATION_END audit carries timestamp + result');
  const serializedEnd = JSON.stringify(firstEnd || {});
  assert(
    !serializedEnd.includes('123456') && !serializedEnd.includes('"password"'),
    'Test: no PIN/password secret appears in IMPERSONATION_END audit'
  );

  const refreshDenyEvents = auditService
    .query({ action: 'AUTHORIZATION_DENIED' })
    .logs.filter((e) => e.resource === 'auth/refresh' && (e.details as any)?.reason === 'ACTING_AS_ACTOR_INVALID');
  assert(
    refreshDenyEvents.length >= 2,
    'Test (C/D): invalid-actor refresh denials are audited',
    `events=${refreshDenyEvents.length}`
  );

  // H. Durable store fallback is a no-op when not configured (test/dev env).
  assert(
    isDurableSessionStoreConfigured() === false,
    'Test (H): durable store reports unconfigured without real Supabase credentials (no mock calls)'
  );
  assert(
    (await getDurableSessionStatus('00000000-0000-0000-0000-000000000000')) === 'UNKNOWN',
    'Test (H): unconfigured durable status returns UNKNOWN'
  );
  assert(
    (await isActingAsSessionDurableActive('00000000-0000-0000-0000-000000000000')) === true,
    'Test (H): unconfigured durable active check defers to in-memory authority'
  );

  // 10 / F. Legacy PIN authentication unchanged and never reinterpreted.
  const legacy = AuthService.verifyPin('123456');
  assert(
    legacy !== null &&
      legacy.app_metadata.operator_id === 'STF-TGL-01' &&
      legacy.app_metadata.auth_method === 'PIN_KIOSK' &&
      legacy.app_metadata.acting_as !== true,
    'Test (F): legacy PIN authentication still returns a normal PIN_KIOSK session'
  );
  assert(
    legacy !== null && legacy.app_metadata.actor_id === 'STF-TGL-01' && legacy.app_metadata.subject_id === 'STF-TGL-01',
    'Test: normal login sets actor_id === subject_id'
  );

  const legacyPassword = AuthService.verifyPassword('admin', 'Ipds#2026Admin!');
  assert(
    legacyPassword !== null && legacyPassword.app_metadata.acting_as !== true,
    'Test (F): legacy enterprise password authentication still works and is not Acting-As'
  );

  const legacyDecoded: any = AuthService.verifyToken(AuthService.generateToken(legacy!));
  const endOnLegacy = await ActingAsService.endActingAs({ actingAsUser: legacyDecoded });
  assert(
    endOnLegacy.success === false && endOnLegacy.code === 'NOT_ACTING_AS',
    'Test (F): legacy PIN session is NOT reinterpreted as Acting-As',
    `code=${endOnLegacy.code}`
  );

  console.log(`\nMODULE 49 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
  } finally {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  }
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /acting_as\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runActingAsTests()
    .then((res) => process.exit(res.passed === res.total ? 0 : 1))
    .catch((err) => {
      console.error('P1 Acting-As suite execution error:', err);
      process.exit(1);
    });
}
