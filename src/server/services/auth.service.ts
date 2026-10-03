import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';
import { IdentityService, UnifiedIdentityProfile } from './identity.service.js';
import { auditService } from './audit.service.js';
import { hashStaffNo, loadHashedCredentials, normalizeStaffNo, verifyPinAgainstHash, verifyPasswordAgainstHash, verifyStaffNoAgainstHash, type UserCredentialConfig, syncKioskIdentitiesFromSupabase } from './credentials.loader.js';
export { syncKioskIdentitiesFromSupabase } from './credentials.loader.js';
import { normalizeEstateId } from '../../config/estateRegistry.js';
import { getPrivilegedSupabase } from '../db.js';

export type AuthRole = 'staff' | 'mandur' | 'pf' | 'fc' | 'afc' | 'fs' | 'eqi' | 'oc' | 'rc' | 'superadmin';

export const IPDS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export interface UserSession {
  sub: string; // Deterministic kiosk UUIDv5
  session_id: string; // Random session UUID
  role: 'authenticated';
  app_metadata: {
    user_id?: string;
    estate_id: string;
    assigned_estates?: string[];
    kiosk_id: string;
    app_role: AuthRole;
    operator_id: string;
    auth_method?: string;
    // P1 Acting-As context (additive). Normal login: actor_id === subject_id.
    actor_id?: string;
    subject_id?: string;
    actor_session_id?: string;
    acting_as?: boolean;
  };
  user_metadata: {
    operator_name: string;
    station_name: string;
    email?: string;
    username?: string;
  };
}

export interface AuthTokenPayload extends UserSession {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

// Server-side authoritative PIN and Kiosk/Operator mapping
// Loaded with setup-time bcrypt hashes from environment variables / .env.credentials.
// Excluded from source code; NEVER contains plaintext passwords.
const PIN_USERS_CONFIG: Record<string, UserCredentialConfig> = {
  ...loadHashedCredentials()
};

function applyIdentityOverridesFromEnv(): void {
  const raw = process.env.IPDS_IDENTITY_OVERRIDES_JSON;
  if (!raw || !raw.trim()) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      updateServerPinConfig(parsed);
    }
  } catch {
    console.warn('[AUTH_CONFIG_NOTICE] IPDS_IDENTITY_OVERRIDES_JSON is not valid JSON; ignoring identity overrides.');
  }
}

applyIdentityOverridesFromEnv();

/**
 * Dynamic registry update for custom PINs / changes made by FC Admin
 */
export function updateServerPinConfig(newConfig: Record<string, { app_role?: AuthRole; role?: AuthRole; operator_id?: string; operator_name?: string; label?: string; estate_id?: string; password?: string; username?: string; email?: string; staff_no_hash?: string }>) {
  for (const [pin, info] of Object.entries(newConfig)) {
    const cleanPin = pin.trim().replace(/\s+/g, '');
    if (cleanPin.length >= 4) {
      const role = (info.app_role || info.role || 'staff') as AuthRole;
      const opName = info.operator_name || info.label || 'Staf Ladang';
      const estateId = info.estate_id || 'FPM_TUNGGAL';

      // Preserve existing canonical operator_id and kiosk configuration if defined in PIN_USERS_CONFIG or IdentityService
      const existingIdentity = IdentityService.findIdentityByPin(cleanPin);
      const opId = info.operator_id || existingIdentity?.operator_id || `OP-${cleanPin}`;
      const existingKiosk = PIN_USERS_CONFIG[opId];
      const kioskId = existingKiosk?.kiosk_id || existingIdentity?.kiosk_id || `kiosk-custom-${cleanPin}`;
      const stationName = existingKiosk?.station_name || existingIdentity?.station_name || `Stesen Lapangan ${estateId}`;
      const staffNoHash = info.staff_no_hash || existingKiosk?.staff_no_hash || existingIdentity?.staff_no_hash;

      const pinHash = bcrypt.hashSync(cleanPin, 10);
      const passwordHash = info.password ? bcrypt.hashSync(info.password, 10) : pinHash;
      const maskedPin = `****${cleanPin.slice(-2)}`;

      PIN_USERS_CONFIG[opId] = {
        app_role: role,
        operator_id: opId,
        operator_name: opName,
        kiosk_id: kioskId,
        estate_id: estateId,
        station_name: stationName,
        pin_hash: pinHash,
        staff_no_hash: staffNoHash,
        password_hash: passwordHash,
        masked_pin: maskedPin,
        username: info.username || cleanPin,
        email: info.email || `${cleanPin}@felda.gov.my`
      };

      // Also register into Unified Identity Service SSOT
      IdentityService.registerOrUpdateIdentity({
        pin: cleanPin,
        pin_hash: pinHash,
        staff_no_hash: staffNoHash,
        password_hash: passwordHash,
        app_role: role,
        full_name: opName,
        operator_id: opId,
        primary_estate_id: estateId,
        station_name: stationName,
        kiosk_id: kioskId,
        username: info.username || cleanPin,
        email: info.email || `${cleanPin}@felda.gov.my`
      });
    }
  }
}

let lastSupabaseRbacSync = 0;
const RBAC_SYNC_INTERVAL_MS = 30 * 1000; // 30s cache for high performance

/**
 * Synchronize RBAC and user credentials dynamically from Supabase database (app_settings.rbac_registry)
 */
export async function syncRbacFromSupabase(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSupabaseRbacSync < RBAC_SYNC_INTERVAL_MS) {
    return;
  }
  try {
    const supabase = getPrivilegedSupabase();
    if (!supabase) return;
    const fetchPromise = supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'rbac_registry')
      .maybeSingle();
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 2500)
    );
    const result = (await Promise.race([fetchPromise, timeoutPromise])) as any;
    const rbacData = result?.data;
    const error = result?.error;

    if (!error && rbacData && rbacData.value && typeof rbacData.value === 'object') {
      const pinMap: Record<string, Record<string, unknown>> = {};
      for (const [pin, user] of Object.entries(rbacData.value as Record<string, any>)) {
        if (user && (user.role || user.app_role)) {
          pinMap[pin] = {
            app_role: user.role || user.app_role,
            operator_name: user.label || user.operator_name || 'Staf Ladang',
            estate_id: user.estate_id || 'FPM_TUNGGAL',
            password: user.password || user.pin || pin,
            username: user.username || user.pin || pin,
            email: user.email || `${pin}@felda.gov.my`,
          };
        }
      }
      updateServerPinConfig(pinMap);
      lastSupabaseRbacSync = now;
      console.log(`[AUTH_SYNC] Synced ${Object.keys(pinMap).length} user credentials from Supabase app_settings.`);
    } else {
      // Offline / timeout / table missing: Mark last sync attempt timestamp to avoid spamming
      lastSupabaseRbacSync = now;
      if (error && error.message !== 'timeout') {
        console.info(`[AUTH_SYNC] Local credentials active (Supabase sync skipped: ${error.message || 'not configured'}).`);
      }
    }
  } catch (err: any) {
    lastSupabaseRbacSync = now;
    console.info(`[AUTH_SYNC] Local credentials active (Supabase sync unavailable: ${err?.message || 'fallback mode'}).`);
  }
}

// Initial background sync on module load
syncRbacFromSupabase(true).catch(() => {});
syncKioskIdentitiesFromSupabase(true).catch(() => {});

export function getServerPinConfig(): Record<string, any> {
  return { ...PIN_USERS_CONFIG };
}

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

let devEphemeralJwtSecret: string | null = null;

export function getSupabaseJwtSecret(): string {
  const configuredSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (configuredSecret && configuredSecret.trim().length > 0) {
    return configuredSecret;
  }

  // Production MUST fail closed: never substitute a known/default signing secret.
  if (isProductionEnvironment()) {
    throw new Error(
      'CRITICAL SECURITY CONFIGURATION ERROR: SUPABASE_JWT_SECRET (or JWT_SECRET) is not configured in production. JWT signing/verification is disabled (fail-closed).'
    );
  }

  // Non-production only: ephemeral per-process secret for local development and tests.
  // This is intentionally NOT a hardcoded/committed credential and is never used in production.
  if (!devEphemeralJwtSecret) {
    devEphemeralJwtSecret = crypto.randomBytes(48).toString('hex');
    console.warn('[AUTH_CONFIG_NOTICE] SUPABASE_JWT_SECRET/JWT_SECRET not set; using an ephemeral in-memory development secret. Production requires an explicitly configured secret.');
  }
  return devEphemeralJwtSecret;
}

export function getSupabaseIssuer(): string {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      const projectRef = url.hostname.split('.')[0];
      return `https://${projectRef}.supabase.co/auth/v1`;
    } catch {
      // fall through to fail-closed / development handling below
    }
  }

  // Production MUST fail closed: never emit tokens with a placeholder/mock issuer.
  if (isProductionEnvironment()) {
    throw new Error(
      'CRITICAL SECURITY CONFIGURATION ERROR: SUPABASE_URL is not configured in production. Unable to determine a trusted JWT issuer (fail-closed).'
    );
  }

  // Non-production only: local issuer for local development and tests.
  return 'http://localhost/auth/v1';
}

// Enterprise JWT Lifecycle configuration
export const JWT_ACCESS_EXPIRES_IN = '1h'; // 1-hour short-lived access token for stateless API verification
export const JWT_KIOSK_SHIFT_EXPIRES_IN = '12h'; // 12-hour shift for estate kiosk terminals
export const JWT_PERSISTENT_EXPIRES_IN = '7d'; // 7-day long-lived token for offline field sync devices
export const JWT_REFRESH_SLIDING_WINDOW_MS = 12 * 60 * 60 * 1000; // 12-hour sliding activity window
export const COOKIE_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours HttpOnly cookie alignment

export class AuthService {
  /**
   * Helper to retrieve user profile mapping for audit inspection
   */
  static getStaffConfig(staffNo: string) {
    if (!staffNo || typeof staffNo !== 'string') return null;
    const cleanStaffNo = staffNo.trim().toUpperCase();

    // Check Unified Identity Service first
    const unified = IdentityService.findIdentityByStaffNo(cleanStaffNo);
    if (unified) {
      return {
        app_role: unified.app_role,
        operator_id: unified.operator_id,
        operator_name: unified.full_name,
        kiosk_id: unified.kiosk_id,
        estate_id: unified.primary_estate_id,
        station_name: unified.station_name,
        password: unified.password,
        email: unified.email,
        username: unified.username
      };
    }

    let keyMatch = PIN_USERS_CONFIG[cleanStaffNo];
    if (!keyMatch) {
      const match = Object.values(PIN_USERS_CONFIG).find(u => 
        u.operator_id.toUpperCase() === cleanStaffNo ||
        (u.username && u.username.toUpperCase() === cleanStaffNo)
      );
      if (match) keyMatch = match;
    }
    return keyMatch || null;
  }

  /**
   * Authoritatively verify login using Kod Ladang (Estate Code) + No. Kakitangan (Staff/Operator No.) + Secret (PIN or password)
   */
  static verifyEstateStaffLogin(estateCode: string, staffNo: string, secret: string): UserSession | null {
    if (!staffNo || typeof staffNo !== 'string' || !secret || typeof secret !== 'string') return null;
    const cleanStaffNo = staffNo.trim().toUpperCase();
    const cleanSecret = secret.trim();
    if (!cleanSecret) return null;
    const cleanEstateCode = (estateCode || 'FPM_TUNGGAL').trim().toUpperCase();

    // 1. Check Unified Identity Service
    const unified = IdentityService.findIdentityByStaffNo(cleanStaffNo);
    if (unified) {
      const isPinValid = unified.pin_hash ? verifyPinAgainstHash(cleanSecret, unified.pin_hash) : false;
      const isPasswordValid = !isPinValid && unified.password_hash ? verifyPasswordAgainstHash(cleanSecret, unified.password_hash) : false;
      if (!isPinValid && !isPasswordValid) {
        return null;
      }
      return IdentityService.createUnifiedSession(unified, 'ESTATE_STAFF_PIN', cleanEstateCode);
    }

    // 2. Fallback check on stored credential entries by operator_id / username
    let keyMatch = PIN_USERS_CONFIG[cleanStaffNo];
    if (!keyMatch) {
      const match = Object.values(PIN_USERS_CONFIG).find(u => 
        u.operator_id.toUpperCase() === cleanStaffNo ||
        (u.username && u.username.toUpperCase() === cleanStaffNo) ||
        u.operator_id.toUpperCase().replace(/^[A-Z]+-/, '') === cleanStaffNo
      );
      if (match) keyMatch = match;
    }

    if (keyMatch) {
      const isPinValid = keyMatch.pin_hash ? verifyPinAgainstHash(cleanSecret, keyMatch.pin_hash) : false;
      const isPasswordValid = !isPinValid && keyMatch.password_hash ? verifyPasswordAgainstHash(cleanSecret, keyMatch.password_hash) : false;
      if (!isPinValid && !isPasswordValid) {
        return null;
      }

      let selectedEstate = 'FPM_TUNGGAL';
      if (cleanEstateCode === '0001' || cleanEstateCode.includes('WILAYAH') || cleanEstateCode === 'WILAYAH_JB') {
        selectedEstate = 'WILAYAH_JB';
      } else if (cleanEstateCode === '5155' || cleanEstateCode.includes('TUNGGAL')) {
        selectedEstate = 'FPM_TUNGGAL';
      } else if (cleanEstateCode === '5136' || cleanEstateCode.includes('ADELA')) {
        selectedEstate = 'FPM_ADELA';
      } else if (cleanEstateCode === '5176' || cleanEstateCode.includes('KLEDANG')) {
        selectedEstate = 'FPM_KLEDANG';
      } else if (cleanEstateCode === '5156' || cleanEstateCode.includes('SENING')) {
        selectedEstate = 'FPM_SENING';
      } else if (cleanEstateCode === 'FPM_ADELA' || cleanEstateCode === 'FPM_TUNGGAL' || cleanEstateCode === 'FPM_KLEDANG' || cleanEstateCode === 'FPM_SENING' || cleanEstateCode === 'WILAYAH_JB') {
        selectedEstate = cleanEstateCode;
      }

      const isMultiEstate = ['rc', 'oc'].includes((keyMatch.app_role || '').toLowerCase().trim());
      const userEstate = (keyMatch.estate_id || 'FPM_TUNGGAL').trim().toUpperCase();

      if (!isMultiEstate && userEstate !== selectedEstate) {
        return null;
      }

      const activeEstate = isMultiEstate ? selectedEstate : userEstate;
      const kioskSub = uuidv5(`kiosk:${activeEstate}:${keyMatch.kiosk_id}`, IPDS_NAMESPACE);
      const sessionId = uuidv4();

      return {
        sub: kioskSub,
        session_id: sessionId,
        role: 'authenticated',
        app_metadata: {
          user_id: uuidv5(`user:${keyMatch.operator_id}`, IPDS_NAMESPACE),
          estate_id: activeEstate,
          assigned_estates: [userEstate],
          kiosk_id: keyMatch.kiosk_id,
          app_role: keyMatch.app_role,
          operator_id: keyMatch.operator_id,
          auth_method: 'ESTATE_STAFF_PIN'
        },
        user_metadata: {
          operator_name: keyMatch.operator_name,
          station_name: keyMatch.station_name,
          email: keyMatch.email,
          username: keyMatch.username
        }
      };
    }

    // STRICT: Reject all unverified staff numbers. No permissive fallbacks.
    return null;
  }

  static verifyKioskLogin(estateCode: string, staffNo: string): UserSession | null {
    return this.verifyKioskLoginResult(estateCode, staffNo).session || null;
  }

  static verifyKioskLoginResult(estateCode: string, staffNo: string): {
    session: UserSession | null;
    failureReason?: 'INVALID_CREDENTIALS' | 'UNAUTHORIZED_ESTATE';
    identity?: UnifiedIdentityProfile;
  } {
    if (!estateCode || typeof estateCode !== 'string' || !staffNo || typeof staffNo !== 'string') {
      return { session: null, failureReason: 'INVALID_CREDENTIALS' };
    }
    const normalizedEstate = normalizeEstateId(estateCode);
    const allowedEstates = ['WILAYAH_JB', 'FPM_TUNGGAL', 'FPM_ADELA', 'FPM_KLEDANG', 'FPM_SENING'];
    if (!allowedEstates.includes(normalizedEstate)) return { session: null, failureReason: 'INVALID_CREDENTIALS' };

    const normalizedStaffNo = normalizeStaffNo(staffNo);
    const identity = IdentityService.findIdentityByStaffNoCredential(normalizedStaffNo, normalizedEstate);
    if (!identity) return { session: null, failureReason: 'INVALID_CREDENTIALS' };
    const session = IdentityService.createUnifiedSession(identity, 'KIOSK_STAFF_NO', normalizedEstate);
    if (!session) return { session: null, failureReason: 'UNAUTHORIZED_ESTATE', identity };
    return { session, identity };
  }

  /**
   * Authoritatively verify an enterprise alphanumeric password on server-side using bcrypt hash comparison
   */
  static verifyPassword(identity: string, pass: string): UserSession | null {
    if (!identity || !pass || typeof identity !== 'string' || typeof pass !== 'string') return null;
    const cleanId = identity.trim().toLowerCase();
    const cleanPass = pass.trim();

    // 1. Check Unified Identity Service
    const unified = IdentityService.findIdentityByCredentials(cleanId, cleanPass);
    if (unified) {
      return IdentityService.createUnifiedSession(unified, 'ENTERPRISE_PASSWORD');
    }

    // 2. Match identity by username, email, operator_id, or PIN key
    const foundEntry = PIN_USERS_CONFIG[cleanId] || Object.values(PIN_USERS_CONFIG).find(user => 
      (user.username && user.username.toLowerCase() === cleanId) ||
      (user.email && user.email.toLowerCase() === cleanId) ||
      (user.operator_id && user.operator_id.toLowerCase() === cleanId) ||
      (user.operator_id && user.operator_id.toLowerCase() === `op-${cleanId}`)
    );

    // Constant-time bcrypt comparison against pre-hashed credentials (NO plaintext comparison)
    if (foundEntry && foundEntry.password_hash && verifyPasswordAgainstHash(cleanPass, foundEntry.password_hash)) {
      const kioskSub = uuidv5(`kiosk:${foundEntry.estate_id}:${foundEntry.kiosk_id}`, IPDS_NAMESPACE);
      const sessionId = uuidv4();

      return {
        sub: kioskSub,
        session_id: sessionId,
        role: 'authenticated',
        app_metadata: {
          user_id: uuidv5(`user:${foundEntry.operator_id}`, IPDS_NAMESPACE),
          estate_id: foundEntry.estate_id,
          assigned_estates: [foundEntry.estate_id],
          kiosk_id: foundEntry.kiosk_id,
          app_role: foundEntry.app_role,
          operator_id: foundEntry.operator_id,
          auth_method: 'ENTERPRISE_PASSWORD'
        },
        user_metadata: {
          operator_name: foundEntry.operator_name,
          station_name: foundEntry.station_name,
          email: foundEntry.email,
          username: foundEntry.username
        }
      };
    }

    return null;
  }

  /**
   * Authoritatively verify a PIN on server-side using bcrypt hash comparison
   */
  static verifyPin(pin: string): UserSession | null {
    if (!pin || typeof pin !== 'string') return null;
    const cleanPin = pin.trim().replace(/\s+/g, '');

    // 1. Check Unified Identity Service
    const unified = IdentityService.findIdentityByPin(cleanPin);
    if (unified) {
      return IdentityService.createUnifiedSession(unified, 'PIN_KIOSK');
    }

    // 2. Constant-time hash verification scan over all stored entries (ONLY resolution path, not fallback)
    for (const config of Object.values(PIN_USERS_CONFIG)) {
      if (config.pin_hash && verifyPinAgainstHash(cleanPin, config.pin_hash)) {
        const kioskSub = uuidv5(`kiosk:${config.estate_id}:${config.kiosk_id}`, IPDS_NAMESPACE);
        const sessionId = uuidv4();

        return {
          sub: kioskSub,
          session_id: sessionId,
          role: 'authenticated',
          app_metadata: {
            user_id: uuidv5(`user:${config.operator_id}`, IPDS_NAMESPACE),
            estate_id: config.estate_id,
            assigned_estates: [config.estate_id],
            kiosk_id: config.kiosk_id,
            app_role: config.app_role,
            operator_id: config.operator_id,
            auth_method: 'PIN_KIOSK'
          },
          user_metadata: {
            operator_name: config.operator_name,
            station_name: config.station_name,
            email: config.email,
            username: config.username
          }
        };
      }
    }

    return null;
  }

  /**
   * Generate signed Supabase-compatible JWT session token
   * Default expiry: 1 hour (short-lived access token) backed by sliding session window
   */
  static generateToken(session: UserSession, customExpiry: string = JWT_ACCESS_EXPIRES_IN): string {
    const secret = getSupabaseJwtSecret();
    const issuer = getSupabaseIssuer();

    return jwt.sign(
      {
        sub: session.sub,
        iss: issuer,
        aud: 'authenticated',
        role: 'authenticated',
        session_id: session.session_id,
        app_metadata: session.app_metadata,
        user_metadata: session.user_metadata
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: customExpiry as any
      }
    );
  }

  /**
   * Refresh and renew an active session token if the underlying session and user remain active
   */
  static async refreshSessionToken(
    currentPayload: AuthTokenPayload,
    clientIp: string = '127.0.0.1',
    userAgent: string = 'unknown'
  ): Promise<{ token: string; user: UserSession } | null> {
    const sessionId = currentPayload.session_id;
    if (!sessionId) return null;

    // P1 Acting-As: the actor (canonical Super Admin) must still be a valid,
    // active identity or the Acting-As session may not be renewed. Normal
    // (non-Acting-As) refresh behavior is unchanged.
    const actingAsMeta = currentPayload.app_metadata;
    if (actingAsMeta?.acting_as === true) {
      const actorId = actingAsMeta.actor_id;
      const actorProfile = actorId ? IdentityService.findIdentityById(actorId) : null;

      let actorValid = false;
      if (actorProfile && actorProfile.is_active !== false) {
        try {
          // Lazy import avoids a static import cycle with middleware/auth.ts.
          const { isSuperAdminIdentity } = await import('../middleware/auth.js');
          actorValid = isSuperAdminIdentity({
            app_metadata: { app_role: actorProfile.app_role, estate_id: actorProfile.primary_estate_id }
          });
        } catch {
          actorValid = false;
        }
      }

      if (!actorValid) {
        auditService.record({
          userId: actorId || 'unknown-actor',
          userName: actorProfile?.full_name || 'Unknown Actor',
          role: actorProfile?.app_role || 'unknown',
          authorizedEstate: actingAsMeta.estate_id,
          action: 'AUTHORIZATION_DENIED',
          resource: 'auth/refresh',
          result: 'DENIED',
          details: {
            reason: 'ACTING_AS_ACTOR_INVALID',
            actor_id: actorId,
            subject_id: actingAsMeta.subject_id,
            actor_found: !!actorProfile,
            actor_active: actorProfile ? actorProfile.is_active !== false : false
          },
          errorMessage: 'Acting-As refresh denied: actor is no longer an active canonical Super Admin.'
        });
        return null;
      }
    }

    // 1. Verify operator identity in SSOT
    const operatorId = currentPayload.app_metadata?.operator_id;
    if (operatorId) {
      const profile = IdentityService.findIdentityById(operatorId) || IdentityService.findIdentityByStaffNo(operatorId);
      if (!profile || profile.is_active === false) {
        return null; // Deactivated user or user no longer exists
      }
    }

    // 2. Reconstruct UserSession object preserving validated tenant claims
    const refreshedSession: UserSession = {
      sub: currentPayload.sub,
      session_id: sessionId,
      role: 'authenticated',
      app_metadata: { ...currentPayload.app_metadata },
      user_metadata: { ...currentPayload.user_metadata }
    };

    // 3. Issue fresh 1-hour access token
    const newToken = this.generateToken(refreshedSession, JWT_ACCESS_EXPIRES_IN);
    return { token: newToken, user: refreshedSession };
  }

  /**
   * Verify and decode session token
   */
  static verifyToken(token: string): AuthTokenPayload | null {
    try {
      const secret = getSupabaseJwtSecret();

      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        audience: 'authenticated'
      }) as AuthTokenPayload;

      return decoded;
    } catch {
      return null;
    }
  }
}
