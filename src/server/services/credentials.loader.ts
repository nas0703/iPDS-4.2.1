/**
 * Credential Seed Loader & Cryptographic Hash Verifier
 * Loads setup-time bcrypt-hashed credentials from environment variables / .env.credentials.
 * Excludes plaintext secrets from source code.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import type { AuthRole } from './identity.service.js';
import { getPrivilegedSupabase } from '../db.js';

// Auto-load .env and .env.credentials
dotenv.config();
const envCredPath = path.join(process.cwd(), '.env.credentials');
if (fs.existsSync(envCredPath)) {
  dotenv.config({ path: envCredPath });
}

let __dirnameCurrent = '';
try {
  __dirnameCurrent = path.dirname(fileURLToPath(import.meta.url));
} catch {
  __dirnameCurrent = process.cwd();
}

export interface UserCredentialConfig {
  app_role: AuthRole;
  operator_id: string;
  operator_name: string;
  kiosk_id: string;
  estate_id: string;
  station_name: string;
  pin_hash?: string;
  staff_no_hash?: string;
  password_hash?: string;
  masked_pin?: string;
  email?: string;
  username?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

let cachedCredentials: Record<string, UserCredentialConfig> | null = null;

export function clearCredentialsCache(): void {
  cachedCredentials = null;
}

function normalizeToOperatorIdKeys(records: Record<string, UserCredentialConfig>): Record<string, UserCredentialConfig> {
  const result: Record<string, UserCredentialConfig> = {};
  for (const [key, val] of Object.entries(records)) {
    if (!val || typeof val !== 'object') continue;
    const opId = val.operator_id || key;
    result[opId] = {
      ...val,
      operator_id: opId
    };
  }
  return result;
}

export function loadHashedCredentials(): Record<string, UserCredentialConfig> {
  if (cachedCredentials && Object.keys(cachedCredentials).length > 0) {
    return cachedCredentials;
  }

  // 1. Try reading from environment variable IPDS_CREDENTIALS_JSON
  const rawJson = process.env.IPDS_CREDENTIALS_JSON;
  if (rawJson && rawJson.trim()) {
    try {
      const parsed = JSON.parse(rawJson.trim());
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        cachedCredentials = normalizeToOperatorIdKeys(parsed);
        return cachedCredentials!;
      }
    } catch (err) {
      console.warn('[CREDENTIAL_LOADER] Error parsing IPDS_CREDENTIALS_JSON:', err);
    }
  }

  // 2. Try reading directly from .env.credentials file if present
  try {
    const credPath = path.join(process.cwd(), '.env.credentials');
    if (fs.existsSync(credPath)) {
      const content = fs.readFileSync(credPath, 'utf-8');
      const match = content.match(/IPDS_CREDENTIALS_JSON='(.*)'/s) || content.match(/IPDS_CREDENTIALS_JSON="(.*)"/s);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          cachedCredentials = normalizeToOperatorIdKeys(parsed);
          return cachedCredentials!;
        }
      }
    }
  } catch (err) {
    console.warn('[CREDENTIAL_LOADER] Error reading .env.credentials:', err);
  }

  // 3. Fallback to bundled safe hashed credentials store (zero plaintext secrets, safe for CI)
  const candidateJsonPaths = [
    path.join(process.cwd(), 'src/server/config/credentials.hashes.json'),
    path.join(__dirnameCurrent, '../config/credentials.hashes.json'),
    path.join(process.cwd(), 'dist/server/config/credentials.hashes.json')
  ];

  for (const candidatePath of candidateJsonPaths) {
    try {
      if (fs.existsSync(candidatePath)) {
        const content = fs.readFileSync(candidatePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          cachedCredentials = normalizeToOperatorIdKeys(parsed);
          break;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  if (!cachedCredentials) {
    cachedCredentials = {};
  }

  // Merge any local / environment kiosk roster profiles so staff_no_hash is always guaranteed
  const candidateRosterPaths = [
    path.join(process.cwd(), '.env.kiosk-roster.local.json'),
    path.join(process.cwd(), 'data/kiosk-roster.json'),
    path.join(process.cwd(), 'src/server/config/kiosk-roster.json')
  ];
  for (const rosterPath of candidateRosterPaths) {
    try {
      if (fs.existsSync(rosterPath)) {
        const rosterContent = fs.readFileSync(rosterPath, 'utf-8');
        const parsed = JSON.parse(rosterContent);
        const rosterList = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.identities) ? parsed.identities : []);
        if (Array.isArray(rosterList)) {
          for (const item of rosterList) {
            if (item && item.operator_id && item.staff_no) {
              const opId = item.operator_id;
              const normalizedStaffNo = normalizeStaffNo(item.staff_no);
              const staffHash = hashStaffNo(normalizedStaffNo);
              cachedCredentials[opId] = {
                ...cachedCredentials[opId],
                app_role: item.app_role || 'staff',
                operator_id: opId,
                operator_name: item.operator_name || opId,
                kiosk_id: item.kiosk_id || `kiosk-${opId.toLowerCase()}`,
                estate_id: item.estate_id || 'FPM_TUNGGAL',
                station_name: item.station_name || `Stesen Lapangan ${item.estate_id || 'Tunggal'}`,
                staff_no_hash: staffHash,
                email: item.email || `${opId.toLowerCase()}@felda.gov.my`,
                username: item.username || opId.toLowerCase()
              };
            }
          }
        }
      }
    } catch {
      // Continue
    }
  }

  return cachedCredentials;
}

let lastSupabaseKioskSync = 0;
const KIOSK_SYNC_INTERVAL_MS = 5 * 1000; // 5s cache interval for quick deactivation response

/**
 * Synchronize authoritative kiosk staff identities (with bcrypt staff_no_hash)
 * dynamically from Supabase database (public.kiosk_identities).
 *
 * Resilient fail-safe pattern:
 * - 2500ms timeout race to prevent blocking authentication if database is slow.
 * - Non-destructive fallback: If database is unreachable or table empty, local
 *   credentials from IPDS_CREDENTIALS_JSON / credentials.hashes.json remain active.
 */
export async function syncKioskIdentitiesFromSupabase(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastSupabaseKioskSync < KIOSK_SYNC_INTERVAL_MS) {
    return 0;
  }
  try {
    const supabase = getPrivilegedSupabase();
    if (!supabase) return 0;

    const fetchPromise = supabase
      .from('kiosk_identities')
      .select('operator_id, staff_no_hash, app_role, estate_id, kiosk_id, station_name, operator_name, is_active');

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 2500)
    );

    const result = (await Promise.race([fetchPromise, timeoutPromise])) as any;
    const records = result?.data;
    const error = result?.error;

    if (!error && Array.isArray(records)) {
      if (!cachedCredentials) {
        loadHashedCredentials();
      }
      for (const row of records) {
        if (row && row.operator_id && row.staff_no_hash) {
          const opId = row.operator_id.trim();
          cachedCredentials![opId] = {
            ...cachedCredentials![opId],
            app_role: (row.app_role || 'staff') as AuthRole,
            operator_id: opId,
            operator_name: row.operator_name || opId,
            kiosk_id: row.kiosk_id || `kiosk-${opId.toLowerCase()}`,
            estate_id: row.estate_id || 'FPM_TUNGGAL',
            station_name: row.station_name || `Stesen Lapangan ${row.estate_id || 'Tunggal'}`,
            staff_no_hash: row.staff_no_hash,
            is_active: row.is_active !== false,
            masked_pin: '******',
            email: `${opId.toLowerCase()}@felda.gov.my`,
            username: opId.toLowerCase()
          };
        }
      }
      lastSupabaseKioskSync = now;
      if (records.length > 0) {
        console.log(`[KIOSK_SYNC] Synced ${records.length} kiosk identities from Supabase kiosk_identities.`);
        try {
          const { refreshMasterIdentityRegistry } = await import('./identity.service.js');
          refreshMasterIdentityRegistry();
        } catch (_) {}
      }
      return records.length;
    } else {
      lastSupabaseKioskSync = now;
      if (error && error.message !== 'timeout') {
        console.info(`[KIOSK_SYNC] Local credentials active (Supabase sync skipped: ${error.message || 'not configured'}).`);
      }
      return 0;
    }
  } catch (err: any) {
    lastSupabaseKioskSync = now;
    console.info(`[KIOSK_SYNC] Local credentials active (Supabase sync unavailable: ${err?.message || 'fallback mode'}).`);
    return 0;
  }
}

/**
 * Compare input PIN against bcrypt hash in constant time
 */
export function verifyPinAgainstHash(inputPin: string, pinHash?: string | null): boolean {
  if (!inputPin || !pinHash || typeof inputPin !== 'string' || typeof pinHash !== 'string') {
    return false;
  }
  const clean = inputPin.trim().replace(/\s+/g, '');
  if (!clean || !pinHash.startsWith('$2')) {
    return false;
  }
  try {
    return bcrypt.compareSync(clean, pinHash);
  } catch {
    return false;
  }
}

/**
 * Compare input password against bcrypt hash in constant time
 */
export function verifyPasswordAgainstHash(inputPassword: string, passwordHash?: string | null): boolean {
  if (!inputPassword || !passwordHash || typeof inputPassword !== 'string' || typeof passwordHash !== 'string') {
    return false;
  }
  const clean = inputPassword.trim();
  if (!clean || !passwordHash.startsWith('$2')) {
    return false;
  }
  try {
    return bcrypt.compareSync(clean, passwordHash);
  } catch {
    return false;
  }
}

export function normalizeStaffNo(staffNo: string): string {
  return staffNo.trim().toUpperCase();
}

export function hashStaffNo(staffNo: string): string {
  const normalized = normalizeStaffNo(staffNo);
  if (!normalized || Buffer.byteLength(normalized, 'utf8') > 72) {
    throw new Error('Staff number is empty or exceeds the bcrypt input limit.');
  }
  return bcrypt.hashSync(normalized, 10);
}

export function verifyStaffNoAgainstHash(staffNo: string, staffNoHash?: string | null): boolean {
  if (!staffNo || !staffNoHash || typeof staffNoHash !== 'string' || !staffNoHash.startsWith('$2')) {
    return false;
  }
  try {
    const normalized = normalizeStaffNo(staffNo);
    if (!normalized || Buffer.byteLength(normalized, 'utf8') > 72) return false;
    return bcrypt.compareSync(normalized, staffNoHash);
  } catch {
    return false;
  }
}
