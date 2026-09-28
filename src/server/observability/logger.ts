/**
 * Server-Side Telemetry & Observability Logger
 * 
 * ZERO DISRUPTION GUARANTEE:
 * 1. Non-blocking & failsafe execution.
 * 2. Strict redaction of credentials, tokens, cookies, and secret keys.
 * 3. Strict bounding of error strings and stack traces.
 */

export const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'cookies',
  'password',
  'pin',
  'token',
  'rawtoken',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'secret',
  'session',
  'service_role',
  'service_key',
  'servicekey',
  'private_key',
  'privatekey',
  'credential',
  'credentials',
  'jwt',
  'prompt',
  'systeminstruction',
];

export const MAX_LENGTHS = {
  name: 100,
  message: 500,
  stack: 2000,
  componentStack: 2000,
  url: 500,
  userAgent: 250,
  extra: 300,
  component: 100,
  operation: 100,
  errorCategory: 100,
};

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

export interface StructuredLogPayload {
  timestamp?: string;
  level: LogLevel;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  service?: string;
  component?: string;
  operation?: string;
  durationMs?: number;
  statusCode?: number;
  errorCategory?: string;
  event?: string;
  authRole?: string;
  authorizedEstate?: string;
  endpoint?: string;
  method?: string;
  message: string;
  details?: Record<string, any>;
}

export function truncateString(val: unknown, maxLen = 500): string {
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

export function redactObject(obj: Record<string, any>): Record<string, any> {
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
        // Redact JWT-like strings and tokens
        if (/^eyJ[A-Za-z0-9-_]*/.test(val) || /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(val)) {
          cleanObj[key] = '[REDACTED]';
        } else if (/^Bearer\s+[A-Za-z0-9-_.]+/i.test(val)) {
          cleanObj[key] = 'Bearer [REDACTED]';
        } else {
          cleanObj[key] = truncateString(val, MAX_LENGTHS.extra);
        }
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        cleanObj[key] = val;
      } else if (Array.isArray(val)) {
        cleanObj[key] = val.map((item) => {
          if (typeof item === 'string') return truncateString(item, MAX_LENGTHS.extra);
          if (typeof item === 'number' || typeof item === 'boolean') return item;
          if (item && typeof item === 'object') return redactObject(item);
          return item === undefined || item === null ? item : '[COMPLEX_OBJECT]';
        });
      } else if (val && typeof val === 'object') {
        cleanObj[key] = redactObject(val);
      } else {
        cleanObj[key] = val === undefined || val === null ? val : '[COMPLEX_OBJECT]';
      }
    }
  }

  return cleanObj;
}

/**
 * Emits a structured JSON log entry in a standardized format.
 * Non-blocking, failsafe, and deeply scrubbed of credentials/PII.
 */
export function structuredLog(payload: StructuredLogPayload): void {
  try {
    const correlationId = payload.correlationId || payload.requestId;
    const cleanLog = {
      timestamp: payload.timestamp || new Date().toISOString(),
      level: payload.level,
      correlation_id: correlationId ? truncateString(correlationId, 100) : undefined,
      request_id: payload.requestId ? truncateString(payload.requestId, 100) : undefined,
      trace_id: payload.traceId ? truncateString(payload.traceId, 100) : undefined,
      service: payload.service ? truncateString(payload.service, 50) : undefined,
      component: payload.component ? truncateString(payload.component, MAX_LENGTHS.component) : undefined,
      operation: payload.operation ? truncateString(payload.operation, MAX_LENGTHS.operation) : undefined,
      event: payload.event ? truncateString(payload.event, 100) : undefined,
      duration_ms: payload.durationMs !== undefined ? Math.round(payload.durationMs * 100) / 100 : undefined,
      status_code: payload.statusCode,
      error_category: payload.errorCategory ? truncateString(payload.errorCategory, MAX_LENGTHS.errorCategory) : undefined,
      auth_role: payload.authRole ? truncateString(payload.authRole, 50) : undefined,
      estate_id: payload.authorizedEstate ? truncateString(payload.authorizedEstate, 50) : undefined,
      endpoint: payload.endpoint ? truncateString(payload.endpoint, MAX_LENGTHS.url) : undefined,
      method: payload.method ? truncateString(payload.method, 10) : undefined,
      message: truncateString(payload.message, MAX_LENGTHS.message),
      details: payload.details ? redactObject(payload.details) : undefined,
    };

    const serialized = JSON.stringify(cleanLog);

    switch (payload.level) {
      case 'ERROR':
        console.error(`[APP_OBSERVABILITY_ERROR] ${serialized}`);
        break;
      case 'WARN':
        console.warn(`[APP_OBSERVABILITY_WARN] ${serialized}`);
        break;
      case 'SECURITY':
        console.warn(`[APP_OBSERVABILITY_SECURITY] ${serialized}`);
        break;
      case 'INFO':
      default:
        console.log(`[APP_OBSERVABILITY_INFO] ${serialized}`);
        break;
    }
  } catch (err) {
    console.warn('[STRUCTURED_LOG_FAILSAFE] Failed to output structured log:', err);
  }
}

export function logInfo(message: string, meta?: Omit<StructuredLogPayload, 'level' | 'message'>): void {
  structuredLog({ level: 'INFO', message, ...meta });
}

export function logWarn(message: string, meta?: Omit<StructuredLogPayload, 'level' | 'message'>): void {
  structuredLog({ level: 'WARN', message, ...meta });
}

export function logError(message: string, meta?: Omit<StructuredLogPayload, 'level' | 'message'>): void {
  structuredLog({ level: 'ERROR', message, ...meta });
}

export function logSecurity(message: string, meta?: Omit<StructuredLogPayload, 'level' | 'message'>): void {
  structuredLog({ level: 'SECURITY', message, ...meta });
}

export interface ClientErrorTelemetryEvent {
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
  requestId?: string;
  ip?: string;
  extra?: Record<string, any>;
}

export function logClientErrorEvent(event: ClientErrorTelemetryEvent): void {
  try {
    const cleanEvent = {
      timestamp: event.timestamp || new Date().toISOString(),
      requestId: truncateString(event.requestId || '', 100),
      ip: truncateString(event.ip || '', 100),
      name: truncateString(event.name, MAX_LENGTHS.name),
      message: truncateString(event.message, MAX_LENGTHS.message),
      stack: event.stack ? truncateString(event.stack, MAX_LENGTHS.stack) : undefined,
      componentStack: event.componentStack ? truncateString(event.componentStack, MAX_LENGTHS.componentStack) : undefined,
      url: event.url ? truncateString(event.url, MAX_LENGTHS.url) : undefined,
      userAgent: event.userAgent ? truncateString(event.userAgent, MAX_LENGTHS.userAgent) : undefined,
      extra: event.extra ? redactObject(event.extra) : undefined,
    };

    console.error(`[CLIENT_TELEMETRY_ERROR] ${JSON.stringify(cleanEvent)}`);
  } catch (err) {
    console.warn('[TELEMETRY_LOGGER_FAILSAFE] Failed to log client telemetry error:', err);
  }
}
