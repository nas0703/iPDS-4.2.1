/**
 * iPDS v4.2.1 — Test Module 72: P7-2 Auth Helper Alignment
 *
 * Static verification of 20261010_auth_helper_alignment.sql:
 *   - the four corrected helper bodies are VERBATIM equal to the repository's
 *     intended 20260930 definitions;
 *   - auth_is_cross_estate_role() permits exactly rc/oc/admin/super_admin and
 *     none of the superseded broad roles;
 *   - auth_is_super_admin() accepts superadmin/super_admin/admin, and 'fc' only
 *     for FPM_TUNGGAL or 5155;
 *   - auth_estate_id()/auth_app_role() read request.jwt.claims and have no
 *     hard-coded fallback;
 *   - auth_tenant_id() is untouched;
 *   - the migration changes no policy/table/grant/trigger/RPC;
 *   - the rollback restores the exact pre-20261010 live definitions;
 *   - the deploy-time guards are fail-closed and correctly ordered.
 *
 * No database connection is made; this is a static analysis module.
 */

import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const ROLLBACKS_DIR = path.join(process.cwd(), 'supabase', 'rollbacks');
const MIGRATION_FILE = '20261010_auth_helper_alignment.sql';
const ROLLBACK_FILE = '20261010_auth_helper_alignment_rollback.sql';
const SOURCE_FILE = '20260930_ipds_grading_tasks.sql';

const FOUR = ['auth_estate_id', 'auth_app_role', 'auth_is_cross_estate_role', 'auth_is_super_admin'];
const SUPERSEDED = ['fc', 'executive_hq', 'zonal_controller', 'regional_controller', 'operation_controller'];

interface AssertResult { passed: number; total: number; failedTests: string[]; }

const normalize = (s: string) => s.replace(/\r\n/g, '\n').split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l.length > 0).join('\n');

/** Extract a function body by locating `FUNCTION public.<name>()` then the end marker. */
function extractFn(src: string, name: string, endMarker: string): string {
  const start = src.indexOf(`FUNCTION public.${name}()`);
  if (start === -1) return '';
  const end = src.indexOf(endMarker, start);
  if (end === -1) return '';
  return normalize(src.slice(start, end + endMarker.length));
}

export async function runP7_2AuthHelperAlignmentTests(): Promise<AssertResult> {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 72: P7-2 AUTH HELPER ALIGNMENT');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 72.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 72.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 72.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const migPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
  const rbPath = path.join(ROLLBACKS_DIR, ROLLBACK_FILE);
  const srcPath = path.join(MIGRATIONS_DIR, SOURCE_FILE);
  assert(fs.existsSync(migPath), `migration ${MIGRATION_FILE} exists`);
  assert(fs.existsSync(rbPath), `rollback ${ROLLBACK_FILE} exists`);
  assert(fs.existsSync(srcPath), `authoritative source ${SOURCE_FILE} exists`);

  const raw = fs.existsSync(migPath) ? fs.readFileSync(migPath, 'utf-8') : '';
  const src = fs.existsSync(srcPath) ? fs.readFileSync(srcPath, 'utf-8') : '';
  const rbRaw = fs.existsSync(rbPath) ? fs.readFileSync(rbPath, 'utf-8') : '';
  const noComments = raw.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n');

  assert(/BEGIN;/.test(raw) && /COMMIT;/.test(raw), 'migration is wrapped in a transaction');

  // ---- 1. Four bodies verbatim-equal to 20260930 ----
  const MARK = '$$ LANGUAGE sql STABLE;';
  for (const fn of FOUR) {
    const mine = extractFn(raw, fn, MARK);
    const theirs = extractFn(src, fn, MARK);
    assert(mine.length > 0 && theirs.length > 0, `${fn}() located in both files`);
    assert(mine === theirs, `${fn}() body is VERBATIM equal to ${SOURCE_FILE}`);
    if (mine !== theirs) console.error(`         mine   : ${mine.slice(0, 160)}\n         theirs : ${theirs.slice(0, 160)}`);
  }

  const cross = extractFn(raw, 'auth_is_cross_estate_role', MARK);
  const sup = extractFn(raw, 'auth_is_super_admin', MARK);
  const estate = extractFn(raw, 'auth_estate_id', MARK);
  const role = extractFn(raw, 'auth_app_role', MARK);

  // ---- 2. cross-estate membership ----
  assert(cross.includes("IN ('rc', 'oc', 'admin', 'super_admin')"),
    'auth_is_cross_estate_role() permits exactly rc, oc, admin, super_admin');
  for (const bad of SUPERSEDED) {
    assert(!cross.includes(`'${bad}'`), `auth_is_cross_estate_role() does NOT include '${bad}'`);
  }
  assert(!/\bLIKE\b|\bEXISTS\b|\bSELECT\b.*FROM/i.test(cross.replace(/SELECT public\.auth_app_role\(\)/, '')),
    'auth_is_cross_estate_role() is a pure membership test (no table access)');

  // ---- 3. super admin membership + fc special case ----
  for (const ok of ['superadmin', 'super_admin', 'admin']) {
    assert(sup.includes(`'${ok}'`), `auth_is_super_admin() accepts '${ok}'`);
  }
  assert(sup.includes("public.auth_app_role() = 'fc'"), 'auth_is_super_admin() special-cases fc explicitly');
  assert(sup.includes("IN ('FPM_TUNGGAL', '5155')"),
    "auth_is_super_admin() restricts the fc case to FPM_TUNGGAL or 5155");
  assert(sup.includes('public.auth_estate_id()'), 'auth_is_super_admin() consults auth_estate_id()');
  assert(!sup.includes('executive_hq') && !sup.includes('zonal_controller') &&
    !sup.includes('regional_controller') && !sup.includes('operation_controller'),
    'auth_is_super_admin() contains no superseded role names');

  // ---- 4/5. readers: claim source + no fallback ----
  for (const [name, body] of [['auth_estate_id', estate], ['auth_app_role', role]] as const) {
    assert(body.includes("current_setting('request.jwt.claims'"),
      `${name}() reads request.jwt.claims via current_setting`);
    assert(!body.includes('auth.jwt()'), `${name}() no longer calls auth.jwt()`);
    assert(/nullif\(/.test(body), `${name}() normalises empty claims to NULL via nullif()`);
  }
  assert(!estate.includes("'FPM_TUNGGAL'"), 'auth_estate_id() has no hard-coded FPM_TUNGGAL fallback');
  assert(!role.includes("'staff'"), 'auth_app_role() has no hard-coded staff fallback');
  assert(!/IF\s+.*IS\s+NULL\s+THEN/i.test(estate + role), 'readers contain no fallback IF-branch');

  // ---- 6. tenant_id untouched ----
  assert(!new RegExp(`FUNCTION public\\.auth_tenant_id`).test(noComments),
    'migration does not redefine auth_tenant_id()');
  assert(/_p61010_auth_tenant_id_before/.test(noComments),
    'migration snapshots auth_tenant_id() before changing anything');
  assert(/md5\(pg_catalog\.pg_get_functiondef/.test(noComments) && /v_before_tenant IS DISTINCT FROM v_now_tenant/.test(noComments),
    'guard proves auth_tenant_id() is byte-identical (md5) after the changes');

  // ---- 7. no policy/table/grant/trigger/RPC changes ----
  assert(!/CREATE\s+POLICY|DROP\s+POLICY|ALTER\s+POLICY/i.test(noComments),
    'migration creates, drops and alters NO policy');
  assert(!/CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE/i.test(noComments),
    'migration does not touch any table (temp snapshot table excepted below)');
  assert((noComments.match(/CREATE\s+TEMP\s+TABLE/gi) || []).length === 1 &&
    (noComments.match(/CREATE\s+TABLE/gi) || []).length === 0,
    'the only table DDL is the CREATE TEMP TABLE snapshot');
  assert(/ON COMMIT DROP/.test(noComments), 'the temp snapshot is dropped at commit');
  assert(!/\bGRANT\b|\bREVOKE\b/i.test(noComments), 'migration contains no GRANT/REVOKE');
  assert(!/CREATE\s+(OR\s+REPLACE\s+)?TRIGGER|DROP\s+TRIGGER/i.test(noComments),
    'migration contains no trigger DDL');
  assert(!/create_employee_with_assignment|CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.fn_/i.test(noComments),
    'migration does not touch any RPC');

  const fnDefs = (noComments.match(/CREATE OR REPLACE FUNCTION public\.(\w+)/g) || []);
  assert(fnDefs.length === FOUR.length,
    `exactly ${FOUR.length} CREATE OR REPLACE FUNCTION statements`, `found ${fnDefs.length}`);
  for (const fn of FOUR) {
    assert(fnDefs.some((d) => d.endsWith(`.${fn}`)), `exactly one definition for ${fn}()`);
  }

  // ---- 9. guard ordering + fail-closed ----
  const idxSnapshot = noComments.indexOf('_p61010_auth_tenant_id_before');
  const idxFirstFn = noComments.indexOf('CREATE OR REPLACE FUNCTION public.auth_estate_id');
  const idxGuards = noComments.indexOf('AUTH_HELPER_GUARD_FAILED');
  assert(idxSnapshot !== -1 && idxFirstFn !== -1 && idxSnapshot < idxFirstFn,
    'pre-state snapshot runs BEFORE the first function replacement');
  assert(idxGuards !== -1 && idxFirstFn < idxGuards,
    'post-condition guards run AFTER all four replacements');
  assert(/AUTH_HELPER_PRECONDITION_FAILED/.test(noComments),
    'precondition guard fails closed when auth_tenant_id() is absent');
  for (const must of [
    'auth_is_cross_estate_role() does not list exactly rc, oc, admin, super_admin',
    'still grants superseded role(s)',
    'must be SECURITY INVOKER',
    'does not accept %',
    'fc special case is not restricted to FPM_TUNGGAL/5155',
    'does not read request.jwt.claims',
    'still calls auth.jwt()',
    'still contains a hard-coded FPM_TUNGGAL fallback',
    'still contains a hard-coded staff fallback',
    'must be NULL without claims (fail closed)',
    'rc must be cross-estate',
    'must NOT be cross-estate',
    'must not be super admin',
    'must be super admin'
  ]) {
    assert(noComments.includes(must), `fail-closed guard covers: "${must}"`);
  }
  assert(/PERFORM\s+pg_catalog\.set_config\('request\.jwt\.claims'/.test(noComments),
    'behavioural guards inject claims transaction-locally via set_config');
  assert(!/USING\s*\(\s*TRUE\s*\)/i.test(noComments), 'migration introduces no USING (TRUE) predicate');

  // ---- 8. rollback restores the exact pre-20261010 live forms ----
  const rbCross = extractFn(rbRaw, 'auth_is_cross_estate_role', '$function$;');
  const rbSup = extractFn(rbRaw, 'auth_is_super_admin', '$function$;');
  const rbEstate = extractFn(rbRaw, 'auth_estate_id', '$function$;');
  const rbRole = extractFn(rbRaw, 'auth_app_role', '$function$;');
  assert(/BEGIN;/.test(rbRaw) && /COMMIT;/.test(rbRaw), 'rollback is wrapped in a transaction');

  for (const bad of SUPERSEDED) {
    assert(rbCross.includes(`'${bad}'`), `rollback restores '${bad}' in auth_is_cross_estate_role()`);
  }
  assert(rbCross.includes("'super_admin', 'executive_hq', 'fc', 'zonal_controller', 'regional_controller', 'operation_controller'"),
    'rollback restores the exact pre-20261010 broad cross-estate list');
  assert(rbSup.includes("'super_admin', 'executive_hq', 'fc', 'zonal_controller', 'regional_controller'"),
    'rollback restores the exact pre-20261010 broad super-admin list');
  for (const [name, body] of [['auth_estate_id', rbEstate], ['auth_app_role', rbRole]] as const) {
    assert(body.includes('auth.jwt()'), `rollback restores auth.jwt() usage in ${name}()`);
    assert(/SECURITY DEFINER/.test(body), `rollback restores SECURITY DEFINER in ${name}()`);
    assert(/LANGUAGE plpgsql/.test(body), `rollback restores LANGUAGE plpgsql in ${name}()`);
  }
  assert(rbEstate.includes("'FPM_TUNGGAL'"), "rollback restores the 'FPM_TUNGGAL' fallback");
  assert(rbRole.includes("'staff'"), "rollback restores the 'staff' fallback");
  assert(!/FUNCTION public\.auth_tenant_id/.test(rbRaw.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n')),
    'rollback does not touch auth_tenant_id()');
  assert(/AUTH_HELPER_ROLLBACK_FAILED/.test(rbRaw), 'rollback verifies its own restore (fail closed)');

  // ---- 10. Fixture hygiene: nothing invalid may reach the ::jsonb cast ----
  // The intended readers cast the raw GUC with ::jsonb, so every fixture that a
  // reader consumes MUST be a valid JSON document. '' is NOT valid JSON (22P02),
  // which is exactly the defect this section locks down.
  const MARKER = "pg_catalog.set_config('request.jwt.claims'";
  const HELPER_CALL = /auth_estate_id\(\)|auth_app_role\(\)|auth_is_cross_estate_role\(\)|auth_is_super_admin\(\)/;
  const markerIdx: number[] = [];
  for (let i = noComments.indexOf(MARKER); i !== -1; i = noComments.indexOf(MARKER, i + 1)) markerIdx.push(i);
  assert(markerIdx.length >= 6, 'guard block sets request.jwt.claims in every behavioural case', `found ${markerIdx.length}`);

  let staticFixtures = 0;
  let dynamicFixtures = 0;
  const emptyStringFixtures: number[] = [];
  markerIdx.forEach((start, k) => {
    const nextMarker = k + 1 < markerIdx.length ? markerIdx[k + 1] : noComments.length;
    const doEnd = noComments.indexOf('END $$;', start);
    const end = doEnd !== -1 && doEnd < nextMarker ? doEnd : nextMarker;
    const segment = noComments.slice(start, end);
    const consumed = HELPER_CALL.test(segment);
    const literal = /^pg_catalog\.set_config\('request\.jwt\.claims',\s*'([^']*)'\s*,/.exec(segment);
    if (literal) {
      staticFixtures++;
      if (literal[1] === '') emptyStringFixtures.push(k);
      if (consumed) {
        let validJson = true;
        try { JSON.parse(literal[1]); } catch { validJson = false; }
        assert(validJson, `fixture ${k + 1} feeding the jsonb cast is valid JSON`, `literal=${JSON.stringify(literal[1])}`);
        assert(literal[1] !== '', `fixture ${k + 1} feeding the jsonb cast is not an empty string`);
      }
    } else {
      dynamicFixtures++;
      assert(!/'\s*\|\|/.test(segment.slice(0, 60)) || segment.includes('||'),
        `dynamic fixture ${k + 1} is built by concatenation`);
    }
  });

  assert(staticFixtures >= 5, 'static claim fixtures were discovered', `found ${staticFixtures}`);
  assert(dynamicFixtures >= 1, 'the parameterised (concatenated) fixture was discovered', `found ${dynamicFixtures}`);

  // The ONLY empty-string set_config permitted is the trailing reset, which is
  // followed by nothing that casts to jsonb. Any other one would re-introduce 22P02.
  assert(emptyStringFixtures.length === 1,
    'exactly one empty-string claim fixture exists (the trailing reset)', `count=${emptyStringFixtures.length}`);
  if (emptyStringFixtures.length === 1) {
    const resetIdx = markerIdx[emptyStringFixtures[0]];
    const resetEnd = noComments.indexOf('END $$;', resetIdx);
    const resetSegment = noComments.slice(resetIdx, resetEnd === -1 ? noComments.length : resetEnd);
    assert(!HELPER_CALL.test(resetSegment),
      'the trailing empty-string reset is never consumed by a jsonb cast');
    assert(resetSegment.replace(/\s+/g, ' ').includes("set_config('request.jwt.claims', '', true)"),
      'the trailing reset is the documented final statement of the guard block');
  }

  assert(!/set_config\('request\.jwt\.claims',\s*''\s*,\s*true\)[\s\S]{0,400}?auth_(estate_id|app_role|is_cross_estate_role|is_super_admin)\(\)/.test(noComments),
    'no empty-string claim fixture is followed by a reader call (the original 22P02 defect)');
  assert(noComments.includes("'{}'"),
    "the no-claims fixture is the valid JSON empty object '{}'");

  return { passed, total, failedTests };
}
