import { Request, Response, NextFunction } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthService, AuthTokenPayload, AuthRole, UserSession } from '../services/auth.service.js';
import { getScopedSupabase } from '../db.js';
import { auditService } from '../services/audit.service.js';
import { sessionManager } from '../services/sessionManager.service.js';
import { alertManager } from '../observability/alerts.js';
import { metricsCollector } from '../observability/metrics.js';
import { isActingAsSessionDurableActive } from '../services/durableSessionStore.service.js';

// Extend Express Request interface to include authenticated user and scoped Supabase client
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      authRole?: AuthRole;
      estateId?: string;
      rawToken?: string;
      supabase?: SupabaseClient;
      requestId?: string;
    }
  }
}

export const COOKIE_NAME = 'ipds_session';

const FC_TUNGGAL_ESTATES = ['FPM_TUNGGAL', '5155'];

const SUPER_ADMIN_ROLE_ALIASES = ['superadmin', 'super_admin', 'admin'];

/**
 * Minimal identity shape required for administrative authorization. Both full
 * JWT payloads and lightweight operator sessions satisfy this, so the SSOT
 * predicates below can be reused by middleware, routes, and services without
 * duplicating role definitions.
 */
export interface SuperAdminIdentityLike {
  app_metadata?: {
    app_role?: string | null;
    estate_id?: string | null;
  } | null;
}

export function isFCTunggalSuperAdmin(user: SuperAdminIdentityLike | null | undefined): boolean {
  if (!user) return false;
  const role = (user.app_metadata?.app_role || '').toLowerCase().trim();
  const estate = (user.app_metadata?.estate_id || '').toUpperCase().trim();
  return role === 'fc' && FC_TUNGGAL_ESTATES.includes(estate);
}

/**
 * Canonical Super Admin identity (SSOT): the FC Tunggal of the primary estate,
 * or an explicit Super Admin role alias. RC/OC/PF and branch-FC are NOT Super
 * Admin. This is the single predicate the app layer must delegate to.
 */
export function isSuperAdminIdentity(user: SuperAdminIdentityLike | null | undefined): boolean {
  if (!user) return false;
  const role = (user.app_metadata?.app_role || '').toLowerCase().trim();
  return SUPER_ADMIN_ROLE_ALIASES.includes(role) || isFCTunggalSuperAdmin(user);
}

/**
 * Extracts raw token string from Cookie or Authorization header
 */
export function extractRawTokenFromRequest(req: Request): string | null {
  // 1. Try parsed HttpOnly Cookie
  let token = req.cookies ? req.cookies[COOKIE_NAME] : null;

  // 1b. Fallback: Parse raw Cookie header if req.cookies is not populated
  if (!token && req.headers?.cookie) {
    const match = req.headers.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  // 2. Try Authorization Bearer Header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      token = parts[1];
    }
  }

  // 3. Try x-access-token header as fallback
  if (!token && req.headers['x-access-token']) {
    token = String(req.headers['x-access-token']);
  }

  return token || null;
}

/**
 * P0-16C.3: extract the device credential from the request.
 *
 * The credential is a secret; it is only read here for server-side hashing and
 * is NEVER logged, echoed, or placed in a token/URL.
 */
export function extractDeviceCredential(req: Request): string {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const fromBody = typeof body.deviceCredential === 'string'
    ? body.deviceCredential
    : (typeof body.device_credential === 'string' ? body.device_credential : '');
  const headerVal = req.headers['x-device-credential'];
  const fromHeader = typeof headerVal === 'string' ? headerVal : '';
  return String(fromBody || fromHeader || '').trim();
}

/**
 * Extracts and verifies token from Cookie or Authorization header
 */
export function extractUserFromRequest(req: Request): { user: AuthTokenPayload | null; token: string | null } {
  const token = extractRawTokenFromRequest(req);
  if (!token) return { user: null, token: null };
  const user = AuthService.verifyToken(token);
  if (!user) return { user: null, token: null };
  if (user.session_id) {
    if (!sessionManager.isSessionActive(user.session_id)) {
      return { user: null, token: null };
    }
    sessionManager.touchSession(user.session_id);
  }
  return { user, token };
}

/**
 * P1 Acting-As: validate the acting-as session against the durable store so a
 * session ended on another instance is rejected here too. Only acting-as tokens
 * reach this; normal sessions keep the synchronous path.
 */
async function isActingAsSessionAuthorized(user: AuthTokenPayload): Promise<boolean> {
  try {
    return await isActingAsSessionDurableActive(user.session_id);
  } catch {
    return false;
  }
}

function rejectRevokedActingAs(res: Response) {
  return res.status(401).json({
    success: false,
    error: 'Sesi Acting-As telah ditamatkan atau tidak sah. Sila log masuk semula.',
    code: 'SESSION_REVOKED'
  });
}

/**
 * Optional authentication middleware: populates req.user and req.supabase if valid token exists
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const { user, token } = extractUserFromRequest(req);
  if (user && token) {
    req.user = user;
    req.authRole = user.app_metadata?.app_role || (user as any).app_role || (user as any).role || 'staff';
    req.estateId = user.app_metadata?.estate_id || (user as any).estate_id || (user as any).estate || 'FPM_TUNGGAL';
    req.rawToken = token;
    
    const scoped = getScopedSupabase(token);
    if (scoped) req.supabase = scoped;

    // P1 Acting-As: enforce durable (cross-instance) revocation. An ended
    // acting-as session is treated as anonymous on optional-auth paths.
    if (user.app_metadata?.acting_as === true) {
      void (async () => {
        if (!(await isActingAsSessionAuthorized(user))) {
          delete req.user;
          delete req.authRole;
          delete req.estateId;
          delete req.rawToken;
          delete req.supabase;
          return next();
        }
        if (!validateTenantAccess(req, res)) {
          return;
        }
        next();
      })();
      return;
    }

    if (!validateTenantAccess(req, res)) return;
    return next();
  }
  next();
}

/**
 * Strict authentication middleware: rejects if no valid session token exists.
 * Injects req.supabase as a Scoped Supabase Client carrying the user JWT.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { user, token } = extractUserFromRequest(req);
  if (!user || !token) {
    return res.status(401).json({
      success: false,
      error: 'Sesi log masuk tidak sah atau telah tamat tempoh. Sila log masuk semula.',
      code: 'UNAUTHORIZED'
    });
  }

  req.user = user;
  req.authRole = user.app_metadata?.app_role || (user as any).app_role || (user as any).role || 'staff';
  req.estateId = user.app_metadata?.estate_id || (user as any).estate_id || (user as any).estate || 'FPM_TUNGGAL';
  req.rawToken = token;

  const scoped = getScopedSupabase(token);
  if (scoped) {
    req.supabase = scoped;
  }

  // P1 Acting-As: enforce durable (cross-instance) revocation before allowing.
  if (user.app_metadata?.acting_as === true) {
    void (async () => {
      if (!(await isActingAsSessionAuthorized(user))) {
        return rejectRevokedActingAs(res);
      }
      if (!validateTenantAccess(req, res)) {
        return;
      }
      next();
    })();
    return;
  }

  if (!validateTenantAccess(req, res)) return;
  return next();
}

/**
 * Role-Based Access Control (RBAC) middleware: checks if authenticated user has one of allowed roles
 */
export function requireRole(allowedRoles: AuthRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { user, token } = extractUserFromRequest(req);
    if (!user || !token) {
      return res.status(401).json({
        success: false,
        error: 'Sesi log masuk tidak sah atau telah tamat tempoh. Sila log masuk.',
        code: 'UNAUTHORIZED'
      });
    }

    req.user = user;
    const effectiveRole = user.app_metadata?.app_role || (user as any).app_role || (user as any).role || 'staff';
    req.authRole = effectiveRole;
    req.estateId = user.app_metadata?.estate_id || (user as any).estate_id || (user as any).estate || 'FPM_TUNGGAL';
    req.rawToken = token;

    const scoped = getScopedSupabase(token);
    if (scoped) {
      req.supabase = scoped;
    }

    const runRoleAndTenantChecks = () => {
      const isSuper = isSuperAdminIdentity(user);
      if (!allowedRoles.includes(effectiveRole) && !isSuper) {
        auditService.logAuthDenied(
          {
            ip: req.ip || req.headers['x-forwarded-for'] as string,
            headers: req.headers,
            user: user ? {
              sub: user.sub,
              app_metadata: {
                operator_id: user.app_metadata?.operator_id,
                app_role: effectiveRole,
                estate_id: user.app_metadata?.estate_id
              },
              user_metadata: {
                operator_name: user.user_metadata?.operator_name
              }
            } : null,
            requestId: req.headers['x-request-id'] as string,
            originalUrl: req.originalUrl || req.url,
            method: req.method
          },
          allowedRoles,
          user.app_metadata.app_role
        );

        return res.status(403).json({
          success: false,
          error: `Akses dinafikan: Peranan '${user.app_metadata.app_role}' tidak dibenarkan untuk tindakan ini. Diperlukan salah satu: ${allowedRoles.join(', ')}`,
          code: 'FORBIDDEN',
          requiredRoles: allowedRoles,
          currentRole: user.app_metadata.app_role
        });
      }

      if (!validateTenantAccess(req, res)) {
        return;
      }

      next();
    };

    // P1 Acting-As: enforce durable (cross-instance) revocation before role checks.
    if (user.app_metadata?.acting_as === true) {
      void (async () => {
        if (!(await isActingAsSessionAuthorized(user))) {
          return rejectRevokedActingAs(res);
        }
        runRoleAndTenantChecks();
      })();
      return;
    }

    return runRoleAndTenantChecks();
  };
}

/**
 * Strict Super Admin middleware: only the designated FC Tunggal identity.
 * Requires `requireAuth` (or equivalent) to have populated `req.user` first.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Sesi log masuk tidak sah.',
      code: 'UNAUTHORIZED'
    });
  }

  if (!isSuperAdminIdentity(user)) {
    const role = (user.app_metadata?.app_role || '').toLowerCase().trim();
    const estate = (user.app_metadata?.estate_id || '').toUpperCase().trim();

    auditService.record({
      action: 'AUTHORIZATION_DENIED',
      resource: 'super-admin',
      userId: user.app_metadata?.operator_id || user.sub,
      userName: user.user_metadata?.operator_name || 'Unauthorized User',
      role,
      authorizedEstate: estate,
      result: 'DENIED',
      ip: req.ip || 'unknown',
      errorMessage: `Akses ditolak: Pengguna [${user.user_metadata?.operator_name}] (${role} / ${estate}) cuba mengakses operasi Super Admin.`
    });

    return res.status(403).json({
      success: false,
      error: 'Akses dinafikan: Hanya Pentadbir Utama (FC FPM Tunggal) dibenarkan.',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }

  next();
}

// Authorized estates for Zon Adela
const ZON_ADELA_ESTATES = ['FPM_TUNGGAL', 'FPM_KLEDANG', 'FPM_ADELA', 'FPM_SENING', 'WILAYAH_JB', 'WJB', '0001'];

/**
 * Internal tenant access validator helper.
 * Enforces strict estate boundary rules based on identity SSOT & requested estate parameters.
 * Returns true if request is permitted, or false if a 403 error response was sent.
 */
export function validateTenantAccess(req: Request, res: Response): boolean {
  const user = req.user;
  if (!user) return true;

  const userRole = (user.app_metadata.app_role || '').toLowerCase();
  const userEstate = (user.app_metadata.estate_id || 'FPM_TUNGGAL').trim().toUpperCase();

  // Extract requested estate from headers, body, or query
  let bodyEstate: string | undefined = undefined;
  if (req.body && typeof req.body === 'object') {
    if (typeof req.body.estate_id === 'string') {
      bodyEstate = req.body.estate_id;
    } else if (typeof req.body.estateId === 'string') {
      bodyEstate = req.body.estateId;
    } else if (Array.isArray(req.body.data) && req.body.data[0] && typeof req.body.data[0].estate_id === 'string') {
      bodyEstate = req.body.data[0].estate_id;
    } else if (Array.isArray(req.body) && req.body[0] && typeof req.body[0].estate_id === 'string') {
      bodyEstate = req.body[0].estate_id;
    }
  }

  const requestedEstate = (req.headers['x-estate-id'] as string) || bodyEstate || (req.query?.estate_id as string) || (req.query?.estateId as string);

  if (requestedEstate && typeof requestedEstate === 'string' && requestedEstate.trim().length > 0) {
    const cleanRequested = requestedEstate.trim().toUpperCase();

    // Regional Controller (RC) and HQ Executive retain cross-estate visibility,
    // while canonical Super Admin (FC Tunggal / admin aliases) has full access.
    if (userRole === 'rc' || userRole === 'executive_hq' || isSuperAdminIdentity(user)) {
      req.estateId = cleanRequested;
      return true;
    }

    // Operation Controller (OC) and Pengurus Felda (PF) have multi-estate access across Zon Adela or ALL
    if (userRole === 'oc' || userRole === 'pf') {
      if (cleanRequested === 'ALL' || ZON_ADELA_ESTATES.includes(cleanRequested)) {
        req.estateId = cleanRequested;
        return true;
      } else {
        auditService.logEstateDenied(
          {
            ip: req.ip || (req.headers['x-forwarded-for'] as string),
            headers: req.headers,
            user: user ? {
              sub: user.sub,
              app_metadata: {
                operator_id: user.app_metadata.operator_id,
                app_role: user.app_metadata.app_role,
                estate_id: user.app_metadata.estate_id
              },
              user_metadata: {
                operator_name: user.user_metadata?.operator_name
              }
            } : null,
            requestId: req.headers['x-request-id'] as string,
            originalUrl: req.originalUrl || req.url
          },
          cleanRequested,
          'ZON_ADELA'
        );

        res.status(403).json({
          success: false,
          error: `Akses dinafikan: Ladang '${cleanRequested}' bukan di bawah seliaan Zon Adela.`,
          code: 'FORBIDDEN_ZONE'
        });
        return false;
      }
    }

    // Standard single-estate roles (FC, AFC, FS, Staff, Mandur, EQI) are strictly locked to their assigned estate
    if (cleanRequested !== userEstate) {
      auditService.logEstateDenied(
        {
          ip: req.ip || (req.headers['x-forwarded-for'] as string),
          headers: req.headers,
          user: user ? {
            sub: user.sub,
            app_metadata: {
              operator_id: user.app_metadata.operator_id,
              app_role: user.app_metadata.app_role,
              estate_id: user.app_metadata.estate_id
            },
            user_metadata: {
              operator_name: user.user_metadata?.operator_name
            }
          } : null,
          requestId: req.headers['x-request-id'] as string,
          originalUrl: req.originalUrl || req.url
        },
        cleanRequested,
        userEstate
      );

      metricsCollector.recordSecurityEvent('estate_denied', {
        requestedEstate: cleanRequested,
        assignedEstate: userEstate,
        userId: user.sub || (user.app_metadata as any)?.user_id,
        role: userRole,
      });

      alertManager.triggerSecurityViolation({
        requestedEstate: cleanRequested,
        userEstate,
        userId: user.sub || (user.app_metadata as any)?.user_id,
        role: userRole,
        ip: req.ip || (req.headers['x-forwarded-for'] as string),
      });

      res.status(403).json({
        success: false,
        error: `Akses dinafikan: Anda hanya mempunyai kebenaran untuk ladang '${userEstate}'.`,
        code: 'FORBIDDEN_ESTATE'
      });
      return false;
    }

    req.estateId = cleanRequested;
  } else {
    req.estateId = userEstate;
  }

  return true;
}

/**
 * Estate Access verification middleware: ensures operation stays strictly within authorized estate / zone
 */
export function requireEstateAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user || extractUserFromRequest(req).user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Sesi log masuk tidak sah.',
      code: 'UNAUTHORIZED'
    });
  }

  req.user = user;
  if (!validateTenantAccess(req, res)) {
    return;
  }

  next();
}
