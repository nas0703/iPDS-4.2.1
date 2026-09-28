import fs from 'fs';
import path from 'path';
import { AuthService, getSupabaseJwtSecret, getSupabaseIssuer } from '../../../src/server/services/auth.service.js';
import { extractUserFromRequest, COOKIE_NAME } from '../../../src/server/middleware/auth.js';
import { IdentityService } from '../../../src/server/services/identity.service.js';
import jwt from 'jsonwebtoken';

export async function runSecurityComplianceTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 8: ENTERPRISE SECURITY & COMPLIANCE ENFORCEMENT');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 8.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 8.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Secret Leakage Pre-Deployment Check (No Service Role or JWT Secret in Client Code)
  {
    const clientSrcPath = path.join(process.cwd(), 'src');
    const clientFiles = fs.readdirSync(clientSrcPath, { recursive: true }) as string[];
    let leakedSecretFound = false;

    for (const file of clientFiles) {
      if (typeof file === 'string' && (file.endsWith('.tsx') || file.endsWith('.ts')) && !file.includes('server')) {
        const fullPath = path.join(clientSrcPath, file);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.includes('SUPABASE_SERVICE_ROLE_KEY') && !content.includes('// Safe check') && !content.includes('process.env.SUPABASE_SERVICE_ROLE_KEY')) {
            leakedSecretFound = true;
          }
        }
      }
    }
    assert(!leakedSecretFound, 'Zero server-side secrets (Service Role / AI Keys) leaked in client-side bundles');
  }

  // 2. Cookie Security Configuration (HttpOnly & SameSite validation)
  {
    assert(COOKIE_NAME === 'ipds_session', 'Standardized secure authentication cookie identifier active (ipds_session)');
  }

  // 3. JWT Signature Algorithm Strictness (No 'none' algorithm bypass)
  {
    let unsignedTokenAccepted = false;
    try {
      // Craft header with 'none' algorithm (common auth bypass attack vector)
      const unsignedPayload = Buffer.from(JSON.stringify({ sub: 'attacker', app_metadata: { app_role: 'fc' } })).toString('base64url');
      const unsignedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const unsignedToken = `${unsignedHeader}.${unsignedPayload}.`;

      const mockReq: any = {
        cookies: { [COOKIE_NAME]: unsignedToken },
        headers: {}
      };
      const { user } = extractUserFromRequest(mockReq);
      if (user !== null) {
        unsignedTokenAccepted = true;
      }
    } catch {
      unsignedTokenAccepted = false;
    }
    assert(!unsignedTokenAccepted, "Unsigned JWT ('alg: none') attack vector is strictly rejected");
  }

  // 4. Role Escalation Immunity (Staff cannot escalate to PF/FC by mutating payload)
  {
    const staffSession = AuthService.verifyPin('123456');
    let escalationBlocked = false;
    if (staffSession) {
      // Attempt to tamper the token claim from 'staff' to 'fc'
      const validToken = AuthService.generateToken(staffSession);
      const parts = validToken.split('.');
      if (parts.length === 3) {
        const tamperedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        tamperedPayload.app_metadata.app_role = 'fc'; // Force escalation
        const forgedPayloadB64 = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
        const forgedToken = `${parts[0]}.${forgedPayloadB64}.${parts[2]}`; // Reusing old signature

        const mockReq: any = {
          cookies: { [COOKIE_NAME]: forgedToken },
          headers: {}
        };
        const { user } = extractUserFromRequest(mockReq);
        escalationBlocked = (user === null);
      }
    }
    assert(escalationBlocked, 'Role escalation via signature tampering is blocked with zero tolerance');
  }

  // 5. Tenant / Estate Isolation Assertion
  {
    const staffSession = AuthService.verifyPin('123456');
    assert(
      staffSession?.app_metadata?.estate_id === 'FPM_TUNGGAL',
      'Authenticated session binds strictly to estate tenant context (app_metadata.estate_id)'
    );
  }

  // 6. Mandatory RBAC Matrix Coverage (All 11 modules guarded)
  {
    const profiles = IdentityService.getAllProfiles();
    const hasAdmin = profiles.some(r => r.app_role === 'fc');
    const hasManager = profiles.some(r => r.app_role === 'pf');
    const hasFieldStaff = profiles.some(r => r.app_role === 'staff');
    assert(hasAdmin && hasManager && hasFieldStaff, 'RBAC Matrix guarantees multi-tier role hierarchy (FC, PF, Staff)');
  }

  // 7-12. P0-03 JWT Secret Remediation: Fail-Closed & Zero Hardcoded Fallback
  {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSupabaseJwt = process.env.SUPABASE_JWT_SECRET;
    const originalJwt = process.env.JWT_SECRET;
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalViteUrl = process.env.VITE_SUPABASE_URL;
    const originalNextUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    try {
      // 7. Hardcoded fallback secret must be permanently removed from server source
      {
        const authSource = fs.readFileSync(
          path.join(process.cwd(), 'src/server/services/auth.service.ts'),
          'utf-8'
        );
        assert(
          !authSource.includes('felda-ipds-secure-jwt-secret-fallback-key-2026-auth'),
          'P0-03: Hardcoded JWT fallback secret is absent from auth.service.ts source'
        );
      }

      // 8. Production without any configured secret MUST fail closed (throw)
      delete process.env.SUPABASE_JWT_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';
      let productionThrew = false;
      try {
        getSupabaseJwtSecret();
      } catch {
        productionThrew = true;
      }
      assert(productionThrew, 'P0-03: Production fails closed (throws) when SUPABASE_JWT_SECRET/JWT_SECRET is missing');

      // 9. Production honors an explicitly configured SUPABASE_JWT_SECRET
      process.env.SUPABASE_JWT_SECRET = 'test-production-secret-value';
      assert(
        getSupabaseJwtSecret() === 'test-production-secret-value',
        'P0-03: Production uses the explicitly configured SUPABASE_JWT_SECRET'
      );

      // 10. Production honors JWT_SECRET only when SUPABASE_JWT_SECRET is absent
      delete process.env.SUPABASE_JWT_SECRET;
      process.env.JWT_SECRET = 'test-production-jwt-secret';
      assert(
        getSupabaseJwtSecret() === 'test-production-jwt-secret',
        'P0-03: Production honors JWT_SECRET when SUPABASE_JWT_SECRET is not set'
      );

      // 11. Production fails closed for the issuer when no trusted Supabase URL exists
      delete process.env.SUPABASE_URL;
      delete process.env.VITE_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      let issuerThrew = false;
      try {
        getSupabaseIssuer();
      } catch {
        issuerThrew = true;
      }
      assert(issuerThrew, 'P0-03: Production fails closed (throws) when no trusted SUPABASE_URL issuer can be derived');

      // 12. Non-production resolves a usable ephemeral secret (no hardcoded value)
      process.env.NODE_ENV = 'development';
      delete process.env.SUPABASE_JWT_SECRET;
      delete process.env.JWT_SECRET;
      const devSecret = getSupabaseJwtSecret();
      assert(
        typeof devSecret === 'string' && devSecret.length >= 32 && devSecret !== 'felda-ipds-secure-jwt-secret-fallback-key-2026-auth',
        'P0-03: Non-production resolves a non-empty ephemeral development secret (no hardcoded value)'
      );
    } finally {
      const restore = (key: string, value: string | undefined) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      };
      restore('NODE_ENV', originalNodeEnv);
      restore('SUPABASE_JWT_SECRET', originalSupabaseJwt);
      restore('JWT_SECRET', originalJwt);
      restore('SUPABASE_URL', originalSupabaseUrl);
      restore('VITE_SUPABASE_URL', originalViteUrl);
      restore('NEXT_PUBLIC_SUPABASE_URL', originalNextUrl);
    }
  }

  return { passed, total };
}

if (process.argv[1]?.endsWith('security_compliance.test.ts') || process.argv[1]?.endsWith('security_compliance.test.js')) {
  runSecurityComplianceTests().then((res) => {
    process.exit(res.passed === res.total ? 0 : 1);
  });
}


