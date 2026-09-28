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
  password_hash?: string;
  masked_pin?: string;
  email?: string;
  username?: string;
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
      if (parsed && typeof parsed === 'object') {
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
        if (parsed && typeof parsed === 'object') {
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
          return cachedCredentials!;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  cachedCredentials = {};
  return cachedCredentials;
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
