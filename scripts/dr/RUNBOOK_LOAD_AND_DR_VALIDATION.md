# iPDS 4.1 — Operational Runbook: Load Testing & Disaster Recovery (DR) Validation

**Document ID:** `IPDS-OPS-RUNBOOK-DR-LOAD-01`
**Classification:** Internal Engineering & DevOps
**Target Environments:** Staging / Non-Production Recovery Target Only (`TARGET_ENV=staging`)
**Strict Safety Rule:** Never target Production (`assertNonProductionTarget` enforces fatal termination).

---

## 1. Executive Summary & Safety Pre-requisites

This runbook specifies the authoritative procedure for executing:
1. **Multi-Phase Staging Load & Stress Testing** (up to 1,500 concurrent virtual users).
2. **Disaster Recovery (DR) Stage 2 Orchestration & RPO/RTO Validation** across all 29 canonical database tables.

### Safety Guards & Lockout Rules
* **Production Guard Armed:** All DR drill scripts (`scripts/dr/*`) and staging load test scripts (`scripts/tests/staging_1500_user_load_test.ts`) contain environment detectors (`detectEnvironment`) that check hostname and `TARGET_ENV`. If a production Supabase project or URL is detected, the process terminates immediately with code 1.
* **Never Run Destructive Restore in Production:** The automated restore procedure is strictly limited to isolated staging/recovery databases.

---

## 2. Environment Configuration Prerequisites

Ensure the following environment variables are set in your staging runner shell or CI runner before initiating drills:

```bash
# Target environment definition (Must NOT be 'production')
export TARGET_ENV="staging"
export NODE_ENV="test"

# Staging Application Server Target
export TEST_TARGET_URL="https://staging.ipds.felda.gov.my" # Or http://localhost:3000

# Isolated Non-Production Supabase Instance (Dedicated Staging/Recovery DB)
export SUPABASE_URL="https://your-staging-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
export SUPABASE_ANON_KEY="eyJhbGciOi..."

# Authentication Context for Load Test Agents
export IPDS_LOAD_TEST_PIN="123456"
```

---

## 3. Load Testing Procedures & Execution

### 3.1 Quick Local / Baseline Load Test
Runs automated Autocannon stress benchmarks against local or staging endpoints (baseline health check, query caching, job submission queue):

```bash
# Target: Local / Staging baseline (30 connections, 5-second burst per scenario)
npm run test:load
```

### 3.2 Full 1,500 Concurrent User Staging Stress Test
Simulates peak operational harvest and weighbridge load across 5 realistic multi-tenant estate phases:

```bash
# Run comprehensive multi-phase benchmark
npm run test:load:staging
```

#### Test Execution Matrix:
| Phase | Simulated Scenario | Concurrent Users (VU) | Duration | Target Metrics |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Baseline & Health Check | 250 VU | 10s | Latency p50 < 50ms, 0% 5xx |
| **Phase 2** | Moderate Harvest Workload | 750 VU | 15s | Latency p95 < 150ms |
| **Phase 3** | Peak Harvest Stress Load | 1,500 VU | 20s | RPS > 1,000, 0 Transport Drops |
| **Phase 4** | Cross-Tenant Zero Leakage | 100 VU | Concurrent | 0 Cross-Estate Leaks (`FPM_TUNGGAL` vs `FPM_ADELA`) |
| **Phase 5** | Concurrent Writes & Cleanup | 50 VU | Idempotent | 100% Write & Transactional Rollback |

#### Metrics to Capture & Record:
* **Throughput:** Requests per Second (RPS) and Throughput (MB/s).
* **Latency Profile:** `p50` (median), `p95` (tail latency), `p99`, Average, and Maximum latency in milliseconds.
* **HTTP Response Codes:** Counts of 2xx, 4xx (client/auth), 5xx (server error).
* **Zero-Leakage Status:** Confirmation that no record belonging to Estate A was returned to Estate B.

---

## 4. Disaster Recovery (DR) Drill & RPO/RTO Validation

### 4.1 Step 1: DR Preflight Verification
Verifies all documentation, manifest registries, safety lockout guards, and route mounts:

```bash
npm run dr:check
```
*Expected Result:* `CI PREFLIGHT RESULT: ALL GATES PASSED (READY)` (0 exit code).

### 4.2 Step 2: Continuous WAL / RPO Capability Assessment
Evaluates whether physical Point-in-Time Recovery (PITR) continuous write-ahead log archiving is provisioned:

```bash
npm run dr:rpo:assess
```
*Output Interpretation:*
* If running on Supabase Pro/Enterprise with active PITR add-on: Reports `RPO STATUS: PASS` with measured delta.
* If running on Development/Free tier without physical WAL add-on: Honestly outputs `RPO STATUS: NOT_PROVEN` and details required cloud dependencies.

### 4.3 Step 3: End-to-End DR Stage 2 Drill Orchestration
Coordinates table reconciliation, backup verification, controlled non-production restore, 11-domain database validation, application smoke tests, storage verification, and adversarial failure tests:

```bash
npm run dr:drill
```

#### DR Verification Breakdown:
1. **Reconciliation & Integrity:** Verifies SHA-256 manifest of logical backup snapshots across all 29 tables (`npm run dr:backup:verify`).
2. **Controlled Restoration:** Restores data idempotently into non-production database (`scripts/dr/restore.ts`).
3. **Deep Database Validation:** Asserts record count, column schemas, and foreign keys across all 11 core domains (`npm run dr:verify`).
4. **Smoke & Failure Adversarial Tests:** Probes failover resilience against corrupted tokens, missing tables, and network partitions (`npm run dr:smoke` and `npm run dr:failures`).
5. **RTO & RPO Measurement:** Calculates exact elapsed minutes against targets (RTO SLA $\le$ 60 min, RPO SLA $\le$ 5 min).

---

## 5. Recommended Operational Cadence

| Activity | Frequency | Target SLA / Criteria | Responsible Owner |
| :--- | :--- | :--- | :--- |
| **Automated DR Preflight** | Every CI/CD Build / PR | 100% Gates Pass | CI Pipeline |
| **Staging Load Test (1,500 VU)** | Pre-Major Release / Bi-weekly | Latency p95 < 200ms, Error rate < 0.1% | QA / DevOps |
| **DR Stage 2 Complete Drill** | Monthly (Scheduled Window) | RTO $\le$ 60 min, RPO $\le$ 5 min | Lead Backend / SRE |
| **Backup Manifest Audit** | Daily (Automated Cron) | Verified SHA-256 for all 29 tables | Automated Cron (`/api/cron/process-jobs`) |

---

## 6. Escalation & Incident Protocols

1. **Staging Load Degradation:** If `test:load:staging` displays `status5xx > 0.5%`, investigate Node.js event loop blocking and Supabase connection pool saturation.
2. **Cross-Tenant Leakage Failure:** If Phase 4 detects cross-estate leakage, immediately halt deployment and audit RLS policies (`auth_estate_id()` and `getScopedSupabase`).
3. **Backup Manifest Mismatch:** If `dr:backup:verify` reports SHA-256 checksum mismatch, treat as data corruption incident and roll back to previous verified snapshot.

