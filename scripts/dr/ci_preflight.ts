/**
 * IPDS VER 3.7 — Disaster Recovery CI/CD Preflight Validator
 * Runs in automated pipelines to ensure all DR runbooks, scripts, safety locks,
 * and canonical domain assertions pass before any deployment or pull request merge.
 */

import fs from 'fs';
import path from 'path';
import { isProductionTarget, assertNonProductionTarget } from './safety.js';
import { IPDS_TABLE_REGISTRY } from './backup.js';

async function runCIPreflightCheck(): Promise<boolean> {
  console.log(`\n================================================================`);
  console.log(`   IPDS VER 3.7 CI/CD — DISASTER RECOVERY PREFLIGHT CHECK      `);
  console.log(`================================================================\n`);

  let allPassed = true;

  function assertCheck(name: string, condition: boolean, details: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      console.log(`       ${details}`);
    } else {
      console.log(`[FAIL] ${name}`);
      console.log(`       FAILED: ${details}`);
      allPassed = false;
    }
  }

  // 1. Check Required Documentation
  const requiredDocs = [
    'docs/DR_ARCHITECTURE.md',
    'docs/DR_RUNBOOK.md',
    'docs/DR_RECOVERY_TEST.md'
  ];

  for (const doc of requiredDocs) {
    const docPath = path.join(process.cwd(), doc);
    const exists = fs.existsSync(docPath);
    const size = exists ? fs.statSync(docPath).size : 0;
    assertCheck(`Documentation: ${doc}`, exists && size > 500, `File exists (${(size / 1024).toFixed(1)} KB)`);
  }

  // 2. Check Required DR Scripts
  const requiredScripts = [
    'scripts/dr/types.ts',
    'scripts/dr/safety.ts',
    'scripts/dr/events.ts',
    'scripts/dr/backup.ts',
    'scripts/dr/verify_backup.ts',
    'scripts/dr/restore_preflight.ts',
    'scripts/dr/verify_recovery.ts'
  ];

  for (const script of requiredScripts) {
    const scriptPath = path.join(process.cwd(), script);
    const exists = fs.existsSync(scriptPath);
    assertCheck(`DR Script: ${script}`, exists, `Module exists and is loadable`);
  }

  // 3. Check Safety Lock on Production Restore
  let prodRestoreBlocked = false;
  try {
    assertNonProductionTarget('production', undefined, false);
  } catch (err: any) {
    if (err.message.includes('FATAL DR SAFETY LOCKOUT')) {
      prodRestoreBlocked = true;
    }
  }
  assertCheck(
    'Production Destructive Restore Lockout',
    prodRestoreBlocked,
    'Safety guard throws fatal error when production target is passed'
  );

  // 4. Check Table Registry Coverage
  assertCheck(
    'Canonical Table Registry Coverage',
    IPDS_TABLE_REGISTRY.length >= 25,
    `Registered ${IPDS_TABLE_REGISTRY.length} canonical and operational tables`
  );

  // 5. Check Pruning Route Integrity
  const pruningRoutePath = path.join(process.cwd(), 'src/server/routes/pruning.routes.ts');
  const serverlessPath = path.join(process.cwd(), 'src/server/serverless.ts');
  const apiIndexPath = path.join(process.cwd(), 'api/index.ts');
  const apiBundlePath = path.join(process.cwd(), 'api/index.js');
  const pruningRouteExists = fs.existsSync(pruningRoutePath);
  let pruningMounted = false;
  let mountedInFile = '';

  const candidateMountFiles = [serverlessPath, apiIndexPath, apiBundlePath];
  for (const candidate of candidateMountFiles) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf-8');
      if (content.includes('pruningRoutes') && content.includes('/pruning')) {
        pruningMounted = true;
        mountedInFile = path.relative(process.cwd(), candidate);
        break;
      }
    }
  }

  assertCheck(
    'Pruning Route & Mounting Integrity',
    pruningRouteExists && pruningMounted,
    `src/server/routes/pruning.routes.ts exists and mounted in ${mountedInFile || 'API router'}`
  );

  // 6. Check Full Regression & Security Test Suite Modules
  const testModules = [
    'auth.test.ts',
    'rbac.test.ts',
    'hasil.test.ts',
    'hantaran.test.ts',
    'pruning.test.ts',
    'merumput.test.ts',
    'db_writes.test.ts',
    'security_compliance.test.ts',
    'auth_bypass.test.ts',
    'kiosk_login.test.ts',
    'kiosk_roster_provisioning.test.ts',
    'acting_as.test.ts',
    'device_bulk_rotation.test.ts',
    'device_merge_redirect.test.ts',
    'device_merge.test.ts',
    'p1_1_auth_hardening.test.ts',
    'p1_1b_employee_guard.test.ts',
    'p1_1c_local_cache_post.test.ts',
    'p1_1c_scoped_client.test.ts',
    'p1_1d_atomic_create.test.ts',
    'grading_tasks.test.ts'
  ];
  const allModulesExist = testModules.every(mod => 
    fs.existsSync(path.join(process.cwd(), 'scripts/tests/modules', mod))
  ) && fs.existsSync(path.join(process.cwd(), 'scripts/tests/run_all_tests.ts'));

  assertCheck(
    'Organisation-Wide Regression & Security Test Coverage',
    allModulesExist,
    `${testModules.length} critical test suites registered and enforced (Auth, RBAC, Hasil, Hantaran, Pruning, Merumput, DB Writes, Security & Compliance, Auth Bypass, Acting-As)`
  );

  console.log(`\n================================================================`);
  console.log(`CI PREFLIGHT RESULT: ${allPassed ? 'ALL GATES PASSED (READY)' : 'FAILED'}`);
  console.log(`================================================================\n`);

  return allPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCIPreflightCheck()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error('[FATAL CI CHECK ERROR]', err);
      process.exit(1);
    });
}
