/**
 * iPDS v4.1.0 — Test Module 21: P0-04 Background Job SECURITY DEFINER Hardening
 *
 * Verifies, from migration configuration (no live database required), that the
 * intentionally GLOBAL background-job claim routine:
 *
 *     public.claim_background_jobs_batch(TEXT, INT, INT)
 *
 *   - is NOT executable by PUBLIC
 *   - is NOT executable by anon
 *   - is NOT executable by authenticated
 *   - IS executable by service_role
 *   - uses a hardened, empty SECURITY DEFINER search_path
 *   - fully schema-qualifies its background_jobs references
 *
 * and guards against a future migration silently re-granting broad execution.
 *
 * The suite replays the supabase/migrations/*.sql files in lexical order and
 * simulates the effective EXECUTE ACL of the function, starting from the
 * PostgreSQL default (EXECUTE granted to PUBLIC) on every CREATE OR REPLACE.
 */

import fs from 'fs';
import path from 'path';

const FUNCTION_SIGNATURE = 'public.claim_background_jobs_batch(TEXT, INT, INT)';

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

function normalize(sql: string): string {
  return stripSqlComments(sql).replace(/\s+/g, ' ').trim();
}

function parseRoles(roleList: string): string[] {
  return roleList
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter((r) => r.length > 0);
}

interface AclSimulation {
  roles: Set<string>;
  latestDefinition: string;
  latestDefinitionFile: string;
  hasHardenedSearchPath: boolean;
  hasUnqualifiedTableRef: boolean;
}

function simulateEffectiveAcl(): AclSimulation {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // PostgreSQL grants EXECUTE on new functions to PUBLIC by default.
  const roles = new Set<string>(['PUBLIC']);
  let latestDefinition = '';
  let latestDefinitionFile = '';
  let hasHardenedSearchPath = false;
  let hasUnqualifiedTableRef = false;

  const createRe = /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.claim_background_jobs_batch\s*\(/i;
  const revokeRe = /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.claim_background_jobs_batch\s*\([^)]*\)\s+FROM\s+([^;]+);/gi;
  const grantRe = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.claim_background_jobs_batch\s*\([^)]*\)\s+TO\s+([^;]+);/gi;

  for (const file of files) {
    const normalized = normalize(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));

    const createMatch = createRe.exec(normalized);
    if (createMatch) {
      // A fresh CREATE OR REPLACE resets the ACL to the PostgreSQL default.
      roles.clear();
      roles.add('PUBLIC');

      const definitionStart = createMatch.index;
      const bodyEnd = normalized.indexOf('$$;', definitionStart);
      latestDefinition = bodyEnd === -1
        ? normalized.slice(definitionStart)
        : normalized.slice(definitionStart, bodyEnd + 3);
      latestDefinitionFile = file;

      hasHardenedSearchPath = /SET\s+search_path\s*=\s*''/i.test(latestDefinition);
      // `public.background_jobs` is fine; a bare table name is not.
      hasUnqualifiedTableRef = /(?<!\.)\bbackground_jobs\b/.test(latestDefinition);
    }

    let m: RegExpExecArray | null;
    revokeRe.lastIndex = 0;
    while ((m = revokeRe.exec(normalized)) !== null) {
      for (const role of parseRoles(m[1])) roles.delete(role);
    }

    grantRe.lastIndex = 0;
    while ((m = grantRe.exec(normalized)) !== null) {
      for (const role of parseRoles(m[1])) roles.add(role);
    }
  }

  return { roles, latestDefinition, latestDefinitionFile, hasHardenedSearchPath, hasUnqualifiedTableRef };
}

export async function runBackgroundJobSecurityTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 21: P0-04 BACKGROUND JOB SECURITY DEFINER HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 21.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 21.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 21.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const correctiveFile = '20260916_p0_04_harden_background_job_security_definer.sql';
  const correctivePath = path.join(migrationsDir, correctiveFile);

  // Test 21.1: Corrective migration exists
  {
    assert(fs.existsSync(correctivePath), `P0-04 corrective migration ${correctiveFile} exists`);
  }

  const correctiveSql = fs.existsSync(correctivePath)
    ? normalize(fs.readFileSync(correctivePath, 'utf-8'))
    : '';

  // Test 21.2: Exact revoke semantics present in corrective migration
  {
    const hasRevoke =
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.claim_background_jobs_batch\s*\([^)]*\)\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i.test(correctiveSql);
    assert(hasRevoke, 'Corrective migration revokes EXECUTE from PUBLIC, anon, authenticated');
  }

  // Test 21.3: Exact grant semantics present in corrective migration
  {
    const hasGrant =
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.claim_background_jobs_batch\s*\([^)]*\)\s+TO\s+service_role/i.test(correctiveSql);
    assert(hasGrant, 'Corrective migration grants EXECUTE to service_role only');
  }

  // Test 21.4: Function is recreated with a hardened empty search_path
  {
    assert(
      /SET\s+search_path\s*=\s*''/i.test(correctiveSql),
      "Function recreated with SET search_path = ''"
    );
  }

  // Test 21.5: Fully-qualified background_jobs references (no unqualified names)
  {
    const bareRef = /(?<!\.)\bbackground_jobs\b/.test(
      correctiveSql.slice(correctiveSql.indexOf('CREATE'))
    );
    assert(!bareRef, 'All background_jobs references are schema-qualified (public.background_jobs)');
  }

  // Replay the migration sequence to derive the effective final ACL
  const sim = simulateEffectiveAcl();

  // Test 21.6: PUBLIC cannot execute
  assert(!sim.roles.has('PUBLIC'), 'PUBLIC cannot execute claim_background_jobs_batch');

  // Test 21.7: anon cannot execute
  assert(!sim.roles.has('ANON'), 'anon cannot execute claim_background_jobs_batch');

  // Test 21.8: authenticated cannot execute
  assert(!sim.roles.has('AUTHENTICATED'), 'authenticated cannot execute claim_background_jobs_batch');

  // Test 21.9: service_role can execute
  assert(sim.roles.has('SERVICE_ROLE'), 'service_role can execute claim_background_jobs_batch');

  // Test 21.10: Final ACL is exactly {SERVICE_ROLE}
  {
    const finalRoles = Array.from(sim.roles).sort().join(',');
    assert(finalRoles === 'SERVICE_ROLE', 'Effective final EXECUTE ACL is exactly {service_role}', `actual: {${finalRoles}}`);
  }

  // Test 21.11: Latest definition carries the hardened search_path
  assert(sim.hasHardenedSearchPath, `Latest definition (${sim.latestDefinitionFile}) uses SET search_path = ''`);

  // Test 21.12: Latest definition has no unqualified table references
  assert(!sim.hasUnqualifiedTableRef, 'Latest function definition has no unqualified background_jobs references');

  // Test 21.13: No migration after the corrective one re-grants broad execution
  {
    const filesAfterCorrective = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && f > correctiveFile)
      .sort();

    const regrantPattern = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.claim_background_jobs_batch\s*\([^)]*\)\s+TO\s+([^;]+);/gi;
    const offenders: string[] = [];
    for (const file of filesAfterCorrective) {
      const normalized = normalize(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
      let m: RegExpExecArray | null;
      regrantPattern.lastIndex = 0;
      while ((m = regrantPattern.exec(normalized)) !== null) {
        const roles = parseRoles(m[1]);
        if (roles.some((r) => r === 'PUBLIC' || r === 'ANON' || r === 'AUTHENTICATED')) {
          offenders.push(file);
        }
      }
    }
    assert(
      offenders.length === 0,
      'No later migration re-grants execution to PUBLIC/anon/authenticated',
      offenders.join(', ')
    );
  }

  console.log(`\nMODULE 21 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/background_job_security.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /background_job_security\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runBackgroundJobSecurityTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-04 background job security suite execution error:', err);
      process.exit(1);
    });
}
