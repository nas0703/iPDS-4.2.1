/**
 * IPDS VER 3.7 — Disaster Recovery Logical Backup Utility
 * Generates timestamped, checksum-signed JSON & schema exports for all IPDS domains.
 */

import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BackupManifest, BackupTableEntry } from './types.js';
import { detectEnvironment, calculateFileSha256, calculateStringSha256 } from './safety.js';
import { emitDREvent } from './events.js';

// Canonical and alias table registry for IPDS Ver. 3.7
export const IPDS_TABLE_REGISTRY = [
  'hantaran_hasil',
  'hantaran_pruning',
  'fertilizer_daily_entries',
  'fertilizer_master_schedule',
  'fertilizer_inventory',
  'fertilizer_inventory_transactions',
  'merumput_progress',
  'merumput_inventory',
  'merumput_inventory_transactions',
  'hujan_rekod',
  'workers',
  'attendance_records',
  'work_assignments',
  'hasil_abw_history',
  'hasil_bbc_history',
  'hasil_backlog_history',
  'annual_yield',
  'block_annual_yields',
  'penggredan_rekod',
  'grading_tasks',
  'app_settings',
  'presentation_decks',
  'the_oil_palm_knowledge',
  'manual_sawit_knowledge',
  'manual_rumpai_knowledge',
  'kadar_upah_knowledge',
  'ipds_rag_documents',
  'ipds_rag_pages',
  'ipds_rag_ingestion_log',
  'observability_metric_snapshots'
];

export async function createLogicalBackup(customOutputDir?: string): Promise<{ success: boolean; backupId: string; manifestPath: string }> {
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backupId = `ipds_backup_${dateStr}`;
  const baseDir = customOutputDir || path.join(process.cwd(), 'backups', backupId);

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    const errorMsg = 'Missing Supabase credentials (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY).';
    emitDREvent('backup_failed', { backupId }, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  const env = detectEnvironment(supabaseUrl);
  emitDREvent('backup_started', { backupId, environment: env, totalTables: IPDS_TABLE_REGISTRY.length });

  console.log(`\n================================================================`);
  console.log(`   IPDS VER 3.7 DISASTER RECOVERY — LOGICAL BACKUP GENERATOR   `);
  console.log(`================================================================`);
  console.log(`Backup ID:      ${backupId}`);
  console.log(`Target Dir:     ${baseDir}`);
  console.log(`Source Env:     ${env}`);
  console.log(`Source Host:    ${supabaseUrl}`);
  console.log(`Registry Count: ${IPDS_TABLE_REGISTRY.length} tables\n`);

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const client: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const tableEntries: BackupTableEntry[] = [];
  let totalRows = 0;
  let totalSizeBytes = 0;

  for (const tableName of IPDS_TABLE_REGISTRY) {
    process.stdout.write(`Exporting table [${tableName}]... `);
    const dumpFileName = `${tableName}.json`;
    const dumpFilePath = path.join(baseDir, dumpFileName);

    try {
      // Query table safely
      const { data, error } = await client
        .from(tableName)
        .select('*')
        .limit(10000); // Bounded chunk limit per table

      if (error) {
        // Check if table missing (could be an alias)
        const isMissing = error.code === '42P01' || error.message?.includes('does not exist');
        console.log(isMissing ? `[SKIPPED - Table not created yet]` : `[FAILED: ${error.message}]`);
        
        tableEntries.push({
          tableName,
          rowCount: 0,
          fileName: dumpFileName,
          sha256: '',
          sizeBytes: 0,
          status: isMissing ? 'SKIPPED' : 'FAILED',
          errorMessage: error.message
        });
        continue;
      }

      const rows = data || [];
      const rowCount = rows.length;
      const jsonContent = JSON.stringify(rows, null, 2);
      fs.writeFileSync(dumpFilePath, jsonContent, 'utf8');

      const sizeBytes = Buffer.byteLength(jsonContent, 'utf8');
      const sha256 = await calculateFileSha256(dumpFilePath);

      totalRows += rowCount;
      totalSizeBytes += sizeBytes;

      tableEntries.push({
        tableName,
        rowCount,
        fileName: dumpFileName,
        sha256,
        sizeBytes,
        status: rowCount > 0 ? 'SUCCESS' : 'EMPTY'
      });

      console.log(`[OK] (${rowCount} rows, ${(sizeBytes / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      console.log(`[ERROR: ${err.message}]`);
      tableEntries.push({
        tableName,
        rowCount: 0,
        fileName: dumpFileName,
        sha256: '',
        sizeBytes: 0,
        status: 'FAILED',
        errorMessage: err.message
      });
    }
  }

  // Construct Manifest
  const manifestData: Omit<BackupManifest, 'sha256Checksum'> = {
    backupId,
    version: 'IPDS-VER-3.7-DR-STAGE-1',
    createdAt: timestamp.toISOString(),
    sourceEnvironment: env,
    sourceHost: supabaseUrl,
    totalTables: tableEntries.filter(t => t.status === 'SUCCESS' || t.status === 'EMPTY').length,
    totalRows,
    totalSizeBytes,
    tables: tableEntries
  };

  const manifestJsonUnsigned = JSON.stringify(manifestData, null, 2);
  const manifestChecksum = calculateStringSha256(manifestJsonUnsigned);

  const finalManifest: BackupManifest = {
    ...manifestData,
    sha256Checksum: manifestChecksum
  };

  const manifestPath = path.join(baseDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2), 'utf8');

  console.log(`\n================================================================`);
  console.log(`[BACKUP COMPLETE] Total Rows: ${totalRows} | Total Size: ${(totalSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`Manifest Path:    ${manifestPath}`);
  console.log(`Manifest SHA-256: ${manifestChecksum}`);
  console.log(`================================================================\n`);

  emitDREvent('backup_completed', {
    backupId,
    totalRows,
    totalSizeBytes,
    manifestChecksum
  });

  return {
    success: true,
    backupId,
    manifestPath
  };
}

// Direct CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  createLogicalBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL BACKUP ERROR]', err);
      process.exit(1);
    });
}
