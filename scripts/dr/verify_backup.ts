/**
 * IPDS VER 3.7 — Disaster Recovery Backup Verification Utility
 * Re-computes SHA-256 checksums of backup archives and validates manifest integrity.
 */

import fs from 'fs';
import path from 'path';
import { BackupManifest } from './types.js';
import { calculateFileSha256, calculateStringSha256 } from './safety.js';

export async function verifyBackupIntegrity(customBackupDir?: string): Promise<{ valid: boolean; backupId: string; issues: string[] }> {
  let targetDir = customBackupDir;

  // If no custom directory provided, find most recent in ./backups
  if (!targetDir) {
    const backupsRoot = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsRoot)) {
      throw new Error(`No backups directory found at ${backupsRoot}. Please run 'npm run dr:backup' first.`);
    }

    const backupFolders = fs.readdirSync(backupsRoot)
      .filter(f => f.startsWith('ipds_backup_') && fs.statSync(path.join(backupsRoot, f)).isDirectory())
      .sort()
      .reverse();

    if (backupFolders.length === 0) {
      throw new Error(`No backup snapshots found in ${backupsRoot}.`);
    }

    targetDir = path.join(backupsRoot, backupFolders[0]);
  }

  console.log(`\n================================================================`);
  console.log(`   IPDS VER 3.7 DISASTER RECOVERY — BACKUP INTEGRITY VERIFIER   `);
  console.log(`================================================================`);
  console.log(`Inspecting Backup Directory: ${targetDir}`);

  const manifestPath = path.join(targetDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Corrupted backup archive: Missing manifest.json in ${targetDir}`);
  }

  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const manifest: BackupManifest = JSON.parse(manifestRaw);
  const issues: string[] = [];

  console.log(`Backup ID:          ${manifest.backupId}`);
  console.log(`Created At:         ${manifest.createdAt}`);
  console.log(`Source Environment: ${manifest.sourceEnvironment}`);
  console.log(`Recorded Tables:    ${manifest.tables.length}`);
  console.log(`Recorded Total Rows: ${manifest.totalRows}\n`);

  // Verify each table file
  let validFilesCount = 0;
  for (const entry of manifest.tables) {
    if (entry.status === 'SKIPPED' || entry.status === 'FAILED') {
      continue;
    }

    const tableFilePath = path.join(targetDir, entry.fileName);
    if (!fs.existsSync(tableFilePath)) {
      const issue = `Missing table dump file: ${entry.fileName}`;
      issues.push(issue);
      console.log(`[FAIL] ${entry.tableName}: File missing!`);
      continue;
    }

    // Verify SHA-256
    const computedSha256 = await calculateFileSha256(tableFilePath);
    if (computedSha256 !== entry.sha256) {
      const issue = `Checksum mismatch for ${entry.tableName}: expected ${entry.sha256}, got ${computedSha256}`;
      issues.push(issue);
      console.log(`[FAIL] ${entry.tableName}: Checksum MISMATCH!`);
    } else {
      validFilesCount++;
      console.log(`[PASS] ${entry.tableName}: SHA-256 Verified (${entry.rowCount} rows)`);
    }
  }

  const isValid = issues.length === 0;

  console.log(`\n================================================================`);
  console.log(`VERIFICATION SUMMARY: ${isValid ? 'PASSED (100% VALID)' : 'FAILED (ISSUES DETECTED)'}`);
  console.log(`Verified Files: ${validFilesCount} / ${manifest.tables.filter(t => t.status === 'SUCCESS' || t.status === 'EMPTY').length}`);
  if (issues.length > 0) {
    console.log(`Issues Found:\n - ${issues.join('\n - ')}`);
  }
  console.log(`================================================================\n`);

  return {
    valid: isValid,
    backupId: manifest.backupId,
    issues
  };
}

// Direct CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const argDir = process.argv[2];
  verifyBackupIntegrity(argDir)
    .then((res) => {
      if (!res.valid) process.exit(1);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[FATAL VERIFICATION ERROR]', err);
      process.exit(1);
    });
}
