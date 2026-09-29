import { Request, Response, NextFunction } from 'express';

/**
 * Enterprise CSRF Defense Middleware for IPDS SPA & API
 * 
 * Enforces:
 * 1. Sec-Fetch-Site check (blocks cross-site requests instantly)
 * 2. Origin header validation on state-changing HTTP methods (POST, PUT, PATCH, DELETE)
 * 3. Referer header fallback validation when Origin is not provided
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // Exempt internal machine/kiosk sync endpoints, health checks, cron triggers, and auth verification endpoints
  const reqUrl = req.originalUrl || req.url || req.path || '';
  const isExcludedPath = [
    '/api/health',
    '/health',
    '/api/cron',
    '/cron',
    '/api/telemetry/client-error',
    '/telemetry/client-error',
    '/api/auth/logout',
    '/auth/logout',
    '/api/devices/approve-link',
    '/devices/approve-link',
    '/api/devices/approve-with-pin',
    '/devices/approve-with-pin',
    '/api/devices/request-approval',
    '/devices/request-approval'
  ].some(p => reqUrl.includes(p) || req.path.startsWith(p) || req.baseUrl.startsWith(p));

  if (isExcludedPath) {
    return next();
  }

  // 1. Defense-in-depth: Sec-Fetch-Site validation
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    return res.status(403).json({
      success: false,
      error: 'Akses dinafikan: Permintaan rentas tapak (cross-site) disekat oleh kawalan keselamatan CSRF.',
      code: 'CSRF_CROSS_SITE_REJECTED'
    });
  }

  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;
  const host = req.get('host'); // e.g. "localhost:3000" or "*.run.app"
  const forwardedHost = req.get('x-forwarded-host');

  // Compile list of trusted origins
  const trustedOrigins = new Set<string>();

  if (host) {
    trustedOrigins.add(`http://${host}`);
    trustedOrigins.add(`https://${host}`);
  }

  if (forwardedHost) {
    trustedOrigins.add(`http://${forwardedHost}`);
    trustedOrigins.add(`https://${forwardedHost}`);
  }

  if (process.env.VERCEL_URL) {
    trustedOrigins.add(`https://${process.env.VERCEL_URL}`);
  }

  // Standard development and preview origins
  trustedOrigins.add('http://localhost:3000');
  trustedOrigins.add('http://127.0.0.1:3000');
  trustedOrigins.add('http://localhost:5173');
  trustedOrigins.add('http://127.0.0.1:5173');

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(o => {
      const trimmed = o.trim();
      if (trimmed) trustedOrigins.add(trimmed);
    });
  }

  // Helper to test if a host matches official application domains
  const isHostAllowed = (testHost: string): boolean => {
    if (!testHost) return false;
    if (host && testHost === host) return true;
    if (forwardedHost && testHost === forwardedHost) return true;
    if (testHost.includes('localhost') || testHost.includes('127.0.0.1')) return true;
    if (testHost.endsWith('.vercel.app') || testHost.includes('vercel.app')) return true;
    if (testHost.endsWith('.run.app') || testHost.includes('run.app')) return true;
    if (testHost.endsWith('.applet.ai') || testHost.includes('applet.ai')) return true;
    if (testHost.endsWith('.googleusercontent.com')) return true;
    return false;
  };

  // 2. Validate Origin Header
  if (origin) {
    let isValid = false;
    if (trustedOrigins.has(origin)) {
      isValid = true;
    } else {
      try {
        const parsed = new URL(origin);
        if (isHostAllowed(parsed.host)) {
          isValid = true;
        }
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      return res.status(403).json({
        success: false,
        error: 'Akses dinafikan: Header Origin tidak sah atau berasal dari domain luar yang tidak dibenarkan.',
        code: 'CSRF_INVALID_ORIGIN',
        rejectedOrigin: origin
      });
    }

    return next();
  }

  // 3. Fallback: Validate Referer Header when Origin is absent
  if (referer) {
    let isRefererValid = false;
    try {
      const parsedRef = new URL(referer);
      const refOrigin = `${parsedRef.protocol}//${parsedRef.host}`;
      if (trustedOrigins.has(refOrigin) || isHostAllowed(parsedRef.host)) {
        isRefererValid = true;
      }
    } catch {
      isRefererValid = false;
    }

    if (!isRefererValid) {
      return res.status(403).json({
        success: false,
        error: 'Akses dinafikan: Header Referer tidak sah atau berasal dari sumber luaran yang tidak dipercayai.',
        code: 'CSRF_INVALID_REFERER',
        rejectedReferer: referer
      });
    }

    return next();
  }

  // 4. Missing both Origin and Referer:
  // If Sec-Fetch-Mode is 'cors' or 'navigate' but origin/referer were stripped by an external site,
  // we check if sec-fetch-site is explicitly 'same-origin' or 'same-site' or safe non-browser API client.
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'same-site' && secFetchSite !== 'none') {
    return res.status(403).json({
      success: false,
      error: 'Akses dinafikan: Metadata permintaan pelayar tidak sah.',
      code: 'CSRF_UNVERIFIED_REQUEST'
    });
  }

  next();
}
