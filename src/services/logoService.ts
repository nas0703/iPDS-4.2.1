import { supabase } from './supabaseClient';
import { getActiveEstateId } from '../utils/estateContext';

const LOCAL_STORAGE_KEY = 'ipds_custom_logo';
const REALTIME_CHANNEL = 'ipds_logo_realtime';

export interface LogoData {
  url: string | null;
  updated_at?: string;
}

/**
 * Image compression utility to ensure fast loading (< 100KB) across all devices
 */
export const compressLogoImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 500; // max 500px dimension
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to webp/jpeg with 0.85 quality
        try {
          const dataUrl = canvas.toDataURL('image/webp', 0.85);
          resolve(dataUrl);
        } catch {
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(jpegDataUrl);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Update HTML Favicon, Apple Touch Icon, and Web App Manifest dynamically
 * so that PWA installed to Home Screen uses the 100% exact uploaded logo.
 */
export const updateDynamicManifestAndIcons = (logoUrl: string | null) => {
  if (typeof document === 'undefined') return;

  try {
    const iconToUse = logoUrl || '/icons/icon-192x192.svg';

    // 1. Update Favicon
    let favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']") || document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (favicon) {
      favicon.href = iconToUse;
    }

    // 2. Update Apple Touch Icon (iOS Home Screen)
    let appleIcon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (appleIcon) {
      appleIcon.href = iconToUse;
    }

    // 3. Ensure Web App Manifest points to /manifest.json for Google Chrome WebAPK minting
    let manifestElem = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    if (manifestElem) {
      manifestElem.href = '/manifest.json';
    }
  } catch (e) {
    console.warn('Failed to dynamically update manifest and icons:', e);
  }
};

/**
 * Get initial cached logo from localStorage
 */
export const getLocalLogo = (): string | null => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      updateDynamicManifestAndIcons(cached);
    }
    return cached;
  } catch {
    return null;
  }
};

/**
 * Set cached logo in localStorage
 */
export const setLocalLogo = (url: string | null) => {
  try {
    if (url) {
      localStorage.setItem(LOCAL_STORAGE_KEY, url);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    updateDynamicManifestAndIcons(url);
  } catch (err) {
    console.warn('Failed to set logo in localStorage:', err);
  }
};

/**
 * Fetch custom logo from Supabase app_settings table or backend API
 */
export const fetchSupabaseLogo = async (): Promise<string | null> => {
  // 1. Try fetching from Supabase table app_settings directly
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'header_logo')
      .maybeSingle();

    if (!error && data && data.value) {
      const logoUrl = typeof data.value === 'string' ? data.value : data.value.url || null;
      if (logoUrl) {
        setLocalLogo(logoUrl);
        return logoUrl;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch logo from Supabase:', err);
  }

  // 2. Fallback: Fetch from Express backend API
  try {
    const res = await fetch('/api/settings/logo').catch(() => null);
    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.logoUrl) {
        setLocalLogo(json.logoUrl);
        return json.logoUrl;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch logo from backend API:', err);
  }

  // 3. Last fallback: return local storage cache
  return getLocalLogo();
};

/**
 * Save logo to Supabase and backend API, broadcast to all connected devices
 */
export const saveSupabaseLogo = async (logoUrl: string): Promise<boolean> => {
  // Update local cache immediately for zero latency
  setLocalLogo(logoUrl);

  let success = false;

  // 1. Save via Express backend API (ensures backend memory/DB sync & sharp PWA icon regeneration)
  try {
    const session = (await supabase.auth.getSession().catch(() => null))?.data?.session;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch('/api/settings/logo', {
      method: 'POST',
      headers,
      body: JSON.stringify({ logoUrl })
    }).catch(() => null);

    if (res && res.ok) {
      success = true;
    }
  } catch (err) {
    console.warn('Failed to save logo to API:', err);
  }

  // 2. Save directly to Supabase client table app_settings
  try {
    const payload = {
      key: 'header_logo',
      value: logoUrl,
      updated_at: new Date().toISOString(),
      estate_id: getActiveEstateId()
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'key' });

    if (!error) {
      success = true;
    } else {
      console.warn('Upsert error for app_settings:', error.message);
    }
  } catch (err) {
    console.warn('Failed to save logo directly to Supabase:', err);
  }

  // 3. Broadcast via Realtime Channel to all other connected devices
  try {
    const channel = supabase.channel(REALTIME_CHANNEL);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'logo_updated',
          payload: { url: logoUrl }
        });
      }
    });
  } catch (err) {
    console.warn('Failed to broadcast logo update:', err);
  }

  return success;
};

/**
 * Delete logo from Supabase & API, broadcast reset to all devices
 */
export const deleteSupabaseLogo = async (): Promise<boolean> => {
  setLocalLogo(null);

  try {
    const session = (await supabase.auth.getSession().catch(() => null))?.data?.session;
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    await fetch('/api/settings/logo', { method: 'DELETE', headers }).catch(() => null);
  } catch (e) {}

  try {
    await supabase
      .from('app_settings')
      .delete()
      .eq('key', 'header_logo');
  } catch (e) {}

  // Broadcast reset via Realtime
  try {
    const channel = supabase.channel(REALTIME_CHANNEL);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'logo_updated',
          payload: { url: null }
        });
      }
    });
  } catch (e) {}

  return true;
};

/**
 * Subscribe to realtime logo updates across all devices
 */
export const subscribeLogoRealtime = (onLogoUpdate: (logoUrl: string | null) => void) => {
  // Listen to broadcast events
  const broadcastChannel = supabase
    .channel(REALTIME_CHANNEL)
    .on('broadcast', { event: 'logo_updated' }, (payload) => {
      const newUrl = payload?.payload?.url || null;
      setLocalLogo(newUrl);
      onLogoUpdate(newUrl);
    })
    .subscribe();

  // Listen to postgres table changes on app_settings
  const dbChannel = supabase
    .channel('app_settings_db_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.header_logo' },
      (payload) => {
        let newUrl: string | null = null;
        if (payload.eventType !== 'DELETE' && payload.new) {
          const val = (payload.new as any).value;
          newUrl = typeof val === 'string' ? val : val?.url || null;
        }
        setLocalLogo(newUrl);
        onLogoUpdate(newUrl);
      }
    )
    .subscribe();

  // Periodic polling fallback (every 10s) to keep devices synced even if realtime websockets disconnect
  const intervalId = setInterval(async () => {
    const url = await fetchSupabaseLogo();
    const currentLocal = getLocalLogo();
    if (url !== currentLocal) {
      onLogoUpdate(url);
    }
  }, 10000);

  return () => {
    supabase.removeChannel(broadcastChannel);
    supabase.removeChannel(dbChannel);
    clearInterval(intervalId);
  };
};
