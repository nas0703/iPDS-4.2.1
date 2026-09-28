import { IdentityService, UnifiedIdentityProfile } from '../../../src/server/services/identity.service.js';
import { AuthService } from '../../../src/server/services/auth.service.js';
import { extractUserFromRequest, COOKIE_NAME } from '../../../src/server/middleware/auth.js';

export async function runUnifiedIdentityTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 14: UNIFIED IDENTITY CONSOLIDATION & SSOT TESTS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 14.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 14.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Unified Identity Lookup by PIN
  const profileByPin = IdentityService.findIdentityByPin('123456');
  assert(
    profileByPin !== null && profileByPin.operator_id === 'STF-TGL-01' && profileByPin.app_role === 'staff',
    'IdentityService resolves PIN 123456 to unified profile STF-TGL-01'
  );

  // 2. Unified Identity Lookup by Staff No / Operator ID
  const profileByStaff = IdentityService.findIdentityByStaffNo('FC-2401199');
  assert(
    profileByStaff !== null && profileByStaff.full_name.startsWith('MD NASRUDDIN BIN BHSERAN') && profileByStaff.primary_estate_id === 'FPM_TUNGGAL',
    'IdentityService resolves Operator ID FC-2401199 correctly',
    `profileByStaff=${JSON.stringify(profileByStaff)}`
  );

  // 3. Unified Identity Lookup by Enterprise Credentials
  const profileByCreds = IdentityService.findIdentityByCredentials('admin', 'Ipds#2026Admin!');
  assert(
    profileByCreds !== null && profileByCreds.app_role === 'rc' && profileByCreds.operator_id === 'RC-0001',
    'IdentityService resolves Enterprise Admin credentials to RC-0001'
  );

  // 4. Session Claims Standardization for PIN Kiosk Login
  const pinSession = AuthService.verifyPin('654321');
  assert(
    pinSession !== null &&
    pinSession.app_metadata.operator_id === 'FC-TGL-01' &&
    pinSession.app_metadata.auth_method === 'PIN_KIOSK' &&
    !!pinSession.app_metadata.user_id &&
    Array.isArray(pinSession.app_metadata.assigned_estates),
    'PIN Kiosk login produces standardized unified claims schema'
  );

  // 5. Session Claims Standardization for Staff No Login (Requires valid secret)
  const missingSecretSession = AuthService.verifyEstateStaffLogin('FPM_ADELA', 'STF-ADL-01', '');
  assert(
    missingSecretSession === null,
    'Estate Staff login without secret is strictly rejected'
  );

  const wrongSecretSession = AuthService.verifyEstateStaffLogin('FPM_ADELA', 'STF-ADL-01', '000000');
  assert(
    wrongSecretSession === null,
    'Estate Staff login with incorrect secret is strictly rejected'
  );

  const staffSession = AuthService.verifyEstateStaffLogin('FPM_ADELA', 'STF-ADL-01', '100300');
  assert(
    staffSession !== null &&
    staffSession.app_metadata.estate_id === 'FPM_ADELA' &&
    staffSession.app_metadata.operator_id === 'STF-ADL-01' &&
    staffSession.app_metadata.auth_method === 'ESTATE_STAFF_PIN',
    'Estate Staff login with valid secret produces standardized unified claims schema for FPM_ADELA'
  );

  // 6. Cross-Estate Single-Estate Role Rejection (Adela Staff attempting Tunggal)
  const crossEstateDenied = AuthService.verifyEstateStaffLogin('FPM_TUNGGAL', 'STF-ADL-01', '100300');
  assert(
    crossEstateDenied === null,
    'Single-estate staff attempting cross-estate login is strictly rejected by Identity Service'
  );

  // 7. Multi-Estate Role Cross-Estate Authorization (RC Wilayah JB accessing Sening)
  const rcCrossEstate = AuthService.verifyEstateStaffLogin('FPM_SENING', 'RC-0001', '111111');
  assert(
    rcCrossEstate !== null && rcCrossEstate.app_metadata.estate_id === 'FPM_SENING',
    'Multi-estate executive (RC) successfully connects to target estate FPM_SENING'
  );

  // 8. Dynamic Registration & SSOT Sync
  const customProfile = IdentityService.registerOrUpdateIdentity({
    pin: '987654',
    app_role: 'mandur',
    full_name: 'Ahmad Mandur Baru',
    operator_id: 'MDR-NEW-01',
    primary_estate_id: 'FPM_KLEDANG',
    station_name: 'Pos Mandur Kledang'
  });
  const verifiedDynamic = AuthService.verifyPin('987654');
  assert(
    verifiedDynamic !== null &&
    verifiedDynamic.app_metadata.operator_id === 'MDR-NEW-01' &&
    verifiedDynamic.app_metadata.estate_id === 'FPM_KLEDANG',
    'Dynamically registered profile immediately authenticates across AuthService'
  );

  // 9. JWT Token Serialization and Claims Preservation
  if (pinSession) {
    const token = AuthService.generateToken(pinSession);
    const mockReq: any = { cookies: { [COOKIE_NAME]: token }, headers: {} };
    const { user } = extractUserFromRequest(mockReq);
    assert(
      user !== null &&
      user.app_metadata.operator_id === 'FC-TGL-01' &&
      user.app_metadata.auth_method === 'PIN_KIOSK' &&
      user.app_metadata.estate_id === 'FPM_TUNGGAL',
      'JWT token round-trip preserves all unified identity metadata and claims'
    );
  } else {
    assert(false, 'JWT verification skipped due to missing pinSession');
  }

  // 10. Total Registered Unified Profiles Integrity
  const allProfiles = IdentityService.getAllProfiles();
  assert(
    allProfiles.length >= 22,
    `Master Identity Registry maintains minimum 22 seeded enterprise profiles (Actual: ${allProfiles.length})`
  );

  console.log(`\nMODULE 14 RESULT: ${passed}/${total} TESTS PASSED\n`);
  return { passed, total };
}
