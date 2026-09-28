import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { loadHashedCredentials, verifyPinAgainstHash, verifyPasswordAgainstHash } from './credentials.loader.js';

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

export interface UnifiedIdentityProfile {
  id: string; // UUID v5 or v4
  operator_id: string; // e.g. "FC-2401199", "STF-TGL-01", "RC-0001"
  full_name: string;
  username: string;
  email: string;
  pin: string; // 6-digit PIN or masked PIN
  pin_hash?: string;
  password?: string; // Legacy/dynamic password
  password_hash?: string;
  app_role: AuthRole;
  primary_estate_id: string;
  assigned_estates: string[];
  kiosk_id: string;
  station_name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Master authoritative unified identity registry (Single Source of Truth)
const MASTER_IDENTITY_REGISTRY: Map<string, UnifiedIdentityProfile> = new Map();

function initMasterIdentity(profile: Omit<UnifiedIdentityProfile, 'id'> & { id?: string }): UnifiedIdentityProfile {
  const generatedId = profile.id || uuidv5(`user:${profile.operator_id}`, IPDS_NAMESPACE);
  const record: UnifiedIdentityProfile = {
    ...profile,
    id: generatedId,
    is_active: profile.is_active ?? true,
    created_at: profile.created_at || '2026-01-01T00:00:00.000Z',
    updated_at: profile.updated_at || '2026-09-04T00:00:00.000Z'
  };
  MASTER_IDENTITY_REGISTRY.set(record.operator_id.toUpperCase(), record);
  return record;
}

// Seed the Master Unified Identity Store from setup-time bcrypt-hashed environment configuration
const INITIAL_SEEDS: Array<Omit<UnifiedIdentityProfile, 'id'>> = Object.entries(loadHashedCredentials()).map(([opIdKey, u]) => ({
  operator_id: u.operator_id || opIdKey,
  full_name: u.operator_name,
  username: u.username || u.operator_id.toLowerCase(),
  email: u.email || `${u.operator_id.toLowerCase()}@felda.gov.my`,
  pin: u.masked_pin || '******',
  pin_hash: u.pin_hash,
  password_hash: u.password_hash,
  app_role: u.app_role,
  primary_estate_id: u.estate_id || 'FPM_TUNGGAL',
  assigned_estates: ['rc', 'oc', 'superadmin'].includes(u.app_role.toLowerCase())
    ? ["FPM_TUNGGAL", "FPM_ADELA", "FPM_KLEDANG", "FPM_SENING", "FPM_SENGGARANG"]
    : [u.estate_id || 'FPM_TUNGGAL'],
  kiosk_id: u.kiosk_id,
  station_name: u.station_name,
  is_active: true
}));

// Initialize the in-memory Single Source of Truth
INITIAL_SEEDS.forEach(initMasterIdentity);

export class IdentityService {
  /**
   * Resolve an identity profile by 6-digit PIN using constant-time bcrypt comparison
   */
  static findIdentityByPin(pin: string): UnifiedIdentityProfile | null {
    if (!pin || typeof pin !== 'string') return null;
    const cleanPin = pin.trim().replace(/\s+/g, '');
    for (const profile of MASTER_IDENTITY_REGISTRY.values()) {
      if (profile.is_active) {
        if (profile.pin_hash && verifyPinAgainstHash(cleanPin, profile.pin_hash)) {
          return profile;
        }
      }
    }
    return null;
  }

  /**
   * Resolve an identity profile by Staff No, Operator ID, or Username
   */
  static findIdentityByStaffNo(staffNo: string): UnifiedIdentityProfile | null {
    if (!staffNo || typeof staffNo !== 'string') return null;
    const clean = staffNo.trim().toUpperCase();

    // Direct lookup by operator_id
    if (MASTER_IDENTITY_REGISTRY.has(clean)) {
      const p = MASTER_IDENTITY_REGISTRY.get(clean)!;
      if (p.is_active) return p;
    }

    // Lookup by username or operator_id (including numeric suffix, e.g. "2401199" -> "FC-2401199")
    for (const profile of MASTER_IDENTITY_REGISTRY.values()) {
      if (!profile.is_active) continue;
      if (
        (profile.username && profile.username.toUpperCase() === clean) ||
        profile.operator_id.toUpperCase() === clean ||
        profile.operator_id.toUpperCase().replace(/^[A-Z]+-/, '') === clean
      ) {
        return profile;
      }
    }

    return null;
  }

  /**
   * Resolve an identity profile by username/email/staffNo/PIN + alphanumeric password or PIN
   */
  static findIdentityByCredentials(identity: string, password: string): UnifiedIdentityProfile | null {
    if (!identity || !password || typeof identity !== 'string' || typeof password !== 'string') {
      return null;
    }
    const cleanId = identity.trim().toLowerCase();
    const cleanPass = password.trim();

    for (const profile of MASTER_IDENTITY_REGISTRY.values()) {
      if (!profile.is_active) continue;
      const matchId = 
        (profile.username && profile.username.toLowerCase() === cleanId) ||
        (profile.email && profile.email.toLowerCase() === cleanId) ||
        profile.operator_id.toLowerCase() === cleanId ||
        (profile.pin && profile.pin.toLowerCase() === cleanId);

      if (matchId) {
        if (profile.password_hash && verifyPasswordAgainstHash(cleanPass, profile.password_hash)) {
          return profile;
        }
        if (profile.pin_hash && verifyPinAgainstHash(cleanPass, profile.pin_hash)) {
          return profile;
        }
        if (profile.password && profile.password === cleanPass) {
          return profile;
        }
      }
    }

    return null;
  }

  /**
   * Resolve an identity profile by user UUID or operator ID
   */
  static findIdentityById(idOrOperatorId: string): UnifiedIdentityProfile | null {
    if (!idOrOperatorId || typeof idOrOperatorId !== 'string') return null;
    const clean = idOrOperatorId.trim().toUpperCase();

    if (MASTER_IDENTITY_REGISTRY.has(clean)) {
      return MASTER_IDENTITY_REGISTRY.get(clean)!;
    }

    for (const profile of MASTER_IDENTITY_REGISTRY.values()) {
      if (profile.id.toUpperCase() === clean || profile.operator_id.toUpperCase() === clean) {
        return profile;
      }
    }

    return null;
  }

  /**
   * Retrieve all registered profiles (for administrative inspection & syncing)
   */
  static getAllProfiles(): UnifiedIdentityProfile[] {
    return Array.from(MASTER_IDENTITY_REGISTRY.values());
  }

  /**
   * Register or dynamically update an identity profile
   */
  static registerOrUpdateIdentity(profile: Partial<UnifiedIdentityProfile> & { pin: string; app_role: AuthRole; full_name: string; operator_id?: string; primary_estate_id?: string }): UnifiedIdentityProfile {
    const opId = profile.operator_id || `OP-${profile.pin}`;
    const cleanOpId = opId.toUpperCase();
    const cleanPin = profile.pin.trim();

    // Check if an existing profile exists with this operator_id OR with this PIN
    let existingKey: string | null = null;
    let existing: UnifiedIdentityProfile | undefined = undefined;

    if (MASTER_IDENTITY_REGISTRY.has(cleanOpId)) {
      existingKey = cleanOpId;
      existing = MASTER_IDENTITY_REGISTRY.get(cleanOpId);
    } else {
      for (const [k, p] of MASTER_IDENTITY_REGISTRY.entries()) {
        if (p.pin === cleanPin || (profile.username && p.username.toLowerCase() === profile.username.toLowerCase())) {
          existingKey = k;
          existing = p;
          break;
        }
      }
    }

    let primaryEstate = (profile.primary_estate_id || existing?.primary_estate_id || 'FPM_TUNGGAL').trim().toUpperCase();
    if (primaryEstate === '5155' || primaryEstate.includes('TUNGGAL')) primaryEstate = 'FPM_TUNGGAL';
    else if (primaryEstate === '5136' || primaryEstate.includes('ADELA')) primaryEstate = 'FPM_ADELA';
    else if (primaryEstate === '5176' || primaryEstate.includes('KLEDANG')) primaryEstate = 'FPM_KLEDANG';
    else if (primaryEstate === '5156' || primaryEstate.includes('SENING')) primaryEstate = 'FPM_SENING';
    else if (primaryEstate === '0001' || primaryEstate.includes('WILAYAH') || primaryEstate === 'WILAYAH_JB') primaryEstate = 'WILAYAH_JB';

    const pinHash = profile.pin_hash || (cleanPin.length >= 4 ? bcrypt.hashSync(cleanPin, 10) : undefined);
    const passwordHash = profile.password_hash || (profile.password ? bcrypt.hashSync(profile.password, 10) : pinHash);

    const updatedRecord: UnifiedIdentityProfile = {
      id: existing?.id || uuidv5(`user:${cleanOpId}`, IPDS_NAMESPACE),
      operator_id: cleanOpId,
      full_name: profile.full_name,
      username: profile.username || existing?.username || cleanPin,
      email: profile.email || existing?.email || `${cleanPin}@felda.gov.my`,
      pin: cleanPin,
      pin_hash: pinHash,
      password_hash: passwordHash,
      app_role: profile.app_role,
      primary_estate_id: primaryEstate,
      assigned_estates: profile.assigned_estates || existing?.assigned_estates || [primaryEstate],
      kiosk_id: profile.kiosk_id || existing?.kiosk_id || `kiosk-custom-${cleanPin}`,
      station_name: profile.station_name || existing?.station_name || `Stesen Lapangan ${primaryEstate}`,
      is_active: profile.is_active ?? existing?.is_active ?? true,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingKey && existingKey !== cleanOpId) {
      MASTER_IDENTITY_REGISTRY.delete(existingKey);
    }

    MASTER_IDENTITY_REGISTRY.set(cleanOpId, updatedRecord);
    return updatedRecord;
  }

  /**
   * Canonical Session Creator: Builds the standardized UserSession carrying unified claims
   */
  static createUnifiedSession(
    profile: UnifiedIdentityProfile,
    authMethod: 'PIN_KIOSK' | 'ESTATE_STAFF_PIN' | 'ENTERPRISE_PASSWORD' | 'SUPABASE_SSO' | 'ADMIN_ACTING_AS' | 'SESSION_RESTORE',
    selectedEstateId?: string
  ): UserSession | null {
    if (!profile || !profile.is_active) return null;

    // Resolve target active estate
    const isMultiEstate = ['rc', 'oc', 'superadmin'].includes(profile.app_role.toLowerCase());
    let activeEstate = profile.primary_estate_id;

    if (selectedEstateId) {
      let normalizedEstate = selectedEstateId.trim().toUpperCase();
      if (normalizedEstate === '5155' || normalizedEstate.includes('TUNGGAL')) normalizedEstate = 'FPM_TUNGGAL';
      else if (normalizedEstate === '5136' || normalizedEstate.includes('ADELA')) normalizedEstate = 'FPM_ADELA';
      else if (normalizedEstate === '5176' || normalizedEstate.includes('KLEDANG')) normalizedEstate = 'FPM_KLEDANG';
      else if (normalizedEstate === '5156' || normalizedEstate.includes('SENING')) normalizedEstate = 'FPM_SENING';
      else if (normalizedEstate === '0001' || normalizedEstate.includes('WILAYAH') || normalizedEstate === 'WILAYAH_JB') normalizedEstate = 'WILAYAH_JB';

      if (isMultiEstate) {
        activeEstate = normalizedEstate;
      } else {
        // Single-estate role must match assigned estate
        const normPrimary = profile.primary_estate_id.trim().toUpperCase();
        if (normPrimary !== normalizedEstate && !profile.assigned_estates.map(e => e.toUpperCase()).includes(normalizedEstate)) {
          return null; // Cross-estate access strictly denied
        }
        activeEstate = normalizedEstate;
      }
    }

    const deterministicKioskSub = uuidv5(`kiosk:${activeEstate}:${profile.kiosk_id}`, IPDS_NAMESPACE);
    const sessionId = uuidv4();

    return {
      sub: deterministicKioskSub,
      session_id: sessionId,
      role: 'authenticated',
      app_metadata: {
        user_id: profile.id,
        estate_id: activeEstate,
        assigned_estates: profile.assigned_estates,
        kiosk_id: profile.kiosk_id,
        app_role: profile.app_role,
        operator_id: profile.operator_id,
        auth_method: authMethod,
        // Normal login identity: the authenticated operator acts as themselves.
        actor_id: profile.operator_id,
        subject_id: profile.operator_id
      },
      user_metadata: {
        operator_name: profile.full_name,
        station_name: profile.station_name,
        email: profile.email,
        username: profile.username
      }
    };
  }
}
