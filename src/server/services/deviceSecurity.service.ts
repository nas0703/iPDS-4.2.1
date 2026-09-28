/**
 * iPDS v4.1.0 — Device Whitelist & Security Management Service
 * Enforces hardware-level registration & authorization before granting operational access.
 */

import { getSupabase } from '../db.js';
import { auditService } from './audit.service.js';
import { isSuperAdminIdentity } from '../middleware/auth.js';
import { ESTATES_REGISTRY, normalizeEstateId } from '../../config/estateRegistry.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const FC_CONTACT_FILE = path.join(process.cwd(), 'data', 'fc_contact.json');

export interface RegisteredDeviceRecord {
  id?: string;
  device_id: string;
  device_name: string;
  estate_id: string;
  registered_by_pin?: string;
  operator_name?: string;
  role?: string;
  status: 'PENDING' | 'APPROVED' | 'BLOCKED' | 'REVOKED';
  approved_by?: string;
  approved_at?: string;
  last_seen_at?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
  // P0-16C.1 credential fields (optional; populated by the C.4 rollout/rotation).
  credential_hash?: string | null;
  credential_version?: number;
  credential_rotated_at?: string | null;
  // P1 soft-merge tracking (populated only by the device dedup merge).
  merged_into?: string | null;
  merged_at?: string | null;
  merge_operation_id?: string | null;
}

// In-memory cache for ultra-low latency verification
const deviceMemoryCache = new Map<string, RegisteredDeviceRecord>();

/**
 * P0-16: Secure first-device bootstrap.
 *
 * Approves a device ONLY when the caller presents the server-configured
 * bootstrap secret (IPDS_DEVICE_BOOTSTRAP_TOKEN) in addition to an already
 * verified operator credential. Returns false when the env token is unset
 * (bootstrap disabled / fail-closed). This is a server-secret mechanism — it
 * is NOT a PIN or master-PIN auto-approval and cannot be triggered by a client
 * without the secret.
 */
export function verifyBootstrapToken(token?: string | null): boolean {
  const configured = (process.env.IPDS_DEVICE_BOOTSTRAP_TOKEN || '').trim();
  if (!configured) return false;
  if (!token || typeof token !== 'string') return false;
  const provided = token.trim();
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * P0-16A: one-time device approval capabilities.
 *
 * The raw capability is never stored or logged; only its SHA-256 hash is kept.
 * Capabilities are 256-bit random, single-use, short-lived, and bound to exactly
 * one device_id + estate_id (never trusted from the URL).
 */
const APPROVAL_CAPABILITY_TTL_MS = 12 * 60 * 1000; // 12 minutes

const approvalCapabilities = new Map<string, {
  deviceId: string;
  estateId: string;
  deviceName?: string | null;
  requesterName?: string | null;
  requesterStaffId?: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdBy?: string;
  createdAt: string;
}>();

function hashApprovalCapability(capability: string): string {
  return crypto.createHash('sha256').update(capability, 'utf8').digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export interface ApprovalCapabilityResult {
  capability: string;
  expiresAt: string;
}

export interface ApprovalCapabilityRequester {
  requesterName?: string | null;
  requesterStaffId?: string | null;
  deviceName?: string | null;
}

export async function createApprovalCapability(params: {
  deviceId: string;
  estateId: string;
  createdBy?: string;
  requesterName?: string | null;
  requesterStaffId?: string | null;
  deviceName?: string | null;
}): Promise<ApprovalCapabilityResult> {
  const capability = crypto.randomBytes(32).toString('base64url'); // 256-bit
  const tokenHash = hashApprovalCapability(capability);
  const expiresAt = new Date(Date.now() + APPROVAL_CAPABILITY_TTL_MS).toISOString();

  approvalCapabilities.set(tokenHash, {
    deviceId: params.deviceId,
    estateId: params.estateId,
    deviceName: params.deviceName ?? null,
    requesterName: params.requesterName ?? null,
    requesterStaffId: params.requesterStaffId ?? null,
    expiresAt,
    usedAt: null,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString()
  });

  try {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('device_approval_capabilities').upsert([{
        device_id: params.deviceId,
        estate_id: params.estateId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: params.createdBy || null,
        requester_name: params.requesterName ?? null,
        requester_staff_id: params.requesterStaffId ?? null,
        device_name: params.deviceName ?? null
      }], { onConflict: 'token_hash' });
    }
  } catch (err) {
    console.warn('[DEVICE_SECURITY] Save approval capability error:', err);
  }

  return { capability, expiresAt };
}

/**
 * Server-side delivery for device approval link.
 * Sends the capability link directly to the registered FC contact (via webhook/outbound channel),
 * preventing client self-approval bypass.
 */
export async function sendApprovalLink(params: {
  approvalUrl: string;
  estateId: string;
  deviceId: string;
  deviceName?: string | null;
  requesterName?: string | null;
  requesterStaffId?: string | null;
}): Promise<boolean> {
  const contact = deviceSecurityService.getFcContact();
  const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();

  // If outbound alert webhook is configured, dispatch notification
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DEVICE_APPROVAL_REQUEST',
          estateId: params.estateId,
          deviceId: params.deviceId,
          deviceName: params.deviceName || 'Peranti Baharu',
          requesterName: params.requesterName || 'Kakitangan',
          requesterStaffId: params.requesterStaffId || 'N/A',
          recipient: contact,
          approvalUrl: params.approvalUrl,
          message: `Permohonan kelulusan peranti baharu (${params.deviceName || 'Peranti'}) untuk ladang ${params.estateId}. Sila hubungi/sahkan FC: ${contact.name} (${contact.phone}). Pautan: ${params.approvalUrl}`,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('[DEVICE_SECURITY] Failed to dispatch approval notification via webhook:', err);
    }
  }

  // TODO: Wire dedicated WhatsApp / SMS / Email provider (e.g. Twilio, Infobip, WhatsApp Cloud API)
  // using recipient contact: phone = contact.phone, name = contact.name.
  console.log(`[DEVICE_APPROVAL_DELIVERY] Approval link sent to FC contact (${contact.name} - ${contact.phone}): ${params.approvalUrl}`);
  return true;
}

export interface ConsumedApprovalCapability {
  ok: boolean;
  deviceId?: string;
  estateId?: string;
  deviceName?: string | null;
  requesterName?: string | null;
  requesterStaffId?: string | null;
  createdAt?: string;
  expiresAt?: string;
  reason?: 'invalid' | 'expired' | 'used';
}

export async function consumeApprovalCapability(capability?: string | null): Promise<ConsumedApprovalCapability> {
  if (!capability || typeof capability !== 'string') return { ok: false, reason: 'invalid' };

  const providedHash = hashApprovalCapability(capability);

  // Constant-time scan of the in-memory store.
  let matchKey: string | null = null;
  for (const key of approvalCapabilities.keys()) {
    if (timingSafeEqualHex(key, providedHash)) { matchKey = key; break; }
  }

  // Prefer atomic DB consumption when a database is configured.
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('device_approval_capabilities')
        .update({ used_at: new Date().toISOString() })
        .eq('token_hash', providedHash)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .select()
        .maybeSingle();

      if (data) {
        // Keep the (now used) entry so subsequent attempts report 'used'.
        const existing = approvalCapabilities.get(providedHash);
        if (existing) existing.usedAt = new Date().toISOString();
        return {
          ok: true,
          deviceId: data.device_id,
          estateId: data.estate_id,
          deviceName: data.device_name,
          requesterName: data.requester_name,
          requesterStaffId: data.requester_staff_id,
          createdAt: data.created_at,
          expiresAt: data.expires_at
        };
      }
    }
  } catch (err) {
    console.warn('[DEVICE_SECURITY] Consume approval capability error:', err);
  }

  // In-memory fallback (single-threaded atomic consume).
  if (!matchKey) return { ok: false, reason: 'invalid' };
  const entry = approvalCapabilities.get(matchKey)!;
  if (entry.usedAt) return { ok: false, reason: 'used' };
  if (new Date(entry.expiresAt).getTime() <= Date.now()) return { ok: false, reason: 'expired' };
  entry.usedAt = new Date().toISOString();
  return {
    ok: true,
    deviceId: entry.deviceId,
    estateId: entry.estateId,
    deviceName: entry.deviceName,
    requesterName: entry.requesterName,
    requesterStaffId: entry.requesterStaffId,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt
  };
}

/**
 * P0-16B: read-only capability inspection for the pre-auth confirmation page.
 * Validates the capability WITHOUT consuming it (GET must never mutate state)
 * and returns the server-side requester/device context for display. The raw
 * capability is never returned or logged.
 */
export async function peekApprovalCapability(capability?: string | null): Promise<ConsumedApprovalCapability> {
  if (!capability || typeof capability !== 'string') return { ok: false, reason: 'invalid' };

  const providedHash = hashApprovalCapability(capability);

  // Read-only DB lookup when a database is configured.
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('device_approval_capabilities')
        .select('device_id, estate_id, device_name, requester_name, requester_staff_id, created_at, expires_at, used_at')
        .eq('token_hash', providedHash)
        .maybeSingle();

      if (data) {
        if (data.used_at) return { ok: false, reason: 'used' };
        if (new Date(data.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'expired' };
        return {
          ok: true,
          deviceId: data.device_id,
          estateId: data.estate_id,
          deviceName: data.device_name,
          requesterName: data.requester_name,
          requesterStaffId: data.requester_staff_id,
          createdAt: data.created_at,
          expiresAt: data.expires_at
        };
      }
    }
  } catch (err) {
    console.warn('[DEVICE_SECURITY] Peek approval capability error:', err);
  }

  // In-memory fallback (constant-time hash comparison).
  let matchKey: string | null = null;
  for (const key of approvalCapabilities.keys()) {
    if (timingSafeEqualHex(key, providedHash)) { matchKey = key; break; }
  }
  if (!matchKey) return { ok: false, reason: 'invalid' };
  const entry = approvalCapabilities.get(matchKey)!;
  if (entry.usedAt) return { ok: false, reason: 'used' };
  if (new Date(entry.expiresAt).getTime() <= Date.now()) return { ok: false, reason: 'expired' };
  return {
    ok: true,
    deviceId: entry.deviceId,
    estateId: entry.estateId,
    deviceName: entry.deviceName,
    requesterName: entry.requesterName,
    requesterStaffId: entry.requesterStaffId,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt
  };
}

/**
 * P0-16C.1: cryptographic device credentials.
 *
 * device_id stays a NON-SECRET display identifier. The device credential is a
 * server-issued 256-bit CSPRNG secret. Only SHA-256(credential) is persisted;
 * the plaintext credential is returned to the client exactly once at issuance.
 *
 * Enforcement (login verification) is intentionally NOT wired here — that is
 * P0-16C.3. This phase establishes issuance + hashing + storage only.
 */
const DEVICE_CREDENTIAL_BYTES = 32; // 256-bit

export function generateDeviceCredential(): string {
  return crypto.randomBytes(DEVICE_CREDENTIAL_BYTES).toString('base64url');
}

export function hashDeviceCredential(credential: string): string {
  return crypto.createHash('sha256').update(credential, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of a presented credential against a stored hash.
 * The comparison is over SHA-256 hex digests (equal length), so
 * crypto.timingSafeEqual is safe to use.
 */
export function verifyDeviceCredential(credential: string, storedHash: string): boolean {
  if (typeof credential !== 'string' || credential.length === 0) return false;
  if (typeof storedHash !== 'string' || storedHash.length === 0) return false;
  return timingSafeEqualHex(hashDeviceCredential(credential), storedHash);
}

/**
 * Compare-and-set credential rotation primitive (P0-16C.1 / C.4).
 *
 * A credential is generated, hashed, and persisted ONLY when the row still has
 * the version that was read (optimistic concurrency). On conflict the version is
 * re-read and a fresh credential is attempted, so two simultaneous rotations can
 * never assign the same credential_version. Only the SHA-256 hash is persisted;
 * the plaintext is returned to the caller exactly once.
 */
const MAX_CREDENTIAL_ROTATION_ATTEMPTS = 5;

interface CredentialRotationDeps {
  readVersion: (deviceId: string) => Promise<number | null>;
  casUpdate: (
    deviceId: string,
    expectedVersion: number,
    credentialHash: string,
    rotatedAt: string
  ) => Promise<number | null>;
  generateCredential: () => string;
  hashCredential: (credential: string) => string;
  now: () => string;
}

interface CredentialRotationOutcome {
  ok: boolean;
  reason?: 'DB_UNAVAILABLE' | 'CONFLICT';
  credential?: string;
  credentialVersion?: number;
  rotatedAt?: string;
}

const DEFAULT_CREDENTIAL_ROTATION_DEPS: CredentialRotationDeps = {
  readVersion: async (deviceId: string) => {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('registered_devices')
        .select('credential_version')
        .eq('device_id', deviceId)
        .maybeSingle();
      if (error || !data) return null;
      return Number(data.credential_version ?? 0) || 0;
    } catch {
      return null;
    }
  },
  casUpdate: async (deviceId, expectedVersion, credentialHash, rotatedAt) => {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('registered_devices')
        .update({
          credential_hash: credentialHash,
          credential_version: expectedVersion + 1,
          credential_rotated_at: rotatedAt
        })
        .eq('device_id', deviceId)
        .eq('credential_version', expectedVersion)
        .select('credential_version')
        .maybeSingle();
      if (error || !data) return null;
      return Number(data.credential_version);
    } catch {
      return null;
    }
  },
  generateCredential: generateDeviceCredential,
  hashCredential: hashDeviceCredential,
  now: () => new Date().toISOString()
};

async function rotateCredentialCas(
  deviceId: string,
  deps: CredentialRotationDeps
): Promise<CredentialRotationOutcome> {
  for (let attempt = 0; attempt < MAX_CREDENTIAL_ROTATION_ATTEMPTS; attempt++) {
    const currentVersion = await deps.readVersion(deviceId);
    if (currentVersion === null) return { ok: false, reason: 'DB_UNAVAILABLE' };

    const credential = deps.generateCredential();
    const credentialHash = deps.hashCredential(credential);
    const rotatedAt = deps.now();

    const newVersion = await deps.casUpdate(deviceId, currentVersion, credentialHash, rotatedAt);
    if (newVersion !== null) {
      return { ok: true, credential, credentialVersion: newVersion, rotatedAt };
    }
  }
  return { ok: false, reason: 'CONFLICT' };
}

/**
 * Issue (or rotate) a device credential. Generates a new CSPRNG credential,
 * persists ONLY its SHA-256 hash, increments credential_version and stamps
 * credential_rotated_at, and returns the plaintext credential exactly once.
 *
 * Fail-closed: returns null when the database is unavailable or the device row
 * does not exist, so a credential is never handed out without a persisted hash.
 */
export async function issueDeviceCredential(deviceId: string): Promise<string | null> {
  if (!deviceId || typeof deviceId !== 'string') return null;
  const outcome = await rotateCredentialCas(deviceId, DEFAULT_CREDENTIAL_ROTATION_DEPS);
  return outcome.ok && outcome.credential ? outcome.credential : null;
}

/**
 * Rotate a device credential. Rotation is issuance of a new credential: the
 * stored hash is overwritten so the previous credential can no longer verify.
 * Automatic rotation is intentionally NOT scheduled in this phase.
 */
export async function rotateDeviceCredential(deviceId: string): Promise<string | null> {
  return issueDeviceCredential(deviceId);
}

/**
 * P0-16C.4: existing-device credential rollout.
 *
 * Devices approved before credential hashing have credential_hash = NULL. This
 * controlled, idempotent mechanism issues such a device a fresh CSPRNG
 * credential and persists ONLY its SHA-256 hash, incrementing credential_version
 * and stamping credential_rotated_at. It never changes registered_devices.status,
 * estate_id, approval state, or device_estate_access.
 *
 * Authorization boundary: the actor must be a device administrator AND be
 * allowed to administer the device's RECORDED estate. The estate is resolved
 * from the authoritative registered_devices row, never from client input.
 */
export type IssueExistingCredentialCode =
  | 'OK'
  | 'UNKNOWN_DEVICE'
  | 'DEVICE_NOT_APPROVED'
  | 'UNAUTHORIZED_ACTOR'
  | 'INVALID_ESTATE'
  | 'DB_UNAVAILABLE'
  | 'CONFLICT';

export interface DeviceCredentialActor {
  name?: string | null;
  role?: string | null;
  estateId?: string | null;
}

export interface IssuedExistingDeviceCredential {
  ok: boolean;
  code: IssueExistingCredentialCode;
  deviceId?: string;
  estateId?: string;
  credential?: string;
  credentialVersion?: number;
  rotatedAt?: string;
}

const CREDENTIAL_ADMIN_ROLES = new Set([
  'rc', 'oc', 'pf', 'fc', 'superadmin', 'super_admin', 'admin', 'executive_hq', 'regional_controller'
]);

/**
 * True only when the actor is a device administrator authorized for the target
 * estate. Cross-estate authority is delegated to the canonical Super Admin /
 * FC Tunggal SSOT (isSuperAdminIdentity); every other admin role must match the
 * target estate exactly. Pure function so the boundary is directly testable and
 * cannot be bypassed by calling the service directly.
 */
export function actorCanAdministerDeviceEstate(
  actor: DeviceCredentialActor | null | undefined,
  deviceEstateId?: string | null
): boolean {
  const role = String(actor?.role || '').toLowerCase().trim();
  if (!CREDENTIAL_ADMIN_ROLES.has(role)) return false;
  if (isSuperAdminIdentity({ app_metadata: { app_role: actor?.role, estate_id: actor?.estateId } })) return true;
  const own = String(actor?.estateId || '').trim().toUpperCase();
  return !!own && own === String(deviceEstateId || '').trim().toUpperCase();
}

export interface DeviceCredentialRolloutDeps extends CredentialRotationDeps {
  findDevice: (deviceId: string) => Promise<RegisteredDeviceRecord | null>;
}

/**
 * Authoritative read of a device row by its (non-secret) device_id, bypassing
 * the in-memory cache. Used to resolve the estate the rollout must authorize
 * against. Fail-closed (null) without a database.
 */
export async function getRegisteredDeviceById(deviceId: string): Promise<RegisteredDeviceRecord | null> {
  if (!deviceId || typeof deviceId !== 'string') return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('registered_devices')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();
    if (error || !data) return null;
    return data as RegisteredDeviceRecord;
  } catch {
    return null;
  }
}

const DEFAULT_DEVICE_CREDENTIAL_ROLLOUT_DEPS: DeviceCredentialRolloutDeps = {
  ...DEFAULT_CREDENTIAL_ROTATION_DEPS,
  findDevice: getRegisteredDeviceById
};

/**
 * Issue/rotate a credential for an EXISTING device under an explicit admin
 * authorization boundary. Returns the plaintext credential exactly once.
 * Fails closed for unknown / PENDING / BLOCKED / REVOKED devices, unauthorized
 * actors, invalid estates, and database failures.
 */
export async function issueExistingDeviceCredential(
  deviceId: string,
  actor: DeviceCredentialActor | null | undefined,
  deps: DeviceCredentialRolloutDeps = DEFAULT_DEVICE_CREDENTIAL_ROLLOUT_DEPS
): Promise<IssuedExistingDeviceCredential> {
  const id = String(deviceId || '').trim();
  if (!id) return { ok: false, code: 'UNKNOWN_DEVICE' };

  const device = await deps.findDevice(id);
  if (!device || !device.device_id) return { ok: false, code: 'UNKNOWN_DEVICE', deviceId: id };
  if (device.status !== 'APPROVED') {
    return { ok: false, code: 'DEVICE_NOT_APPROVED', deviceId: id };
  }

  const estateId = String(device.estate_id || '').trim().toUpperCase();
  if (!isValidEstateId(estateId)) {
    return { ok: false, code: 'INVALID_ESTATE', deviceId: id };
  }

  if (!actorCanAdministerDeviceEstate(actor, estateId)) {
    return { ok: false, code: 'UNAUTHORIZED_ACTOR', deviceId: id, estateId };
  }

  const outcome = await rotateCredentialCas(id, deps);
  if (!outcome.ok) {
    return {
      ok: false,
      code: outcome.reason === 'CONFLICT' ? 'CONFLICT' : 'DB_UNAVAILABLE',
      deviceId: id,
      estateId
    };
  }

  return {
    ok: true,
    code: 'OK',
    deviceId: id,
    estateId,
    credential: outcome.credential,
    credentialVersion: outcome.credentialVersion,
    rotatedAt: outcome.rotatedAt
  };
}

/**
 * P0-16C.2: explicit device -> estate authorization.
 *
 * A device may be authorized for one or many estates independently. Missing row
 * means NOT authorized (never treated as ACTIVE). Global device status is a
 * separate concern and is NOT changed by single-estate grant/revoke.
 */
export interface DeviceEstateAccessRecord {
  id?: string;
  device_id: string;
  estate_id: string;
  status: 'ACTIVE' | 'REVOKED';
  granted_by?: string | null;
  granted_at?: string;
  revoked_by?: string | null;
  revoked_at?: string | null;
}

/**
 * Validate an estate identifier using the repository's canonical registry.
 * Unknown/blank identifiers are rejected (fail-closed).
 */
export function isValidEstateId(estateId?: string | null): boolean {
  if (!estateId || typeof estateId !== 'string') return false;
  const normalized = normalizeEstateId(estateId);
  return Object.prototype.hasOwnProperty.call(ESTATES_REGISTRY, normalized);
}

export async function getDeviceEstateAccess(deviceId: string, estateId: string): Promise<DeviceEstateAccessRecord | null> {
  if (!deviceId || !estateId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('device_estate_access')
      .select('*')
      .eq('device_id', deviceId)
      .eq('estate_id', estateId)
      .maybeSingle();
    if (error || !data) return null;
    return data as DeviceEstateAccessRecord;
  } catch {
    return null;
  }
}

/**
 * P0-16C.3 consumption point (NOT wired to login in this phase): true only when
 * an explicit ACTIVE grant exists for this device + estate. Missing row and
 * REVOKED both return false (fail-closed).
 */
export async function isDeviceAuthorizedForEstate(deviceId: string, estateId: string): Promise<boolean> {
  const access = await getDeviceEstateAccess(deviceId, estateId);
  return !!access && access.status === 'ACTIVE';
}

/**
 * P0-16C.5: pure backfill planner (mirrors the migration SQL exactly).
 *
 * Least privilege: APPROVED + canonical estate only; existing grants (ACTIVE or
 * REVOKED) are preserved and never reactivated. No grant-all / cross-estate
 * inference. Used for validation/tooling; the migration performs the same rule.
 */
export type DeviceEstateBackfillSkipReason = 'NOT_APPROVED' | 'NULL_ESTATE' | 'INVALID_ESTATE' | 'GRANT_EXISTS';

/**
 * Canonical estate ids (exact, case-insensitive) as defined by the application's
 * ESTATES_REGISTRY. The backfill is intentionally STRICT: aliases/numeric codes
 * are treated as unmapped and skipped (no inference).
 */
const CANONICAL_ESTATE_IDS = new Set(Object.keys(ESTATES_REGISTRY).map(k => k.toUpperCase()));

export interface DeviceEstateGrantBackfillPlan {
  toInsert: Array<{ device_id: string; estate_id: string }>;
  skipped: Array<{ device_id: string; reason: DeviceEstateBackfillSkipReason }>;
}

export function computeDeviceEstateGrantBackfill(
  devices: Array<{ device_id: string; status: string; estate_id?: string | null }>,
  existingGrants: Array<{ device_id: string; estate_id: string }> = []
): DeviceEstateGrantBackfillPlan {
  const existing = new Set(existingGrants.map(g => `${g.device_id}::${String(g.estate_id).trim().toUpperCase()}`));
  const toInsert: Array<{ device_id: string; estate_id: string }> = [];
  const skipped: Array<{ device_id: string; reason: DeviceEstateBackfillSkipReason }> = [];

  for (const d of devices) {
    if (!d || !d.device_id) continue;
    if (d.status !== 'APPROVED') { skipped.push({ device_id: d.device_id, reason: 'NOT_APPROVED' }); continue; }
    const estate = String(d.estate_id ?? '').trim().toUpperCase();
    if (!estate) { skipped.push({ device_id: d.device_id, reason: 'NULL_ESTATE' }); continue; }
    if (!CANONICAL_ESTATE_IDS.has(estate)) { skipped.push({ device_id: d.device_id, reason: 'INVALID_ESTATE' }); continue; }
    if (existing.has(`${d.device_id}::${estate}`)) { skipped.push({ device_id: d.device_id, reason: 'GRANT_EXISTS' }); continue; }
    toInsert.push({ device_id: d.device_id, estate_id: estate });
  }

  return { toInsert, skipped };
}

export async function listDeviceEstateAccess(deviceId: string): Promise<DeviceEstateAccessRecord[]> {
  if (!deviceId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('device_estate_access')
      .select('*')
      .eq('device_id', deviceId)
      .order('estate_id', { ascending: true });
    if (error || !data) return [];
    return data as DeviceEstateAccessRecord[];
  } catch {
    return [];
  }
}

/**
 * Grant (idempotently) ACTIVE access for exactly one device + estate pair.
 * Returns null when the device does not exist, the estate is invalid, or the DB
 * is unavailable. Never grants any other estate.
 */
export async function grantDeviceEstateAccess(deviceId: string, estateId: string, actor?: string): Promise<DeviceEstateAccessRecord | null> {
  if (!deviceId || !estateId) return null;
  if (!isValidEstateId(estateId)) return null;

  const device = await deviceSecurityService.getDeviceStatus(deviceId);
  if (!device) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const now = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from('device_estate_access')
      .upsert(
        {
          device_id: deviceId,
          estate_id: estateId,
          status: 'ACTIVE',
          granted_by: actor || null,
          granted_at: now,
          revoked_by: null,
          revoked_at: null
        },
        { onConflict: 'device_id,estate_id' }
      )
      .select()
      .maybeSingle();

    if (error || !data) return null;
    return data as DeviceEstateAccessRecord;
  } catch {
    return null;
  }
}

/**
 * Revoke access for exactly one device + estate pair. Does NOT modify
 * registered_devices.status (global device state is untouched).
 */
export async function revokeDeviceEstateAccess(deviceId: string, estateId: string, actor?: string): Promise<boolean> {
  if (!deviceId || !estateId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('device_estate_access')
      .update({
        status: 'REVOKED',
        revoked_by: actor || null,
        revoked_at: new Date().toISOString()
      })
      .eq('device_id', deviceId)
      .eq('estate_id', estateId)
      .select('device_id')
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * P0-16C.3: strict device authorization primitive.
 *
 * Resolves the device BY CREDENTIAL (never by device_id), then requires:
 *   valid credential + registered_devices.status = APPROVED +
 *   device_estate_access.status = ACTIVE for the requested estate.
 *
 * Fail-closed. device_id is a non-secret display identifier and is never used
 * as the authorization key here. The user/role -> estate authorization is
 * enforced separately by the existing auth flow (validateTenantAccess etc.).
 */
export type DeviceAuthCode =
  | 'OK'
  | 'CREDENTIAL_MISSING'
  | 'CREDENTIAL_INVALID'
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_NOT_APPROVED'
  | 'ESTATE_NOT_AUTHORIZED'
  | 'DEVICE_MERGED';

export interface DeviceAuthorizationResult {
  allowed: boolean;
  code: DeviceAuthCode;
  deviceId?: string;
  mergedInto?: string;
}

export interface DeviceAuthorizationDeps {
  findDeviceByCredentialHash: (credentialHash: string) => Promise<RegisteredDeviceRecord | null>;
  getEstateAccess: (deviceId: string, estateId: string) => Promise<DeviceEstateAccessRecord | null>;
}

export async function getDeviceByCredentialHash(credentialHash: string): Promise<RegisteredDeviceRecord | null> {
  if (!credentialHash || typeof credentialHash !== 'string') return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('registered_devices')
      .select('*')
      .eq('credential_hash', credentialHash)
      .maybeSingle();
    if (error || !data) return null;
    return data as RegisteredDeviceRecord;
  } catch {
    return null;
  }
}

const DEFAULT_DEVICE_AUTH_DEPS: DeviceAuthorizationDeps = {
  findDeviceByCredentialHash: getDeviceByCredentialHash,
  getEstateAccess: getDeviceEstateAccess
};

/**
 * Authoritative device authorization for a requested estate. Both the login
 * routes and the raw-PIN middleware consume this single primitive.
 */
export async function authorizeDeviceForEstate(
  params: { credential?: string | null; requestedEstateId: string },
  deps: DeviceAuthorizationDeps = DEFAULT_DEVICE_AUTH_DEPS
): Promise<DeviceAuthorizationResult> {
  const credential = typeof params?.credential === 'string' ? params.credential.trim() : '';
  const requestedEstate = String(params?.requestedEstateId || '').trim().toUpperCase();

  if (!credential) return { allowed: false, code: 'CREDENTIAL_MISSING' };
  if (!requestedEstate || !isValidEstateId(requestedEstate)) return { allowed: false, code: 'ESTATE_NOT_AUTHORIZED' };

  const credentialHash = hashDeviceCredential(credential);
  const device = await deps.findDeviceByCredentialHash(credentialHash);
  if (!device || !device.device_id) return { allowed: false, code: 'DEVICE_NOT_FOUND' };
  // P1 soft-merge: a merged duplicate must never authenticate; tell the caller
  // which canonical device_id to adopt instead.
  if (device.merged_into) {
    return { allowed: false, code: 'DEVICE_MERGED', deviceId: device.device_id, mergedInto: device.merged_into };
  }
  if (device.status !== 'APPROVED') return { allowed: false, code: 'DEVICE_NOT_APPROVED', deviceId: device.device_id };

  const access = await deps.getEstateAccess(device.device_id, requestedEstate);
  if (!access || access.status !== 'ACTIVE') {
    return { allowed: false, code: 'ESTATE_NOT_AUTHORIZED', deviceId: device.device_id };
  }

  return { allowed: true, code: 'OK', deviceId: device.device_id };
}

/**
 * P0-16C.3 transition control.
 *
 * Strict device enforcement is OFF by default so that existing APPROVED devices
 * (which have no credential_hash and no device_estate_access rows yet — P0-16C.5
 * backfill not implemented) are NOT locked out. Enable explicitly via the
 * server env flag after C.5 backfill + client credential rollout:
 *   IPDS_DEVICE_STRICT_ENFORCEMENT=true
 */
export function isStrictDeviceEnforcementEnabled(): boolean {
  const raw = String(process.env.IPDS_DEVICE_STRICT_ENFORCEMENT || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

// Trusted master devices pre-approved by default
const SEED_MASTER_DEVICES: RegisteredDeviceRecord[] = [
  {
    device_id: 'DEV-MASTER-NAS-FC',
    device_name: 'Telefon Utama Pengurus / Field Controller (FC)',
    estate_id: 'FPM_TUNGGAL',
    operator_name: 'MD NASRUDDIN BIN BHSERAN',
    role: 'fc',
    status: 'APPROVED',
    approved_by: 'SYSTEM_SUPERADMIN',
    approved_at: new Date().toISOString()
  }
];

/**
 * P0-16 read-path consistency.
 *
 * A warm serverless instance may hold a stale in-memory PENDING while another
 * instance (or the FC approval link) has already persisted APPROVED into
 * registered_devices. Persistence must therefore take precedence:
 *   - a persisted APPROVED ALWAYS wins over a cached PENDING/unknown state;
 *   - a cached APPROVED is already authoritative and stays APPROVED;
 *   - a more restrictive cached state (BLOCKED/REVOKED) is preserved unless
 *     persistence explicitly says APPROVED;
 *   - a cached PENDING is refreshed from persistence.
 *
 * Pure function (no I/O) so the precedence rules are directly testable.
 */
export function resolveDeviceStatusRecord(
  cached: RegisteredDeviceRecord | null | undefined,
  persisted: RegisteredDeviceRecord | null | undefined
): RegisteredDeviceRecord | null {
  // A cached APPROVED is already authoritative and must remain APPROVED.
  if (cached && cached.status === 'APPROVED') return cached;

  if (!persisted) return cached || null;

  // Persistent APPROVED is authoritative over any cached state.
  if (persisted.status === 'APPROVED') return persisted;

  // Keep a more restrictive cached state rather than relaxing it.
  if (cached && (cached.status === 'BLOCKED' || cached.status === 'REVOKED')) {
    return cached;
  }

  return persisted;
}


class DeviceSecurityService {
  constructor() {
    for (const d of SEED_MASTER_DEVICES) {
      deviceMemoryCache.set(d.device_id, d);
    }
    // Load persisted contact settings on boot
    this.loadFromSupabase().catch(() => {});
  }

  /**
   * Check if a device is registered and approved
   */
  async getDeviceStatus(deviceId: string, estateId: string = 'FPM_TUNGGAL'): Promise<RegisteredDeviceRecord | null> {
    if (!deviceId) return null;

    const cached = deviceMemoryCache.get(deviceId);

    // Fast path: an APPROVED cache is authoritative and cannot be masked.
    if (cached && cached.status === 'APPROVED') {
      return cached;
    }

    // P0-16 read-path consistency: for a cached PENDING/unknown (or uncached)
    // device, consult persistence so an APPROVED record written by another
    // instance always takes precedence over a stale in-memory PENDING.
    let persisted: RegisteredDeviceRecord | null = null;
    try {
      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from('registered_devices')
          .select('*')
          .eq('device_id', deviceId)
          .maybeSingle();

        if (!error && data) {
          persisted = data as RegisteredDeviceRecord;
        }
      }
    } catch (err) {
      console.warn('[DEVICE_SECURITY] Supabase lookup error:', err);
    }

    const resolved = resolveDeviceStatusRecord(cached, persisted);
    if (resolved) {
      // Refresh the cache when persistence provided the authoritative record
      // (e.g. a persisted APPROVED promoting a stale cached PENDING).
      if (persisted) {
        deviceMemoryCache.set(deviceId, resolved);
      }
      return resolved;
    }

    return null;
  }

  /**
   * Register a new device (Initial status: PENDING)
   */
  async registerDevice(payload: {
    deviceId: string;
    deviceName: string;
    estateId: string;
    pin?: string;
    operatorName?: string;
    role?: string;
    ip?: string;
    userAgent?: string;
    bootstrapToken?: string;
  }): Promise<RegisteredDeviceRecord> {
    // P0-07: registration never auto-approves from a PIN/master PIN.
    // P0-16: the ONLY auto-approval path is the server-configured bootstrap
    // token, presented alongside an already-verified operator credential.
    const bootstrapApproved = verifyBootstrapToken(payload.bootstrapToken);
    const status: 'PENDING' | 'APPROVED' = bootstrapApproved ? 'APPROVED' : 'PENDING';

    const record: RegisteredDeviceRecord = {
      device_id: payload.deviceId,
      device_name: payload.deviceName || 'Peranti Baharu',
      estate_id: payload.estateId || 'FPM_TUNGGAL',
      registered_by_pin: payload.pin ? '******' : undefined,
      operator_name: payload.operatorName || 'Tidak Diketahui',
      role: payload.role || 'staff',
      status,
      approved_by: bootstrapApproved ? 'BOOTSTRAP_TOKEN' : undefined,
      approved_at: bootstrapApproved ? new Date().toISOString() : undefined,
      last_seen_at: new Date().toISOString(),
      ip_address: payload.ip || 'unknown',
      user_agent: payload.userAgent || 'unknown',
      created_at: new Date().toISOString()
    };

    // Update memory
    deviceMemoryCache.set(payload.deviceId, record);

    // Persist to Supabase
    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('registered_devices').upsert([record], { onConflict: 'device_id' });
      }
    } catch (err) {
      console.warn('[DEVICE_SECURITY] Save to Supabase error:', err);
    }

    auditService.record({
      action: bootstrapApproved ? 'DEVICE_BOOTSTRAP_APPROVED' : 'DEVICE_REGISTRATION_REQUESTED',
      resource: 'devices',
      userId: payload.deviceId,
      userName: payload.operatorName,
      authorizedEstate: payload.estateId,
      result: bootstrapApproved ? 'SUCCESS' : 'PENDING',
      ip: payload.ip || 'unknown',
      userAgent: payload.userAgent || 'unknown',
      details: {
        deviceName: payload.deviceName,
        status
      }
    });

    return record;
  }

  /**
   * Approve a pending device (by FC / PF / Admin)
   */
  async approveDevice(deviceId: string, approverName: string, approverRole: string): Promise<RegisteredDeviceRecord | null> {
    const existing = await this.getDeviceStatus(deviceId);
    const updated: RegisteredDeviceRecord = {
      ...(existing || {
        device_id: deviceId,
        device_name: 'Peranti Baharu',
        estate_id: 'FPM_TUNGGAL',
        status: 'APPROVED'
      }),
      status: 'APPROVED',
      approved_by: `${approverName} (${approverRole})`,
      approved_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };

    deviceMemoryCache.set(deviceId, updated);

    try {
      const supabase = getSupabase();
      if (supabase) {
        // P0-16: upsert (not update) so approving an unknown device creates an
        // APPROVED row and can never silently affect zero rows.
        const { error } = await supabase
          .from('registered_devices')
          .upsert(
            {
              device_id: updated.device_id,
              device_name: updated.device_name,
              estate_id: updated.estate_id,
              operator_name: updated.operator_name,
              role: updated.role,
              status: 'APPROVED',
              approved_by: updated.approved_by,
              approved_at: updated.approved_at,
              last_seen_at: updated.last_seen_at
            },
            { onConflict: 'device_id' }
          );

        if (error) {
          console.warn('[DEVICE_SECURITY] Approve device upsert warning:', error.message);
        }
      }
    } catch (err) {
      console.warn('[DEVICE_SECURITY] Approve device error:', err);
    }

    auditService.record({
      action: 'DEVICE_APPROVED',
      resource: 'devices',
      userId: deviceId,
      userName: approverName,
      result: 'SUCCESS',
      details: { approverRole }
    });

    return updated;
  }

  /**
   * Block or revoke a device
   */
  async revokeDevice(deviceId: string, revokerName: string, reason: string = 'Akses ditamatkan'): Promise<boolean> {
    const existing = await this.getDeviceStatus(deviceId);
    if (!existing) return false;

    const updated: RegisteredDeviceRecord = {
      ...existing,
      status: 'REVOKED',
      last_seen_at: new Date().toISOString()
    };

    deviceMemoryCache.set(deviceId, updated);

    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase
          .from('registered_devices')
          .update({
            status: 'REVOKED',
            last_seen_at: updated.last_seen_at
          })
          .eq('device_id', deviceId);
      }
    } catch (err) {
      console.warn('[DEVICE_SECURITY] Revoke device error:', err);
    }

    auditService.record({
      action: 'DEVICE_REVOKED',
      resource: 'devices',
      userId: deviceId,
      userName: revokerName,
      result: 'BLOCKED',
      details: { reason }
    });

    return true;
  }

  /**
   * List all registered devices for an estate
   */
  async listDevices(estateId?: string): Promise<RegisteredDeviceRecord[]> {
    try {
      const supabase = getSupabase();
      if (supabase) {
        let query = supabase.from('registered_devices').select('*').order('created_at', { ascending: false });
        if (estateId && estateId !== 'WILAYAH_JB' && estateId !== 'ALL') {
          query = query.eq('estate_id', estateId);
        }
        const { data, error } = await query;
        if (!error && data) {
          // Sync into memory cache
          for (const d of data) {
            deviceMemoryCache.set(d.device_id, d as RegisteredDeviceRecord);
          }
          return data as RegisteredDeviceRecord[];
        }
      }
    } catch (err) {
      console.warn('[DEVICE_SECURITY] List devices error:', err);
    }

    // Return in-memory list
    return Array.from(deviceMemoryCache.values());
  }

  // Active FC WhatsApp Contact (Default with env override, loaded from Supabase on boot)
  private fcContact = {
    phone: process.env.ADMIN_WHATSAPP_PHONE || process.env.FC_WHATSAPP_PHONE || '60177853551',
    name: 'MD NASRUDDIN (FC Tunggal / Admin)',
    estate: 'FPM_TUNGGAL'
  };

  private isSupabaseLoaded = false;

  /**
   * Load active contact settings from Supabase app_settings table
   */
  async loadFromSupabase() {
    try {
      const sb = getSupabase();
      if (!sb) return this.fcContact;
      const { data, error } = await sb
        .from('app_settings')
        .select('key, value')
        .in('key', ['admin_fc_whatsapp_phone', 'admin_fc_whatsapp_name']);

      if (!error && data && data.length > 0) {
        for (const row of data) {
          if (row.key === 'admin_fc_whatsapp_phone' && row.value) {
            this.fcContact.phone = row.value;
          }
          if (row.key === 'admin_fc_whatsapp_name' && row.value) {
            this.fcContact.name = row.value;
          }
        }
        this.isSupabaseLoaded = true;
        // Sync to local file as immediate filesystem backup
        try {
          const dir = path.dirname(FC_CONTACT_FILE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(FC_CONTACT_FILE, JSON.stringify(this.fcContact, null, 2), 'utf-8');
        } catch {}
      }
    } catch (e) {
      console.warn('[DEVICE_SECURITY] Load fc contact from Supabase error:', e);
    }
    return this.fcContact;
  }

  getFcContact() {
    try {
      if (!this.isSupabaseLoaded) {
        this.loadFromSupabase().catch(() => {});
        if (fs.existsSync(FC_CONTACT_FILE)) {
          const raw = fs.readFileSync(FC_CONTACT_FILE, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed?.phone) {
            this.fcContact = { ...this.fcContact, ...parsed };
          }
        }
      }
    } catch (e) {
      console.warn('[DEVICE_SECURITY] Read fc_contact.json error:', e);
    }
    return this.fcContact;
  }

  async setFcContact(phone: string, name?: string) {
    let cleaned = (phone || '').replace(/\D/g, '');
    // Remove repeated country codes like 6060...
    while (cleaned.startsWith('6060')) {
      cleaned = cleaned.slice(2);
    }
    if (cleaned.startsWith('0')) {
      cleaned = '60' + cleaned.slice(1);
    } else if (!cleaned.startsWith('60') && cleaned.length >= 8) {
      cleaned = '60' + cleaned;
    }

    this.fcContact = {
      phone: cleaned || '601138404285',
      name: name || this.fcContact.name,
      estate: this.fcContact.estate
    };

    // 1. Write to local JSON file
    try {
      const dir = path.dirname(FC_CONTACT_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(FC_CONTACT_FILE, JSON.stringify(this.fcContact, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[DEVICE_SECURITY] Write fc_contact.json error:', e);
    }

    // 2. Persist to Supabase app_settings table for durable persistence
    try {
      const sb = getSupabase();
      if (sb) {
        await sb.from('app_settings').upsert([
          { key: 'admin_fc_whatsapp_phone', value: this.fcContact.phone },
          { key: 'admin_fc_whatsapp_name', value: this.fcContact.name }
        ], { onConflict: 'key' });
        this.isSupabaseLoaded = true;
      }
    } catch (e) {
      console.warn('[DEVICE_SECURITY] Persist to Supabase app_settings error:', e);
    }

    return this.fcContact;
  }
}

export const deviceSecurityService = new DeviceSecurityService();
