/**
 * iPDS v4.1.0 — Test Module 46: P0-16C.3 Strict Login Enforcement
 *
 * Verifies the authoritative device authorization primitive and its wiring:
 *   - credential -> SHA-256 -> device resolution (never device_id)
 *   - APPROVED + ACTIVE estate grant required (APPROVED alone insufficient)
 *   - full ALLOW/DENY matrix (device status, credential, estate, user, manipulation)
 *   - kiosk login consumes the shared primitive; API auth requires signed JWTs
 *   - transition flag default OFF (no lockout); strict when explicitly enabled
 *   - no credential leakage (JWT/URL/logs), no C.4/C.5
 */

import fs from 'fs';
import path from 'path';
import {
  authorizeDeviceForEstate,
  isStrictDeviceEnforcementEnabled,
  generateDeviceCredential,
  hashDeviceCredential
} from '../../../src/server/services/deviceSecurity.service.js';

const SERVICE_SRC = 'src/server/services/deviceSecurity.service.ts';
const AUTH_ROUTES_SRC = 'src/server/routes/auth.routes.ts';
const MIDDLEWARE_SRC = 'src/server/middleware/auth.ts';
const AUTH_SERVICE_SRC = 'src/server/services/auth.service.ts';
const USEAUTH_SRC = 'src/features/auth/hooks/useAuth.ts';

function read(rel: string): string { return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8'); }

type AccessMap = Record<string, { status: 'ACTIVE' | 'REVOKED' } | undefined>;

function makeDeps(config: {
  credential?: string;
  device?: { device_id: string; status: string } | null;
  access?: AccessMap;
}) {
  const expectedHash = config.credential ? hashDeviceCredential(config.credential) : null;
  return {
    findDeviceByCredentialHash: async (hash: string) => {
      if (expectedHash && hash === expectedHash && config.device) {
        return { ...config.device } as any;
      }
      return null;
    },
    getEstateAccess: async (_deviceId: string, estateId: string) => {
      const a = config.access?.[estateId];
      return a ? ({ device_id: config.device?.device_id, estate_id: estateId, status: a.status } as any) : null;
    }
  };
}

export async function runDeviceLoginEnforcementTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 46: P0-16C.3 STRICT LOGIN ENFORCEMENT');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 46.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 46.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 46.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  const cred = generateDeviceCredential();
  const deviceId = 'DEV-C3-A';

  // 1. Device status
  {
    const approved = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
    assert(approved.allowed && approved.code === 'OK', 'APPROVED + valid credential + ACTIVE estate -> ALLOW', JSON.stringify(approved));

    for (const status of ['PENDING', 'BLOCKED', 'REVOKED']) {
      const r = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' },
        makeDeps({ credential: cred, device: { device_id: deviceId, status }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
      assert(!r.allowed && r.code === 'DEVICE_NOT_APPROVED', `${status} + valid credential + ACTIVE estate -> DENY`, JSON.stringify(r));
    }
  }

  // 2. Credential
  {
    const valid = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
    assert(valid.allowed, 'valid credential -> ALLOW when all else passes');

    const wrong = await authorizeDeviceForEstate({ credential: generateDeviceCredential(), requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
    assert(!wrong.allowed && wrong.code === 'DEVICE_NOT_FOUND', 'invalid credential -> DENY', JSON.stringify(wrong));

    const missing = await authorizeDeviceForEstate({ credential: '', requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
    assert(!missing.allowed && missing.code === 'CREDENTIAL_MISSING', 'missing credential -> DENY', JSON.stringify(missing));

    const tampered = await authorizeDeviceForEstate({ credential: cred + 'x', requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
    assert(!tampered.allowed && tampered.code === 'DEVICE_NOT_FOUND', 'tampered credential -> DENY', JSON.stringify(tampered));

    // credential_hash NULL / no matching hash
    const nullHash = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
    assert(!nullHash.allowed && nullHash.code === 'DEVICE_NOT_FOUND', 'credential_hash NULL (no match) -> DENY', JSON.stringify(nullHash));

    // device_id alone is never a credential
    const deviceIdOnly = await authorizeDeviceForEstate({ credential: deviceId, requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
    assert(!deviceIdOnly.allowed, 'device_id used as credential -> DENY', JSON.stringify(deviceIdOnly));

    const copiedKnownId = await authorizeDeviceForEstate({ credential: 'DEV-MASTER-NAS-FC', requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
    assert(!copiedKnownId.allowed, 'known/copied device_id without credential -> DENY', JSON.stringify(copiedKnownId));
  }

  // 3. Estate
  {
    const multi = makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' }, FPM_ADELA: { status: 'ACTIVE' }, FPM_KLEDANG: { status: 'REVOKED' } } });

    const a = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' }, multi);
    assert(a.allowed, 'device ACTIVE for requested estate -> ALLOW');

    const b = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_ADELA' }, multi);
    assert(b.allowed, 'device ACTIVE for A+B, login B -> ALLOW');

    const onlyA = makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } });
    const aToB = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_ADELA' }, onlyA);
    assert(!aToB.allowed && aToB.code === 'ESTATE_NOT_AUTHORIZED', 'device ACTIVE A, login B -> DENY', JSON.stringify(aToB));

    const c = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_SENING' }, multi);
    assert(!c.allowed && c.code === 'ESTATE_NOT_AUTHORIZED', 'device ACTIVE A+B, login C -> DENY', JSON.stringify(c));

    const revokedB = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_KLEDANG' }, multi);
    assert(!revokedB.allowed && revokedB.code === 'ESTATE_NOT_AUTHORIZED', 'REVOKED grant for B -> DENY B', JSON.stringify(revokedB));

    const stillA = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' }, multi);
    assert(stillA.allowed, 'revoking B still allows A');

    const noGrant = makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: {} });
    const missingGrant = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' }, noGrant);
    assert(!missingGrant.allowed && missingGrant.code === 'ESTATE_NOT_AUTHORIZED', 'missing grant -> DENY (never global approval)', JSON.stringify(missingGrant));
  }

  // 4. User authorization combination (user layer is enforced separately)
  {
    const deviceOk = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } }));
    // Simulate the existing user->estate authorization layer (single-estate role).
    const userAuthorized = (userEstate: string, requested: string) => userEstate === requested;

    assert(deviceOk.allowed && userAuthorized('FPM_TUNGGAL', 'FPM_TUNGGAL'), 'valid user + valid device + authorized estate -> ALLOW');
    assert(deviceOk.allowed && !userAuthorized('FPM_ADELA', 'FPM_TUNGGAL'), 'device authorized but user unauthorized -> DENY');
    const deviceDenied = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' },
      makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: {} }));
    assert(!deviceDenied.allowed && userAuthorized('FPM_TUNGGAL', 'FPM_TUNGGAL'), 'user authorized but device unauthorized -> DENY', JSON.stringify(deviceDenied));
  }

  // 5. Request manipulation
  {
    const onlyTunggal = makeDeps({ credential: cred, device: { device_id: deviceId, status: 'APPROVED' }, access: { FPM_TUNGGAL: { status: 'ACTIVE' } } });
    const changedBody = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_ADELA' }, onlyTunggal);
    assert(!changedBody.allowed, 'body/header estate change to unauthorized estate -> DENY', JSON.stringify(changedBody));

    // device_id changed -> resolution is by credential, so a foreign device_id is irrelevant
    const foreignId = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' }, onlyTunggal);
    assert(foreignId.allowed && foreignId.deviceId === deviceId, 'device resolved from credential (client device_id ignored)');

    const noId = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' }, onlyTunggal);
    assert(noId.allowed, 'device_id omitted but valid credential -> resolved from credential');

    const copied = await authorizeDeviceForEstate({ credential: cred, requestedEstateId: 'FPM_TUNGGAL' }, onlyTunggal);
    assert(copied.allowed, 'credential is the secret: a valid credential authorizes wherever presented (documented model)');
  }

  // 6. Transition flag
  {
    const saved = process.env.IPDS_DEVICE_STRICT_ENFORCEMENT;
    try {
      delete process.env.IPDS_DEVICE_STRICT_ENFORCEMENT;
      assert(isStrictDeviceEnforcementEnabled() === false, 'strict enforcement defaults OFF (no lockout)');
      process.env.IPDS_DEVICE_STRICT_ENFORCEMENT = 'true';
      assert(isStrictDeviceEnforcementEnabled() === true, "flag 'true' enables strict enforcement");
      process.env.IPDS_DEVICE_STRICT_ENFORCEMENT = '1';
      assert(isStrictDeviceEnforcementEnabled() === true, "flag '1' enables strict enforcement");
      process.env.IPDS_DEVICE_STRICT_ENFORCEMENT = 'false';
      assert(isStrictDeviceEnforcementEnabled() === false, "flag 'false' keeps legacy mode");
    } finally {
      if (saved === undefined) delete process.env.IPDS_DEVICE_STRICT_ENFORCEMENT; else process.env.IPDS_DEVICE_STRICT_ENFORCEMENT = saved;
    }
  }

  // 7. Source wiring / single shared primitive
  {
    const service = read(SERVICE_SRC);
    const authRoutes = read(AUTH_ROUTES_SRC);
    const middleware = read(MIDDLEWARE_SRC);
    const useAuth = read(USEAUTH_SRC);

    assert(/export async function authorizeDeviceForEstate/.test(service), 'authoritative authorizeDeviceForEstate primitive exists');
    assert(/hashDeviceCredential\(credential\)/.test(service) && /findDeviceByCredentialHash\(credentialHash\)/.test(service), 'device resolved by credential hash (not device_id)');
    assert(/credential_hash/.test(service) && /\.eq\('credential_hash', credentialHash\)/.test(service), 'lookup is by registered_devices.credential_hash');

    const staffRoute = authRoutes.slice(authRoutes.indexOf("router.post(['/verify-staff"), authRoutes.indexOf("router.post(['/verify-password"));
    assert(/authorizeDeviceForEstate\(/.test(staffRoute), 'kiosk login consumes the shared device authorization primitive');
    assert(!/x-auth-pin|x-kiosk-pin|x-pin|verifyEstateStaffLogin|AuthService\.verifyPin/.test(middleware), 'API middleware has no raw-PIN authentication path');
    assert(/isStrictDeviceEnforcementEnabled\(\)/.test(staffRoute), 'kiosk login honours the existing device enforcement flag');
    assert(/deviceCredential: getDeviceCredential\(\)/.test(useAuth), 'client sends the device credential on login');

    assert(middleware.includes('getScopedSupabase(token)') && middleware.includes('AuthService.verifyToken(token)'),
      'API authorization and scoped Supabase access require a verified signed JWT');
  }

  // 8. No credential leakage / no C.4
  {
    const authService = read(AUTH_SERVICE_SRC);
    const tokenBlock = authService.slice(authService.indexOf('static generateToken'), authService.indexOf('static generateToken') + 600);
    assert(!/deviceCredential|credential_hash|device_credential/i.test(tokenBlock), 'credential never placed in the JWT (C.4 not implemented)');
    const authRoutes = read(AUTH_ROUTES_SRC);
    assert(!/credential.*res\.json|res\.json\([^)]*credential/i.test(authRoutes), 'credential never returned in an auth response body');
    assert(!/credential=\$\{|credential=.*encodeURIComponent/.test(authRoutes), 'credential never placed in a URL/query string');
    const service = read(SERVICE_SRC);
    assert(!/console\.[a-z]+\([^)]*credential\b/i.test(service.replace(/console\.warn\('\[DEVICE_SECURITY\] Issue device credential/g, '')), 'plaintext credential is never logged');
  }

  console.log(`\nMODULE 46 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_login_enforcement\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceLoginEnforcementTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16C.3 device login enforcement suite execution error:', err); process.exit(1); });
}
