/**
 * iPDS v4.1.0 — Test Module 22: P0-05 Tenant View RLS-Bypass Hardening
 *
 * Verifies, from migration configuration (no live database required), that:
 *
 *   1. The four public views are marked `security_invoker = true` so that
 *      underlying tenant/estate RLS is enforced:
 *        - public.merumput_daily_entries
 *        - public.data_pekerja
 *        - public.annual_yield
 *        - public.v_current_employee_assignments
 *   2. PUBLIC and anon cannot SELECT those views.
 *   3. authenticated + service_role retain the intended SELECT grant.
 *   4. The seven Stage C2 tables have FORCE ROW LEVEL SECURITY.
 *   5. Any future `public` view created by a migration without
 *      `security_invoker = true` is detected (regression guard).
 */

import fs from 'fs';
import path from 'path';

const TARGET_VIEWS = [
  'merumput_daily_entries',
  'data_pekerja',
  'annual_yield',
  'v_current_employee_assignments'
];

const STAGE_C2_TABLES = [
  'tenants',
  'companies',
  'org_positions',
  'org_blocks',
  'employees',
  'employee_assignments',
  'employee_assignment_blocks'
];

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

function normalize(sql: string): string {
  return stripSqlComments(sql).replace(/\s+/g, ' ').trim();
}

function readMigrations(): Array<{ file: string; sql: string }> {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: normalize(fs.readFileSync(path.join(migrationsDir, file), 'utf-8')) }));
}

function collectCreatedPublicViews(migrations: Array<{ file: string; sql: string }>): Map<string, string> {
  const created = new Map<string, string>();
  const re = /CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+public\.([a-z0-9_]+)/gi;
  for (const { file, sql } of migrations) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(sql)) !== null) {
      created.set(m[2].toLowerCase(), file);
    }
  }
  return created;
}

function collectSecurityInvokerViews(migrations: Array<{ file: string; sql: string }>): Set<string> {
  const invoker = new Set<string>();

  // ALTER VIEW public.<name> SET (security_invoker = true)
  const alterRe = /ALTER\s+VIEW\s+public\.([a-z0-9_]+)\s+SET\s*\(([^)]*)\)/gi;
  for (const { sql } of migrations) {
    let m: RegExpExecArray | null;
    alterRe.lastIndex = 0;
    while ((m = alterRe.exec(sql)) !== null) {
      if (/security_invoker\s*=\s*true/i.test(m[2])) invoker.add(m[1].toLowerCase());
    }
  }

  // CREATE VIEW public.<name> ... WITH (security_invoker = true) ... AS
  const createRe = /CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+public\.([a-z0-9_]+)([^;]*?)\bAS\b/gi;
  for (const { sql } of migrations) {
    let m: RegExpExecArray | null;
    createRe.lastIndex = 0;
    while ((m = createRe.exec(sql)) !== null) {
      if (/security_invoker\s*=\s*true/i.test(m[3])) invoker.add(m[2].toLowerCase());
    }
  }

  return invoker;
}

export async function runTenantViewSecurityTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 22: P0-05 TENANT VIEW RLS-BYPASS HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 22.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 22.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 22.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const migrations = readMigrations();
  const correctiveFile = '20260917_p0_05_harden_tenant_views_security_invoker.sql';
  const corrective = migrations.find((m) => m.file === correctiveFile);
  const correctiveSql = corrective ? corrective.sql : '';

  // Test 22.1: Corrective migration exists
  assert(!!corrective, `P0-05 corrective migration ${correctiveFile} exists`);

  // Tests 22.2–22.5: each target view is security_invoker
  const invokerViews = collectSecurityInvokerViews(migrations);
  for (const view of TARGET_VIEWS) {
    assert(invokerViews.has(view), `View public.${view} is security_invoker = true`);
  }

  // Tests 22.6–22.9: PUBLIC/anon cannot SELECT each view
  for (const view of TARGET_VIEWS) {
    const revokeRe = new RegExp(
      `REVOKE\\s+ALL\\s+ON\\s+public\\.${view}\\s+FROM\\s+([^;]+);`,
      'i'
    );
    const m = revokeRe.exec(correctiveSql);
    const roles = m ? m[1].toUpperCase() : '';
    assert(
      !!m && roles.includes('PUBLIC') && roles.includes('ANON'),
      `PUBLIC and anon cannot SELECT public.${view}`,
      m ? `revoke roles: ${roles}` : 'no matching REVOKE'
    );
  }

  // Tests 22.10–22.13: authenticated + service_role retain SELECT
  for (const view of TARGET_VIEWS) {
    const grantRe = new RegExp(
      `GRANT\\s+SELECT\\s+ON\\s+public\\.${view}\\s+TO\\s+([^;]+);`,
      'i'
    );
    const m = grantRe.exec(correctiveSql);
    const roles = m ? m[1].toUpperCase() : '';
    assert(
      !!m && roles.includes('AUTHENTICATED') && roles.includes('SERVICE_ROLE'),
      `authenticated + service_role retain SELECT on public.${view}`,
      m ? `grant roles: ${roles}` : 'no matching GRANT'
    );
  }

  // Tests 22.14–22.20: Stage C2 tables have FORCE ROW LEVEL SECURITY
  for (const table of STAGE_C2_TABLES) {
    const forceRe = new RegExp(
      `ALTER\\s+TABLE\\s+public\\.${table}\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      'i'
    );
    assert(forceRe.test(correctiveSql), `Stage C2 table public.${table} has FORCE ROW LEVEL SECURITY`);
  }

  // Test 22.21: No public view is left without security_invoker (regression guard)
  {
    const created = collectCreatedPublicViews(migrations);
    const insecure = Array.from(created.keys()).filter((v) => !invokerViews.has(v));
    assert(
      insecure.length === 0,
      'No public view is created without security_invoker = true',
      insecure.length ? `insecure views: ${insecure.join(', ')}` : undefined
    );
  }

  console.log(`\nMODULE 22 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/tenant_view_security.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /tenant_view_security\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runTenantViewSecurityTests()
    .then((res) => {
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('P0-05 tenant view security suite execution error:', err);
      process.exit(1);
    });
}
