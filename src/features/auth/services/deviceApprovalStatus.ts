/**
 * P0-16 device approval status check (client-side, shared).
 *
 * Single source of truth for the DeviceApprovalModal status polling so the
 * manual "Semak Status Sekarang" button and the automatic poll apply the exact
 * same APPROVED / PENDING / error handling.
 *
 * Security notes:
 *   - Read-only: only calls the pre-auth, status-only GET
 *     /api/devices/enrollment-status (which remains rate-limited server-side).
 *   - No auth/approval logic lives here; it never approves a device and never
 *     handles capabilities, PINs or tokens.
 *   - Error messages are non-sensitive (no capability/PII/device internals).
 */

export type DeviceApprovalStatus = 'APPROVED' | 'PENDING' | 'UNREGISTERED';

export interface DeviceApprovalCheckResult {
  status: DeviceApprovalStatus;
  httpStatus?: number;
  retryable: boolean;
  error?: string;
}

export interface DeviceApprovalCheckHandlers {
  onApproved: () => void;
  onPending: () => void;
  onError: (message: string) => void;
}

export const DEVICE_APPROVAL_STATUS_ENDPOINT = '/api/devices/enrollment-status';

/**
 * Poll cadence. The enrollment-status endpoint shares the server auth rate
 * limiter (10 requests / minute / client). 3s polling (20/min) exhausted the
 * budget and caused both the poll and the manual button to receive HTTP 429,
 * so the modal appeared frozen. 10s keeps us at 6/min, leaving headroom for
 * manual checks.
 */
export const DEVICE_APPROVAL_POLL_INTERVAL_MS = 10 * 1000;

export function normalizeDeviceApprovalStatus(raw: unknown): DeviceApprovalStatus {
  const value = String(raw ?? '').trim().toUpperCase();
  if (value === 'APPROVED' || value === 'PENDING' || value === 'UNREGISTERED') return value;
  return 'PENDING';
}

export function isDeviceApproved(raw: unknown): boolean {
  return normalizeDeviceApprovalStatus(raw) === 'APPROVED';
}

/**
 * Fetch the current device approval status. Never throws; always resolves to a
 * result with a safe, user-facing error when the check could not be completed.
 */
export async function checkDeviceApprovalStatus(
  deviceId: string,
  fetchImpl: typeof fetch = fetch
): Promise<DeviceApprovalCheckResult> {
  const id = String(deviceId || '').trim();
  if (!id) {
    return { status: 'PENDING', retryable: false, error: 'ID peranti tidak tersedia. Sila muat semula halaman.' };
  }

  try {
    const res = await fetchImpl(
      `${DEVICE_APPROVAL_STATUS_ENDPOINT}?deviceId=${encodeURIComponent(id)}`,
      { headers: { Accept: 'application/json' } }
    );

    let data: { status?: DeviceApprovalStatus; success?: boolean; error?: string } | null = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.status === 429) {
      return {
        status: 'PENDING',
        httpStatus: 429,
        retryable: true,
        error: 'Sistem sedang sibuk menyemak status. Sila tunggu sebentar dan cuba lagi.'
      };
    }

    if (!res.ok) {
      return {
        status: 'PENDING',
        httpStatus: res.status,
        retryable: true,
        error: 'Gagal menyemak status peranti. Sila cuba lagi.'
      };
    }

    return {
      status: normalizeDeviceApprovalStatus(data?.status),
      httpStatus: res.status,
      retryable: false
    };
  } catch {
    return {
      status: 'PENDING',
      retryable: true,
      error: 'Ralat sambungan semasa menyemak status peranti. Sila cuba lagi.'
    };
  }
}

/**
 * Runs one status check and dispatches to the caller's handlers. This is the
 * single function used by BOTH the manual button and the automatic poll, which
 * guarantees identical APPROVED handling.
 */
export async function runDeviceApprovalCheck(
  deviceId: string,
  handlers: DeviceApprovalCheckHandlers,
  fetchImpl: typeof fetch = fetch
): Promise<DeviceApprovalCheckResult> {
  const result = await checkDeviceApprovalStatus(deviceId, fetchImpl);

  if (result.status === 'APPROVED') {
    handlers.onApproved();
  } else if (result.error) {
    handlers.onError(result.error);
  } else {
    handlers.onPending();
  }

  return result;
}
