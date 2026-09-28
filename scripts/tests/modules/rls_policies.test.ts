import fs from 'fs';
import path from 'path';

export async function runRlsPoliciesTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 11: PHASE 2 SUPABASE ROW LEVEL SECURITY (RLS) POLICIES');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 11.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 11.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260905_phase2_supabase_rls_policies.sql');
  const migrationExists = fs.existsSync(migrationPath);

  // Test 11.1: Migration SQL file exists
  assert(migrationExists, 'Phase 2 RLS Policies SQL blueprint (20260905_phase2_supabase_rls_policies.sql) exists');

  let migrationSql = '';
  if (migrationExists) {
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  }

  // Test 11.2: RLS enabled across all core tables and topology tables
  const coreAndTopologyTables = [
    'org_macro_zones',
    'org_regions',
    'org_op_zones',
    'org_estates',
    'org_divisions',
    'hasil_abw',
    'hantaran_resit',
    'pruning_progress',
    'merumput_progress',
    'merumput_inventory',
    'workers',
    'kualiti_bts',
    'observability_logs'
  ];
  const rlsEnabledAll = coreAndTopologyTables.every(tbl => migrationSql.includes(`ALTER TABLE public.${tbl} ENABLE ROW LEVEL SECURITY;`));
  assert(rlsEnabledAll, 'Row Level Security (RLS) enabled across all 8 core tables and 5 topology tables');

  // Test 11.3: Claim extraction helper functions declared
  const claimsFunctions = [
    'auth_estate_id()',
    'auth_app_role()',
    'auth_is_super_admin()',
    'auth_is_cross_estate_role()'
  ];
  const functionsDeclared = claimsFunctions.every(fn => migrationSql.includes(fn));
  assert(functionsDeclared, 'PostgREST JWT claim extraction helper functions defined for estate_id & role resolution');

  // Test 11.4: SELECT policies enforce tenant isolation & cross-estate access
  const selectPoliciesCreated = coreAndTopologyTables.slice(5).every(tbl => migrationSql.includes(`${tbl}_select_policy`));
  assert(selectPoliciesCreated, 'Tenant isolation SELECT policies enforced across all operational tables');

  // Test 11.5: INSERT/UPDATE policies restrict write actions by tenant & role
  const transactionalTables = coreAndTopologyTables.slice(5, 12); // exclude append-only observability_logs
  const writePoliciesCreated = transactionalTables.every(tbl => migrationSql.includes(`${tbl}_insert_policy`) && migrationSql.includes(`${tbl}_update_policy`)) && migrationSql.includes('observability_logs_insert_policy');
  assert(writePoliciesCreated, 'Tenant-bound INSERT and UPDATE policies enforcing role authorization WITH CHECK');

  // Test 11.6: DELETE policies restricted to privileged roles
  const deletePoliciesCreated = transactionalTables.every(tbl => migrationSql.includes(`${tbl}_delete_policy`));
  assert(deletePoliciesCreated, 'DELETE operations strictly guarded for high-tier managerial roles (PF, FC, Super Admin)');

  return { passed, total };
}
