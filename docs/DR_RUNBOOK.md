# IPDS VER 3.7 — DISASTER RECOVERY (DR) RUNBOOK
## Operational Step-by-Step Incident & Recovery Guide

**System:** Integrated Plantation Data System (IPDS)  
**Target RTO:** $\le 60\text{ minutes}$ | **Target RPO:** $\le 5\text{ minutes}$  
**Classification:** Operational Runbook (Strictly Non-Destructive to Production by Default)  

---

## 1. Incident Command Structure & Roles

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INCIDENT RESPONSE TEAM                          │
├───────────────────┬────────────────────────────────────────────────────┤
│ ROLE              │ RESPONSIBILITIES                                   │
├───────────────────┼────────────────────────────────────────────────────┤
│ Incident Lead     │ Declares disaster, coordinates timeline,           │
│ (CTO / Head of IT)│ gives final Go/No-Go cutover authorization.        │
├───────────────────┼────────────────────────────────────────────────────┤
│ Database Recovery │ Executes PITR / snapshot restore, verifies DDL     │
│ Lead (DBA)        │ and data integrity, runs `dr:verify`.              │
├───────────────────┼────────────────────────────────────────────────────┤
│ Application Lead  │ Validates backend services, API health routes,     │
│ (Senior Engineer) │ frontend SPA loads, and estate session keys.       │
├───────────────────┼────────────────────────────────────────────────────┤
│ Operations Liaison│ Communicates with plantation managers & weighbridge│
│ (Estate Admin)    │ clerks regarding offline buffering / ETA.          │
└───────────────────┴────────────────────────────────────────────────────┘
```

---

## 2. Emergency Assessment & Disaster Declaration Workflow

```
[1. DETECT] Alert triggered (e.g. Health check fails > 5m or Data Corruption reported)
     │
[2. TRIAGE] Verify outage severity:
     ├─ Transient Network Glitch? ──> Wait 2 min / Auto-restart container
     └─ Confirmed Database/Host Loss or Corruption? ──> PROCEED TO STEP 3
     │
[3. DECLARE] Incident Lead officially declares DISASTER STATE (Start RTO clock)
     │
[4. FREEZE] Put primary application in read-only / maintenance mode if accessible
     │
[5. EXECUTE] Follow Section 3 (Database Recovery) & Section 4 (Storage Recovery)
```

---

## 3. Database Recovery Procedures

### Scenario A: Point-in-Time Recovery (PITR) via Supabase Console / CLI
*Use when accidental deletion or data corruption occurs at a known timestamp.*

1. **Identify Target Timestamp**: Determine exact timestamp $T_{\text{target}}$ prior to the incident (e.g., `2026-08-24T08:15:00Z`).
2. **Provision Recovery Target**:
   - Create a staging/recovery instance (`ipds-recovery-db`).
   - Do **NOT** restore directly over production.
3. **Execute PITR**:
   ```bash
   # Point Supabase CLI to target recovery project
   supabase db restore --project-ref <recovery-project-ref> --timestamp "2026-08-24 08:15:00+08"
   ```
4. **Run Recovery Verification**:
   ```bash
   SUPABASE_URL="https://<recovery-project>.supabase.co" \
   SUPABASE_SERVICE_ROLE_KEY="<recovery-service-key>" \
   npm run dr:verify
   ```

---

### Scenario B: Snapshot Restore from Verified Backup (`scripts/dr/`)
*Use when restoring from cold storage or testing recovery in development/staging.*

1. **Verify Backup Archive & Manifest**:
   ```bash
   npm run dr:backup:verify -- --backup-id=<BACKUP_ID>
   ```
2. **Run Restore Preflight (MANDATORY)**:
   ```bash
   # The preflight checks target environment, schema, and rejects production
   npm run dr:restore:preflight -- --target-env=staging --backup-id=<BACKUP_ID>
   ```
3. **Execute Non-Destructive Restore**:
   ```bash
   # Restore into staging/recovery instance only
   TARGET_ENV=staging \
   RESTORE_CONFIRM_NON_PRODUCTION=true \
   npm run dr:restore -- --backup-id=<BACKUP_ID>
   ```
4. **Execute Post-Restore Verification**:
   ```bash
   npm run dr:verify
   ```

---

## 4. Storage Recovery Procedure

If Supabase Storage buckets (`ipds-assets`, `ipds-rag-documents`, `ipds-exports`) are missing or corrupted:

1. **Verify Cloud Storage Target**:
   ```bash
   npm run dr:storage:verify -- --target-env=staging
   ```
2. **Re-sync RAG PDFs & Agronomy Manuals**:
   - Synchronize from the secondary encrypted cold-storage vault.
   - Verify file checksums against `ipds_rag_documents.hash`.
3. **Reconcile Asset Bucket**:
   - Verify estate header logos in `app_settings` correspond to valid storage URLs.

---

## 5. Application & Routing Cutover Gate

Once database and storage verifications show **ALL PASS**, perform cutover:

1. **Update Environment Configuration in Production Cloud Run / Vercel**:
   - Point `VITE_SUPABASE_URL` / `SUPABASE_URL` to the recovered database.
   - Update `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
2. **Restart Application Services**:
   ```bash
   curl -s -i https://<app-domain>/api/health
   curl -s -i https://<app-domain>/api/config-check
   ```
3. **Test Key Plantation Workflows**:
   - Weighbridge ticket lookup (`/api/hantaran`)
   - Worker checkroll list (`/api/pekerja` or `src/features/pekerja`)
   - Agro-AI RAG search (`/api/ai/ask`)
4. **Lift Maintenance Mode**: Announce system availability to estate stations.

---

## 6. Post-Recovery Review & Incident Retrospective

Within 24 hours of cutover:
1. Calculate actual **RPO** achieved ($\Delta T_{\text{last\_data}} - T_{\text{incident}}$).
2. Calculate actual **RTO** achieved ($T_{\text{cutover}} - T_{\text{declared}}$).
3. Document root cause analysis (RCA) and file tickets for preventive architecture hardening.
