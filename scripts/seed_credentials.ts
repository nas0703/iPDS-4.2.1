/**
 * Setup-time credential seed script.
 * Generates setup-time bcrypt hashes for authoritative credentials and writes them
 * to .env.credentials / .env (which are excluded from git by .gitignore).
 *
 * Plaintext credential definitions are externalized from source code and read from
 * IPDS_SEED_CREDENTIALS_INPUT_JSON or a gitignored input file (.env.credentials.input.json).
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface SeedUserInput {
  pin: string;
  password?: string;
  app_role: string;
  operator_id: string;
  operator_name: string;
  kiosk_id: string;
  estate_id: string;
  station_name: string;
  email?: string;
  username?: string;
}

export function loadSeedUserInputs(): SeedUserInput[] {
  // 1. Environment variable IPDS_SEED_CREDENTIALS_INPUT_JSON
  const envJson = process.env.IPDS_SEED_CREDENTIALS_INPUT_JSON;
  if (envJson && envJson.trim()) {
    try {
      const parsed = JSON.parse(envJson.trim());
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn('[SEED_CREDENTIALS] Failed to parse IPDS_SEED_CREDENTIALS_INPUT_JSON:', e);
    }
  }

  // 2. Gitignored input file (.env.credentials.input.json or custom path)
  const filePath = process.env.IPDS_SEED_CREDENTIALS_FILE || path.join(process.cwd(), '.env.credentials.input.json');
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn(`[SEED_CREDENTIALS] Failed to parse input credentials file ${filePath}:`, e);
    }
  }

  return [];
}

export function buildHashedCredentials(seedUsers?: SeedUserInput[]): Record<string, any> {
  const users = seedUsers || loadSeedUserInputs();
  const result: Record<string, any> = {};

  for (const user of users) {
    if (!user.pin || !user.operator_id) continue;
    const pinHash = bcrypt.hashSync(user.pin, 10);
    const passwordHash = user.password ? bcrypt.hashSync(user.password, 10) : undefined;
    const cleanPin = String(user.pin).trim();
    const maskedPin = `****${cleanPin.slice(-2)}`;

    // Keyed by operator_id (never by plaintext PIN)
    result[user.operator_id] = {
      app_role: user.app_role,
      operator_id: user.operator_id,
      operator_name: user.operator_name,
      kiosk_id: user.kiosk_id,
      estate_id: user.estate_id,
      station_name: user.station_name,
      pin_hash: pinHash,
      password_hash: passwordHash,
      masked_pin: maskedPin,
      email: user.email,
      username: user.username
    };
  }

  return result;
}

export function writeCredentialsToEnvFile(): void {
  const inputs = loadSeedUserInputs();
  if (!inputs || inputs.length === 0) {
    console.log(
      '[SEED_CREDENTIALS] No input credentials found.\n' +
      'To generate hashes, supply IPDS_SEED_CREDENTIALS_INPUT_JSON in environment or create .env.credentials.input.json.\n' +
      'See .env.example for schema format.'
    );
    return;
  }

  const credentials = buildHashedCredentials(inputs);
  const jsonStr = JSON.stringify(credentials);
  const line = `IPDS_CREDENTIALS_JSON='${jsonStr}'\n`;

  const credPath = path.join(process.cwd(), '.env.credentials');
  fs.writeFileSync(credPath, line, 'utf-8');
  console.log(`[SEED_CREDENTIALS] Successfully generated setup-time hashed credentials in ${credPath} keyed by operator_id`);

  // Also append or update .env if present
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf-8');
    if (content.includes('IPDS_CREDENTIALS_JSON=')) {
      content = content.replace(/IPDS_CREDENTIALS_JSON=.*(\r?\n|$)/, line);
    } else {
      content += `\n${line}`;
    }
    fs.writeFileSync(envPath, content, 'utf-8');
    console.log(`[SEED_CREDENTIALS] Synced IPDS_CREDENTIALS_JSON to ${envPath}`);
  } else {
    fs.writeFileSync(envPath, line, 'utf-8');
    console.log(`[SEED_CREDENTIALS] Created ${envPath} with IPDS_CREDENTIALS_JSON`);
  }
}

if (process.argv[1]?.endsWith('seed_credentials.ts') || process.argv[1]?.endsWith('seed_credentials.js')) {
  writeCredentialsToEnvFile();
}
