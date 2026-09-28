import express from 'express';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getScopedSupabase, getPrivilegedSupabase } from '../db.js';
import { authenticate, requireAuth, requireRole, isSuperAdminIdentity } from '../middleware/auth.js';
import { auditService } from '../services/audit.service.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';
import { getSafeErrorMessage } from '../utils/errorUtils.js';

const router = express.Router();

export interface RbacUserEntry {
  id?: string;
  pin?: string;
  role?: string;
  app_role?: string;
  label?: string;
  operator_name?: string;
  estate_id?: string;
  username?: string;
  password?: string;
  email?: string;
  quickAccess?: boolean;
  allowedModules?: string[];
  [key: string]: unknown;
}

export type RbacRegistry = Record<string, RbacUserEntry>;

/**
 * P0-06 / P0-ADMIN: Strict RBAC administration guard.
 *
 * Delegates to the canonical Super Admin / FC Tunggal SSOT
 * (isSuperAdminIdentity): the FC of the primary estate (FPM_TUNGGAL / 5155) or
 * an explicit Super Admin role alias. RC / OC / PF / branch-FC / HQ Executive
 * are NOT RBAC administrators.
 *
 * Must be mounted AFTER requireAuth so req.user is populated.
 */
export function requireRbacAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Sesi log masuk tidak sah.', code: 'UNAUTHORIZED' });
  }

  const role = (user.app_metadata?.app_role || '').toLowerCase().trim();
  const estate = (user.app_metadata?.estate_id || '').toUpperCase().trim();

  if (!isSuperAdminIdentity(user)) {
    auditService.record({
      action: 'AUTHORIZATION_DENIED',
      resource: 'settings/rbac',
      userId: user.app_metadata?.operator_id || user.sub,
      userName: user.user_metadata?.operator_name || 'Unauthorized User',
      role,
      authorizedEstate: estate,
      result: 'DENIED',
      ip: req.ip || 'unknown',
      errorMessage: `Akses RBAC ditolak untuk peranan [${role}] (${estate}).`
    });

    return res.status(403).json({
      success: false,
      error: 'Akses dinafikan: Hanya Pentadbir Utama (FC FPM Tunggal / Super Admin) dibenarkan menguruskan RBAC.',
      code: 'RBAC_ADMIN_REQUIRED'
    });
  }

  next();
}

/**
 * P0-06: Strip credential material (password, PIN, secrets, tokens, hashes)
 * from any RBAC registry payload before it is serialized to a client.
 * Non-secret operational fields (id, role, label, estate_id, username,
 * allowedModules, quickAccess, ...) are preserved.
 */
const RBAC_CREDENTIAL_FIELD_PATTERN = /pass(word)?|pin|secret|token|credential|hash/i;

export function sanitizeRbacRegistryForResponse(
  registry: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  if (!registry || typeof registry !== 'object') return safe;

  for (const [key, user] of Object.entries(registry)) {
    if (!user || typeof user !== 'object') continue;
    const entry: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(user as Record<string, unknown>)) {
      if (RBAC_CREDENTIAL_FIELD_PATTERN.test(field)) continue;
      entry[field] = value;
    }
    safe[key] = entry;
  }
  return safe;
}

// Server-side in-memory cache for instant fallback across devices
let cachedLogoUrl: string | null = null;
let cachedRbacRegistry: RbacRegistry | null = null;

// P0-11-D: SSRF-safe logo parsing. Only inline data:image/* base64 URIs are
// accepted; client-supplied http(s) URLs are never fetched. Enforces allowed
// MIME types and a maximum decoded size.
export const LOGO_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'];
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export function parseLogoDataUri(value: unknown): { mime: string; buffer: Buffer } | null {
  if (typeof value !== 'string') return null;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(value.trim());
  if (!match) return null;

  const mime = match[1].toLowerCase();
  if (!LOGO_ALLOWED_MIME_TYPES.includes(mime)) return null;

  const base64Data = match[2].replace(/\s+/g, '');
  const approxBytes = Math.floor((base64Data.length * 3) / 4);
  if (approxBytes <= 0 || approxBytes > LOGO_MAX_BYTES) return null;

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0 || buffer.length > LOGO_MAX_BYTES) return null;
    return { mime, buffer };
  } catch {
    return null;
  }
}

/**
 * Helper to generate PNG icons from custom uploaded logo (base64/dataURI/buffer) or fallback to default SVG
 */
async function generatePwaIcons(logoDataUriOrUrl: string | null) {
  try {
    const iconsDir = path.join(process.cwd(), 'public', 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    const parsedLogo = parseLogoDataUri(logoDataUriOrUrl);
    if (parsedLogo) {
      const inputBuffer: Buffer = parsedLogo.buffer;

      // Generate customized PNG icons for PWA
      // 1. Maskable icon (Android Adaptive Icon): full bleed background with centered safe zone
      const maskableInner = await sharp(inputBuffer)
        .resize(410, 410, { fit: 'contain', background: { r: 3, g: 19, b: 21, alpha: 1 } })
        .toBuffer();

      await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 3, g: 19, b: 21, alpha: 1 }
        }
      })
      .composite([{ input: maskableInner, gravity: 'center' }])
      .png()
      .toFile(path.join(iconsDir, 'icon-maskable.png'));

      // 2. Standard icons
      await sharp(inputBuffer).resize(192, 192, { fit: 'contain', background: { r: 3, g: 19, b: 21, alpha: 1 } }).png().toFile(path.join(iconsDir, 'icon-192x192.png'));
      await sharp(inputBuffer).resize(512, 512, { fit: 'contain', background: { r: 3, g: 19, b: 21, alpha: 1 } }).png().toFile(path.join(iconsDir, 'icon-512x512.png'));
      await sharp(inputBuffer).resize(180, 180, { fit: 'contain', background: { r: 3, g: 19, b: 21, alpha: 1 } }).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
      await sharp(inputBuffer).resize(32, 32, { fit: 'contain', background: { r: 3, g: 19, b: 21, alpha: 1 } }).png().toFile(path.join(process.cwd(), 'public', 'favicon.png'));
      console.log('[PWA_ICON_SYNC] Custom PWA icons (192, 512, maskable, apple-touch) generated successfully from uploaded logo.');
    } else {
      // Revert to official iPDS SVG
      const svg192Path = path.join(iconsDir, 'icon-192x192.svg');
      const svg512Path = path.join(iconsDir, 'icon-512x512.svg');
      const svgMaskPath = path.join(iconsDir, 'icon-maskable.svg');

      if (fs.existsSync(svg192Path)) {
        await sharp(fs.readFileSync(svg192Path)).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192x192.png'));
        await sharp(fs.readFileSync(svg192Path)).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
        await sharp(fs.readFileSync(svg192Path)).resize(32, 32).png().toFile(path.join(process.cwd(), 'public', 'favicon.png'));
      }
      if (fs.existsSync(svg512Path)) {
        await sharp(fs.readFileSync(svg512Path)).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512x512.png'));
      }
      if (fs.existsSync(svgMaskPath)) {
        await sharp(fs.readFileSync(svgMaskPath)).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-maskable.png'));
      }
      console.log('[PWA_ICON_SYNC] Restored default official iPDS PNG icons for PWA.');
    }
  } catch (err) {
    console.warn('[PWA_ICON_SYNC] Error generating PNG icons for PWA:', err);
  }
}

// Initial check from Supabase at startup (Skip in serverless read-only filesystem environments)
(async () => {
  try {
    const supabase = getPrivilegedSupabase();
    if (supabase) {
      // 1. Hydrate header logo
      if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'header_logo')
          .maybeSingle();

        if (!error && data && data.value) {
          const storedLogo = typeof data.value === 'string' ? data.value : (data.value && data.value.url) || null;
          // P0-11-D: only hydrate inline data:image/* values; never fetch stored URLs.
          if (storedLogo && parseLogoDataUri(storedLogo)) {
            cachedLogoUrl = storedLogo;
            await generatePwaIcons(storedLogo);
          }
        }
      }

      // 2. Hydrate RBAC registry and credentials from local disk or Supabase
      const localRbacPath = path.join(process.cwd(), 'data', 'rbac_registry.json');
      if (fs.existsSync(localRbacPath)) {
        try {
          const rawLocal = fs.readFileSync(localRbacPath, 'utf-8');
          const localData = JSON.parse(rawLocal);
          if (localData && typeof localData === 'object') {
            cachedRbacRegistry = localData as RbacRegistry;
            const pinMap: Record<string, Record<string, unknown>> = {};
            for (const [pin, user] of Object.entries(localData as RbacRegistry)) {
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
            console.log('[RBAC_STARTUP] Hydrated', Object.keys(pinMap).length, 'user credentials from local disk.');
          }
        } catch (localErr) {
          console.warn('[RBAC_STARTUP] Error reading local rbac_registry.json:', localErr);
        }
      }

      if (supabase) {
        const { data: rbacData, error: rbacError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'rbac_registry')
          .maybeSingle();

        if (!rbacError && rbacData && rbacData.value && typeof rbacData.value === 'object') {
          cachedRbacRegistry = { ...(cachedRbacRegistry || {}), ...(rbacData.value as RbacRegistry) };
          const pinMap: Record<string, Record<string, unknown>> = {};
          for (const [pin, user] of Object.entries(cachedRbacRegistry as RbacRegistry)) {
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
          console.log('[RBAC_STARTUP] Merged & hydrated', Object.keys(pinMap).length, 'user credentials from Supabase.');
        }
      }
    }
  } catch (e: unknown) {
    console.warn('[PWA_STARTUP] Startup sync notice:', getSafeErrorMessage(e));
  }
})();

/**
 * GET /api/settings/logo
 * Fetch logo from Supabase app_settings table or in-memory cache
 */
router.get(['/logo', '/settings/logo'], authenticate, async (req, res) => {
  try {
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'header_logo')
        .maybeSingle();

      if (!error && data && data.value) {
        const logoUrl = typeof data.value === 'string' ? data.value : data.value.url || null;
        if (logoUrl) {
          cachedLogoUrl = logoUrl;
          return res.json({ logoUrl });
        }
      }
    }
  } catch (err) {
    console.warn('[API] Error fetching logo from Supabase:', err);
  }

  // Fallback to in-memory cache
  return res.json({ logoUrl: cachedLogoUrl });
});

/**
 * POST /api/settings/logo
 * Save logo to Supabase app_settings table AND server cache
 */
router.post(['/logo', '/settings/logo'], requireRole(['fc']), adminRateLimiter, async (req, res) => {
  try {
    const { logoUrl } = req.body || {};

    if (logoUrl === undefined) {
      return res.status(400).json({ error: 'Missing logoUrl parameter' });
    }

    // P0-11-D: accept only inline data:image/* (or explicit clear). Reject all
    // client-supplied http(s) URLs to prevent SSRF.
    const isClearing = logoUrl === null || logoUrl === '';
    if (!isClearing && !parseLogoDataUri(logoUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Format logo tidak sah. Hanya imej inline data:image/* dibenarkan.',
        code: 'INVALID_LOGO_FORMAT'
      });
    }

    const previousLogo = cachedLogoUrl;
    cachedLogoUrl = isClearing ? null : logoUrl;

    // Trigger instant PWA icon regeneration (data:image only; never fetches URLs)
    await generatePwaIcons(cachedLogoUrl);

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      const payload = {
        key: 'header_logo',
        value: logoUrl,
        updated_at: new Date().toISOString(),
        estate_id: req.estateId || 'FPM_TUNGGAL'
      };

      const { error } = await supabase
        .from('app_settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) {
        console.warn('[API] Warning upserting logo to Supabase app_settings:', error.message);
      } else {
        console.log('[API] Logo saved successfully to Supabase app_settings table.');
      }
    }

    // Structured Audit: Record Admin Setting Update
    auditService.record({
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.app_metadata.operator_id || req.user?.sub,
      userName: req.user?.user_metadata.operator_name,
      role: req.user?.app_metadata.app_role,
      authorizedEstate: req.estateId || 'FPM_TUNGGAL',
      action: 'ADMIN_OPERATION',
      resource: 'app_settings/header_logo',
      result: 'SUCCESS',
      beforeState: { header_logo: previousLogo ? '[LOGO_PRESENT]' : null },
      afterState: { header_logo: logoUrl ? '[LOGO_UPDATED]' : null },
      ip: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'] || 'unknown',
      details: { operation: 'UPDATE_HEADER_LOGO' }
    });

    return res.json({ success: true, logoUrl: cachedLogoUrl });
  } catch (err: unknown) {
    console.error('[API] Error saving logo:', err);
    return res.status(500).json({ error: getSafeErrorMessage(err) });
  }
});

/**
 * DELETE /api/settings/logo
 * Reset/delete custom logo from Supabase and server cache
 */
router.delete(['/logo', '/settings/logo'], requireRole(['fc']), adminRateLimiter, async (req, res) => {
  try {
    const previousLogo = cachedLogoUrl;
    cachedLogoUrl = null;

    // Reset PWA icons to default official vector
    await generatePwaIcons(null);

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      const { error } = await supabase
        .from('app_settings')
        .delete()
        .eq('key', 'header_logo');

      if (error) {
        console.warn('[API] Warning deleting logo from Supabase app_settings:', error.message);
      }
    }

    // Structured Audit: Record Admin Setting Delete
    auditService.record({
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.app_metadata.operator_id || req.user?.sub,
      userName: req.user?.user_metadata.operator_name,
      role: req.user?.app_metadata.app_role,
      authorizedEstate: req.estateId || 'FPM_TUNGGAL',
      action: 'ADMIN_OPERATION',
      resource: 'app_settings/header_logo',
      result: 'SUCCESS',
      beforeState: { header_logo: previousLogo ? '[LOGO_PRESENT]' : null },
      afterState: { header_logo: null },
      ip: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'] || 'unknown',
      details: { operation: 'DELETE_HEADER_LOGO' }
    });

    return res.json({ success: true, logoUrl: null });
  } catch (err: unknown) {
    console.error('[API] Error deleting logo:', err);
    return res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat dalaman pelayan.') });
  }
});

import { updateServerPinConfig, getServerPinConfig } from '../services/auth.service.js';

/**
 * POST /api/settings/rbac and /api/rbac
 * Save and sync RBAC registry and PINs (Authorized Admin)
 */
router.post(['/rbac', '/settings/rbac'], requireAuth, requireRbacAdmin, adminRateLimiter, async (req, res) => {
  try {
    const { registry } = req.body || {};
    if (registry && typeof registry === 'object') {
      cachedRbacRegistry = registry as RbacRegistry;

      // Update server-side in-memory auth PINs & Identity Service
      const pinMap: Record<string, Record<string, unknown>> = {};
      for (const [pin, user] of Object.entries(registry as RbacRegistry)) {
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

      // 1. Save to local disk (data/rbac_registry.json) for instantaneous durable offline persistence
      try {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        const rbacFilePath = path.join(dataDir, 'rbac_registry.json');
        fs.writeFileSync(rbacFilePath, JSON.stringify(registry, null, 2), 'utf-8');
      } catch (fsErr) {
        console.warn('[RBAC_SYNC] Notice saving to local disk:', fsErr);
      }

      // 2. Save to Supabase app_settings table if connected
      const supabase = req.supabase || getScopedSupabase(req.rawToken);
      if (supabase) {
        try {
          await supabase.from('app_settings').upsert({
            key: 'rbac_registry',
            value: registry,
            updated_at: new Date().toISOString(),
          });
        } catch (e: unknown) {
          console.warn('[RBAC_SYNC] Notice saving to supabase:', getSafeErrorMessage(e));
        }
      }

      return res.json({
        success: true,
        count: Object.keys(pinMap).length,
        message: 'RBAC registry synchronized successfully.'
      });
    }

    return res.status(400).json({ error: 'Format data registry tidak sah.' });
  } catch (err: unknown) {
    console.error('[API] Error saving RBAC registry:', err);
    return res.status(500).json({ error: getSafeErrorMessage(err, 'Ralat dalaman pelayan.') });
  }
});

/**
 * GET /api/settings/rbac and /api/rbac
 * Get current synchronized RBAC registry (Accessible for kiosk and client sync)
 */
router.get(['/rbac', '/settings/rbac'], requireAuth, requireRbacAdmin, async (req, res) => {
  try {
    if (cachedRbacRegistry) {
      return res.json({ success: true, registry: sanitizeRbacRegistryForResponse(cachedRbacRegistry) });
    }

    // Check local disk first
    const rbacFilePath = path.join(process.cwd(), 'data', 'rbac_registry.json');
    if (fs.existsSync(rbacFilePath)) {
      try {
        const raw = fs.readFileSync(rbacFilePath, 'utf-8');
        const fileRegistry = JSON.parse(raw);
        if (fileRegistry && typeof fileRegistry === 'object') {
          cachedRbacRegistry = fileRegistry as RbacRegistry;
          return res.json({ success: true, registry: sanitizeRbacRegistryForResponse(fileRegistry) });
        }
      } catch (err) {
        console.warn('[RBAC] Error reading local rbac_registry.json:', err);
      }
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'rbac_registry')
        .maybeSingle();

      if (data && data.value) {
        cachedRbacRegistry = data.value as RbacRegistry;
        return res.json({ success: true, registry: sanitizeRbacRegistryForResponse(data.value as RbacRegistry) });
      }
    }

    // Dynamic fallback to system pin users so registry is never empty
    const defaultUsers = getServerPinConfig();
    const fallbackRegistry: RbacRegistry = {};
    for (const [pin, u] of Object.entries(defaultUsers)) {
      fallbackRegistry[pin] = {
        id: `role_${u.app_role}_${pin}`,
        pin,
        role: u.app_role,
        label: u.operator_name || 'Staf Ladang',
        estate_id: u.estate_id || 'FPM_TUNGGAL',
        username: u.username || pin,
        password: u.password || pin,
        email: u.email || `${pin}@felda.gov.my`,
        quickAccess: ['fc', 'rc', 'oc'].includes(u.app_role),
        allowedModules: ['fc', 'rc', 'oc', 'pf', 'afc'].includes(u.app_role)
          ? ['dashboard', 'hasil', 'pekerja', 'sejarah', 'kualiti', 'fertilizer', 'merumput', 'hujan', 'export', 'settings']
          : ['hasil', 'pekerja']
      };
    }
    cachedRbacRegistry = fallbackRegistry;

    return res.json({ success: true, registry: sanitizeRbacRegistryForResponse(fallbackRegistry) });
  } catch (err: unknown) {
    return res.status(500).json({ error: getSafeErrorMessage(err) });
  }
});

/**
 * GET /api/config-check
 * Verify Supabase connection readiness
 */
router.get(['/config-check', '/settings/config-check'], (req, res) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const isReady = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co');

  res.json({
    supabase: isReady,
    googleSheets: false,
    supabaseUrl: isReady ? supabaseUrl : undefined,
    supabaseAnonKey: isReady ? supabaseAnonKey : undefined,
  });
});

/**
 * GET /api/public-config
 * Provide public client configuration for Supabase URL and Anon Key
 */
router.get(['/public-config', '/settings/public-config'], (req, res) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  res.json({
    supabaseUrl,
    supabaseAnonKey,
    isConfigured: !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co')
  });
});

export default router;
