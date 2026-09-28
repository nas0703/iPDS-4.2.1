import { DEFAULT_PIN_REGISTRY, AVAILABLE_MODULES, isSuperAdmin } from '../../../src/features/auth/services/rbacService.js';
import { AuthService } from '../../../src/server/services/auth.service.js';
import { requireRole, COOKIE_NAME } from '../../../src/server/middleware/auth.js';
import { canSwitchEstates, getAccessibleEstatesForUser, getAllEstatesList } from '../../../src/config/estateRegistry.js';

export async function runRbacTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 2: RBAC (ROLE-BASED ACCESS CONTROL) REGRESSION TESTS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 2.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 2.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. PIN Registry completeness
  const rolesFound = new Set(Object.values(DEFAULT_PIN_REGISTRY).map(c => c.role));
  assert(rolesFound.has('fc') && rolesFound.has('pf') && rolesFound.has('staff'), 'PIN Registry contains FC, PF, and Staff role definitions');

  // 2. Field Controller (FC) full module access
  const fcConfig = DEFAULT_PIN_REGISTRY['role_fc_tgl'] || DEFAULT_PIN_REGISTRY['654321'] || Object.values(DEFAULT_PIN_REGISTRY).find(c => c.role === 'fc' && c.estate_id === 'FPM_TUNGGAL');
  assert(fcConfig && fcConfig.allowedModules.length === 11, 'FC role has access to all 11 modules including settings');

  // 3. Mandur restricted access
  const mandurConfig = DEFAULT_PIN_REGISTRY['role_mandur_tgl'] || DEFAULT_PIN_REGISTRY['222222'] || Object.values(DEFAULT_PIN_REGISTRY).find(c => c.label.includes('Mandur'));
  assert(mandurConfig && mandurConfig.allowedModules.length === 2 && mandurConfig.allowedModules.includes('hasil') && mandurConfig.allowedModules.includes('pekerja'), 'Mandur role is strictly restricted to hasil and pekerja modules');

  // 4. Role middleware gate enforcement (Authorized role)
  let authorizedOk = false;
  const fcSession = AuthService.verifyPin('654321');
  if (fcSession) {
    const fcToken = AuthService.generateToken(fcSession);
    const mockReqAuth: any = {
      headers: {},
      cookies: { [COOKIE_NAME]: fcToken }
    };
    const mockResAuth: any = { status: () => mockResAuth, json: () => mockResAuth };
    const middlewareFc = requireRole(['pf', 'fc']);
    middlewareFc(mockReqAuth, mockResAuth, () => {
      authorizedOk = true;
    });
  }
  assert(authorizedOk, 'requireRole([pf, fc]) allows valid FC session token access');

  // 5. Role middleware gate enforcement (Unauthorized role)
  let unauthorizedBlocked = false;
  const staffSession = AuthService.verifyPin('123456');
  if (staffSession) {
    const staffToken = AuthService.generateToken(staffSession);
    const mockReqStaff: any = {
      headers: {},
      cookies: { [COOKIE_NAME]: staffToken }
    };
    const mockResStaff: any = {
      status(code: number) {
        if (code === 403) unauthorizedBlocked = true;
        return mockResStaff;
      },
      json() {
        return mockResStaff;
      }
    };
    const middlewarePfFc = requireRole(['pf', 'fc']);
    middlewarePfFc(mockReqStaff, mockResStaff, () => {});
  }
  assert(unauthorizedBlocked, 'requireRole([pf, fc]) blocks authenticated Staff role with 403 FORBIDDEN');

  // 6. Available modules registration
  assert(AVAILABLE_MODULES.length >= 11, 'All 11 core operational modules registered in RBAC configuration');

  // 7. Canonical Super Admin truth table (P1-09 parity + P0 admin least-privilege).
  //    RC/OC/PF/branch-FC are NOT Super Admin; admin aliases + FC Tunggal ARE.
  {
    const truthTable: Array<{ label: string; role: string; estate?: string; expect: boolean }> = [
      { label: 'rc', role: 'rc', expect: false },
      { label: 'oc', role: 'oc', expect: false },
      { label: 'pf', role: 'pf', expect: false },
      { label: 'staff', role: 'staff', expect: false },
      { label: 'branch FC (FPM_ADELA)', role: 'fc', estate: 'FPM_ADELA', expect: false },
      { label: 'admin alias', role: 'admin', expect: true },
      { label: 'super_admin alias', role: 'super_admin', expect: true },
      { label: 'superadmin alias', role: 'superadmin', expect: true },
      { label: 'FC Tunggal (FPM_TUNGGAL)', role: 'fc', estate: 'FPM_TUNGGAL', expect: true }
    ];
    const wrong = truthTable.filter((t) => isSuperAdmin(t.role, t.estate) !== t.expect);
    assert(
      wrong.length === 0,
      'isSuperAdmin truth table: admin aliases + FC Tunggal are Super Admin; rc/oc/pf/staff/branch-FC are not',
      wrong.map((t) => `${t.label}->${isSuperAdmin(t.role, t.estate)}`).join(', ')
    );
  }

  // 8. Estate switching: role-based default and Super Admin (FC Tunggal) override.
  assert(
    canSwitchEstates('rc') && canSwitchEstates('oc') && canSwitchEstates('pf') && !canSwitchEstates('fc') && !canSwitchEstates('staff'),
    'canSwitchEstates grants switching to rc/oc/pf only by default'
  );
  assert(
    canSwitchEstates('fc', true) && canSwitchEstates(null, true),
    'canSwitchEstates Super Admin override allows FC Tunggal (and role-less super admin) to switch estates'
  );
  assert(
    getAccessibleEstatesForUser('fc', 'FPM_TUNGGAL', true).length === getAllEstatesList().length &&
      getAccessibleEstatesForUser('fc', 'FPM_ADELA', false).length === 1 &&
      getAccessibleEstatesForUser('fc', 'FPM_ADELA', false)[0].id === 'FPM_ADELA',
    'getAccessibleEstatesForUser returns all estates for FC Tunggal and own estate only for a branch FC'
  );

  return { passed, total };
}
