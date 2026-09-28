/**
 * iPDS v3.8 — Client Architecture: Browser Supabase Client Implementation
 * 
 * DESIGN PRINCIPLES:
 * 1. BROWSER CLIENT PATTERN: Uses public Anon key only (window.__SUPABASE_ANON_KEY__ or VITE_SUPABASE_ANON_KEY).
 * 2. NO SERVICE ROLE EXPOSURE: Service-role credentials are strictly forbidden on browser/client side.
 * 3. DYNAMIC FALLBACK: Supports offline placeholder and dynamic reconfiguration in settings.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const resolveCurrentCredentials = () => {
  let localUrl = '';
  let localKey = '';
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localUrl = localStorage.getItem('supabase_url') || '';
      localKey = localStorage.getItem('supabase_anon_key') || '';
    } catch (_) {}
  }

  const url = 
    (typeof window !== 'undefined' && (window as any).__SUPABASE_URL__) ||
    localUrl ||
    (typeof process !== 'undefined' ? (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : undefined) ||
    // @ts-ignore
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
    // @ts-ignore
    (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    '';

  const key = 
    (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY__) ||
    localKey ||
    (typeof process !== 'undefined' ? (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : undefined) ||
    // @ts-ignore
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
    // @ts-ignore
    (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    '';

  return {
    url: (url && url !== 'https://placeholder.supabase.co') ? url : 'https://placeholder.supabase.co',
    key: key || 'placeholder'
  };
};

let currentCreds = resolveCurrentCredentials();
let internalClient: SupabaseClient = createClient(currentCreds.url, currentCreds.key);

function ensureLiveClient(): SupabaseClient {
  const latestCreds = resolveCurrentCredentials();
  const isCurrentlyPlaceholder = !currentCreds.url || currentCreds.url === 'https://placeholder.supabase.co' || currentCreds.key === 'placeholder';
  const hasValidLatest = latestCreds.url && latestCreds.url !== 'https://placeholder.supabase.co' && latestCreds.key && latestCreds.key !== 'placeholder';

  if (isCurrentlyPlaceholder && hasValidLatest) {
    currentCreds = latestCreds;
    internalClient = createClient(latestCreds.url, latestCreds.key);
  } else if (hasValidLatest && (latestCreds.url !== currentCreds.url || latestCreds.key !== currentCreds.key)) {
    currentCreds = latestCreds;
    internalClient = createClient(latestCreds.url, latestCreds.key);
  }
  return internalClient;
}

export function isSupabaseReady(): boolean {
  const creds = resolveCurrentCredentials();
  return !!(creds.url && creds.url !== 'https://placeholder.supabase.co' && creds.key && creds.key !== 'placeholder');
}

export function updateSupabaseClient(url: string, key: string, persistLocal: boolean = true) {
  if (url && key) {
    currentCreds = { url, key };
    if (typeof window !== 'undefined') {
      (window as any).__SUPABASE_URL__ = url;
      (window as any).__SUPABASE_ANON_KEY__ = key;
      if (persistLocal && window.localStorage) {
        try {
          localStorage.setItem('supabase_url', url);
          localStorage.setItem('supabase_anon_key', key);
        } catch (_) {}
      }
    }
    internalClient = createClient(url, key);
  }
}

// Proxy supabase object so calls like supabase.from(...) or supabase.channel(...) always route to the active client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = ensureLiveClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});


