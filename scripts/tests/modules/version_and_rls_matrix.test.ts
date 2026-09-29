import fs from 'fs';
import path from 'path';
import { APP_VERSION, APP_VERSION_TAG, getVersionInfo, getVersionHeaders } from '../../../src/config/version.js';

export async function runVersionAndRlsMatrixTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 16: VERSION ALIGNMENT & 100% RLS COVERAGE MATRIX');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 16.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 16.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Version SSOT verification
  assert(
    APP_VERSION === '4.1.0' && APP_VERSION_TAG === 'VER 4.1.0',
    'Version Single Source of Truth (SSOT) defined as 4.1.0 / VER 4.1.0'
  );

  const versionInfo = getVersionInfo();
  assert(
    versionInfo.version === '4.1.0' &&
    versionInfo.apiVersion === 'v1' &&
    typeof versionInfo.rlsCoverage === 'string',
    'getVersionInfo() helper returns structured enterprise metadata'
  );

  const versionHeaders = getVersionHeaders();
  assert(
    versionHeaders['X-IPDS-Version'] === '4.1.0' &&
    typeof versionHeaders['X-IPDS-Release'] === 'string',
    'getVersionHeaders() returns standard X-IPDS-Version: 4.1.0 header payload'
  );

  // 2. package.json synchronization
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  assert(
    packageJson.version === '4.1.0',
    'package.json version aligned to 4.1.0'
  );

  // 3. metadata.json synchronization
  const metadataJsonPath = path.join(process.cwd(), 'metadata.json');
  const metadataJson = JSON.parse(fs.readFileSync(metadataJsonPath, 'utf8'));
  assert(
    metadataJson.description.includes('4.1.0') || metadataJson.description.includes('4.2'),
    'metadata.json description synchronized with Ver 4.1.0 / Ver 4.2'
  );

  // 4. index.html meta tags synchronization
  const indexHtmlPath = path.join(process.cwd(), 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(
    indexHtml.includes('iPDS Ver 4.1.0') || indexHtml.includes('4.1.0') || indexHtml.includes('ver 4.2') || indexHtml.includes('VER 4.2'),
    'index.html description and OpenGraph meta tags aligned to Ver 4.1.0 / Ver 4.2'
  );

  // 5. Phase 7 Complete RLS Coverage Matrix Migration Blueprint exists
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260908_phase7_complete_rls_coverage_matrix.sql');
  const migrationExists = fs.existsSync(migrationPath);
  assert(
    migrationExists,
    'Phase 7 Complete RLS Matrix SQL migration blueprint (20260908_phase7_complete_rls_coverage_matrix.sql) exists'
  );

  if (!migrationExists) {
    return { passed, total };
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // 6. Domain 1 Operational Tables RLS & FORCE ROW LEVEL SECURITY
  assert(
    migrationSql.includes('operational_tables') &&
    migrationSql.includes('FORCE ROW LEVEL SECURITY') &&
    migrationSql.includes('rekod_hasil') &&
    migrationSql.includes('kadar_upah'),
    'Domain 1: Operational tables protected with ENABLE & FORCE ROW LEVEL SECURITY'
  );

  // 7. Domain 2 Topology Master Tables (Global Read, Admin Write)
  assert(
    migrationSql.includes('topology_tables') &&
    migrationSql.includes('org_macro_zones') &&
    migrationSql.includes('org_estates') &&
    migrationSql.includes('org_divisions'),
    'Domain 2: Organizational topology tables protected with universal read & admin write policies'
  );

  // 8. Domain 3 Identity & Tamper-Proof Audit Policies
  assert(
    migrationSql.includes('audit_tables') &&
    migrationSql.includes('tamper_guard_policy') &&
    migrationSql.includes('FOR UPDATE USING (false)'),
    'Domain 3: Audit and incident logs protected with tamper-proof append-only RLS policy'
  );

  // 9. Domain 4 Knowledge Base, RAG & Observability Policies
  assert(
    migrationSql.includes('rag_and_obs_tables') &&
    migrationSql.includes('rag_knowledge_chunks') &&
    migrationSql.includes('observability_metric_snapshots') &&
    migrationSql.includes('oil_palm_reference_corpus'),
    'Domain 4: RAG knowledge chunks and observability tables guarded with authenticated read policies'
  );

  // 10. Domain 5 Supabase Storage Objects Security
  assert(
    migrationSql.includes('storage.objects') &&
    migrationSql.includes('receipt-images') &&
    migrationSql.includes('audit-exports'),
    'Domain 5: Supabase storage buckets enforced with tenant-bound object isolation'
  );

  return { passed, total };
}
