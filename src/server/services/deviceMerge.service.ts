import { getSupabase } from '../db.js';
import { auditService } from './audit.service.js';
import {
  getRegisteredDeviceById,
  type DeviceCredentialActor,
  type RegisteredDeviceRecord
} from './deviceSecurity.service.js';

/**
 * P1 — Device soft-merge orchestration.
 *
 * The authoritative, atomic merge runs in the SQL function
 * public.merge_registered_devices(...) (migration 20260927): row locks,
 * same-estate / APPROVED / not-already-merged guards, archive of originals,
 * duplicate status='REVOKED', merged_into set. This service adds a fast,
 * testable pre-validation layer and never exposes credential material.
 */

export const MERGE_OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export type DeviceMergeErrorCode =
  | 'INVALID_OPERATION_ID'
  | 'CANONICAL_REQUIRED'
  | 'DUPLICATES_REQUIRED'
  | 'CANONICAL_NOT_FOUND'
  | 'CANONICAL_NOT_APPROVED'
  | 'CANONICAL_IS_DUPLICATE'
  | 'DUPLICATE_NOT_FOUND'
  | 'DUPLICATE_NOT_APPROVED'
  | 'DUPLICATE_ALREADY_MERGED'
  | 'SELF_MERGE'
  | 'CROSS_ESTATE'
  | 'DB_UNAVAILABLE'
  | 'MERGE_FAILED';

export interface DeviceMergeRequest {
  operationId: string;
  canonicalDeviceId: string;
  duplicateDeviceIds: string[];
  actor?: DeviceCredentialActor;
}

export interface DeviceMergeResult {
  ok: boolean;
  code?: DeviceMergeErrorCode;
  error?: string;
  operationId?: string;
  canonicalDeviceId?: string;
  estateId?: string;
  mergedDuplicateIds?: string[];
  alreadyMergedIds?: string[];
  mergedAt?: string;
  idempotent?: boolean;
}

export interface RpcMergeData {
  estate_id?: string;
  merged_duplicate_ids?: string[];
  already_merged_ids?: string[];
  merged_at?: string;
}

export interface DeviceMergeDeps {
  getDevice: (deviceId: string) => Promise<RegisteredDeviceRecord | null>;
  rpcMerge: (args: {
    p_operation_id: string;
    p_canonical_device_id: string;
    p_duplicate_device_ids: string[];
  }) => Promise<{ data: RpcMergeData | null; error: { message: string } | null }>;
  audit: (info: {
    actor?: DeviceCredentialActor;
    operationId: string;
    canonicalDeviceId: string;
    estateId?: string;
    mergedDuplicateIds: string[];
    mergedAt?: string;
  }) => void;
  now: () => string;
}

function fail(code: DeviceMergeErrorCode, error?: string): DeviceMergeResult {
  return { ok: false, code, error };
}

/**
 * Pure, side-effect-free validation of a merge selection. Mirrors the SQL
 * guards so failures are fast and directly testable.
 */
export function validateMergeSelection(
  canonical: RegisteredDeviceRecord | null,
  duplicateIds: string[],
  duplicates: Map<string, RegisteredDeviceRecord | null>
): DeviceMergeResult {
  if (!canonical || !canonical.device_id) return fail('CANONICAL_NOT_FOUND', 'Peranti kanonikal tidak dijumpai.');
  if (canonical.status !== 'APPROVED') return fail('CANONICAL_NOT_APPROVED', 'Peranti kanonikal mesti APPROVED.');
  if (canonical.merged_into) return fail('CANONICAL_IS_DUPLICATE', 'Peranti kanonikal telah digabungkan ke peranti lain.');

  const canonicalEstate = String(canonical.estate_id || '').trim().toUpperCase();

  for (const id of duplicateIds) {
    if (id === canonical.device_id) return fail('SELF_MERGE', 'Peranti kanonikal tidak boleh menjadi duplikat dirinya.');
    const dup = duplicates.get(id);
    if (!dup || !dup.device_id) return fail('DUPLICATE_NOT_FOUND', `Peranti duplikat tidak dijumpai: ${id}`);
    if (dup.merged_into) return fail('DUPLICATE_ALREADY_MERGED', `Peranti duplikat telah digabungkan: ${id}`);
    if (dup.status !== 'APPROVED') return fail('DUPLICATE_NOT_APPROVED', `Peranti duplikat mesti APPROVED: ${id}`);
    if (String(dup.estate_id || '').trim().toUpperCase() !== canonicalEstate) {
      return fail('CROSS_ESTATE', `Gabungan merentas ladang tidak dibenarkan: ${id}`);
    }
  }
  return { ok: true };
}

function mapSqlError(message: string): DeviceMergeResult {
  const m = String(message || '');
  const known: Array<[string, DeviceMergeErrorCode]> = [
    ['MERGE_INVALID_OPERATION_ID', 'INVALID_OPERATION_ID'],
    ['MERGE_CANONICAL_REQUIRED', 'CANONICAL_REQUIRED'],
    ['MERGE_DUPLICATES_REQUIRED', 'DUPLICATES_REQUIRED'],
    ['MERGE_CANONICAL_NOT_FOUND', 'CANONICAL_NOT_FOUND'],
    ['MERGE_CANONICAL_NOT_APPROVED', 'CANONICAL_NOT_APPROVED'],
    ['MERGE_CANONICAL_IS_DUPLICATE', 'CANONICAL_IS_DUPLICATE'],
    ['MERGE_DUPLICATE_NOT_FOUND', 'DUPLICATE_NOT_FOUND'],
    ['MERGE_DUPLICATE_NOT_APPROVED', 'DUPLICATE_NOT_APPROVED'],
    ['MERGE_DUPLICATE_ALREADY_MERGED', 'DUPLICATE_ALREADY_MERGED'],
    ['MERGE_SELF_MERGE', 'SELF_MERGE'],
    ['MERGE_CROSS_ESTATE', 'CROSS_ESTATE']
  ];
  for (const [needle, code] of known) {
    if (m.includes(needle)) return fail(code, 'Gabungan peranti ditolak oleh pengawal keselamatan.');
  }
  return fail('MERGE_FAILED', 'Gabungan peranti gagal.');
}

const DEFAULT_DEPS: DeviceMergeDeps = {
  getDevice: getRegisteredDeviceById,
  rpcMerge: async (args) => {
    const supabase = getSupabase();
    if (!supabase) return { data: null, error: { message: 'DB_UNAVAILABLE' } };
    const { data, error } = await supabase.rpc('merge_registered_devices', args);
    return { data, error };
  },
  audit: ({ actor, operationId, canonicalDeviceId, estateId, mergedDuplicateIds, mergedAt }) => {
    // Note: device ids only — never credential material.
    auditService.record({
      action: 'DEVICE_MERGE',
      resource: 'devices/merge',
      resourceId: canonicalDeviceId,
      userName: actor?.name || 'Pentadbir',
      role: actor?.role || undefined,
      authorizedEstate: estateId,
      result: 'SUCCESS',
      details: { operationId, canonicalDeviceId, mergedDuplicateIds, mergedAt }
    });
  },
  now: () => new Date().toISOString()
};

export async function mergeDevices(
  request: DeviceMergeRequest,
  deps: DeviceMergeDeps = DEFAULT_DEPS
): Promise<DeviceMergeResult> {
  const operationId = String(request?.operationId || '').trim();
  if (!MERGE_OPERATION_ID_PATTERN.test(operationId)) {
    return fail('INVALID_OPERATION_ID', 'operation_id tidak sah (8-128 aksara).');
  }

  const canonicalDeviceId = String(request?.canonicalDeviceId || '').trim();
  if (!canonicalDeviceId) return fail('CANONICAL_REQUIRED', 'Peranti kanonikal diperlukan.');

  const duplicateDeviceIds = Array.from(
    new Set((Array.isArray(request?.duplicateDeviceIds) ? request.duplicateDeviceIds : []).map((d) => String(d || '').trim()).filter(Boolean))
  );
  if (duplicateDeviceIds.length === 0) return fail('DUPLICATES_REQUIRED', 'Sekurang-kurangnya satu peranti duplikat diperlukan.');

  // Pre-validation (defense in depth; SQL remains authoritative).
  const canonical = await deps.getDevice(canonicalDeviceId).catch(() => null);
  const duplicates = new Map<string, RegisteredDeviceRecord | null>();
  for (const id of duplicateDeviceIds) {
    duplicates.set(id, await deps.getDevice(id).catch(() => null));
  }
  const pre = validateMergeSelection(canonical, duplicateDeviceIds, duplicates);
  if (!pre.ok) return pre;

  const { data, error } = await deps.rpcMerge({
    p_operation_id: operationId,
    p_canonical_device_id: canonicalDeviceId,
    p_duplicate_device_ids: duplicateDeviceIds
  });

  if (error) {
    const mapped = mapSqlError(error.message);
    return mapped.code === 'MERGE_FAILED' ? fail('DB_UNAVAILABLE', 'Storan peranti tidak tersedia.') : mapped;
  }

  const estateId = data?.estate_id || canonical?.estate_id;
  const mergedDuplicateIds: string[] = Array.isArray(data?.merged_duplicate_ids) ? data.merged_duplicate_ids : [];
  const alreadyMergedIds: string[] = Array.isArray(data?.already_merged_ids) ? data.already_merged_ids : [];

  try {
    deps.audit({ actor: request.actor, operationId, canonicalDeviceId, estateId, mergedDuplicateIds, mergedAt: data?.merged_at });
  } catch {
    /* audit is fail-safe */
  }

  return {
    ok: true,
    operationId,
    canonicalDeviceId,
    estateId,
    mergedDuplicateIds,
    alreadyMergedIds,
    mergedAt: data?.merged_at || deps.now(),
    idempotent: mergedDuplicateIds.length === 0 && alreadyMergedIds.length > 0
  };
}

/**
 * Strip ALL credential material before a device record crosses the API boundary.
 * credential_hash is never exposed; only a boolean presence flag is returned.
 */
export function toSafeMergeCandidate(device: RegisteredDeviceRecord): Record<string, any> {
  return {
    device_id: device.device_id,
    device_name: device.device_name,
    estate_id: device.estate_id,
    status: device.status,
    operator_name: device.operator_name,
    role: device.role,
    credential_present: !!(device.credential_hash && String(device.credential_hash).length > 0),
    credential_version: device.credential_version ?? null,
    credential_rotated_at: device.credential_rotated_at ?? null,
    created_at: device.created_at,
    last_seen_at: device.last_seen_at,
    user_agent: device.user_agent,
    ip_address: device.ip_address,
    merged_into: device.merged_into ?? null,
    merged_at: device.merged_at ?? null
  };
}
