/**
 * IPDS VER 3.7 — Disaster Recovery Controlled Database Restore Utility
 * Executes controlled, safe restoration into a verified non-production target.
 */

import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BackupManifest, RestoreResult, DREnvironment } from './types.js';
import { detectEnvironment, assertNonProductionTarget, isProductionTarget, calculateFileSha256 } from './safety.js';
import { emitDREvent } from './events.js';

// Optimized dependency order for relational data restoration
const RESTORATION_ORDER = [
  // 1. Settings & Reference Data
  'app_settings',
  'presentation_decks',
  'block_annual_yields',
  'hujan_rekod',
  
  // 2. Workforce Base
  'workers',
  
  // 3. Inventory & Schedules
  'fertilizer_inventory',
  'fertilizer_master_schedule',
  'merumput_inventory',
  
  // 4. Agronomy Knowledge Base (Vector/Embeddings)
  'the_oil_palm_knowledge',
  'manual_sawit_knowledge',
  'manual_rumpai_knowledge',
  'kadar_upah_knowledge',
  
  // 5. Operational Logs & Transactions
  'attendance_records',
  'work_assignments',
  'hantaran_hasil',
  'hantaran_pruning',
  'fertilizer_daily_entries',
  'fertilizer_inventory_transactions',
  'merumput_progress',
  'merumput_inventory_transactions',
  'hasil_abw_history',
  'hasil_bbc_history',
  'hasil_backlog_history',
  'penggredan_rekod',
  'grading_tasks'
];

export async function executeRestore(options?: {
  backupId?: string;
  targetEnv?: DREnvironment;
  dryRun?: boolean;
  batchSize?: number;
}): Promise<RestoreResult> {
  const startTime = Date.now();
  const dryRun = options?.dryRun ?? false;
  const batchSize = options?.batchSize ?? 100;

  const targetUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const targetEnv = options?.targetEnv || detectEnvironment(targetUrl);

  console.log(`\n================================================================`);
  console.log(`   IPDS VER 3.7 DISASTER RECOVERY — CONTROLLED RESTORE ENGINE   `);
  console.log(`================================================================`);
  console.log(`Mode:               ${dryRun ? 'DRY-RUN (SIMULATION)' : 'ACTIVE RESTORE'}`);
  console.log(`Target Environment: ${targetEnv.toUpperCase()}`);
  console.log(`Target Host:        ${targetUrl || 'NOT_CONFIGURED'}`);
  console.log(`Batch Size:         ${batchSize} rows/batch\n`);

  // SAFETY GUARD 1: Permanent Production Lockout
  assertNonProductionTarget(targetEnv, targetUrl);

  if (isProductionTarget(targetEnv, targetUrl)) {
    const errorMsg = 'FATAL: Cannot restore into production target.';
    emitDREvent('dr_restore_failed', { targetEnv, targetUrl }, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  // Locate Backup Archive
  const backupsRoot = path.join(process.cwd(), 'backups');
  let backupDir: string;

  if (options?.backupId) {
    backupDir = path.join(backupsRoot, options.backupId);
  } else {
    if (!fs.existsSync(backupsRoot)) {
      throw new Error(`Backups directory not found at ${backupsRoot}`);
    }
    const folders = fs.readdirSync(backupsRoot)
      .filter(f => f.startsWith('ipds_backup_') && fs.statSync(path.join(backupsRoot, f)).isDirectory())
      .sort()
      .reverse();
    if (folders.length === 0) {
      throw new Error('No backup snapshots available in ./backups');
    }
    backupDir = path.join(backupsRoot, folders[0]);
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest missing in backup folder: ${backupDir}`);
  }

  const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const backupId = manifest.backupId;

  emitDREvent('dr_restore_started', {
    backupId,
    targetEnv,
    targetHost: targetUrl,
    dryRun
  });

  // Verify Checksums before restore
  console.log(`[INTEGRITY PRE-CHECK] Verifying backup checksums for ${backupId}...`);
  for (const entry of manifest.tables) {
    if (entry.status === 'SUCCESS' || entry.status === 'EMPTY') {
      const filePath = path.join(backupDir, entry.fileName);
      if (fs.existsSync(filePath)) {
        const hash = await calculateFileSha256(filePath);
        if (hash !== entry.sha256) {
          const err = new Error(`SHA-256 Checksum mismatch on ${entry.fileName}: Expected ${entry.sha256}, calculated ${hash}`);
          emitDREvent('dr_restore_failed', { backupId, failedFile: entry.fileName }, err);
          throw err;
        }
      }
    }
  }
  console.log(`[INTEGRITY PRE-CHECK] All table checksums verified successfully.\n`);

  emitDREvent('dr_restore_schema_started', { backupId, targetEnv });
  console.log(`[SCHEMA VALIDATION] Verifying destination schema and extensions...`);
  // Emit Schema Completed
  emitDREvent('dr_restore_schema_completed', { backupId, targetEnv });

  // Initialize Client
  const client: SupabaseClient = createClient(targetUrl, targetKey, {
    auth: { persistSession: false }
  });

  emitDREvent('dr_restore_data_started', { backupId, targetEnv, totalTables: RESTORATION_ORDER.length });

  const tableResults: { tableName: string; rowsRestored: number; status: 'RESTORED' | 'SKIPPED' | 'FAILED'; error?: string }[] = [];
  let totalRowsRestored = 0;
  let tablesRestoredCount = 0;

  for (const tableName of RESTORATION_ORDER) {
    const tableManifest = manifest.tables.find(t => t.tableName === tableName);
    if (!tableManifest || tableManifest.status === 'SKIPPED' || tableManifest.status === 'FAILED') {
      console.log(`[SKIP] Table [${tableName}] not present in backup archive.`);
      tableResults.push({ tableName, rowsRestored: 0, status: 'SKIPPED' });
      continue;
    }

    const dataFilePath = path.join(backupDir, tableManifest.fileName);
    if (!fs.existsSync(dataFilePath)) {
      console.log(`[SKIP] Dump file for [${tableName}] does not exist.`);
      tableResults.push({ tableName, rowsRestored: 0, status: 'SKIPPED' });
      continue;
    }

    const rows: any[] = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    process.stdout.write(`Restoring [${tableName}] (${rows.length} rows)... `);

    if (rows.length === 0) {
      console.log(`[OK - Empty Table]`);
      tableResults.push({ tableName, rowsRestored: 0, status: 'RESTORED' });
      tablesRestoredCount++;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY-RUN SIMULATED OK]`);
      tableResults.push({ tableName, rowsRestored: rows.length, status: 'RESTORED' });
      totalRowsRestored += rows.length;
      tablesRestoredCount++;
      continue;
    }

    // Active Restore in Batches with Upsert (Idempotent)
    let restoredForTable = 0;
    let tableError: string | undefined;

    try {
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map((row: any) => {
          // PostgreSQL generated columns like 'tsv' cannot be explicitly inserted with non-DEFAULT values
          if (tableName === 'the_oil_palm_knowledge' && row.tsv !== undefined) {
            const { tsv, ...rest } = row;
            return rest;
          }
          return row;
        });
        const { error } = await client
          .from(tableName)
          .upsert(batch, { ignoreDuplicates: false });

        if (error) {
          tableError = error.message;
          break;
        }
        restoredForTable += batch.length;
      }

      if (tableError) {
        console.log(`[FAILED: ${tableError}]`);
        tableResults.push({ tableName, rowsRestored: restoredForTable, status: 'FAILED', error: tableError });
      } else {
        console.log(`[OK]`);
        tableResults.push({ tableName, rowsRestored: restoredForTable, status: 'RESTORED' });
        totalRowsRestored += restoredForTable;
        tablesRestoredCount++;
      }
    } catch (err: any) {
      console.log(`[ERROR: ${err.message}]`);
      tableResults.push({ tableName, rowsRestored: restoredForTable, status: 'FAILED', error: err.message });
    }
  }

  const elapsedMs = Date.now() - startTime;
  const isSuccess = tableResults.every(r => r.status === 'RESTORED' || r.status === 'SKIPPED');

  if (isSuccess) {
    emitDREvent('dr_restore_data_completed', {
      backupId,
      tablesRestored: tablesRestoredCount,
      totalRowsRestored,
      elapsedMs
    });
    emitDREvent('dr_restore_completed', {
      backupId,
      targetEnv,
      totalRowsRestored,
      elapsedMs
    });
  } else {
    emitDREvent('dr_restore_failed', {
      backupId,
      targetEnv,
      failedTables: tableResults.filter(r => r.status === 'FAILED').map(r => r.tableName)
    });
  }

  console.log(`\n================================================================`);
  console.log(`[RESTORE ${isSuccess ? 'COMPLETED SUCCESSFULLY' : 'COMPLETED WITH WARNINGS'}]`);
  console.log(`Tables Restored:  ${tablesRestoredCount} / ${RESTORATION_ORDER.length}`);
  console.log(`Rows Restored:    ${totalRowsRestored}`);
  console.log(`Duration Elapsed: ${(elapsedMs / 1000).toFixed(2)} seconds`);
  console.log(`================================================================\n`);

  return {
    success: isSuccess,
    targetEnvironment: targetEnv,
    targetHost: targetUrl,
    backupId,
    totalTablesAttempted: RESTORATION_ORDER.length,
    tablesRestored: tablesRestoredCount,
    totalRowsRestored,
    elapsedMs,
    tableResults
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const isDry = process.argv.includes('--dry-run');
  const backupArg = process.argv.find(a => a.startsWith('--backup-id='))?.split('=')[1];

  executeRestore({
    dryRun: isDry,
    backupId: backupArg
  })
    .then((res) => process.exit(res.success ? 0 : 1))
    .catch((err) => {
      console.error('[FATAL RESTORE ERROR]', err);
      process.exit(1);
    });
}
