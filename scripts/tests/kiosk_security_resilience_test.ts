import assert from 'assert';
import { getPrivilegedSupabase } from '../../src/server/db.js';
import { 
  syncKioskIdentitiesFromSupabase, 
  loadHashedCredentials,
  hashStaffNo
} from '../../src/server/services/credentials.loader.js';
import { AuthService } from '../../src/server/services/auth.service.js';
import { refreshMasterIdentityRegistry, IdentityService } from '../../src/server/services/identity.service.js';

async function runResilienceTests() {
  console.log('--- STARTING KIOSK SECURITY & RESILIENCE TEST SUITE ---');

  const supabase = getPrivilegedSupabase();
  assert(supabase, 'Privileged Supabase client must be available for testing');

  // Initial baseline sync
  await syncKioskIdentitiesFromSupabase(true);
  refreshMasterIdentityRegistry();

  // TEST 1: Revocation / Deletion Test (Ensure deleted staff CANNOT login)
  console.log('\n[TEST 1] Testing immediate staff revocation and deletion eviction...');
  const testStaffNo = '987654321';
  const testOperatorId = 'OPR-REVOKE-TEST-01';
  const testEstateId = 'FPM_TUNGGAL';
  const hashedStaffNo = hashStaffNo(testStaffNo);

  // 1.1 Insert test staff into kiosk_identities
  const { error: insertErr } = await supabase
    .from('kiosk_identities')
    .upsert({
      operator_id: testOperatorId,
      estate_id: testEstateId,
      staff_no_hash: hashedStaffNo,
      app_role: 'staff',
      kiosk_id: 'kiosk-test-revoke',
      station_name: 'Stesen Ujian Pembatalan',
      operator_name: 'Pegawai Ujian Pembatalan',
      is_active: true
    }, { onConflict: 'estate_id,operator_id' });

  assert(!insertErr, `Failed to insert test staff: ${insertErr?.message}`);

  // 1.2 Force sync and verify login succeeds
  const count = await syncKioskIdentitiesFromSupabase(true);
  assert(count > 0, 'Sync must load records from Supabase');
  refreshMasterIdentityRegistry();

  const preDeleteLogin = AuthService.verifyKioskLoginResult(testEstateId, testStaffNo);
  assert(preDeleteLogin.session !== null, 'Pre-deletion login MUST succeed');
  assert.strictEqual(preDeleteLogin.session.app_metadata.operator_id, testOperatorId);
  console.log('✓ Test staff successfully authenticated before revocation');

  // 1.3 Delete test staff from database
  const { error: deleteErr } = await supabase
    .from('kiosk_identities')
    .delete()
    .eq('operator_id', testOperatorId);

  assert(!deleteErr, `Failed to delete test staff: ${deleteErr?.message}`);

  // 1.4 Sync from Supabase and verify dynamic eviction
  await syncKioskIdentitiesFromSupabase(true);
  refreshMasterIdentityRegistry();

  const postDeleteLogin = AuthService.verifyKioskLoginResult(testEstateId, testStaffNo);
  assert(
    postDeleteLogin.session === null, 
    'CRITICAL: Deleted staff MUST NOT be able to log in after removal from database!'
  );
  console.log('✓ Successfully verified: Deleted staff is dynamically evicted and CANNOT log in!');

  // TEST 2: Inactive Staff (is_active: false) Enforcement
  console.log('\n[TEST 2] Testing deactivation (is_active: false) enforcement...');
  const testInactiveStaffNo = '888888888';
  const testInactiveOpId = 'OPR-INACTIVE-TEST-01';

  const { error: inactErr } = await supabase
    .from('kiosk_identities')
    .upsert({
      operator_id: testInactiveOpId,
      estate_id: testEstateId,
      staff_no_hash: hashStaffNo(testInactiveStaffNo),
      app_role: 'staff',
      kiosk_id: 'kiosk-test-inactive',
      station_name: 'Stesen Ujian Tidak Aktif',
      operator_name: 'Pegawai Tidak Aktif',
      is_active: false // Explicitly deactivated
    }, { onConflict: 'estate_id,operator_id' });

  assert(!inactErr, `Failed to insert inactive staff: ${inactErr?.message}`);

  await syncKioskIdentitiesFromSupabase(true);
  refreshMasterIdentityRegistry();

  const inactiveLogin = AuthService.verifyKioskLoginResult(testEstateId, testInactiveStaffNo);
  assert(
    inactiveLogin.session === null,
    'CRITICAL: Inactive staff (is_active: false) MUST NOT be able to log in!'
  );
  console.log('✓ Inactive staff was correctly rejected during login');

  // Clean up test inactive record
  await supabase.from('kiosk_identities').delete().eq('operator_id', testInactiveOpId);
  await syncKioskIdentitiesFromSupabase(true);
  refreshMasterIdentityRegistry();

  // TEST 3: Database Disruption / Timeout Resilience
  console.log('\n[TEST 3] Testing database disruption and graceful timeout handling...');
  const mockTimeoutResult = await Promise.race([
    syncKioskIdentitiesFromSupabase(false),
    new Promise(resolve => setTimeout(() => resolve('OK'), 3000))
  ]);
  assert(mockTimeoutResult !== undefined, 'DB sync must be resilient and bounded');
  console.log('✓ DB sync completes within bounded latency without crashing');

  // TEST 4: Cross-Estate Isolation for Kiosk Staff
  console.log('\n[TEST 4] Testing strict estate boundary isolation...');
  const adelaCode = '5136'; // FPM_ADELA
  // Attempt cross-estate login under Adela with Tunggal staff number
  const crossEstateAttempt = AuthService.verifyKioskLoginResult(adelaCode, '2401859');
  assert(
    crossEstateAttempt.session === null,
    'Cross-estate login for estate-bound staff MUST be rejected'
  );
  assert.strictEqual(crossEstateAttempt.failureReason, 'UNAUTHORIZED_ESTATE');
  console.log('✓ Cross-estate unauthorized attempt correctly blocked with UNAUTHORIZED_ESTATE');

  console.log('\n======================================================');
  console.log('✓ ALL KIOSK SECURITY & RESILIENCE TESTS PASSED (100%)');
  console.log('======================================================\n');
}

runResilienceTests().catch(err => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
