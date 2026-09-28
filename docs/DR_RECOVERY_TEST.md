# IPDS VER 3.7 — DISASTER RECOVERY (DR) RECOVERY TEST PROTOCOL
## Verification & Drill Validation Guide

**Objective:** Validate that IPDS Ver. 3.7 disaster recovery mechanisms are functional, predictable, safe, and adhere to the strict Zero-Disruption and Production Protection rules.

---

## 1. Safety Rules for DR Drills

```
[SAFETY RULE 1] NEVER run destructive restore commands against production database.
[SAFETY RULE 2] Any drill requiring simulated restore MUST use a designated staging or local target.
[SAFETY RULE 3] Verification scripts must be strictly read-only or operate within isolated test schemas.
[SAFETY RULE 4] Do NOT disable RLS or rotate credentials on the production baseline.
```

---

## 2. DR Verification Matrix (11 Critical IPDS Domains)

The recovery verification engine (`scripts/dr/verify_recovery.ts`) rigorously inspects each domain:

| Domain No. | Critical IPDS Domain | Canonical Table(s) Tested | Fallback / Alias Handled | Integrity Check |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Estate Master & Settings** | `app_settings`, `presentation_decks` | - | Primary keys, JSON schema |
| **2** | **Block & Annual Targets** | `annual_yield`, `block_annual_yields` | - | Yield per hectare consistency |
| **3** | **Workers / Checkroll** | `workers` | `data_pekerja` (alias) | Active worker status |
| **4** | **Attendance & Work Log** | `attendance_records`, `work_assignments` | `rekod_kerja` | Foreign key to `workers` |
| **5** | **FFB / Weighbridge Yield** | `hantaran_hasil` | - | Tare/Gross/Net calculation |
| **6** | **Yield Analytics (ABW/BBC)** | `hasil_abw_history`, `hasil_bbc_history`, `hasil_backlog_history` | - | Monthly estate indexes |
| **7** | **Rainfall Records** | `hujan_rekod` (wide pivot) | `data_hujan` (normalised) | 12-month rainfall floats |
| **8** | **Fertilizer Program** | `fertilizer_daily_entries`, `fertilizer_master_schedule`, `fertilizer_inventory`, `fertilizer_inventory_transactions` | - | Bag count, ledger foreign keys |
| **9** | **Weeding & Pruning** | `merumput_progress`, `merumput_inventory`, `merumput_inventory_transactions`, `hantaran_pruning` | `merumput_daily_entries` | Round numbers, chemical stock |
| **10** | **Quality & Grading** | `penggredan_rekod` | - | Ripeness %, unripeness %, grading officer |
| **11** | **Enterprise RAG & Telemetry** | `the_oil_palm_knowledge`, `manual_sawit_knowledge`, `ipds_rag_documents`, `ipds_rag_pages`, `observability_metric_snapshots` | `kadar_upah_knowledge`, `manual_rumpai_knowledge` | HNSW vector dimension (768/1536), GIN text search |

---

## 3. Step-by-Step Drill Procedure

### Step 1: Pre-Drill Environmental Baseline Check
```bash
npm run dr:check
```
*Expected: Identifies environment, verifies credentials, confirms production lock is armed.*

### Step 2: Generate Timestamped Logical Backup
```bash
npm run dr:backup
```
*Expected: Creates `./backups/ipds_backup_YYYYMMDD_HHMMSS/` containing `manifest.json`, table dumps, and SHA-256 signatures.*

### Step 3: Validate Backup Integrity & Checksums
```bash
npm run dr:backup:verify
```
*Expected: Recalculates SHA-256 for all dumped files and matches against manifest. Confirms zero data tampering.*

### Step 4: Run Restore Preflight Against Staging Target
```bash
npm run dr:restore:preflight -- --target-env=staging
```
*Expected: Simulates recovery readiness, validates target connection, verifies production lockout prevents accidental overwrite.*

### Step 5: Execute Deep Recovery Verification
```bash
npm run dr:verify
```
*Expected: Audits all 11 domains, verifying connectivity, extensions (`pgvector`, `uuid-ossp`), table row accessibility, indexes, and RPC functions.*

---

## 4. Edge-Case & Adversarial Drill Tests

| Edge Case Test | Test Action | Expected Safe Result |
| :--- | :--- | :--- |
| **Accidental Production Restore** | Execute restore with `TARGET_ENV=production` | **BLOCKED & ABORTED** (`ProductionRestoreLockedError`). |
| **Corrupted Checksum** | Alter 1 byte in backup file and run verify | **REJECTED** (`SHA-256 Mismatch: backup invalidated`). |
| **Missing Table Alias** | Database contains `merumput_progress` instead of `merumput_daily_entries` | **RESOLVED** via canonical fallback resolver without breaking verification. |
| **Supabase Storage Outage** | Storage bucket unreachable | **ISOLATED WARNING** (does not fail database recovery validation). |
| **Telemetry DB Timeout** | Observability snapshot write fails during DR | **CAUGHT SAFELY** (DR script completes 100% without exception). |
