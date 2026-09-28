/**
 * Client-Side Observability & Telemetry Utility
 * 
 * ZERO DISRUPTION & FAILSAFE GUARANTEE:
 * 1. Fully non-blocking - error reporting runs in background and handles all exceptions silently.
 * 2. Strict sanitization, length bounding, and redaction of sensitive key/value pairs.
 * 3. Client-side deduplication to prevent log flooding.
 */

const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'secret',
  'session',
  'service_role',
  'private_key',
];

const MAX_STRING_LENGTHS = {
  name: 100,
  message: 500,
  stack: 2000,
  componentStack: 2000,
  url: 500,
  userAgent: 250,
  extra: 300,
};

// Client-side error deduplication memory (cleared after 5s window)
const recentErrorHashes = new Set<string>();

export function sanitizeString(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') {
    if (val === null || val === undefined) return '';
    try {
      val = String(val);
    } catch {
      return '';
    }
  }
  const str = (val as string).trim();
  return str.length > maxLen ? str.slice(0, maxLen) + '...[TRUNCATED]' : str;
}

export function redactSensitiveData(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return {};
  }

  const cleanObj: Record<string, any> = {};

  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));

    if (isSensitive) {
      cleanObj[key] = '[REDACTED]';
    } else {
      const val = obj[key];
      if (typeof val === 'string') {
        cleanObj[key] = sanitizeString(val, MAX_STRING_LENGTHS.extra);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        cleanObj[key] = val;
      } else {
        cleanObj[key] = '[COMPLEX_OBJECT]';
      }
    }
  }

  return cleanObj;
}

export interface ClientErrorPayload {
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  extra?: Record<string, any>;
}

/**
 * Report a client error non-blockingly to the telemetry endpoint.
 */
export function reportClientError(
  error: unknown,
  extra?: { componentStack?: string; [key: string]: any }
): void {
  try {
    const errObj = error instanceof Error ? error : new Error(String(error || 'Unknown Client Error'));
    const message = sanitizeString(errObj.message || 'No error message provided', MAX_STRING_LENGTHS.message);
    const name = sanitizeString(errObj.name || 'Error', MAX_STRING_LENGTHS.name);

    // Deduplication check: hash message + name to avoid flooding
    const hashKey = `${name}:${message}`;
    if (recentErrorHashes.has(hashKey)) {
      return;
    }
    recentErrorHashes.add(hashKey);
    setTimeout(() => {
      recentErrorHashes.delete(hashKey);
    }, 5000);

    const stack = errObj.stack ? sanitizeString(errObj.stack, MAX_STRING_LENGTHS.stack) : undefined;
    const componentStack = extra?.componentStack
      ? sanitizeString(extra.componentStack, MAX_STRING_LENGTHS.componentStack)
      : undefined;

    let cleanExtra: Record<string, any> | undefined;
    if (extra) {
      const { componentStack: _, ...rest } = extra;
      if (Object.keys(rest).length > 0) {
        cleanExtra = redactSensitiveData(rest);
      }
    }

    const payload: ClientErrorPayload = {
      name,
      message,
      stack,
      componentStack,
      url: typeof window !== 'undefined' ? sanitizeString(window.location.href, MAX_STRING_LENGTHS.url) : '',
      userAgent: typeof navigator !== 'undefined' ? sanitizeString(navigator.userAgent, MAX_STRING_LENGTHS.userAgent) : '',
      timestamp: new Date().toISOString(),
      extra: cleanExtra,
    };

    // Send payload non-blockingly using fetch
    if (typeof fetch !== 'undefined') {
      fetch('/api/telemetry/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch((fetchErr) => {
        // Failsafe: ignore network/telemetry failure
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[TELEMETRY_CLIENT_SILENT_FAIL]', fetchErr);
        }
      });
    }
  } catch (err) {
    // Failsafe: telemetry error must never break UI execution
    console.warn('[TELEMETRY_FAILSAFE] Client error reporting caught exception:', err);
  }
}
