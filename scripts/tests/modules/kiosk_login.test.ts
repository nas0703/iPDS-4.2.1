import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { runKioskLoginAttempt } from '../../../src/features/auth/services/kioskLoginFlow.js';
import { buildHashedCredentials } from '../../seed_credentials.js';
import authRoutes from '../../../src/server/routes/auth.routes.js';
import { IdentityService } from '../../../src/server/services/identity.service.js';
import { AuthService } from '../../../src/server/services/auth.service.js';
import { isSuperAdminIdentity } from '../../../src/server/middleware/auth.js';
import { hashStaffNo, verifyStaffNoAgainstHash } from '../../../src/server/services/credentials.loader.js';
import { deviceSecurityService } from '../../../src/server/services/deviceSecurity.service.js';

interface RouteResult {
  status: number;
  body: any;
  cookies: Record<string, string>;
}

function findHandler(method: 'get' | 'post', routePath: string): any {
  const layer = (authRoutes as any).stack.find((entry: any) => {
    const paths = Array.isArray(entry.route?.path) ? entry.route.path : [entry.route?.path];
    return entry.route?.methods?.[method] && paths.includes(routePath);
  });
  return layer?.route?.stack?.[layer.route.stack.length - 1]?.handle;
}

function invokeRoute(handler: any, body: any, ip: string): Promise<RouteResult> {
  return new Promise((resolve) => {
    let status = 200;
    let responseBody: any = null;
    const cookies: Record<string, string> = {};
    const req: any = {
      method: 'POST', body, ip, socket: { remoteAddress: ip }, cookies: {}, query: {},
      headers: { 'user-agent': 'KioskLoginTest' },
      get(name: string) { return this.headers[String(name).toLowerCase()]; }
    };
    const res: any = {
      status(code: number) { status = code; return res; },
      cookie(name: string, value: string) { cookies[name] = value; return res; },
      json(value: any) { responseBody = value; resolve({ status, body: responseBody, cookies }); return res; }
    };
    Promise.resolve(handler(req, res)).catch((error) => resolve({
      status: 500,
      body: { error: error?.message || String(error) },
      cookies
    }));
  });
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

export async function runKioskLoginTests() {
  console.log('\n----------------------------------------------------');
  console.log('KIOSK LOGIN HASH, ESTATE, AND RETRY REGRESSIONS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] KIOSK ${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] KIOSK ${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`KIOSK ${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const fixtureStaffNo = 'TEST-KIOSK-ADL-9001';
  IdentityService.registerOrUpdateIdentity({
    pin: '900101',
    password: 'TEST-ONLY-LEGACY-PASSWORD',
    staff_no_hash: bcrypt.hashSync(fixtureStaffNo, 10),
    app_role: 'staff',
    full_name: 'Synthetic Kiosk Test User',
    operator_id: 'TEST-KIOSK-ADL-01',
    primary_estate_id: 'FPM_ADELA',
    station_name: 'Synthetic Test Station'
  });

  const getDeviceStatus = deviceSecurityService.getDeviceStatus;
  const savedStrictFlag = process.env.IPDS_DEVICE_STRICT_ENFORCEMENT;
  delete process.env.IPDS_DEVICE_STRICT_ENFORCEMENT;
  (deviceSecurityService as any).getDeviceStatus = async (deviceId: string) => ({
    device_id: deviceId,
    status: 'APPROVED',
    estate_id: 'FPM_ADELA'
  });

  try {
    const loginHandler = findHandler('post', '/verify-staff');
    assert(typeof loginHandler === 'function', 'POST /verify-staff is registered as the kiosk login endpoint');

    const valid = await invokeRoute(loginHandler, {
      estate_code: '5136', staff_no: ` ${fixtureStaffNo.toLowerCase()} `, deviceId: 'DEV-KIOSK-TEST'
    }, '127.0.10.1');
    assert(valid.status === 200 && valid.body?.success === true && !!valid.body?.token,
      'valid estate and normalized staff-number hash issue a session', `status=${valid.status}`);
    assert(valid.cookies.ipds_session === valid.body?.token && valid.body?.user?.estate_id === 'FPM_ADELA',
      'successful login retains the estate claim and HttpOnly session cookie');
    assert(valid.body?.user?.operator_id === 'TEST-KIOSK-ADL-01', 'JWT response identifies the hash-matched identity');

    const wrongStaff = await invokeRoute(loginHandler, {
      estate_code: 'FPM_ADELA', staff_no: 'TEST-KIOSK-WRONG-9001', deviceId: 'DEV-KIOSK-TEST'
    }, '127.0.10.2');
    assert(wrongStaff.status === 401 && !wrongStaff.body?.token && !wrongStaff.cookies.ipds_session,
      'wrong staff number is rejected without issuing a session');

    const wrongEstate = await invokeRoute(loginHandler, {
      estate_code: '5155', staff_no: fixtureStaffNo, deviceId: 'DEV-KIOSK-TEST'
    }, '127.0.10.3');
    assert(wrongEstate.status === 401 && !wrongEstate.body?.token && !wrongEstate.cookies.ipds_session,
      'authorized staff number cannot authenticate for an unassigned estate');
    const crossEstateResult = AuthService.verifyKioskLoginResult('5155', fixtureStaffNo);
    assert(crossEstateResult.failureReason === 'UNAUTHORIZED_ESTATE' && crossEstateResult.identity?.operator_id === 'TEST-KIOSK-ADL-01',
      'verified cross-estate attempts retain specific audit classification without exposing the credential');

    const unknownStaff = await invokeRoute(loginHandler, {
      estate_code: '5136', staff_no: 'UNKNOWN-ROSTER-9001', deviceId: 'DEV-KIOSK-TEST'
    }, '127.0.10.4');
    assert(unknownStaff.status === 401 && !unknownStaff.body?.token,
      'unknown staff number fails closed');

    const inactiveStaffNo = 'INACTIVE-KIOSK-STAFF-01';
    IdentityService.registerOrUpdateIdentity({
      pin: '900104', staff_no_hash: bcrypt.hashSync(inactiveStaffNo, 10), app_role: 'staff',
      full_name: 'Inactive Kiosk User', operator_id: 'TEST-KIOSK-INACTIVE-01', primary_estate_id: 'FPM_ADELA',
      station_name: 'Inactive Test Station', is_active: false
    });
    assert(AuthService.verifyKioskLogin('FPM_ADELA', inactiveStaffNo) === null,
      'inactive identity cannot authenticate with a matching staff-number hash');

    const noHashFallback = await invokeRoute(loginHandler, {
      estate_code: 'FPM_ADELA', staff_no: 'STF-ADL-01', pin: '100300', secret: '100300',
      password: 'TEST-ONLY-LEGACY-PASSWORD', deviceId: 'DEV-KIOSK-TEST'
    }, '127.0.10.5');
    assert(noHashFallback.status === 401 && !noHashFallback.body?.token,
      'missing staff_no_hash rejects without PIN or password fallback');

    const pinAsStaffNo = await invokeRoute(loginHandler, {
      estate_code: 'FPM_TUNGGAL', staff_no: '123456', pin: '123456', deviceId: 'DEV-KIOSK-TEST'
    }, '127.0.10.6');
    assert(pinAsStaffNo.status === 401 && !pinAsStaffNo.body?.token,
      'six-digit PIN cannot authenticate through the normal kiosk endpoint');

    const passwordAsStaffNo = await invokeRoute(loginHandler, {
      estate_code: 'FPM_ADELA', staff_no: 'TEST-ONLY-LEGACY-PASSWORD', password: 'TEST-ONLY-LEGACY-PASSWORD',
      deviceId: 'DEV-KIOSK-TEST'
    }, '127.0.10.7');
    assert(passwordAsStaffNo.status === 401 && !passwordAsStaffNo.body?.token,
      'legacy password cannot authenticate through the normal kiosk endpoint');

    for (const endpoint of ['/verify-pin', '/verify-password']) {
      const handler = findHandler('post', endpoint);
      const disabled = await invokeRoute(handler, { pin: '123456', identity: 'admin', password: 'anything' }, '127.0.10.8');
      assert(disabled.status === 410 && disabled.body?.code === 'AUTH_METHOD_REMOVED' && !disabled.body?.token,
        `${endpoint} is disabled as a normal login route`);
    }

    const seed = buildHashedCredentials([{
      pin: '900102',
      staff_no: ` ${fixtureStaffNo.toLowerCase()} `,
      app_role: 'staff',
      operator_id: 'TEST-SEED-ONLY-01',
      operator_name: 'Synthetic Seed User',
      kiosk_id: 'TEST-KIOSK',
      estate_id: 'FPM_ADELA',
      station_name: 'Synthetic Seed Station'
    }]);
    const seedCredential = seed['TEST-SEED-ONLY-01'];
    assert(verifyStaffNoAgainstHash(fixtureStaffNo, seedCredential?.staff_no_hash),
      'server seed path writes a bcrypt staff-number hash using canonical normalization');
    assert(!JSON.stringify(seed).includes(fixtureStaffNo), 'seed output contains no plaintext staff number');
    assert(!verifyStaffNoAgainstHash(`${fixtureStaffNo}${'X'.repeat(80)}`, seedCredential?.staff_no_hash),
      'staff number input beyond bcrypt byte limit is rejected, not truncated');
    let oversizedHashRejected = false;
    try { hashStaffNo('X'.repeat(73)); } catch { oversizedHashRejected = true; }
    assert(oversizedHashRejected, 'provisioning rejects staff numbers beyond bcrypt byte limit');
    const unprovisioned = buildHashedCredentials([{
      pin: '900103', app_role: 'staff', operator_id: 'TEST-SEED-MISSING-01', operator_name: 'Synthetic Missing User',
      kiosk_id: 'TEST-KIOSK', estate_id: 'FPM_ADELA', station_name: 'Synthetic Missing Station'
    }]);
    assert(!unprovisioned['TEST-SEED-MISSING-01']?.staff_no_hash,
      'seed does not derive staff_no_hash from PIN when roster staff_no is missing');

    let submitting = false;
    let verifyAttempt = 0;
    const credentialsSent: Array<[string, string]> = [];
    const verify = async (estate: string, staffNo: string) => {
      credentialsSent.push([estate, staffNo]);
      verifyAttempt++;
      return verifyAttempt === 2;
    };
    const firstAttempt = await runKioskLoginAttempt(verify, '5155', 'WRONG-TEST-ID', (value) => { submitting = value; });
    assert(!firstAttempt.success && !submitting, 'failed kiosk request resets submitting state');
    const retryAttempt = await runKioskLoginAttempt(verify, '5136', fixtureStaffNo, (value) => { submitting = value; });
    assert(retryAttempt.success && !submitting && credentialsSent.length === 2,
      'corrected credentials succeed on immediate second attempt without reload');

    const screen = read('src/features/auth/components/LoginScreen.tsx');
    assert(screen.includes('type="submit"') && screen.includes('LOG MASUK') && screen.includes('name="estateCode"') && screen.includes('name="staffNo"'),
      'login UI exposes only the explicit estate/staff-number kiosk form');
    assert(!/No\. PIN \(6 Digit\)|handlePinPress|handleQuickLogin|typedDigits|loginMode/.test(screen),
      'login UI contains no normal PIN mode or keypad flow');
    assert(!/useEffect\([\s\S]{0,600}verifyStaffCredentials/.test(screen), 'login submission is not effect-driven');
    assert(!screen.includes('window.location.reload'), 'failed login recovery does not reload the app');

    const authHook = read('src/features/auth/hooks/useAuth.ts');
    assert(!/getItem\(["']ipds_last_pin/.test(authHook) && !/setItem\(["']ipds_last_pin/.test(authHook) && authHook.includes('removeItem("ipds_last_pin")') && !authHook.includes('/api/auth/verify-pin'),
      'session restoration never uses a cached PIN');
    const safeFetch = read('src/utils/safeFetch.ts');
    assert(!safeFetch.includes('x-auth-pin') && !safeFetch.includes('ipds_last_pin'),
      'shared requests never send staff number as x-auth-pin');
    const privilegedTestPin = '900105';
    IdentityService.registerOrUpdateIdentity({
      pin: privilegedTestPin,
      app_role: 'fc',
      full_name: 'Synthetic Step-Up Administrator',
      operator_id: 'TEST-KIOSK-STEP-UP-FC',
      primary_estate_id: 'FPM_TUNGGAL',
      station_name: 'Synthetic Step-Up Station'
    });
    const superAdminPinSession = AuthService.verifyPin(privilegedTestPin);
    assert(!!superAdminPinSession && isSuperAdminIdentity(superAdminPinSession),
      'Super Admin PIN verification remains available for privileged step-up');
    const authRoutesSource = read('src/server/routes/auth.routes.ts');
    assert(authRoutesSource.includes('AuthService.verifyPin(challenge)'),
      'Super Admin reveal endpoint still validates its explicit PIN challenge');
    const seedSource = read('scripts/seed_credentials.ts');
    assert(seedSource.includes('staff_no_hash') && seedSource.includes('hashStaffNo') && !seedSource.includes('staff_no: user.staff_no'),
      'seed provisioning stores only the server-generated hash');
  } finally {
    (deviceSecurityService as any).getDeviceStatus = getDeviceStatus;
    if (savedStrictFlag === undefined) delete process.env.IPDS_DEVICE_STRICT_ENFORCEMENT;
    else process.env.IPDS_DEVICE_STRICT_ENFORCEMENT = savedStrictFlag;
  }

  console.log(`\nKIOSK LOGIN RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly = /kiosk_login\.test\.[cm]?tsx?$/.test(process.argv[1] || '');
if (invokedDirectly) {
  runKioskLoginTests().then((result) => process.exit(result.passed === result.total ? 0 : 1))
    .catch((error) => { console.error('Kiosk login test failed:', error); process.exit(1); });
}
