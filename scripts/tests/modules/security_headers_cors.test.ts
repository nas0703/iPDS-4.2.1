import { isAllowedOrigin, securityHeadersMiddleware, corsAllowListMiddleware } from '../../../src/server/middleware/securityHeaders.js';

export async function runSecurityHeadersAndCorsTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE: SECURITY HEADERS & STRICT CORS ALLOW-LIST');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test SH.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test SH.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. isAllowedOrigin logic
  {
    assert(isAllowedOrigin('http://localhost:3000'), 'Local dev origin localhost:3000 is allowed');
    assert(isAllowedOrigin('http://127.0.0.1:3000'), 'Local dev origin 127.0.0.1:3000 is allowed');
    assert(isAllowedOrigin('https://ipds.felda.gov.my'), 'Production felda.gov.my domain is allowed');
    assert(isAllowedOrigin('https://subdomain.felda.gov.my'), 'Subdomain on felda.gov.my is allowed');
    assert(isAllowedOrigin('https://ipds-staging.vercel.app'), 'Vercel deployment domain is allowed');
    assert(isAllowedOrigin('https://preview.run.app'), 'Cloud Run preview domain is allowed');
    assert(!isAllowedOrigin('https://attacker.com'), 'Arbitrary origin attacker.com is rejected');
    assert(!isAllowedOrigin('http://evil-felda.gov.my.attacker.com'), 'Phishing prefix/suffix domain is rejected');
    assert(!isAllowedOrigin('null'), 'String "null" origin is rejected');
    assert(!isAllowedOrigin(''), 'Empty origin is rejected');
  }

  // 2. securityHeadersMiddleware headers verification
  {
    const req: any = { secure: true, headers: {} };
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader(name: string, val: string) { headers[name.toLowerCase()] = val; }
    };
    let nextCalled = false;
    securityHeadersMiddleware(req, res, () => { nextCalled = true; });

    assert(nextCalled, 'securityHeadersMiddleware calls next()');
    assert(headers['strict-transport-security']?.includes('max-age=31536000'), 'HSTS header set to at least 1 year (31536000s)');
    assert(headers['strict-transport-security']?.includes('includeSubDomains'), 'HSTS includes includeSubDomains');
    assert(headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options is nosniff');
    assert(headers['x-frame-options'] === 'SAMEORIGIN', 'X-Frame-Options is SAMEORIGIN');
    assert(headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy is strict-origin-when-cross-origin');
    assert(headers['permissions-policy']?.includes('camera=(self)'), 'Permissions-Policy is present and restricts APIs');
    assert(headers['content-security-policy']?.includes("object-src 'none'"), 'CSP restricts object-src to none');
    assert(headers['content-security-policy']?.includes("frame-ancestors"), 'CSP restricts frame-ancestors');
  }

  // 3. corsAllowListMiddleware behavior
  {
    // Allowed origin
    const reqAllowed: any = {
      method: 'GET',
      headers: { origin: 'https://ipds.felda.gov.my' }
    };
    const headersAllowed: Record<string, string> = {};
    const resAllowed: any = {
      setHeader(name: string, val: string) { headersAllowed[name.toLowerCase()] = val; }
    };
    let nextAllowed = false;
    corsAllowListMiddleware(reqAllowed, resAllowed, () => { nextAllowed = true; });

    assert(nextAllowed, 'Allowed origin calls next()');
    assert(headersAllowed['access-control-allow-origin'] === 'https://ipds.felda.gov.my', 'CORS returns exact allowed origin (not *)');
    assert(headersAllowed['access-control-allow-credentials'] === 'true', 'CORS allows credentials for allowed origin');

    // Disallowed origin on preflight OPTIONS
    let optionsStatus = 0;
    let optionsJson: any = null;
    const reqForbiddenOptions: any = {
      method: 'OPTIONS',
      headers: { origin: 'https://malicious-site.com' }
    };
    const resForbiddenOptions: any = {
      setHeader() {},
      status(code: number) { optionsStatus = code; return this; },
      json(data: any) { optionsJson = data; }
    };
    let nextForbiddenOptions = false;
    corsAllowListMiddleware(reqForbiddenOptions, resForbiddenOptions, () => { nextForbiddenOptions = true; });

    assert(!nextForbiddenOptions, 'Disallowed origin preflight does NOT call next()');
    assert(optionsStatus === 403, 'Disallowed origin preflight returns 403 Forbidden');
    assert(optionsJson?.code === 'CORS_ORIGIN_NOT_ALLOWED', 'Disallowed origin preflight returns CORS error code');

    // Disallowed origin on regular GET does NOT set Access-Control-Allow-Origin
    const reqForbiddenGet: any = {
      method: 'GET',
      headers: { origin: 'https://malicious-site.com' }
    };
    const headersForbiddenGet: Record<string, string> = {};
    const resForbiddenGet: any = {
      setHeader(name: string, val: string) { headersForbiddenGet[name.toLowerCase()] = val; }
    };
    let nextForbiddenGet = false;
    corsAllowListMiddleware(reqForbiddenGet, resForbiddenGet, () => { nextForbiddenGet = true; });

    assert(nextForbiddenGet, 'Disallowed regular request calls next() without setting CORS headers');
    assert(!headersForbiddenGet['access-control-allow-origin'], 'Disallowed regular request gets NO Access-Control-Allow-Origin header (browser blocks)');
  }

  console.log(`\nMODULE RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total };
}

// Self-invoking when executed directly
if (process.argv[1]?.includes('security_headers_cors.test')) {
  runSecurityHeadersAndCorsTests().then(res => {
    process.exit(res.passed === res.total ? 0 : 1);
  });
}
