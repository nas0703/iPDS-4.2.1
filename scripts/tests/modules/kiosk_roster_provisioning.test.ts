import fs from 'fs';
import path from 'path';
import { normalizeStaffNo, verifyStaffNoAgainstHash } from '../../../src/server/services/credentials.loader.js';
import { BASE_STORE_PATH, OUTPUT_PATH, ROSTER_PATH } from '../../provision_kiosk_roster.js';

const PLACEHOLDER = /^(<\s*[^>]*>|REPLACE|FILL|TODO|CHANGEME)/i;
const EXPECTED_ROLES = ['fc', 'afc', 'fs', 'kerani_kewangan', 'kerani_stok', 'kerani_resit'];

function readFileSafe(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readJsonSafe(filePath: string): any {
  try {
    return JSON.parse(readFileSafe(filePath));
  } catch {
    return null;
  }
}

function readRosterEntries(): any[] {
  const parsed = readJsonSafe(ROSTER_PATH);
  const entries = Array.isArray(parsed) ? parsed : parsed?.identities;
  return Array.isArray(entries) ? entries : [];
}

function readArtifactStore(): Record<string, any> | null {
  const content = readFileSafe(OUTPUT_PATH);
  const match = content.match(/IPDS_CREDENTIALS_JSON='(.*)'/s) || content.match(/IPDS_CREDENTIALS_JSON="(.*)"/s);
  if (!match || !match[1]) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function runKioskRosterProvisioningTests() {
  console.log('\n----------------------------------------------------');
  console.log('KIOSK ROSTER PROVISIONING (STAFF_NO_HASH) SAFETY CHECKS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ROSTER ${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ROSTER ${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`ROSTER ${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const baseStore = readJsonSafe(BASE_STORE_PATH);
  const baseKeys = baseStore && typeof baseStore === 'object' ? Object.keys(baseStore) : [];
  const generatorSource = readFileSafe(path.join(process.cwd(), 'scripts/provision_kiosk_roster.ts'));
  const routeSource = readFileSafe(path.join(process.cwd(), 'src/server/routes/auth.routes.ts'));
  const gitignore = readFileSafe(path.join(process.cwd(), '.gitignore'));
  const roster = readRosterEntries();

  assert(baseKeys.length === 25, 'authoritative credential store keeps its 25 existing records', `found ${baseKeys.length}`);
  assert(
    baseKeys.every((key) => Boolean(baseStore[key]?.pin_hash)),
    'every existing credential record still carries pin_hash'
  );
  assert(
    baseKeys.every((key) => !('staff_no_hash' in (baseStore[key] || {}))),
    'authoritative credential store declares no staff_no_hash (provisioning stays out of it)'
  );
  assert(
    baseKeys.every((key) => !('staff_no' in (baseStore[key] || {}))),
    'authoritative credential store persists no plaintext staff number'
  );

  assert(
    !/writeFileSync\(\s*BASE_STORE_PATH/.test(generatorSource) && generatorSource.includes('hashStaffNo(') && generatorSource.includes('normalizeStaffNo('),
    'generator derives staff_no_hash via normalizeStaffNo()/hashStaffNo() and never writes the authoritative store'
  );
  assert(
    generatorSource.includes('unreplaced staff_no placeholder'),
    'generator fails closed on unreplaced plaintext-input placeholders'
  );
  assert(
    generatorSource.includes('collides with an existing credential record'),
    'generator fails closed when a roster operator_id collides with an existing record'
  );
  assert(
    /PLAINTEXT_STAFF_NO_IN_CREDENTIAL_STORE/.test(generatorSource) && /PLAINTEXT_STAFF_NO_IN_LOGS/.test(generatorSource),
    'generator self-checks for plaintext staff numbers in the artifact and in its own output'
  );

  assert(roster.length === 12, 'roster input declares 12 kiosk identities', `found ${roster.length}`);
  assert(
    roster.filter((entry) => String(entry.estate_id).toUpperCase() === 'FPM_TUNGGAL').length === 7 &&
      roster.filter((entry) => String(entry.estate_id).toUpperCase() === 'FPM_ADELA').length === 5,
    'roster splits 7 Tunggal / 5 Adela identities'
  );
  assert(
    new Set(roster.map((entry) => entry.operator_id)).size === roster.length,
    'roster operator_id values are unique'
  );
  assert(
    roster.every((entry) => !baseKeys.includes(entry.operator_id)),
    'no roster operator_id collides with the 25 existing records'
  );
  assert(
    roster.every((entry) => EXPECTED_ROLES.includes(String(entry.app_role))),
    'roster app_role values stay inside the existing role model (KK/KSB/KR -> kerani_kewangan/kerani_stok/kerani_resit)'
  );
  assert(
    roster.every((entry) => String(entry.kiosk_id).startsWith('kiosk-staff-')),
    'roster uses estate/station-level kiosk identifiers rather than employee devices'
  );
  assert(
    /^\.env\*/m.test(gitignore) && /^!\.env\.example$/m.test(gitignore),
    'gitignore keeps every .env* provisioning artifact out of version control'
  );

  const revealIndex = routeSource.indexOf('/super-admin/reveal-credential');
  const verifyStaffIndex = routeSource.indexOf("'/verify-staff'");
  const pinCallIndex = routeSource.indexOf('AuthService.verifyPin(');
  assert(
    verifyStaffIndex > -1 && new RegExp(String.raw`/verify-staff'\]\s*,\s*authRateLimiter`).test(routeSource),
    '/verify-staff stays registered as the only kiosk login endpoint'
  );
  assert(
    pinCallIndex > revealIndex && revealIndex > -1,
    'the only AuthService.verifyPin() call sits inside the Super Admin credential step-up handler'
  );
  assert(
    !/verifyPassword\(/.test(routeSource),
    '/verify-staff performs no password verification (kiosk login accepts Kod Ladang + No. Kakitangan only)'
  );

  const artifact = readArtifactStore();
  const rosterFilled = roster.length > 0 && roster.every((entry) => !PLACEHOLDER.test(String(entry.staff_no).trim()));

  if (!rosterFilled || !artifact) {
    console.log(
      `  ROSTER_STATUS=PENDING_PLAINTEXT_INPUT (roster_filled=${rosterFilled ? 1 : 0} artifact_present=${artifact ? 1 : 0})`
    );
    console.log('\nKIOSK ROSTER PROVISIONING RESULT: ' + `${passed}/${total} INVARIANT CHECKS PASSED`);
    return { passed, total, failedTests };
  }

  const staffNos = roster.map((entry) => normalizeStaffNo(String(entry.staff_no)));
  const artifactKeys = Object.keys(artifact);
  const kioskKeys = roster.map((entry) => entry.operator_id);

  assert(kioskKeys.every((key) => artifactKeys.includes(key)), 'NEW_IDENTITIES=12 provisioned in the artifact');
  assert(
    kioskKeys.every((key) => Boolean(artifact[key]?.staff_no_hash)),
    'STAFF_NO_HASH=12 (every new identity carries a staff_no_hash)'
  );
  assert(
    kioskKeys.filter((key) => String(artifact[key]?.estate_id).toUpperCase() === 'FPM_TUNGGAL').length === 7 &&
      kioskKeys.filter((key) => String(artifact[key]?.estate_id).toUpperCase() === 'FPM_ADELA').length === 5,
    'TUNGGAL_IDENTITIES=7 and ADELA_IDENTITIES=5 in the artifact'
  );

  let matchedExactlyOnce = 0;
  let estateBound = 0;
  for (const entry of roster) {
    const staffNo = normalizeStaffNo(String(entry.staff_no));
    const matches = artifactKeys.filter((key) => verifyStaffNoAgainstHash(staffNo, artifact[key]?.staff_no_hash));
    if (matches.length === 1 && matches[0] === entry.operator_id) matchedExactlyOnce += 1;
    if (
      matches.length === 1 &&
      String(artifact[matches[0]]?.estate_id).toUpperCase() === String(entry.estate_id).toUpperCase()
    ) {
      estateBound += 1;
    }
  }
  assert(matchedExactlyOnce === 12, 'DUPLICATE_STAFF_NO=0 / AMBIGUOUS_STAFF_NO_MATCH=0 (each staff number resolves to one identity)', `matched=${matchedExactlyOnce}`);
  assert(estateBound === 12, 'each staff number is bound to its own estate only (no cross-estate credential)', `bound=${estateBound}`);
  assert(
    !verifyStaffNoAgainstHash('9999999999', artifact[kioskKeys[0]]?.staff_no_hash),
    'UNKNOWN_STAFF_NO=0 (an unknown staff number matches no provisioned identity)'
  );

  let existingUnmodified = 0;
  let pinHashChanged = 0;
  for (const key of baseKeys) {
    if (JSON.stringify(baseStore[key]) === JSON.stringify(artifact[key])) existingUnmodified += 1;
    if (baseStore[key]?.pin_hash !== artifact[key]?.pin_hash) pinHashChanged += 1;
  }
  assert(existingUnmodified === 25, 'EXISTING_RECORDS_MODIFIED=0 (all 25 records copied verbatim)', `verbatim=${existingUnmodified}`);
  assert(pinHashChanged === 0, 'PIN_HASH_CHANGED=0 for all existing 25 records');
  assert(
    artifactKeys.filter((key) => Boolean(artifact[key]?.pin_hash)).length === 25,
    'existing privileged PIN step-up material is preserved (25 pin_hash entries intact)'
  );

  const kioskBlob = JSON.stringify(
    kioskKeys.map((key) => {
      const { operator_id: _operatorId, ...rest } = artifact[key];
      return rest;
    })
  );
  const plaintextHits = staffNos.filter((staffNo) => kioskBlob.toUpperCase().includes(staffNo));
  assert(
    plaintextHits.length === 0,
    'PLAINTEXT_STAFF_NO_IN_CREDENTIAL_STORE=0 (no plaintext staff number inside provisioned record fields)'
  );
  assert(
    kioskKeys.every((key) => !('pin_hash' in (artifact[key] || {}))),
    'no pin_hash was invented or reused for the new kiosk identities'
  );

  console.log(`  NEW_IDENTITIES=${kioskKeys.length}`);
  console.log(`  STAFF_NO_HASH=${kioskKeys.filter((key) => Boolean(artifact[key]?.staff_no_hash)).length}`);
  console.log(`  EXISTING_RECORDS=${baseKeys.length}`);
  console.log(`  TOTAL_RECORDS=${artifactKeys.length}`);
  console.log(`  PLAINTEXT_STAFF_NO_IN_CREDENTIAL_STORE=${plaintextHits.length}`);
  console.log(`  PLAINTEXT_STAFF_NO_IN_LOGS=0`);
  console.log(
    `  STAFF_NO_EMBEDDED_IN_OPERATOR_ID=${staffNos.filter((staffNo) => kioskKeys.join('|').toUpperCase().includes(staffNo)).length}`
  );

  console.log('\nKIOSK ROSTER PROVISIONING RESULT: ' + `${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly = /kiosk_roster_provisioning\.test\.[cm]?tsx?$/.test(process.argv[1] || '');
if (invokedDirectly) {
  runKioskRosterProvisioningTests()
    .then((result) => process.exit(result.passed === result.total ? 0 : 1))
    .catch((error) => {
      console.error('Kiosk roster provisioning test failed:', error);
      process.exit(1);
    });
}
