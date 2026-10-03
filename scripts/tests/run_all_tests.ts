process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { runAuthTests } from './modules/auth.test.js';
import { runRbacTests } from './modules/rbac.test.js';
import { runHasilTests } from './modules/hasil.test.js';
import { runHantaranTests } from './modules/hantaran.test.js';
import { runPruningTests } from './modules/pruning.test.js';
import { runMerumputTests } from './modules/merumput.test.js';
import { runDbWritesTests } from './modules/db_writes.test.js';
import { runSecurityComplianceTests } from './modules/security_compliance.test.js';
import { runAuthBypassTests } from './modules/auth_bypass.test.js';
import { runMultiTenantSchemaTests } from './modules/multi_tenant_schema.test.js';
import { runRlsPoliciesTests } from './modules/rls_policies.test.js';
import { runJwtClaimsTests } from './modules/jwt_claims.test.js';
import { runScopedSupabaseClientTests } from './modules/scoped_supabase_client.test.js';
import { runUnifiedIdentityTests } from './modules/unified_identity.test.js';
import { runJwtSessionLifecycleTests } from './modules/jwt_session_lifecycle.test.js';
import { runVersionAndRlsMatrixTests } from './modules/version_and_rls_matrix.test.js';
import { runTenantIsolationTests } from './modules/tenant_isolation.test.js';
import { runJobQueueTests } from './modules/job_queue.test.js';
import { runRemediationDirectAnonRlsTests } from './modules/remediation_direct_anon_rls.test.js';
import { runCronEndpointTests } from './modules/cron_endpoint.test.js';
import { runAiEndpointSecurityTests } from './modules/ai_endpoint_security.test.js';
import { runOperationalReadAuthzTests } from './modules/operational_read_authz.test.js';
import { runDeviceAuthBypassTests } from './modules/device_auth_bypass.test.js';
import { runTelemetryAuthzTests } from './modules/telemetry_authz.test.js';
import { runWorkersAuthzTests } from './modules/workers_authz.test.js';
import { runLogoSSRFTests } from './modules/logo_ssrf.test.js';
import { runHujanReadAuthzTests } from './modules/hujan_read_authz.test.js';
import { runErrorMessageHardeningTests } from './modules/error_message_hardening.test.js';
import { runErrorMessageSweepTests } from './modules/error_message_sweep.test.js';
import { runErrorMessageFinalSweepTests } from './modules/error_message_final_sweep.test.js';
import { runSecurityIntegrationGateTests } from './modules/security_integration_gate.test.js';
import { runDeviceBootstrapTests } from './modules/device_bootstrap.test.js';
import { runDeviceBootstrapUxTests } from './modules/device_bootstrap_ux.test.js';
import { runDeviceApprovalCapabilityTests } from './modules/device_approval_capability.test.js';
import { runDeviceApprovalRequesterContextTests } from './modules/device_approval_requester_context.test.js';
import { runDeviceApprovalStatusCheckTests } from './modules/device_approval_status_check.test.js';
import { runStaleDeviceApprovalReadPathTests } from './modules/device_status_read_path.test.js';
import { runPekerjaPersistenceApiTests } from './modules/pekerja_persistence_api.test.js';
import { runDeviceCredentialFoundationTests } from './modules/device_credential_foundation.test.js';
import { runDeviceEstateAccessTests } from './modules/device_estate_access.test.js';
import { runDeviceLoginEnforcementTests } from './modules/device_login_enforcement.test.js';
import { runDeviceEstateBackfillTests } from './modules/device_estate_backfill.test.js';
import { runDeviceCredentialRolloutTests } from './modules/device_credential_rollout.test.js';
import { runBackgroundJobSecurityTests } from './modules/background_job_security.test.js';
import { runTenantViewSecurityTests } from './modules/tenant_view_security.test.js';
import { runRbacEndpointSecurityTests } from './modules/rbac_endpoint_security.test.js';
import { runDeviceSecurityTests } from './modules/device_security.test.js';
import { runOperationalWriteAuthzTests } from './modules/operational_write_authz.test.js';
import { runActingAsTests } from './modules/acting_as.test.js';
import { runDeviceBulkRotationTests } from './modules/device_bulk_rotation.test.js';
import { runDeviceMergeRedirectTests } from './modules/device_merge_redirect.test.js';
import { runDeviceMergeTests } from './modules/device_merge.test.js';
import { runRateLimitingTests } from './modules/rate_limiting.test.js';
import { runAiServiceWrapperTests } from './modules/ai_service_wrapper.test.js';
import { runP1_1AuthHardeningTests } from './modules/p1_1_auth_hardening.test.js';
import { runP1_1BEmployeeGuardTests } from './modules/p1_1b_employee_guard.test.js';
import { runP1_1CLocalCacheAndPostTests } from './modules/p1_1c_local_cache_post.test.js';
import { runP1_1CScopedClientTests } from './modules/p1_1c_scoped_client.test.js';
import { runP1_1DAtomicCreateTests } from './modules/p1_1d_atomic_create.test.js';
import { runGradingTaskTests } from './modules/grading_tasks.test.js';
import { runSecurityHeadersAndCorsTests } from './modules/security_headers_cors.test.js';
import { runRlsTenantIsolationGapsTests } from './modules/rls_tenant_isolation_gaps.test.js';
import { runKioskLoginTests } from './modules/kiosk_login.test.js';
import { runKioskRosterProvisioningTests } from './modules/kiosk_roster_provisioning.test.js';

async function runMasterRegressionSuite() {
  console.log('================================================================');
  console.log('iPDS VER 4.1.0 — MASTER AUTOMATED REGRESSION & SECURITY GATE SUITE');
  console.log('================================================================');

  let grandTotalPassed = 0;
  let grandTotalTests = 0;
  const allFailedTests: string[] = [];

  const modules = [
    { name: '1. Authentication', fn: runAuthTests },
    { name: '2. RBAC', fn: runRbacTests },
    { name: '3. Hasil', fn: runHasilTests },
    { name: '4. Hantaran', fn: runHantaranTests },
    { name: '5. Pruning', fn: runPruningTests },
    { name: '6. Merumput', fn: runMerumputTests },
    { name: '7. Database Writes', fn: runDbWritesTests },
    { name: '8. Security & Compliance', fn: runSecurityComplianceTests },
    { name: '9. Auth Bypass Defense', fn: runAuthBypassTests },
    { name: '10. Phase 1 Multi-Tenant Schema', fn: runMultiTenantSchemaTests },
    { name: '11. Phase 2 RLS Policies', fn: runRlsPoliciesTests },
    { name: '12. Phase 3 JWT Claims & Context', fn: runJwtClaimsTests },
    { name: '13. Phase 4 Scoped Supabase Client', fn: runScopedSupabaseClientTests },
    { name: '14. Phase 5 Unified Identity & SSOT', fn: runUnifiedIdentityTests },
    { name: '15. Phase 6 JWT & Sliding Session Lifecycle', fn: runJwtSessionLifecycleTests },
    { name: '16. Phase 7 Version Alignment & 100% RLS Coverage Matrix', fn: runVersionAndRlsMatrixTests },
    { name: '17. P0-3 Tenant Isolation Hardening', fn: runTenantIsolationTests },
    { name: '18. Background Job Queue & Asynchronous Engine', fn: runJobQueueTests },
    { name: '19. Direct Anon Access Remediation & API Proxy Verification', fn: runRemediationDirectAnonRlsTests },
    { name: '20. Protected Vercel Cron Runner (/api/cron/process-jobs)', fn: runCronEndpointTests },
    { name: '26. P0-09 AI Endpoint Authorization Hardening', fn: runAiEndpointSecurityTests },
    { name: '27. P0-10 Operational Read Authorization Hardening', fn: runOperationalReadAuthzTests },
    { name: '28. P0-11-A Device-Whitelist Bypass Hardening', fn: runDeviceAuthBypassTests },
    { name: '29. P0-11-B Telemetry Threshold Authorization', fn: runTelemetryAuthzTests },
    { name: '30. P0-11-C Worker Mutation Authorization', fn: runWorkersAuthzTests },
    { name: '31. P0-11-D Logo SSRF Hardening', fn: runLogoSSRFTests },
    { name: '32. P0-11-E Hujan Read Authorization', fn: runHujanReadAuthzTests },
    { name: '33. P0-11-F Error-Message Disclosure Hardening', fn: runErrorMessageHardeningTests },
    { name: '34. P0-12 Error-Message Disclosure Sweep', fn: runErrorMessageSweepTests },
    { name: '35. P0-13 Final Error-Message Sweep', fn: runErrorMessageFinalSweepTests },
    { name: '36. P0-14 Security Integration Release Gate', fn: runSecurityIntegrationGateTests },
    { name: '21. P0-04 Background Job SECURITY DEFINER Hardening', fn: runBackgroundJobSecurityTests },
    { name: '22. P0-05 Tenant View RLS-Bypass Hardening', fn: runTenantViewSecurityTests },
    { name: '23. P0-06 RBAC Endpoint Authorization Hardening', fn: runRbacEndpointSecurityTests },
    { name: '24. P0-07 Device Security Hardening', fn: runDeviceSecurityTests },
    { name: '25. P0-08 Optional-Auth Write Hardening', fn: runOperationalWriteAuthzTests },
    { name: '37. P0-16 Secure Device Bootstrap & Persistence', fn: runDeviceBootstrapTests },
    { name: '38. P0-16 Device Bootstrap UX Fix', fn: runDeviceBootstrapUxTests },
    { name: '39. P0-16A One-Time Device Approval Capability', fn: runDeviceApprovalCapabilityTests },
    { name: '40. P0-16B Device Approval Requester Context', fn: runDeviceApprovalRequesterContextTests },
    { name: '41. P0-16 Device Approval Status Check UX Fix', fn: runDeviceApprovalStatusCheckTests },
    { name: '42. P0-16 Stale Device Approval Read-Path Fix', fn: runStaleDeviceApprovalReadPathTests },
    { name: '43. P0-16B.1 Authenticated Pekerja Persistence API', fn: runPekerjaPersistenceApiTests },
    { name: '44. P0-16C.1 Cryptographic Device Credential Foundation', fn: runDeviceCredentialFoundationTests },
    { name: '45. P0-16C.2 Multi-Estate Device Authorization', fn: runDeviceEstateAccessTests },
    { name: '46. P0-16C.3 Strict Login Enforcement', fn: runDeviceLoginEnforcementTests },
    { name: '47. P0-16C.5 Existing Device Estate-Grant Backfill', fn: runDeviceEstateBackfillTests },
    { name: '48. P0-16C.4 Existing-Device Credential Rollout', fn: runDeviceCredentialRolloutTests },
    { name: '49. P1 Administrative Acting-As (Actor/Subject)', fn: runActingAsTests },
    { name: '50. P1 Bulk Device-Credential Rotation (Idempotent)', fn: runDeviceBulkRotationTests },
    { name: '51. P1 Device Soft-Merge Redirect & Safeguards', fn: runDeviceMergeRedirectTests },
    { name: '52. P1 Device Merge (Operator-Driven Soft-Merge)', fn: runDeviceMergeTests },
    { name: '53. Sliding Window Rate Limiting & Enterprise Security', fn: runRateLimitingTests },
    { name: '54. Centralized AI Service Wrapper Verification', fn: runAiServiceWrapperTests },
    { name: '55. P1.1 Emergency Auth Hardening', fn: runP1_1AuthHardeningTests },
    { name: '56. P1.1-B Fail-Closed Employee Estate Guard', fn: runP1_1BEmployeeGuardTests },
    { name: '57. P1.1-C Local Employee Cache (B4) + POST Fail-Closed', fn: runP1_1CLocalCacheAndPostTests },
    { name: '58. P1.1-C SEC-03 Scoped vs Privileged Supabase Client', fn: runP1_1CScopedClientTests },
    { name: '59. P1.1-D Atomic Employee Create RPC Contract', fn: runP1_1DAtomicCreateTests },
    { name: '60. IPDS Grading Task Workflow', fn: runGradingTaskTests },
    { name: '61. Enterprise Security Headers & CORS Allow-List', fn: runSecurityHeadersAndCorsTests },
    { name: '62. RLS Tenant Isolation Gaps & Policy Consolidation Proof', fn: runRlsTenantIsolationGapsTests },
    { name: '63. Kiosk Login Hash, Estate & Retry Regressions', fn: runKioskLoginTests },
    { name: '64. Kiosk Roster Provisioning (Staff-No Hash) Safety', fn: runKioskRosterProvisioningTests },
  ];

  for (const mod of modules) {
    try {
      process.env.NODE_ENV = 'test';
      const res: any = await mod.fn();
      grandTotalPassed += res.passed;
      grandTotalTests += res.total;
      if (res.passed !== res.total) {
        console.error(`\n🚨 FAILED MODULE: ${mod.name} had failures! Passed: ${res.passed}/${res.total}`);
        if (res.failedTests && Array.isArray(res.failedTests) && res.failedTests.length > 0) {
          allFailedTests.push(...res.failedTests);
        } else {
          allFailedTests.push(`${mod.name}: Passed ${res.passed}/${res.total}`);
        }
      }
    } catch (e: any) {
      console.error(`\n[CRITICAL FAIL] Module ${mod.name} encountered unexpected error:`, e.stack || e.message || e);
      allFailedTests.push(`Module ${mod.name} crash: ${e.message || e}`);
    }
  }

  console.log('\n================================================================');
  console.log(`MASTER REGRESSION SUITE RESULTS: ${grandTotalPassed}/${grandTotalTests} TESTS PASSED (${Math.round((grandTotalPassed / grandTotalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (grandTotalPassed !== grandTotalTests) {
    console.error('REGRESSION SUITE FAILED — One or more critical tests did not pass!');
    if (allFailedTests.length > 0) {
      console.error('\nFAILED TESTS BREAKDOWN:');
      allFailedTests.forEach((f) => console.error(`  ❌ ${f}`));
      console.error('================================================================\n');
    }
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterRegressionSuite().catch((err) => {
  console.error('Master regression suite execution error:', err);
  process.exit(1);
});
