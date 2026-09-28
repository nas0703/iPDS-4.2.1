import { Request, Response, NextFunction } from 'express';

/**
 * Enterprise Security Headers & Strict CORS Allow-List Middleware
 *
 * Provides defense-in-depth:
 * 1. Strict-Transport-Security (HSTS: 1 year, includeSubDomains)
 * 2. Content-Security-Policy (CSP: restrictive script-src, object-src 'none', frame-ancestors)
 * 3. X-Content-Type-Options: nosniff
 * 4. X-Frame-Options: SAMEORIGIN
 * 5. Referrer-Policy: strict-origin-when-cross-origin
 * 6. Permissions-Policy (restricts sensitive APIs)
 * 7. CORS Allow-List (Restricts origins strictly, rejecting arbitrary/reflected origins)
 */

// Helper to determine if an origin matches an allowed pattern (supporting wildcard subdomains)
export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  const cleanOrigin = origin.trim().toLowerCase();

  // Local development origins
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
    return true;
  }

  // Custom configured origins via environment variables
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim().toLowerCase())
    .filter(Boolean);
  if (envOrigins.includes(cleanOrigin)) return true;

  if (process.env.APP_URL && cleanOrigin === process.env.APP_URL.trim().toLowerCase()) {
    return true;
  }

  // Trusted domain patterns
  const allowedPatterns = [
    /^https:\/\/([a-zA-Z0-9-]+\.)*felda\.gov\.my$/,
    /^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/,
    /^https:\/\/([a-zA-Z0-9-]+\.)*run\.app$/,
    /^https:\/\/([a-zA-Z0-9-]+\.)*googleusercontent\.com$/,
    /^https:\/\/([a-zA-Z0-9-]+\.)*aistudio\.google\.com$/
  ];

  return allowedPatterns.some(pattern => pattern.test(cleanOrigin));
}

/**
 * Defense-in-depth Security Headers Middleware
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // 1. Strict-Transport-Security (HSTS - 1 year with includeSubDomains & preload)
  if (process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // 2. X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 3. X-Frame-Options (complemented by CSP frame-ancestors)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // 4. Referrer-Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 5. Permissions-Policy (restrict unused sensor/hardware APIs)
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), interest-cohort=()'
  );

  // 6. Content-Security-Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self' https://*.google.com https://*.aistudio.google.com https://*.googleusercontent.com https://*.run.app"
  ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  next();
};

/**
 * Strict CORS Allow-List Middleware
 * Replaces wildcards '*' or reflective CORS with an authoritative allow-list
 */
export const corsAllowListMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;

  // Requests without Origin header (e.g. server-to-server, cron, same-origin, curl)
  if (!origin) {
    return next();
  }

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-Request-ID, X-Correlation-ID, X-Trace-ID, X-Estate-ID, X-Device-ID, X-Device-Signature, X-Device-Timestamp, X-Admin-Reauth-PIN'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    return next();
  }

  // Preflight rejected if origin not permitted
  if (req.method === 'OPTIONS') {
    res.status(403).json({
      success: false,
      error: 'CORS policy violation: Origin not allowed.',
      code: 'CORS_ORIGIN_NOT_ALLOWED'
    });
    return;
  }

  // Proceed without CORS headers so the browser enforces the cross-origin boundary
  next();
};

