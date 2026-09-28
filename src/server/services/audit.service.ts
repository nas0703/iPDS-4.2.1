/**
 * iPDS v3.8 — Enterprise Structured Audit Trail Service
 * 
 * STRICT COMPLIANCE RULES:
 * 1. Zero disruption to FpmSystem v3.5 - does NOT alter any shared operational tables.
 * 2. Fail-safe design - failures in audit recording NEVER break or interrupt business transactions.
 * 3. Append-only - no API or method allows updating or deleting historical audit records.
 * 4. Automatic secret scrubbing - passwords, PINs, JWTs, cookies, and keys are NEVER recorded.
 */

import crypto from 'crypto';
import { getSupabase } from '../db.js';

export type AuditAction = 
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'TOKEN_REFRESH'
  | 'SESSION_REVOKE'
  | 'AUTHORIZATION_DENIED'
  | 'ESTATE_ACCESS_DENIED'
  | 'ROLE_CHANGE'
  | 'USER_CHANGE'
  | 'ADMIN_OPERATION'
  | 'SENSITIVE_RECORD_CREATE'
  | 'SENSITIVE_RECORD_UPDATE'
  | 'SENSITIVE_RECORD_DELETE'
  | 'INVENTORY_CHANGE'
  | 'FFB/HARVEST CORRECTION'
  | 'AI_SENSITIVE_OPERATION'
  | 'LOGIN_BLOCKED_UNREGISTERED_DEVICE'
  | 'LOGIN_BLOCKED_DEVICE_NOT_AUTHORIZED'
  | 'DEVICE_AUTO_APPROVED'
  | 'DEVICE_BOOTSTRAP_APPROVED'
  | 'DEVICE_REGISTRATION_REQUESTED'
  | 'DEVICE_APPROVED'
  | 'DEVICE_REVOKED'
  | 'DEVICE_CREDENTIAL_ROTATED'
  | 'DEVICE_MERGE'
  | 'IMPERSONATION_START'
  | 'IMPERSONATION_END';

export type AuditResult = 'SUCCESS' | 'FAILURE' | 'DENIED' | 'ERROR' | 'BLOCKED' | 'PENDING';

export interface AuditEventPayload {
  requestId?: string;
  userId?: string;
  userName?: string;
  role?: string;
  authorizedEstate?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  result: AuditResult;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any> | string | null;
  errorMessage?: string;
}

export interface StoredAuditEvent extends AuditEventPayload {
  id: string;
  timestamp: string;
}

// Banned key names for secret scrubbing
const SENSITIVE_KEYS = new Set([
  'password',
  'pin',
  'jwt',
  'token',
  'rawtoken',
  'authorization',
  'cookie',
  'cookies',
  'secret',
  'service_role',
  'apikey',
  'api_key',
  'supabase_anon_key',
  'supabase_service_role_key',
  'gemini_api_key',
  'credential',
  'credentials'
]);

export interface AuditUserContext {
  sub?: string;
  app_metadata?: {
    operator_id?: string;
    app_role?: string;
    estate_id?: string;
    [key: string]: unknown;
  };
  user_metadata?: {
    operator_name?: string;
    [key: string]: unknown;
  };
}

export interface AuditReqContext {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: AuditUserContext | null;
  requestId?: string;
  originalUrl?: string;
  method?: string;
}

/**
 * Deep sanitization function to scrub all credentials, keys, and tokens from audit payloads
 */
export function scrubSensitiveData<T = unknown>(input: T): T {
  if (input === null || input === undefined) return input;
  
  if (typeof input === 'string') {
    // Redact JWT-like strings (header.payload.signature)
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(input)) {
      return '[REDACTED_JWT]' as unknown as T;
    }
    // Redact Bearer tokens
    if (/^Bearer\s+[A-Za-z0-9-_.]+/i.test(input)) {
      return 'Bearer [REDACTED_TOKEN]' as unknown as T;
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => scrubSensitiveData(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const cleanObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('pin')) {
        cleanObj[key] = '[REDACTED]';
      } else {
        cleanObj[key] = scrubSensitiveData(value);
      }
    }
    return cleanObj as unknown as T;
  }

  return input;
}

class AuditService {
  private static instance: AuditService;
  private readonly maxInMemoryEntries = 2000;
  private inMemoryLogs: StoredAuditEvent[] = [];

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Records a structured audit event.
   * Completely non-blocking and fail-safe.
   */
  public record(payload: AuditEventPayload): StoredAuditEvent {
    try {
      const auditEvent: StoredAuditEvent = {
        id: `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        timestamp: new Date().toISOString(),
        requestId: payload.requestId || `req_${crypto.randomBytes(6).toString('hex')}`,
        userId: payload.userId || 'anonymous',
        userName: payload.userName || 'Unknown User',
        role: payload.role || 'anonymous',
        authorizedEstate: payload.authorizedEstate || 'FPM_TUNGGAL',
        action: payload.action,
        resource: payload.resource,
        resourceId: payload.resourceId,
        result: payload.result,
        beforeState: payload.beforeState ? scrubSensitiveData(payload.beforeState) : null,
        afterState: payload.afterState ? scrubSensitiveData(payload.afterState) : null,
        ip: payload.ip || '127.0.0.1',
        userAgent: payload.userAgent || 'system',
        details: payload.details ? scrubSensitiveData(payload.details) : null,
        errorMessage: payload.errorMessage ? String(payload.errorMessage) : undefined
      };

      // Append to bounded in-memory buffer
      this.inMemoryLogs.unshift(auditEvent);
      if (this.inMemoryLogs.length > this.maxInMemoryEntries) {
        this.inMemoryLogs.pop();
      }

      // Safe non-blocking async persist to isolated audit table if Supabase is active
      this.persistToSupabaseAsync(auditEvent);

      return auditEvent;
    } catch (err) {
      // Fail-safe guarantee: Audit failures must NEVER throw or crash requests
      console.warn('[AuditService] Non-fatal error recording audit event:', err);
      return {
        id: `aud_fallback_${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...payload
      };
    }
  }

  /**
   * Safe asynchronous persist to isolated Supabase audit log table
   * Does NOT alter or impact any shared v3.5 operational tables.
   */
  private async persistToSupabaseAsync(event: StoredAuditEvent): Promise<void> {
    try {
      const supabase = getSupabase();
      if (!supabase) return;

      // Note: security_audit_logs is an isolated additive table, not a shared operational table
      await supabase
        .from('security_audit_logs')
        .insert([{
          id: event.id,
          timestamp: event.timestamp,
          request_id: event.requestId,
          user_id: event.userId,
          user_name: event.userName,
          role: event.role,
          authorized_estate: event.authorizedEstate,
          action: event.action,
          resource: event.resource,
          resource_id: event.resourceId,
          result: event.result,
          before_state: event.beforeState,
          after_state: event.afterState,
          ip: event.ip,
          user_agent: event.userAgent,
          details: event.details,
          error_message: event.errorMessage
        }]);
    } catch {
      // Ignored intentionally — fail-safe design
    }
  }

  /**
   * Read-only query method for security and compliance audits
   */
  public query(filters?: {
    action?: AuditAction;
    role?: string;
    estateId?: string;
    result?: AuditResult;
    search?: string;
    limit?: number;
    offset?: number;
  }): { logs: StoredAuditEvent[]; total: number } {
    let filtered = [...this.inMemoryLogs];

    if (filters) {
      if (filters.action) {
        filtered = filtered.filter(l => l.action === filters.action);
      }
      if (filters.role) {
        filtered = filtered.filter(l => l.role?.toLowerCase() === filters.role?.toLowerCase());
      }
      if (filters.estateId) {
        filtered = filtered.filter(l => l.authorizedEstate === filters.estateId);
      }
      if (filters.result) {
        filtered = filtered.filter(l => l.result === filters.result);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(l => 
          l.action.toLowerCase().includes(q) ||
          l.resource.toLowerCase().includes(q) ||
          l.userId?.toLowerCase().includes(q) ||
          l.userName?.toLowerCase().includes(q) ||
          l.requestId?.toLowerCase().includes(q) ||
          (l.resourceId && l.resourceId.toLowerCase().includes(q))
        );
      }
    }

    const total = filtered.length;
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;
    const paginated = filtered.slice(offset, offset + limit);

    return { logs: paginated, total };
  }

  /**
   * Helper for logging authentication events
   */
  public logAuth(
    action: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT',
    req: AuditReqContext,
    details?: Record<string, unknown>,
    errorMessage?: string
  ): StoredAuditEvent {
    const user = req.user;
    return this.record({
      requestId: req.requestId || (typeof req.headers?.['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined) || (typeof req.headers?.['x-correlation-id'] === 'string' ? req.headers['x-correlation-id'] : undefined),
      userId: user?.app_metadata?.operator_id || user?.sub || 'anonymous',
      userName: user?.user_metadata?.operator_name || 'System Operator',
      role: user?.app_metadata?.app_role || 'anonymous',
      authorizedEstate: user?.app_metadata?.estate_id || 'FPM_TUNGGAL',
      action,
      resource: 'auth',
      result: action === 'LOGIN_SUCCESS' || action === 'LOGOUT' ? 'SUCCESS' : 'FAILURE',
      ip: req.ip || (typeof req.headers?.['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : undefined) || '127.0.0.1',
      userAgent: (typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : undefined) || 'unknown',
      details,
      errorMessage
    });
  }

  /**
   * Helper for logging authorization rejections
   */
  public logAuthDenied(
    req: AuditReqContext,
    requiredRoles: string[],
    deniedRole?: string
  ): StoredAuditEvent {
    const user = req.user;
    return this.record({
      requestId: req.requestId || (typeof req.headers?.['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined),
      userId: user?.app_metadata?.operator_id || user?.sub || 'unauthenticated',
      userName: user?.user_metadata?.operator_name || 'Unknown Operator',
      role: deniedRole || user?.app_metadata?.app_role || 'unauthenticated',
      authorizedEstate: user?.app_metadata?.estate_id || 'FPM_TUNGGAL',
      action: 'AUTHORIZATION_DENIED',
      resource: req.originalUrl || 'api',
      result: 'DENIED',
      ip: req.ip || (typeof req.headers?.['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : undefined) || '127.0.0.1',
      userAgent: (typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : undefined) || 'unknown',
      details: {
        method: req.method,
        requiredRoles,
        currentRole: deniedRole || user?.app_metadata?.app_role || 'none'
      },
      errorMessage: `Role '${deniedRole || user?.app_metadata?.app_role}' is not in allowed roles: ${requiredRoles.join(', ')}`
    });
  }

  /**
   * Helper for logging estate access rejection
   */
  public logEstateDenied(
    req: AuditReqContext,
    attemptedEstate: string,
    authorizedEstate: string
  ): StoredAuditEvent {
    const user = req.user;
    return this.record({
      requestId: req.requestId || (typeof req.headers?.['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined),
      userId: user?.app_metadata?.operator_id || user?.sub || 'unauthenticated',
      userName: user?.user_metadata?.operator_name || 'Unknown Operator',
      role: user?.app_metadata?.app_role || 'anonymous',
      authorizedEstate,
      action: 'ESTATE_ACCESS_DENIED',
      resource: req.originalUrl || 'estate_scope',
      result: 'DENIED',
      ip: req.ip || (typeof req.headers?.['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : undefined) || '127.0.0.1',
      userAgent: (typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : undefined) || 'unknown',
      details: { attemptedEstate, authorizedEstate },
      errorMessage: `User authorized for '${authorizedEstate}' attempted unauthorized access to '${attemptedEstate}'`
    });
  }
}

export const auditService = AuditService.getInstance();
