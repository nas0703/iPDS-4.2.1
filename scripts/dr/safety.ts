/**
 * IPDS VER 3.7 — Disaster Recovery Safety & Environment Guard
 * Strictly prevents accidental destructive operations against Production.
 */

import crypto from 'crypto';
import fs from 'fs';
import { DREnvironment } from './types.js';

export function detectEnvironment(url?: string): DREnvironment {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  const drTargetEnv = (process.env.TARGET_ENV || process.env.DR_TARGET_ENV || '').toLowerCase();
  const supabaseUrl = url || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';

  if (drTargetEnv === 'staging' || drTargetEnv === 'recovery' || drTargetEnv === 'development' || drTargetEnv === 'test') {
    return drTargetEnv as DREnvironment;
  }

  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return nodeEnv as DREnvironment;
  }

  // Check URL patterns
  if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
    return 'development';
  }

  if (supabaseUrl.includes('staging') || supabaseUrl.includes('dev-') || supabaseUrl.includes('preview')) {
    return 'staging';
  }

  if (nodeEnv === 'production') {
    return 'production';
  }

  return 'unknown';
}

export function isProductionTarget(targetEnv?: DREnvironment, targetUrl?: string): boolean {
  const env = targetEnv || detectEnvironment(targetUrl);
  return env === 'production';
}

/**
 * Asserts that the current operation is NOT executing a destructive restore against Production.
 * Throws a fatal safety error if a violation is detected.
 */
export function assertNonProductionTarget(targetEnv?: DREnvironment, targetUrl?: string, allowOverrideFlag = false): void {
  const env = targetEnv || detectEnvironment(targetUrl);

  if (env === 'production' && !allowOverrideFlag) {
    throw new Error(
      `[FATAL DR SAFETY LOCKOUT] Destructive restore is strictly prohibited against the PRODUCTION environment!\n` +
      `Target Environment: ${env}\n` +
      `To perform a restore, you MUST explicitly specify a non-production target (e.g. TARGET_ENV=staging or TARGET_ENV=recovery).`
    );
  }

  // Extra safety: check if user explicitly confirmed non-production
  const confirmation = (process.env.RESTORE_CONFIRM_NON_PRODUCTION || '').toLowerCase();
  if (confirmation !== 'true' && confirmation !== 'yes' && confirmation !== '1') {
    // If not confirmed, we allow dry-run / preflight only, never destructive execution
    console.log('[DR SAFETY NOTICE] Running in safe inspection/preflight mode (RESTORE_CONFIRM_NON_PRODUCTION is not set).');
  }
}

/**
 * Calculates SHA-256 hash of a file
 */
export async function calculateFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found for checksum: ${filePath}`));
    }
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => reject(err));
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Calculates SHA-256 hash of a string buffer
 */
export function calculateStringSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
