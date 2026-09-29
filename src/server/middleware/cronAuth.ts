/**
 * iPDS v4.1.0 — Vercel Cron Authentication & Security Guard Middleware
 * 
 * DESIGN PRINCIPLES:
 * 1. Constant-Time Token Comparison (crypto.timingSafeEqual) prevents timing attacks.
 * 2. Multi-Header Support: Evaluates 'Authorization: Bearer <CRON_SECRET>', 'x-cron-secret', and query parameters.
 * 3. Environment Fallback: Strictly enforces CRON_SECRET in production while providing safe dev fallback.
 * 4. System Identity Injection: Populates system-level audit and user session metadata for background workers.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { auditService } from '../services/audit.service.js';

export const DEV_DEFAULT_CRON_SECRET = 'dev_cron_secret_ipds_2026';

/**
 * Safely extracts the cron secret token from request headers or query
 */
export function extractCronSecretFromRequest(req: Request): string | null {
  // 1. Authorization: Bearer <TOKEN> (Vercel standard)
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.trim().split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1].trim();
    }
  }

  // 2. Custom headers: x-cron-secret or x-vercel-cron
  const xCronSecret = req.headers['x-cron-secret'] as string | undefined;
  if (xCronSecret && typeof xCronSecret === 'string' && xCronSecret.trim().length > 0) {
    return xCronSecret.trim();
  }

  // 3. Fallback: Query parameter for testing / manual trigger in staging
  const querySecret = req.query?.secret || req.query?.cron_secret;
  if (querySecret && typeof querySecret === 'string' && querySecret.trim().length > 0) {
    return querySecret.trim();
  }

  return null;
}

/**
 * Timing-safe string comparison to prevent side-channel timing attacks
 */
export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function getEffectiveCronSecret(isProduction = process.env.NODE_ENV === 'production'): string {
  const envSecret = process.env.CRON_SECRET?.trim();
  if (envSecret && !envSecret.startsWith('#')) {
    return envSecret;
  }
  return !isProduction ? DEV_DEFAULT_CRON_SECRET : '';
}

/**
 * Middleware: requireCronAuth
 * Protects cron job runner endpoints from unauthorized access
 */
export function requireCronAuth(req: Request, res: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredSecret = getEffectiveCronSecret(isProduction);

  const correlationId = (req as any).correlationId || (req as any).requestId || `cron_${Date.now().toString(36)}`;

  // If in production and no CRON_SECRET is configured at all
  if (isProduction && !configuredSecret) {
    console.error(`[CRON_AUTH_CRITICAL] [${correlationId}] CRON_SECRET environment variable is not defined in production.`);
    return res.status(500).json({
      success: false,
      error: 'Ralat konfigurasi keselamatan: Pembolehubah CRON_SECRET tidak ditetapkan pada pelayan produksi.',
      code: 'CRON_SECRET_NOT_CONFIGURED',
      correlationId
    });
  }

  const providedSecret = extractCronSecretFromRequest(req);

  if (!providedSecret) {
    auditService.record({
      userId: 'system:anonymous',
      userName: 'ANONYMOUS_CALLER',
      role: 'unauthorized',
      authorizedEstate: 'GLOBAL',
      action: 'ADMIN_OPERATION',
      resource: 'cron_process_jobs',
      result: 'DENIED',
      errorMessage: 'Missing Cron Authorization token'
    });

    return res.status(401).json({
      success: false,
      error: 'Akses dinafikan: Token pengesahan Vercel Cron (CRON_SECRET) tidak dibekalkan.',
      code: 'UNAUTHORIZED_CRON_MISSING_SECRET',
      correlationId
    });
  }

  const isValid = timingSafeCompare(providedSecret, configuredSecret);

  if (!isValid) {
    auditService.record({
      userId: 'system:unauthorized',
      userName: 'INVALID_CRON_TOKEN',
      role: 'unauthorized',
      authorizedEstate: 'GLOBAL',
      action: 'ADMIN_OPERATION',
      resource: 'cron_process_jobs',
      result: 'DENIED',
      errorMessage: 'Invalid Cron Authorization token presented'
    });

    return res.status(401).json({
      success: false,
      error: 'Akses dinafikan: Token pengesahan Vercel Cron tidak sah.',
      code: 'UNAUTHORIZED_CRON_INVALID_SECRET',
      correlationId
    });
  }

  // Inject System Cron Identity Context for audit trails & worker context
  const nowSec = Math.floor(Date.now() / 1000);
  req.user = {
    iss: 'supabase',
    sub: 'system:vercel-cron-scheduler',
    aud: 'authenticated',
    role: 'authenticated',
    session_id: 'cron-session-system',
    app_metadata: {
      app_role: 'rc',
      estate_id: 'ALL',
      kiosk_id: 'cron-runner-kiosk',
      operator_id: 'VERCEL_CRON_SERVICE',
      auth_method: 'CRON_SECRET'
    },
    user_metadata: {
      operator_name: 'Vercel Cron Automation Runner',
      station_name: 'Vercel Serverless Cron Gateway'
    },
    iat: nowSec,
    exp: nowSec + 3600
  };
  req.authRole = 'rc';
  req.estateId = 'ALL';

  next();
}
