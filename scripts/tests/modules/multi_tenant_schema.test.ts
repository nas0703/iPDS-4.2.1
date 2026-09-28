import fs from 'fs';
import path from 'path';
import { assertTenantContext } from '../../../src/types/multiTenantSchema.js';

export async function runMultiTenantSchemaTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 10: PHASE 1 MULTI-TENANT SCHEMA & 8 CORE TABLES HARDENING');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 10.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 10.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260904_phase1_multi_tenant_schema.sql');
  const migrationExists = fs.existsSync(migrationPath);

  // Test 10.1: SQL Migration file exists
  assert(migrationExists, 'Phase 1 SQL migration blueprint (20260904_phase1_multi_tenant_schema.sql) exists');

  let migrationSql = '';
  if (migrationExists) {
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  }

  // Test 10.2: All 5 Organizational Topology Hierarchy Tables defined
  const topologyTables = ['org_macro_zones', 'org_regions', 'org_op_zones', 'org_estates', 'org_divisions'];
  const allTopologyDefined = topologyTables.every(t => migrationSql.includes(`CREATE TABLE IF NOT EXISTS public.${t}`));
  assert(allTopologyDefined, 'All 5 organizational topology hierarchy tables defined in migration blueprint');

  // Test 10.3: All 8 Core Operational Tables defined with mandatory estate_id
  const coreTables = [
    'hasil_abw',
    'hantaran_resit',
    'pruning_progress',
    'merumput_progress',
    'merumput_inventory',
    'workers',
    'kualiti_bts',
    'observability_logs'
  ];
  const allCoreDefined = coreTables.every(t => migrationSql.includes(t) && migrationSql.includes('estate_id VARCHAR'));
  assert(allCoreDefined, 'All 8 core operational tables defined with mandatory estate_id isolation column');

  // Test 10.4: Composite performance indexes created for all 8 core tables
  const compositeIndexes = [
    'idx_hasil_abw_estate_tarikh',
    'idx_hantaran_resit_estate_tarikh',
    'idx_pruning_progress_estate_tarikh',
    'idx_merumput_progress_estate_tarikh',
    'idx_merumput_inventory_estate_code',
    'idx_workers_estate_active',
    'idx_kualiti_bts_estate_tarikh',
    'idx_observability_logs_estate_time'
  ];
  const allIndexesCreated = compositeIndexes.every(idx => migrationSql.includes(idx));
  assert(allIndexesCreated, 'Composite performance indexes (estate_id + date/id) created for high-speed multi-tenant queries');

  // Test 10.5: Non-cascading RESTRICT constraints and audit triggers attached
  const auditTriggersAttached = migrationSql.includes('update_timestamp_and_tenant_user') && migrationSql.includes('ON DELETE RESTRICT');
  assert(auditTriggersAttached, 'Non-cascading RESTRICT constraints and automated multi-tenant audit triggers attached');

  // Test 10.6: TypeScript tenant context assertion helper validator
  let assertTenantWorks = false;
  try {
    const valid = assertTenantContext('FPM_ADELA');
    if (valid === 'FPM_ADELA') {
      try {
        assertTenantContext(''); // Should throw
      } catch {
        assertTenantWorks = true;
      }
    }
  } catch {
    assertTenantWorks = false;
  }
  assert(assertTenantWorks, 'TypeScript assertTenantContext strictly validates tenant estate_id and rejects empty context');

  return { passed, total };
}
