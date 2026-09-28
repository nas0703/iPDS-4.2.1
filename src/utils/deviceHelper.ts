/**
 * Device Identification Utility for Client Browser
 * Generates and persists a stable, unique device identifier per hardware/browser profile.
 */

export interface ClientDeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  browser: string;
  screenRes: string;
}

function generateRandomHex(length: number): string {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * P1 soft-merge: adopt the server-validated canonical device_id after a
 * DEVICE_MERGED response. Never called with an unvalidated client-supplied value.
 */
export function setClientDeviceId(deviceId: string): void {
  if (!deviceId || typeof deviceId !== 'string') return;
  try {
    localStorage.setItem('ipds_device_id', deviceId);
  } catch {
    // storage unavailable — device id simply not persisted
  }
}

export function getClientDeviceInfo(): ClientDeviceInfo {
  // 1. Get or generate persistent Device ID
  let deviceId = localStorage.getItem('ipds_device_id');
  if (!deviceId) {
    deviceId = `DEV-${generateRandomHex(4)}-${generateRandomHex(4)}`;
    localStorage.setItem('ipds_device_id', deviceId);
  }

  // 2. Derive friendly platform / OS
  const ua = navigator.userAgent;
  let platform = 'Desktop / Lain-lain';
  let isMobile = false;

  if (/Android/i.test(ua)) {
    platform = 'Android Mobile / Tablet';
    isMobile = true;
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    platform = 'Apple iOS (iPhone/iPad)';
    isMobile = true;
  } else if (/Windows NT/i.test(ua)) {
    platform = 'Windows PC';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    platform = 'Apple macOS';
  } else if (/Linux/i.test(ua)) {
    platform = 'Linux Desktop';
  }

  // 3. Derive browser
  let browser = 'Pelayar Web';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Edg/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/Firefox/i.test(ua)) {
    browser = 'Mozilla Firefox';
  }

  // 4. Stored or default friendly device name
  let deviceName = localStorage.getItem('ipds_device_name');
  if (!deviceName) {
    deviceName = isMobile ? `${browser} (${platform})` : `Komputer Pejabat (${browser})`;
    localStorage.setItem('ipds_device_name', deviceName);
  }

  const screenRes = `${window.screen?.width || 0}x${window.screen?.height || 0}`;

  return {
    deviceId,
    deviceName,
    platform,
    browser,
    screenRes
  };
}

/**
 * P0-16C.1 device credential storage (foundation).
 *
 * `ipds_device_id` remains a NON-SECRET display identifier. The device credential
 * issued by the server at registration is stored separately.
 *
 * SECURITY TRADE-OFF: localStorage is readable by any JavaScript running on the
 * origin and is therefore vulnerable to XSS. It is used here only as the interim
 * store for the issued credential; credential VERIFICATION is not enforced until
 * P0-16C.3. Do NOT treat localStorage as secure storage.
 */
const DEVICE_CREDENTIAL_KEY = 'ipds_device_credential';

export function getDeviceCredential(): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(DEVICE_CREDENTIAL_KEY) : null;
  } catch {
    return null;
  }
}

export function setDeviceCredential(credential: string): void {
  if (!credential || typeof credential !== 'string') return;
  try {
    localStorage.setItem(DEVICE_CREDENTIAL_KEY, credential);
  } catch {
    // Storage unavailable (private mode / quota) — credential simply not persisted.
  }
}

export function clearDeviceCredential(): void {
  try {
    localStorage.removeItem(DEVICE_CREDENTIAL_KEY);
  } catch {
    // ignore
  }
}
