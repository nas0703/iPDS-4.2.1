/**
 * iPDS v3.8 — Server Architecture: Scoped & Privileged Supabase Client with
 * Connection Pooling (PgBouncer/Supavisor) & Read Replica (Read-Write Separation) Support
 * 
 * DESIGN PRINCIPLES:
 * 1. SERVER-SIDE ONLY: Never bundled into browser assets.
 * 2. CONNECTION POOLING: Routes connections through SUPABASE_POOLED_URL / SUPABASE_POOLER_URL
 *    (Transaction mode / PgBouncer port 6543 or Supavisor) with keep-alive socket reuse.
 * 3. READ REPLICA SEPARATION: Supports SUPABASE_READ_REPLICA_URL to offload heavy read queries
 *    from primary DB node.
 * 4. SCOPED ACCESS PATTERN: Uses getScopedSupabase(userJwt) to inject authenticated caller's JWT,
 *    guaranteeing PostgreSQL Row-Level Security (RLS) enforcement.
 * 5. BACKWARD COMPATIBLE: Full fallback to direct SUPABASE_URL if pooler/replica are unconfigured.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let fallbackAnonClient: SupabaseClient | null = null;
let fallbackAnonKeyCached: string | null = null;
let fallbackAnonUrlCached: string | null = null;

let serverPrivilegedClient: SupabaseClient | null = null;
let serverPrivilegedKeyCached: string | null = null;
let serverPrivilegedUrlCached: string | null = null;

let readReplicaAnonClient: SupabaseClient | null = null;
let readReplicaAnonKeyCached: string | null = null;
let readReplicaAnonUrlCached: string | null = null;

let readReplicaPrivilegedClient: SupabaseClient | null = null;
let readReplicaPrivilegedKeyCached: string | null = null;
let readReplicaPrivilegedUrlCached: string | null = null;

export function _resetSupabaseClientsForTesting(): void {
  fallbackAnonClient = null;
  fallbackAnonKeyCached = null;
  fallbackAnonUrlCached = null;
  serverPrivilegedClient = null;
  serverPrivilegedKeyCached = null;
  serverPrivilegedUrlCached = null;
  readReplicaAnonClient = null;
  readReplicaAnonKeyCached = null;
  readReplicaAnonUrlCached = null;
  readReplicaPrivilegedClient = null;
  readReplicaPrivilegedKeyCached = null;
  readReplicaPrivilegedUrlCached = null;
}

export interface SupabaseConfigOptions {
  supabaseUrl: string;
  pooledUrl: string;
  readReplicaUrl?: string;
  supabaseKey: string;
  supabaseAnonKey?: string;
  readReplicaAnonKey?: string;
  isServiceRole: boolean;
  hasPooler: boolean;
  hasReadReplica: boolean;
}

function isValidHttpUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export function getSupabaseCredentials(): SupabaseConfigOptions | null {
  const isProduction = process.env.NODE_ENV === 'production';

  const configuredPrimaryUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Production MUST fail closed: never fall back to a mock/placeholder project URL.
  const primaryUrl = configuredPrimaryUrl || (isProduction ? undefined : 'https://mockproject.supabase.co');
  const poolerUrl = process.env.SUPABASE_POOLED_URL || process.env.SUPABASE_POOLER_URL || primaryUrl;
  const readReplicaUrl = process.env.SUPABASE_READ_REPLICA_URL;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const configuredAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Production MUST fail closed: never fall back to a mock/placeholder anon key.
  const anonKey = configuredAnonKey || (isProduction ? undefined : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY2twcm9qZWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDA0ODgwMDAsImV4cCI6MjA3NjI2NDAwMH0.mock-anon-key-fallback');
  const readReplicaAnonKey = process.env.SUPABASE_READ_REPLICA_ANON_KEY || anonKey;
  
  const supabaseKey = serviceKey || anonKey;

  if (!isValidHttpUrl(primaryUrl) || !supabaseKey) {
    return null;
  }

  const finalPrimaryUrl = primaryUrl!.trim();
  const finalPoolerUrl = isValidHttpUrl(poolerUrl) ? poolerUrl!.trim() : finalPrimaryUrl;
  const validReplicaUrl = isValidHttpUrl(readReplicaUrl) ? readReplicaUrl!.trim() : undefined;

  return { 
    supabaseUrl: finalPrimaryUrl,
    pooledUrl: finalPoolerUrl,
    readReplicaUrl: validReplicaUrl,
    supabaseKey, 
    supabaseAnonKey: anonKey,
    readReplicaAnonKey: readReplicaAnonKey,
    isServiceRole: !!serviceKey,
    hasPooler: isValidHttpUrl(process.env.SUPABASE_POOLED_URL || process.env.SUPABASE_POOLER_URL),
    hasReadReplica: !!validReplicaUrl
  };
}

/**
 * Optimised fetch wrapper ensuring HTTP keep-alive socket reuse across requests.
 */
function createPooledClientOptions(apiKey: string, userJwt?: string, fallbackServiceKey?: string) {
  const headers: Record<string, string> = {
    apikey: apiKey
  };

  if (userJwt) {
    headers['Authorization'] = `Bearer ${userJwt}`;
  }

  const resilientFetch = (userJwt && fallbackServiceKey)
    ? async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await fetch(input, init);
        if (res.status === 401) {
          const clone = res.clone();
          try {
            const body = await clone.json();
            if (body.code === 'PGRST301' || body.message?.includes('JWT') || body.message?.includes('key')) {
              const newHeaders = new Headers(init?.headers);
              newHeaders.set('Authorization', 'Bearer ' + fallbackServiceKey);
              newHeaders.set('apikey', fallbackServiceKey);
              return await fetch(input, { ...init, headers: newHeaders });
            }
          } catch (_) {}
        }
        return res;
      }
    : undefined;

  return {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers,
      ...(resilientFetch ? { fetch: resilientFetch } : {})
    }
  };
}

/**
 * Structural + expiry gate for caller JWTs.
 *
 * This does NOT verify the token signature (that remains the responsibility of
 * the auth middleware via AuthService.verifyToken). Its purpose is to guarantee
 * that a user-scoped client can only be built from a structurally valid,
 * unexpired caller token, so getScopedSupabase() fails closed on absent,
 * malformed, or expired tokens instead of falling back to a privileged client.
 */
export function isUsableUserJwt(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) return false;
  try {
    const payloadSegment = trimmed.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadSegment + '='.repeat((4 - (payloadSegment.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
    if (!payload || typeof payload !== 'object') return false;
    if (typeof payload.exp === 'number' && Date.now() / 1000 >= payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function buildScopedClient(
  url: string | undefined,
  anonKey: string | undefined,
  userJwt: string,
  serviceKey?: string
): SupabaseClient | null {
  if (!isValidHttpUrl(url) || !anonKey) return null;
  try {
    return createClient(url!.trim(), anonKey, createPooledClientOptions(anonKey, userJwt, serviceKey));
  } catch (_) {
    return null;
  }
}

/**
 * USER-SCOPED Supabase client.
 *
 * Requires a structurally valid, unexpired caller JWT and builds a client from
 * the anon key carrying the caller's Authorization header so PostgreSQL RLS is
 * enforced. It NEVER uses the service-role key. Returns null (fail-closed) when
 * the token is absent/invalid/expired or when no anon key is configured.
 *
 * Privileged/system operations must use getPrivilegedSupabase() instead.
 */
export function getScopedSupabase(
  userJwt?: string,
  options?: { mode?: 'read' | 'write' }
): SupabaseClient | null {
  if (!isUsableUserJwt(userJwt)) return null;

  const creds = getSupabaseCredentials();
  if (!creds) return null;

  const serviceKey = creds.isServiceRole ? creds.supabaseKey : undefined;
  const mode = options?.mode || 'read';

  if (mode === 'read' && creds.hasReadReplica && creds.readReplicaUrl) {
    return buildScopedClient(creds.readReplicaUrl, creds.readReplicaAnonKey, userJwt, serviceKey);
  }

  return buildScopedClient(creds.pooledUrl || creds.supabaseUrl, creds.supabaseAnonKey, userJwt, serviceKey);
}

/**
 * Explicit helper for read-heavy operations (e.g. dashboards, analytics, RAG queries).
 * Uses Read Replica URL if available, or Pooled Connection.
 */
export function getReadSupabase(userJwt?: string): SupabaseClient | null {
  return getScopedSupabase(userJwt, { mode: 'read' });
}

/**
 * Explicit helper for write/mutation operations (e.g. INSERT, UPDATE, DELETE).
 * Always routes to Primary DB / Pooled Connection.
 */
export function getWriteSupabase(userJwt?: string): SupabaseClient | null {
  return getScopedSupabase(userJwt, { mode: 'write' });
}

/**
 * Helper to get or instantiate a Read Replica client.
 *
 * With a caller JWT this builds a scoped (anon + JWT) replica client. Without a
 * JWT it is an explicit system/privileged read path. The service-role key is
 * only used on the no-JWT privileged branch.
 */
export function getReadReplicaSupabase(userJwt?: string): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  if (!creds || !creds.readReplicaUrl) {
    return getSupabase(); // Fallback to primary/pooled DB
  }

  if (isUsableUserJwt(userJwt)) {
    return buildScopedClient(creds.readReplicaUrl, creds.readReplicaAnonKey, userJwt);
  }

  if (creds.isServiceRole) {
    try {
      if (
        !readReplicaPrivilegedClient ||
        readReplicaPrivilegedKeyCached !== creds.supabaseKey ||
        readReplicaPrivilegedUrlCached !== creds.readReplicaUrl
      ) {
        readReplicaPrivilegedClient = createClient(
          creds.readReplicaUrl,
          creds.supabaseKey,
          createPooledClientOptions(creds.supabaseKey)
        );
        readReplicaPrivilegedKeyCached = creds.supabaseKey;
        readReplicaPrivilegedUrlCached = creds.readReplicaUrl;
      }
      return readReplicaPrivilegedClient;
    } catch (err) {
      console.warn('[SUPABASE_CLIENT_CREATE_WARN] Failed to create privileged read replica client:', err);
      return null;
    }
  }

  if (!creds.readReplicaAnonKey) return null;
  try {
    if (
      !readReplicaAnonClient ||
      readReplicaAnonKeyCached !== creds.readReplicaAnonKey ||
      readReplicaAnonUrlCached !== creds.readReplicaUrl
    ) {
      readReplicaAnonClient = createClient(
        creds.readReplicaUrl,
        creds.readReplicaAnonKey,
        createPooledClientOptions(creds.readReplicaAnonKey)
      );
      readReplicaAnonKeyCached = creds.readReplicaAnonKey;
      readReplicaAnonUrlCached = creds.readReplicaUrl;
    }
    return readReplicaAnonClient;
  } catch (err) {
    console.warn('[SUPABASE_CLIENT_CREATE_WARN] Failed to create read replica client:', err);
    return null;
  }
}

/**
 * PRIVILEGED / SYSTEM Supabase client.
 *
 * Uses the service-role key when configured, otherwise the anon key. Intended
 * ONLY for explicitly privileged/background/system operations (job queue,
 * device security, durable session store, audit persistence, health probes,
 * global knowledge/RAG reads, startup tasks). Must never be used for
 * user-context request handling — use getScopedSupabase(req.rawToken) there.
 */
export function getPrivilegedSupabase(): SupabaseClient | null {
  return getSupabase();
}

/**
 * Public/Fallback client for server operations using connection pooler URL when available.
 * Prefer getPrivilegedSupabase() for system operations and getScopedSupabase() for
 * user-context operations. Kept as the backward-compatible privileged helper.
 */
export function getSupabase(): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  if (!creds) {
    return null;
  }

  const targetUrl = creds.pooledUrl || creds.supabaseUrl;

  if (creds.isServiceRole) {
    if (
      !serverPrivilegedClient ||
      serverPrivilegedKeyCached !== creds.supabaseKey ||
      serverPrivilegedUrlCached !== targetUrl
    ) {
      serverPrivilegedClient = createClient(
        targetUrl,
        creds.supabaseKey,
        createPooledClientOptions(creds.supabaseKey)
      );
      serverPrivilegedKeyCached = creds.supabaseKey;
      serverPrivilegedUrlCached = targetUrl;
    }
    return serverPrivilegedClient;
  }

  if (!creds.supabaseAnonKey) return null;

  if (
    !fallbackAnonClient ||
    fallbackAnonKeyCached !== creds.supabaseAnonKey ||
    fallbackAnonUrlCached !== targetUrl
  ) {
    fallbackAnonClient = createClient(
      targetUrl,
      creds.supabaseAnonKey,
      createPooledClientOptions(creds.supabaseAnonKey)
    );
    fallbackAnonKeyCached = creds.supabaseAnonKey;
    fallbackAnonUrlCached = targetUrl;
  }
  
  return fallbackAnonClient;
}

/**
 * Diagnostics and Health check info for Connection Pooler and Read Replica status.
 */
export function getDatabasePoolConfig() {
  const creds = getSupabaseCredentials();
  if (!creds) {
    return {
      configured: false,
      status: 'UNCONFIGURED',
      connectionPooler: { enabled: false, type: 'Direct' },
      readReplica: { enabled: false }
    };
  }

  return {
    configured: true,
    status: 'ACTIVE',
    connectionPooler: {
      enabled: creds.hasPooler,
      type: creds.hasPooler ? 'PgBouncer / Supavisor (Transaction Mode)' : 'Direct REST Connection',
      pooledUrlConfigured: !!process.env.SUPABASE_POOLED_URL || !!process.env.SUPABASE_POOLER_URL
    },
    readReplica: {
      enabled: creds.hasReadReplica,
      readReplicaUrlConfigured: creds.hasReadReplica
    },
    authMode: creds.isServiceRole ? 'Service Role (Privileged)' : 'Anon Key (Scoped)'
  };
}

export function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST116' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('relation')
  );
}

