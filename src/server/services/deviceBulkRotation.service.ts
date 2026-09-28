import { getSupabase } from '../db.js';
import { auditService } from './audit.service.js';
import {
  issueExistingDeviceCredential,
  getRegisteredDeviceById,
  isDeviceAuthorizedForEstate,
  isValidEstateId,
  isStrictDeviceEnforcementEnabled,
  type DeviceCredentialActor,
  type IssuedExistingDeviceCredential,
  type RegisteredDeviceRecord
} from './deviceSecurity.service.js';

/**
 * P1 — Operationally safe bulk device-credential rotation.
 *
 * Additive to the existing single-device rotation. It reuses the existing
 * authorization primitives (issueExistingDeviceCredential -> requireDeviceAdmin
 * + canonical Super Admin / estate SSOT) and never changes P0 behavior.
 *
 * Idempotency: each operation has a caller-supplied operation_id. Per-device
 * results are persisted durably (reusing the existing app_settings KV), so a
 * retried request with the SAME operation_id never rotates a device twice.
 * Plaintext credentials are NEVER persisted — only status/version metadata.
 */

export type BulkDeviceStatus = 'PENDING' | 'ROTATED' | 'FAILED';

export interface BulkDeviceRotationEntry {
  status: BulkDeviceStatus;
  code: string;
  baselineCredentialVersion?: number;
  credentialVersion?: number;
  rotatedAt?: string;
  error?: string;
  updatedAt?: string;
}

export interface BulkRotationOperationRecord {
  operationId: string;
  createdAt: string;
  updatedAt: string;
  actorName?: string;
  requestedDeviceIds: string[];
  devices: Record<string, BulkDeviceRotationEntry>;
}

export interface BulkRotationStore {
  get(operationId: string): Promise<BulkRotationOperationRecord | null>;
  save(record: BulkRotationOperationRecord): Promise<void>;
}

export interface BulkRotationDeviceResult {
  deviceId: string;
  status: 'ROTATED' | 'ALREADY_ROTATED' | 'FAILED';
  credentialState: 'CREDENTIAL_ROTATED' | 'CREDENTIAL_ALREADY_ROTATED' | 'CREDENTIAL_ROTATION_FAILED';
  code: string;
  credentialVersion?: number;
  rotatedAt?: string;
  credential?: string;
  credentialRecoverable: boolean;
  error?: string;
}

export type BulkRotationErrorCode =
  | 'INVALID_OPERATION_ID'
  | 'INVALID_DEVICE_LIST'
  | 'OPERATION_SCOPE_MISMATCH'
  | 'STORE_UNAVAILABLE'
  | 'SYSTEMIC_ABORT';

export interface BulkRotationOutcome {
  ok: boolean;
  code?: BulkRotationErrorCode;
  error?: string;
  operationId?: string;
  resumed: boolean;
  aborted: boolean;
  abortReason?: string;
  idempotencyRecorded: boolean;
  resumedFrom?: string;
  enforcementActive: boolean;
  enforcementState: 'DEVICE_LOGIN_ENFORCEMENT_ACTIVE' | 'DEVICE_LOGIN_ENFORCEMENT_INACTIVE';
  results: BulkRotationDeviceResult[];
  summary?: { requested: number; rotated: number; alreadyRotated: number; failed: number; pending: number };
}

export interface BulkRotationDeps {
  rotate: (deviceId: string, actor: DeviceCredentialActor) => Promise<IssuedExistingDeviceCredential>;
  findDevice: (deviceId: string) => Promise<RegisteredDeviceRecord | null>;
  isEstateGranted: (deviceId: string, estateId: string) => Promise<boolean>;
  store: BulkRotationStore;
  now: () => string;
  enforcementActive: () => boolean;
  auditRotated: (info: {
    operationId: string;
    deviceId: string;
    estateId?: string;
    credentialVersion?: number;
    actor: DeviceCredentialActor;
  }) => void;
}

const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const MAX_DEVICES_PER_OPERATION = 200;
const APP_SETTINGS_KEY_PREFIX = 'device_rotation_op:';

class StoreUnavailableError extends Error {}

/**
 * Durable idempotency store reusing the existing app_settings key/value table
 * (no migration). Fails closed when the database is unavailable.
 */
export const supabaseBulkRotationStore: BulkRotationStore = {
  async get(operationId: string): Promise<BulkRotationOperationRecord | null> {
    const supabase = getSupabase();
    if (!supabase) throw new StoreUnavailableError('CREDENTIAL_STORE_UNAVAILABLE');
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', `${APP_SETTINGS_KEY_PREFIX}${operationId}`)
      .maybeSingle();
    if (error) throw new StoreUnavailableError('CREDENTIAL_STORE_UNAVAILABLE');
    if (!data || !data.value) return null;

    const value = data.value as BulkRotationOperationRecord;
    if (!value || typeof value !== 'object' || !value.devices || !Array.isArray(value.requestedDeviceIds)) {
      throw new StoreUnavailableError('CREDENTIAL_STORE_CORRUPT');
    }
    return value;
  },
  async save(record: BulkRotationOperationRecord): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new StoreUnavailableError('CREDENTIAL_STORE_UNAVAILABLE');
    const { error } = await supabase.from('app_settings').upsert(
      {
        key: `${APP_SETTINGS_KEY_PREFIX}${record.operationId}`,
        value: record,
        updated_at: record.updatedAt
      },
      { onConflict: 'key' }
    );
    if (error) throw new StoreUnavailableError('CREDENTIAL_STORE_UNAVAILABLE');
  }
};

const DEFAULT_BULK_ROTATION_DEPS: BulkRotationDeps = {
  rotate: issueExistingDeviceCredential,
  findDevice: getRegisteredDeviceById,
  isEstateGranted: isDeviceAuthorizedForEstate,
  store: supabaseBulkRotationStore,
  now: () => new Date().toISOString(),
  enforcementActive: isStrictDeviceEnforcementEnabled,
  auditRotated: ({ operationId, deviceId, estateId, credentialVersion, actor }) => {
    // Note: no credential material is ever placed in audit details.
    auditService.record({
      action: 'DEVICE_CREDENTIAL_ROTATED',
      resource: 'devices/bulk-rotation',
      resourceId: deviceId,
      userName: actor?.name || 'Pentadbir',
      role: actor?.role || undefined,
      authorizedEstate: estateId,
      result: 'SUCCESS',
      details: { operationId, credentialVersion, estateId }
    });
  }
};

function failResult(deviceId: string, code: string, error?: string): BulkRotationDeviceResult {
  return {
    deviceId,
    status: 'FAILED',
    credentialState: 'CREDENTIAL_ROTATION_FAILED',
    code,
    credentialRecoverable: false,
    error
  };
}

export async function runBulkDeviceCredentialRotation(
  params: { operationId: string; deviceIds: string[]; actor: DeviceCredentialActor },
  deps: BulkRotationDeps = DEFAULT_BULK_ROTATION_DEPS
): Promise<BulkRotationOutcome> {
  const enforcementActive = !!deps.enforcementActive();
  const enforcementState = enforcementActive
    ? 'DEVICE_LOGIN_ENFORCEMENT_ACTIVE'
    : 'DEVICE_LOGIN_ENFORCEMENT_INACTIVE';

  const base: BulkRotationOutcome = {
    ok: false,
    resumed: false,
    aborted: false,
    idempotencyRecorded: false,
    enforcementActive,
    enforcementState,
    results: []
  };

  const operationId = String(params?.operationId || '').trim();
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    return { ...base, code: 'INVALID_OPERATION_ID', error: 'operation_id tidak sah (8-128 aksara alfanumerik/._:-).' };
  }

  const requested = Array.from(
    new Set((Array.isArray(params?.deviceIds) ? params.deviceIds : []).map((d) => String(d || '').trim()).filter(Boolean))
  );
  if (requested.length === 0 || requested.length > MAX_DEVICES_PER_OPERATION) {
    return { ...base, code: 'INVALID_DEVICE_LIST', error: `Senarai peranti tidak sah (1-${MAX_DEVICES_PER_OPERATION}).` };
  }

  // 1. Load or create the durable operation record.
  let record: BulkRotationOperationRecord | null = null;
  try {
    record = await deps.store.get(operationId);
  } catch {
    return { ...base, code: 'STORE_UNAVAILABLE', error: 'Storan idempotensi tidak tersedia. Tiada putaran dilakukan.' };
  }

  const recordExisted = !!record;
  const operationCreatedAt = record?.createdAt;
  const requestedSet = new Set(requested);
  if (record) {
    const sameSet =
      record.requestedDeviceIds.length === requested.length &&
      record.requestedDeviceIds.every((d) => requestedSet.has(d));
    if (!sameSet) {
      return {
        ...base,
        operationId,
        resumed: true,
        code: 'OPERATION_SCOPE_MISMATCH',
        error: 'operation_id ini telah digunakan dengan senarai peranti yang berbeza.'
      };
    }
  } else {
    const now = deps.now();
    record = {
      operationId,
      createdAt: now,
      updatedAt: now,
      actorName: params.actor?.name || undefined,
      requestedDeviceIds: requested,
      devices: {}
    };
    for (const d of requested) record.devices[d] = { status: 'PENDING', code: 'PENDING', updatedAt: now };
    try {
      await deps.store.save(record);
    } catch {
      return { ...base, operationId, code: 'STORE_UNAVAILABLE', error: 'Storan idempotensi tidak tersedia. Tiada putaran dilakukan.' };
    }
  }

  // 2. Process each requested device independently.
  const results: BulkRotationDeviceResult[] = [];
  let aborted = false;
  let abortReason: string | undefined;
  let idempotencyRecorded = true;

  const persist = async (): Promise<boolean> => {
    record!.updatedAt = deps.now();
    try {
      await deps.store.save(record!);
      return true;
    } catch {
      idempotencyRecorded = false;
      return false;
    }
  };

  for (const deviceId of requested) {
    const entry: BulkDeviceRotationEntry = record.devices[deviceId] || { status: 'PENDING', code: 'PENDING' };

    // Already rotated by THIS operation -> never rotate again.
    if (entry.status === 'ROTATED') {
      results.push({
        deviceId,
        status: 'ALREADY_ROTATED',
        credentialState: 'CREDENTIAL_ALREADY_ROTATED',
        code: entry.code || 'ALREADY_ROTATED',
        credentialVersion: entry.credentialVersion,
        rotatedAt: entry.rotatedAt,
        credentialRecoverable: false
      });
      continue;
    }

    // Readiness (never auto-repair).
    let device: RegisteredDeviceRecord | null = null;
    try {
      device = await deps.findDevice(deviceId);
    } catch {
      aborted = true;
      abortReason = 'DEVICE_READ_FAILED';
      break;
    }
    if (!device || !device.device_id) {
      entry.status = 'FAILED';
      entry.code = 'UNKNOWN_DEVICE';
      entry.updatedAt = deps.now();
      if (!(await persist())) { aborted = true; abortReason = 'IDEMPOTENCY_RECORD_FAILED'; break; }
      results.push(failResult(deviceId, 'UNKNOWN_DEVICE', 'Peranti tidak dijumpai.'));
      continue;
    }
    if (device.status !== 'APPROVED') {
      entry.status = 'FAILED';
      entry.code = 'DEVICE_NOT_APPROVED';
      entry.updatedAt = deps.now();
      if (!(await persist())) { aborted = true; abortReason = 'IDEMPOTENCY_RECORD_FAILED'; break; }
      results.push(failResult(deviceId, 'DEVICE_NOT_APPROVED', 'Peranti bukan status APPROVED.'));
      continue;
    }
    const estateId = String(device.estate_id || '').trim().toUpperCase();
    if (!isValidEstateId(estateId)) {
      entry.status = 'FAILED';
      entry.code = 'INVALID_ESTATE';
      entry.updatedAt = deps.now();
      if (!(await persist())) { aborted = true; abortReason = 'IDEMPOTENCY_RECORD_FAILED'; break; }
      results.push(failResult(deviceId, 'INVALID_ESTATE', 'Ladang peranti tidak sah.'));
      continue;
    }

    let granted = false;
    try {
      granted = await deps.isEstateGranted(deviceId, estateId);
    } catch {
      aborted = true;
      abortReason = 'ESTATE_GRANT_READ_FAILED';
      break;
    }
    if (!granted) {
      entry.status = 'FAILED';
      entry.code = 'ESTATE_GRANT_MISSING';
      entry.updatedAt = deps.now();
      if (!(await persist())) { aborted = true; abortReason = 'IDEMPOTENCY_RECORD_FAILED'; break; }
      results.push(failResult(deviceId, 'ESTATE_GRANT_MISSING', 'Peranti tiada akses ACTIVE ke ladangnya.'));
      continue;
    }

    // Crash-safety anchor: capture the pre-rotation version durably BEFORE rotating.
    const currentVersion = Number(device.credential_version ?? 0) || 0;
    if (entry.baselineCredentialVersion === undefined) {
      entry.baselineCredentialVersion = currentVersion;
      entry.updatedAt = deps.now();
      if (!(await persist())) {
        aborted = true;
        abortReason = 'IDEMPOTENCY_RECORD_FAILED';
        break;
      }
    } else if (currentVersion > entry.baselineCredentialVersion) {
      // A rotation already happened after our baseline (e.g. response lost /
      // crash before recording). Do NOT rotate again; report as already rotated.
      entry.status = 'ROTATED';
      entry.code = 'ROTATED_UNVERIFIED';
      entry.credentialVersion = currentVersion;
      entry.rotatedAt = device.credential_rotated_at || undefined;
      entry.updatedAt = deps.now();
      if (!(await persist())) { aborted = true; abortReason = 'IDEMPOTENCY_RECORD_FAILED'; break; }
      results.push({
        deviceId,
        status: 'ALREADY_ROTATED',
        credentialState: 'CREDENTIAL_ALREADY_ROTATED',
        code: 'ROTATED_UNVERIFIED',
        credentialVersion: currentVersion,
        rotatedAt: device.credential_rotated_at || undefined,
        credentialRecoverable: false
      });
      continue;
    }

    // Rotate using the EXISTING mechanism (authorization enforced inside).
    let outcome: IssuedExistingDeviceCredential;
    try {
      outcome = await deps.rotate(deviceId, params.actor);
    } catch {
      aborted = true;
      abortReason = 'UNEXPECTED_ROTATION_ERROR';
      break;
    }

    if (!outcome.ok) {
      // DB outage is systemic -> stop; do not silently continue.
      if (outcome.code === 'DB_UNAVAILABLE') {
        aborted = true;
        abortReason = 'DB_UNAVAILABLE';
        break;
      }
      entry.status = 'FAILED';
      entry.code = outcome.code;
      entry.updatedAt = deps.now();
      if (!(await persist())) { aborted = true; abortReason = 'IDEMPOTENCY_RECORD_FAILED'; break; }
      results.push(failResult(deviceId, outcome.code));
      continue;
    }

    entry.status = 'ROTATED';
    entry.code = 'ROTATED';
    entry.credentialVersion = outcome.credentialVersion;
    entry.rotatedAt = outcome.rotatedAt;
    entry.updatedAt = deps.now();
    if (!(await persist())) {
      // Rotation succeeded; the credential is still delivered once. The
      // crash-safety version anchor prevents a double-rotation on retry.
      aborted = true;
      abortReason = 'IDEMPOTENCY_RECORD_FAILED';
    }

    try {
      deps.auditRotated({
        operationId,
        deviceId,
        estateId,
        credentialVersion: outcome.credentialVersion,
        actor: params.actor
      });
    } catch {
      /* audit is fail-safe */
    }

    results.push({
      deviceId,
      status: 'ROTATED',
      credentialState: 'CREDENTIAL_ROTATED',
      code: 'OK',
      credentialVersion: outcome.credentialVersion,
      rotatedAt: outcome.rotatedAt,
      credential: outcome.credential,
      credentialRecoverable: false
    });

    if (aborted) break;
  }

  const pending = requested.filter((d) => (record!.devices[d]?.status || 'PENDING') === 'PENDING').length;
  const summary = {
    requested: requested.length,
    rotated: results.filter((r) => r.status === 'ROTATED').length,
    alreadyRotated: results.filter((r) => r.status === 'ALREADY_ROTATED').length,
    failed: results.filter((r) => r.status === 'FAILED').length,
    pending
  };

  return {
    ok: true,
    operationId,
    resumed: recordExisted,
    resumedFrom: recordExisted ? operationCreatedAt : undefined,
    aborted,
    abortReason,
    idempotencyRecorded,
    enforcementActive,
    enforcementState,
    results,
    summary
  };
}
