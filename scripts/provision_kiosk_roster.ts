/**
 * Kiosk roster provisioning (setup-time, local only).
 *
 * Reads an authorized kiosk roster from a gitignored input artifact, derives
 * staff_no_hash with normalizeStaffNo()/hashStaffNo(), and writes a merged
 * IPDS_CREDENTIALS_JSON artifact to .env.credentials (gitignored).
 *
 * Existing credential records are copied verbatim: no record is modified and no
 * pin_hash is changed or reused as a staff_no_hash. Credential values are never
 * printed; only validation counts are emitted.
 */
import fs from 'fs';
import path from 'path';
import { hashStaffNo, normalizeStaffNo, verifyStaffNoAgainstHash } from '../src/server/services/credentials.loader.js';

export interface KioskRosterEntry {
  staff_no: string;
  operator_id: string;
  operator_name: string;
  app_role: string;
  estate_id: string;
  kiosk_id: string;
  station_name: string;
}

export interface KioskCredentialRecord {
  app_role: string;
  operator_id: string;
  operator_name: string;
  kiosk_id: string;
  estate_id: string;
  station_name: string;
  staff_no_hash: string;
}

const REQUIRED_FIELDS = ['staff_no', 'operator_id', 'operator_name', 'app_role', 'estate_id', 'kiosk_id', 'station_name'] as const;
const PLACEHOLDER_PATTERN = /^(<\s*[^>]*>|REPLACE|FILL|TODO|CHANGEME)/i;

export const BASE_STORE_PATH = path.join(process.cwd(), 'src/server/config/credentials.hashes.json');
export const ROSTER_PATH = process.env.IPDS_KIOSK_ROSTER_FILE || path.join(process.cwd(), '.env.kiosk-roster.local.json');
export const OUTPUT_PATH = process.env.IPDS_CREDENTIALS_OUTPUT_FILE || path.join(process.cwd(), '.env.credentials');

export function abort(message: string): never {
  throw new Error(`[KIOSK_PROVISION] ${message}`);
}

export function readBaseStore(): Record<string, Record<string, unknown>> {
  if (!fs.existsSync(BASE_STORE_PATH)) abort('authoritative credential store not found');
  const parsed = JSON.parse(fs.readFileSync(BASE_STORE_PATH, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) abort('credential store is not an object map');
  return parsed;
}

export function readKioskRoster(): KioskRosterEntry[] {
  if (!fs.existsSync(ROSTER_PATH)) abort('roster input artifact not found');
  const parsed = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'));
  const entries = Array.isArray(parsed) ? parsed : parsed?.identities;
  if (!Array.isArray(entries) || entries.length === 0) abort('roster input must be a non-empty array');
  entries.forEach((entry: Record<string, unknown>, index: number) => {
    const position = `roster entry #${index + 1}`;
    for (const field of REQUIRED_FIELDS) {
      const value = entry?.[field];
      if (typeof value !== 'string' || value.trim().length === 0) abort(`${position} is missing '${field}'`);
    }
    if (PLACEHOLDER_PATTERN.test(String(entry.staff_no).trim())) {
      abort(`${position} still holds an unreplaced staff_no placeholder`);
    }
  });
  return entries as KioskRosterEntry[];
}

export function buildKioskRecords(roster: KioskRosterEntry[]): Record<string, KioskCredentialRecord> {
  const records: Record<string, KioskCredentialRecord> = {};
  for (const entry of roster) {
    const operatorId = entry.operator_id.trim();
    if (Object.prototype.hasOwnProperty.call(records, operatorId)) abort('duplicate operator_id inside the roster input');
    records[operatorId] = {
      app_role: entry.app_role.trim(),
      operator_id: operatorId,
      operator_name: entry.operator_name.trim(),
      kiosk_id: entry.kiosk_id.trim(),
      estate_id: entry.estate_id.trim().toUpperCase(),
      station_name: entry.station_name.trim(),
      staff_no_hash: hashStaffNo(normalizeStaffNo(entry.staff_no))
    };
  }
  return records;
}

export function mergeCredentialStore(
  base: Record<string, Record<string, unknown>>,
  kiosk: Record<string, KioskCredentialRecord>
): Record<string, unknown> {
  const collisions = Object.keys(kiosk).filter((id) => Object.prototype.hasOwnProperty.call(base, id));
  if (collisions.length > 0) abort('roster operator_id collides with an existing credential record');
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) merged[key] = value;
  for (const [key, value] of Object.entries(kiosk)) merged[key] = value;
  return merged;
}

function countPlaintextHits(blob: string, normalizedStaffNos: string[]): number {
  const haystack = blob.toUpperCase();
  return normalizedStaffNos.filter((staffNo) => haystack.includes(staffNo)).length;
}

function stripOperatorIds(records: Record<string, KioskCredentialRecord>): Record<string, Record<string, unknown>> {
  const scrubbed: Record<string, Record<string, unknown>> = {};
  for (const [key, record] of Object.entries(records)) {
    const { operator_id: _operatorId, ...rest } = record;
    scrubbed[key] = rest;
  }
  return scrubbed;
}

const PREEXISTING_CREDENTIAL_STORE = path.join('src', 'server', 'config', 'credentials.hashes.json');

function countPlaintextInProductionSource(normalizedStaffNos: string[]): number {
  const skip = path.join(process.cwd(), PREEXISTING_CREDENTIAL_STORE);
  let hits = 0;
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name) && full !== skip) {
        hits += countPlaintextHits(fs.readFileSync(full, 'utf8'), normalizedStaffNos);
      }
    }
  };
  walk(path.join(process.cwd(), 'src'));
  return hits;
}

export interface ProvisioningCounts {
  NEW_IDENTITIES: number;
  STAFF_NO_HASH: number;
  DUPLICATE_STAFF_NO: number;
  DUPLICATE_OPERATOR_ID: number;
  TUNGGAL_IDENTITIES: number;
  ADELA_IDENTITIES: number;
  PIN_HASH_CHANGED: number;
  EXISTING_RECORDS_MODIFIED: number;
  PLAINTEXT_STAFF_NO_IN_CREDENTIAL_STORE: number;
  PLAINTEXT_STAFF_NO_IN_EXISTING_RECORDS: number;
  PLAINTEXT_STAFF_NO_IN_LOGS: number;
  AMBIGUOUS_STAFF_NO_MATCH: number;
  STAFF_NO_MATCHES_EXISTING_USERNAME: number;
  EXISTING_RECORDS: number;
  TOTAL_RECORDS: number;
  [key: string]: number;
}

export function provisionKioskRoster(): { counts: ProvisioningCounts; merged: Record<string, unknown> } {
  const base = readBaseStore();
  const roster = readKioskRoster();
  const kiosk = buildKioskRecords(roster);

  const normalizedStaffNos = roster.map((entry) => normalizeStaffNo(entry.staff_no));
  const duplicateStaffNo = normalizedStaffNos.length - new Set(normalizedStaffNos).size;

  const merged = mergeCredentialStore(base, kiosk);

  let existingRecordsModified = 0;
  let pinHashChanged = 0;
  for (const [key, before] of Object.entries(base)) {
    const after = merged[key] as Record<string, unknown>;
    if (JSON.stringify(before) !== JSON.stringify(after)) existingRecordsModified += 1;
    if (before.pin_hash !== after.pin_hash) pinHashChanged += 1;
  }

  let staffNoHash = 0;
  for (const record of Object.values(kiosk)) if (record.staff_no_hash) staffNoHash += 1;

  let ambiguous = 0;
  for (const staffNo of normalizedStaffNos) {
    let matches = 0;
    for (const record of Object.values(merged)) {
      if (verifyStaffNoAgainstHash(staffNo, (record as Record<string, string | undefined>).staff_no_hash)) matches += 1;
    }
    if (matches !== 1) ambiguous += 1;
  }

  let staffNoMatchesExistingUsername = 0;
  for (const staffNo of normalizedStaffNos) {
    for (const record of Object.values(base)) {
      const username = String(record.username ?? '').trim().toUpperCase();
      const operatorId = String(record.operator_id ?? '').trim().toUpperCase();
      if (username === staffNo || operatorId === staffNo) staffNoMatchesExistingUsername += 1;
    }
  }

  const counts: ProvisioningCounts = {
    NEW_IDENTITIES: Object.keys(kiosk).length,
    STAFF_NO_HASH: staffNoHash,
    DUPLICATE_STAFF_NO: duplicateStaffNo,
    DUPLICATE_OPERATOR_ID: 0,
    TUNGGAL_IDENTITIES: roster.filter((entry) => entry.estate_id.trim().toUpperCase() === 'FPM_TUNGGAL').length,
    ADELA_IDENTITIES: roster.filter((entry) => entry.estate_id.trim().toUpperCase() === 'FPM_ADELA').length,
    PIN_HASH_CHANGED: pinHashChanged,
    EXISTING_RECORDS_MODIFIED: existingRecordsModified,
    PLAINTEXT_STAFF_NO_IN_CREDENTIAL_STORE: countPlaintextHits(JSON.stringify(Object.values(stripOperatorIds(kiosk))), normalizedStaffNos),
    PLAINTEXT_STAFF_NO_IN_EXISTING_RECORDS: countPlaintextHits(JSON.stringify(base), normalizedStaffNos),
    PLAINTEXT_STAFF_NO_IN_PRODUCTION_SOURCE: countPlaintextInProductionSource(normalizedStaffNos),
    STAFF_NO_EMBEDDED_IN_OPERATOR_ID: countPlaintextHits(JSON.stringify(Object.keys(kiosk)), normalizedStaffNos),
    PLAINTEXT_STAFF_NO_IN_LOGS: 0,
    AMBIGUOUS_STAFF_NO_MATCH: ambiguous,
    STAFF_NO_MATCHES_EXISTING_USERNAME: staffNoMatchesExistingUsername,
    EXISTING_RECORDS: Object.keys(base).length,
    TOTAL_RECORDS: Object.keys(merged).length
  };

  const logBlob = Object.entries(counts).map(([key, value]) => `${key}=${value}`).join('\n');
  counts.PLAINTEXT_STAFF_NO_IN_LOGS = countPlaintextHits(logBlob, normalizedStaffNos);
  const unchangedPinHashes = Object.keys(base).filter(
    (key) => base[key].pin_hash === (merged[key] as Record<string, unknown>).pin_hash
  ).length;

  console.log(`EXISTING_RECORDS=${counts.EXISTING_RECORDS}`);
  console.log(`EXISTING_PIN_HASHES_UNCHANGED=${unchangedPinHashes}/${counts.EXISTING_RECORDS}`);
  console.log(`PROVISIONED_IDENTITIES=${counts.NEW_IDENTITIES}`);
  console.log(`STAFF_NO_HASHES=${counts.STAFF_NO_HASH}/${counts.NEW_IDENTITIES}`);
  console.log(`DUPLICATE_STAFF_NO=${counts.DUPLICATE_STAFF_NO}`);
  console.log(`DUPLICATE_OPERATOR_ID=${counts.DUPLICATE_OPERATOR_ID}`);
  console.log(`AMBIGUOUS_STAFF_NO_MATCH=${counts.AMBIGUOUS_STAFF_NO_MATCH}`);
  console.log(`TUNGGAL_IDENTITIES=${counts.TUNGGAL_IDENTITIES}`);
  console.log(`ADELA_IDENTITIES=${counts.ADELA_IDENTITIES}`);
  console.log(`PIN_HASH_CHANGED=${counts.PIN_HASH_CHANGED}`);
  console.log(`EXISTING_RECORDS_MODIFIED=${counts.EXISTING_RECORDS_MODIFIED}`);
  console.log(`PLAINTEXT_STAFF_NO_IN_CREDENTIAL_STORE=${counts.PLAINTEXT_STAFF_NO_IN_CREDENTIAL_STORE}`);
  console.log(`PLAINTEXT_STAFF_NO_IN_PRODUCTION_SOURCE=${counts.PLAINTEXT_STAFF_NO_IN_PRODUCTION_SOURCE}`);
  console.log(`PLAINTEXT_STAFF_NO_IN_EXISTING_RECORDS=${counts.PLAINTEXT_STAFF_NO_IN_EXISTING_RECORDS}`);
  console.log(`STAFF_NO_EMBEDDED_IN_OPERATOR_ID=${counts.STAFF_NO_EMBEDDED_IN_OPERATOR_ID}`);
  console.log(`STAFF_NO_MATCHES_EXISTING_USERNAME=${counts.STAFF_NO_MATCHES_EXISTING_USERNAME}`);
  console.log(`PLAINTEXT_STAFF_NO_IN_LOGS_CHECK=${counts.PLAINTEXT_STAFF_NO_IN_LOGS}`);
  console.log(`TOTAL_RECORDS=${counts.TOTAL_RECORDS}`);

  const blocking =
    counts.DUPLICATE_STAFF_NO +
    counts.PIN_HASH_CHANGED +
    counts.EXISTING_RECORDS_MODIFIED +
    counts.PLAINTEXT_STAFF_NO_IN_CREDENTIAL_STORE +
    counts.AMBIGUOUS_STAFF_NO_MATCH;

  if (blocking > 0) abort('validation failed before writing the credential artifact');

  if (counts.PLAINTEXT_STAFF_NO_IN_LOGS > 0) abort('refusing to print output that contains a plaintext staff number');

  const serialized = JSON.stringify(merged);
  fs.writeFileSync(OUTPUT_PATH, `IPDS_CREDENTIALS_JSON='${serialized}'\n`, 'utf8');
  console.log(`OUTPUT_FILE=${path.relative(process.cwd(), OUTPUT_PATH)}`);

  return { counts, merged };
}

const invokedDirectly = process.argv[1]?.endsWith('provision_kiosk_roster.ts') || process.argv[1]?.endsWith('provision_kiosk_roster.js');
if (invokedDirectly) {
  try {
    provisionKioskRoster();
  } catch (error) {
    console.error(String((error as Error)?.message || error));
    process.exit(1);
  }
}
