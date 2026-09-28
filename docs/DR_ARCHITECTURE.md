# IPDS VER 3.7 — DISASTER RECOVERY (DR) ARCHITECTURE
## Stage 1: Core Foundation & Recovery Strategy

**System Version:** IPDS Ver. 3.7 (Enterprise Plantation Management System)  
**Environment Baseline:** PostgreSQL (Supabase) + Node.js / Express Backend + React 19 Client  
**Status:** DR Stage 1 Foundation (Development & Pre-production Safety)  
**Target RPO:** $\le 5\text{ minutes}$ (Recovery Point Objective)  
**Target RTO:** $\le 60\text{ minutes}$ (Recovery Time Objective)  

> *Disclaimer: RPO $\le 5\text{ min}$ and RTO $\le 60\text{ min}$ are operational engineering targets to be validated through staging simulations and scheduled drills, not claims of instantaneous completion.*

---

## 1. Executive Summary & Philosophy

The Integrated Plantation Data System (IPDS) powers mission-critical estate operations across Peninsular Malaysia and Borneo, including daily fresh fruit bunch (FFB/timbangan) deliveries, checkroll/worker payroll records, pesticide calibration, fertilizer scheduling, rainfall tracking, and Enterprise Agro-AI RAG agronomy knowledge.

The **Stage 1 Disaster Recovery Architecture** establishes a resilient, non-destructive, and verified foundation ensuring that:
1. **Zero-Production Disruption**: All DR tooling is failsafe, isolated, and strictly prohibits destructive operations against the live production environment.
2. **Deterministic Recoverability**: Automated tools verify database identity, schema consistency, data checksums, row accessibility, and extensions before and after any recovery operation.
3. **Multi-Domain Coverage**: Full coverage of 11 critical IPDS operational domains, Supabase Storage buckets, and observability audit trails.

---

## 2. Recovery Objective Targets (RPO & RTO)

| Metric | Target Window | Description & Implementation Mechanism |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **$\le 5$ Minutes** | Point-in-time recovery (PITR) with write-ahead logging (WAL) archiving in Supabase + hourly snapshot exports for cold storage. Maximum allowable transactional data loss in a catastrophe is 5 minutes. |
| **RTO (Recovery Time Objective)** | **$\le 60$ Minutes** | Time from disaster declaration to a fully healthy, verified, and accessible standby instance (database restore $\le 30\text{ min}$, storage validation $\le 15\text{ min}$, verification & health checks $\le 15\text{ min}$). |

---

## 3. Threat Model & Disaster Scenarios

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IPDS DISASTER CLASSIFICATIONS                      │
├───────────────────┬──────────────────────────────────┬──────────────────────┤
│ SCENARIO          │ IMPACT / SYMPTOM                 │ RECOVERY STRATEGY    │
├───────────────────┼──────────────────────────────────┼──────────────────────┤
│ 1. Data Corruption│ Erroneous batch update or bad    │ PITR rollback to     │
│    / User Error   │ script corrupts plantation table │ $T - 1\text{ min}$   │
├───────────────────┼──────────────────────────────────┼──────────────────────┤
│ 2. Schema / Failed│ Failed SQL migration locks DDL   │ Safe migration abort │
│    Migration      │ or breaks API contracts          │ & snapshot restore   │
├───────────────────┼──────────────────────────────────┼──────────────────────┤
│ 3. Cloud Outage   │ Supabase/Cloud Run region down   │ Cross-region standby │
│    (Primary Host) │ or container unreachable         │ failover with DNS/CDN│
├───────────────────┼──────────────────────────────────┼──────────────────────┤
│ 4. Storage Loss   │ S3/Supabase Storage bucket loss  │ Dual-replicated cold │
│    (PDFs / Assets)│ or asset corruption              │ storage sync restore │
├───────────────────┼──────────────────────────────────┼──────────────────────┤
│ 5. Ransomware /   │ Primary database compromised or  │ Clean-room rebuild   │
│    Intrusion      │ unauthorized destructive query   │ from signed backups  │
└───────────────────┴──────────────────────────────────┴──────────────────────┘
```

---

## 4. Multi-Tier Backup Strategy

### Tier 1: Continuous WAL Archiving & Point-In-Time Recovery (PITR)
- **Engine**: PostgreSQL WAL stream managed by Supabase Cloud.
- **Retention**: 7 to 30 days continuous rolling window.
- **Granularity**: Second-level recovery capability.

### Tier 2: Logical Schema & Data Snapshots (`scripts/dr/backup.ts`)
- **Format**: Structured SQL DDL + Plaintext JSON/CSV table dumps with SHA-256 integrity manifests.
- **Frequency**:
  - Full Logical Snapshot: Daily at 02:00 MYT (low plantation activity).
  - Telemetry & Aggregated Metrics: Hourly snapshot writer.
- **Manifest**: Contains `backup_id`, `created_at`, `source_env`, `table_count`, `row_counts`, and `sha256_checksum`.

### Tier 3: Storage Bucket Mirroring
- **Engine**: S3-compatible cold replication script.
- **Target**: Isolated secondary object storage bucket with immutable Object Lock (WORM).

---

## 5. Storage Disaster Recovery Strategy

Supabase Storage holds critical unstructured assets that are **not** stored directly in PostgreSQL relational rows.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         IPDS STORAGE BUCKET INVENTORY                        │
├───────────────────────┬──────────────────────┬─────────────┬─────────────────┤
│ Bucket Name           │ Content Description  │ Sensitivity │ Recovery Method │
├───────────────────────┼──────────────────────┼─────────────┼─────────────────┤
│ `ipds-assets`         │ Custom estate logos, │ Low /       │ S3 Mirror Sync  │
│                       │ header logos, icons  │ Operational │ & Local Seed    │
├───────────────────────┼──────────────────────┼─────────────┼─────────────────┤
│ `ipds-rag-documents`  │ Enterprise Agronomy  │ High /      │ Secondary Object│
│                       │ PDFs, Manual Sawit,  │ Knowledge   │ Storage Vault   │
│                       │ The Oil Palm 5th Ed  │             │ with Hash Sync  │
├───────────────────────┼──────────────────────┼─────────────┼─────────────────┤
│ `ipds-exports`        │ Generated PDF bills, │ Medium /    │ Regenerable on- │
│                       │ Excel summaries,     │ Transient   │ demand or from  │
│                       │ monthly reports      │             │ DB transactions │
└───────────────────────┴──────────────────────┴─────────────┴─────────────────┘
```

### Storage Recovery Execution:
1. **Preflight**: Verify secondary storage bucket connectivity and hash integrity.
2. **Sync**: Stream missing binary objects back to target Supabase Storage instance using idempotent `upsertObject` logic.
3. **Database Reconciliation**: Cross-reference `ipds_rag_documents.hash` with stored objects in `ipds-rag-documents`.

---

## 6. Migration Failure Recovery Architecture

To prevent DDL locks or partial migrations from bringing down plantation operations:
1. **Transactional Migrations**: Every migration script must be wrapped in `BEGIN; ... COMMIT;`.
2. **Schema State Check**: Prior to applying any migration, verify schema state using `scripts/dr/verify_recovery.ts`.
3. **Rollback Script Pre-requisite**: Every forward migration `YYYYMMDD_feature.sql` must have a corresponding test-verified rollback script `YYYYMMDD_feature_rollback.sql`.

---

## 7. Observability & Telemetry Integration

All DR operations (backups, verifications, preflights, and drills) emit structured observability events:
- `dr_backup_started`
- `dr_backup_completed`
- `dr_backup_failed`
- `dr_restore_preflight_started`
- `dr_restore_preflight_failed`
- `dr_recovery_verification_started`
- `dr_recovery_verification_passed`
- `dr_recovery_verification_failed`

These events are routed through `api/observability/logger.ts` and `api/observability/metrics.ts` with complete failure isolation (errors in telemetry never disrupt or abort DR scripts).

---

## 8. Production Cutover Gate (Go/No-Go Criteria)

A recovered staging or standby instance can **ONLY** be cut over to production traffic when all of the following gates pass:

```
[GATE 1] Database Connectivity & Response Latency < 50ms ................. [PASS]
[GATE 2] 11 Core Plantation Domains Verified (Zero Missing Tables) ...... [PASS]
[GATE 3] Row Count Delta vs Pre-Disaster Snapshot < 0.1% ................ [PASS]
[GATE 4] Required Extensions (pgvector, uuid-ossp, pg_trgm) Active ...... [PASS]
[GATE 5] RAG Hybrid RPC (match_ipds_documents_hybrid) Operable .......... [PASS]
[GATE 6] Storage Object Count Matches DB Document Index ................. [PASS]
[GATE 7] Backend /api/health and /api/config-check Return HTTP 200 ...... [PASS]
[GATE 8] Authentication & RBAC Access Verification Succeeded ............ [PASS]
```
