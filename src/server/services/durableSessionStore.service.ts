import { getPrivilegedSupabase, isMissingTableError } from '../db.js';

/**
 * P1 Acting-As durable session store.
 *
 * Complements the in-memory SessionManager by persisting Acting-As session
 * lifecycle to the EXISTING public.active_sessions table (migration
 * 20260907_phase6_active_sessions_schema.sql). This provides cross-instance /
 * cross-process revocation without introducing a new session architecture or a
 * new migration.
 *
 * Safety: if no real Supabase credentials are configured (or the store is
 * unreachable) the functions degrade to a no-op / 'UNKNOWN' status so the
 * existing in-memory behavior remains authoritative (local dev, tests). This
 * matches the repository's DB-optional design.
 */

export type DurableSessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';

export interface DurableSessionDescriptor {
  sessionId: string;
  operatorId: string;
  operatorName: string;
  appRole: string;
  estateId: string;
  kioskId: string;
  stationName?: string;
}

export function isDurableSessionStoreConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
  // Never treat the non-production mock fallback as a real durable store.
  if (url.includes('mockproject.supabase.co')) return false;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

function baseRow(descriptor: DurableSessionDescriptor, estateId: string) {
  return {
    session_id: descriptor.sessionId,
    // Avoid FK coupling to user_profiles for deterministic kiosk identities.
    user_id: null as string | null,
    operator_id: descriptor.operatorId.slice(0, 50),
    operator_name: (descriptor.operatorName || 'Unknown Operator').slice(0, 150),
    app_role: (descriptor.appRole || 'staff').slice(0, 20),
    assigned_estate: estateId.slice(0, 50),
    connected_estate: estateId.slice(0, 50),
    kiosk_id: (descriptor.kioskId || 'kiosk-unknown').slice(0, 100),
    station_name: descriptor.stationName ? descriptor.stationName.slice(0, 150) : null,
    ip_address: '127.0.0.1',
    user_agent: 'unknown',
    last_active_at: new Date().toISOString()
  };
}

/**
 * Upsert a row into the existing active_sessions table. The estate columns carry
 * an FK to org_estates(estate_id); if the real estate is not present (e.g.
 * WILAYAH_JB is an aggregate HQ code) we retry with the canonical estate so the
 * durable revocation is never lost to a foreign-key mismatch.
 */
async function upsertActiveSessionRow(
  descriptor: DurableSessionDescriptor,
  fields: Record<string, any>
): Promise<boolean> {
  const client = getPrivilegedSupabase();
  if (!client) return false;

  const attempt = async (estateId: string) => {
    const { error } = await client.from('active_sessions').upsert(
      { ...baseRow(descriptor, estateId), ...fields },
      { onConflict: 'session_id' }
    );
    return error;
  };

  try {
    let error = await attempt(descriptor.estateId);
    if (error && descriptor.estateId !== 'FPM_TUNGGAL') {
      error = await attempt('FPM_TUNGGAL');
    }
    if (error) {
      if (isMissingTableError(error)) {
        // Table not present in DB schema yet; graceful degradation to in-memory store
        return true;
      }
      console.warn('[DURABLE_SESSION] active_sessions write warning:', error.message);
      return false;
    }
    return true;
  } catch (err: unknown) {
    if (isMissingTableError(err)) {
      return true;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[DURABLE_SESSION] active_sessions write error:', msg);
    return false;
  }
}

export async function persistActingAsSession(
  descriptor: DurableSessionDescriptor,
  ip: string,
  userAgent: string
): Promise<boolean> {
  if (!descriptor?.sessionId || !isDurableSessionStoreConfigured()) return false;
  return upsertActiveSessionRow(descriptor, {
    ip_address: (ip || '127.0.0.1').slice(0, 45),
    user_agent: (userAgent || 'unknown').slice(0, 1000),
    status: 'ACTIVE'
  });
}

export async function revokeActingAsSessionDurable(
  descriptor: DurableSessionDescriptor,
  revokedBy: string,
  reason: string
): Promise<boolean> {
  if (!descriptor?.sessionId || !isDurableSessionStoreConfigured()) return false;
  return upsertActiveSessionRow(descriptor, {
    status: 'REVOKED',
    revoked_by: (revokedBy || 'Super Admin').slice(0, 150),
    revoked_reason: (reason || 'Sesi Acting-As ditamatkan').slice(0, 1000)
  });
}

export async function getDurableSessionStatus(sessionId: string): Promise<DurableSessionStatus> {
  if (!sessionId || !isDurableSessionStoreConfigured()) return 'UNKNOWN';
  const client = getPrivilegedSupabase();
  if (!client) return 'UNKNOWN';
  try {
    const { data, error } = await client
      .from('active_sessions')
      .select('status, expires_at')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      if (!isMissingTableError(error)) {
        console.warn('[DURABLE_SESSION] Acting-As session status read warning:', error.message);
      }
      return 'UNKNOWN';
    }
    if (!data) return 'UNKNOWN';
    if (data.status === 'REVOKED') return 'REVOKED';

    const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
    if (data.status === 'EXPIRED' || (expiresAt > 0 && expiresAt < Date.now())) return 'EXPIRED';
    return 'ACTIVE';
  } catch (err: unknown) {
    if (!isMissingTableError(err)) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[DURABLE_SESSION] Acting-As session status read error:', msg);
    }
    return 'UNKNOWN';
  }
}

/**
 * Durable authority for an Acting-As session. When no durable store is
 * configured this returns true so the in-memory SessionManager remains the
 * sole authority (local/test). When configured, a REVOKED/EXPIRED record
 * rejects the session on ANY instance.
 */
export async function isActingAsSessionDurableActive(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  if (!isDurableSessionStoreConfigured()) return true;
  const status = await getDurableSessionStatus(sessionId);
  return status !== 'REVOKED' && status !== 'EXPIRED';
}
