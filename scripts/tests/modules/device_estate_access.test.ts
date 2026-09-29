/**
 * iPDS v4.1.0 — Test Module 45: P0-16C.2 Multi-Estate Device Authorization
 *
 * Verifies the explicit device -> estate authorization layer:
 *   - migration/schema/RLS/ACL
 *   - service grant/revoke/list/get semantics (idempotent, pair-scoped, fail-closed)
 *   - API admin authorization + estate boundary
 *   - approval-flow grant integration (single estate only)
 *   - NO login enforcement (C.3) introduced
 */

import fs from 'fs';
import path from 'path';
import {
  deviceSecurityService,
  isValidEstateId,
  getDeviceEstateAccess,
  listDeviceEstateAccess,
  grantDeviceEstateAccess,
  revokeDeviceEstateAccess,
  isDeviceAuthorizedForEstate
} from '../../../src/server/services/deviceSecurity.service.js';
import devicesRoutes from '../../../src/server/routes/devices.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

type Method = 'get' | 'post' | 'delete';

interface MockResult { status: number; body: any; allowed: boolean; }

function findRoute(method: Method, exactPath: string) {
  const stack = (devicesRoutes as any).stack || [];
  return stack.find((l: any) => {
    const p = l.route?.path;
    const paths = Array.isArray(p) ? p : [p];
    return l.route?.methods?.[method] && paths.includes(exactPath);
  });
}
function routeHandlers(route: any): any[] {
  return (route?.route?.stack || []).map((s: any) => s.handle);
}
function invokeHandlers(handlers: any[], req: any): Promise<MockResult> {
  return new Promise((resolve) => {
    let status = 200; let body: any = null; let settled = false;
    const finish = (allowed = false) => { if (!settled) { settled = true; resolve({ status, body, allowed }); } };
    const res: any = {
      status(code: number) { status = code; return res; },
      json(data: any) { body = data; finish(false); return res; },
      send(data: any) { body = data; finish(false); return res; },
      setHeader() { return res; },
      getHeader() { return undefined; },
      end() { finish(false); return res; }
    };
    let i = 0;
    const next = (err?: any) => {
      if (err) { status = 500; body = { error: String(err?.message || err) }; finish(false); return; }
      if (i >= handlers.length) { finish(true); return; }
      const handler = handlers[i++];
      try { handler(req, res, next); }
      catch (e: any) { status = 500; body = { error: e?.message || e }; finish(false); }
    };
    next();
  });
}
function buildReq(method: string, opts: { headers?: Record<string, string>; query?: any; body?: any } = {}): any {
  return {
    method, headers: opts.headers || {}, cookies: {}, query: opts.query || {}, body: opts.body || {},
    ip: '127.0.0.1', originalUrl: '/api/devices', url: '/api/devices', path: '/api/devices', baseUrl: '',
    get(name: string) { return this.headers[String(name).toLowerCase()]; }
  };
}
function read(rel: string): string { return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8'); }

const SERVICE_SRC = 'src/server/services/deviceSecurity.service.ts';
const ROUTES_SRC = 'src/server/routes/devices.routes.ts';
const AUTH_ROUTES_SRC = 'src/server/routes/auth.routes.ts';
const MIDDLEWARE_SRC = 'src/server/middleware/auth.ts';
const MIGRATION = 'supabase/migrations/20260924_p0_16c_device_estate_access.sql';

const PIN_STAFF = authHeaders('123456');
const PIN_MANDUR = authHeaders('222222');
const PIN_FC = authHeaders('2401199');
// FC Tunggal (2401199) is the designated cross-estate Super Admin; use a genuine
// single-estate branch FC (FC Adela 600300) for estate-boundary assertions.
const PIN_FC_BRANCH = authHeaders('600300');
const PIN_RC = authHeaders('111111');

export async function runDeviceEstateAccessTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 45: P0-16C.2 MULTI-ESTATE DEVICE AUTHORIZATION');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 45.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 45.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 45.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  const envKeys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];

  try {
    for (const k of envKeys) delete process.env[k];
    // Non-production: keep the ephemeral dev JWT secret usable for the signed
    // test tokens regardless of what earlier modules left in NODE_ENV.
    process.env.NODE_ENV = 'test';

    // 1. Migration / schema
    {
      assert(fs.existsSync(path.join(process.cwd(), MIGRATION)), 'migration 20260924 exists');
      const sql = read(MIGRATION);
      const code = sql.replace(/--[^\n]*/g, '');
      assert(/CREATE TABLE IF NOT EXISTS public\.device_estate_access/.test(code), 'migration creates public.device_estate_access');
      for (const col of ['device_id', 'estate_id', 'status', 'granted_by', 'granted_at', 'revoked_by', 'revoked_at']) {
        assert(new RegExp(`\\b${col}\\b`).test(code), `migration defines column ${col}`);
      }
      assert(/CONSTRAINT uq_device_estate_access_device_estate UNIQUE \(device_id, estate_id\)/.test(code), 'unique (device_id, estate_id)');
      assert(/CHECK \(status IN \('ACTIVE', 'REVOKED'\)\)/.test(code), 'status constrained to ACTIVE/REVOKED');
      assert(/ENABLE ROW LEVEL SECURITY/.test(code) && /FORCE ROW LEVEL SECURITY/.test(code), 'RLS enabled and forced');
      assert(/REVOKE ALL ON public\.device_estate_access FROM PUBLIC/.test(code) && /FROM anon/.test(code) && /FROM authenticated/.test(code), 'PUBLIC/anon/authenticated revoked');
      assert(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.device_estate_access TO service_role/.test(code), 'service_role granted CRUD');
      assert(/CREATE POLICY device_estate_access_service_role_policy[\s\S]*?TO service_role/.test(code), 'service_role-only policy present');
      assert(/CREATE INDEX IF NOT EXISTS idx_device_estate_access_device\b/.test(code) && /idx_device_estate_access_estate\b/.test(code) && /idx_device_estate_access_device_status\b/.test(code), 'indexes on device_id / estate_id / (device_id,status)');
      assert(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP TABLE)\b/i.test(code.replace(/\b(GRANT|REVOKE)\b[^;]*;/gi, '')), 'migration has no DML/destructive DDL');
      assert(!/REFERENCES/i.test(code), 'migration adds no FK (avoids inventing relationships)');
      assert(/BEGIN;/.test(sql) && /COMMIT;/.test(sql), 'migration wrapped in a transaction');
      const files = fs.readdirSync(path.join(process.cwd(), 'supabase', 'migrations')).filter(f => f.endsWith('.sql')).sort();
      assert(files.indexOf('20260924_p0_16c_device_estate_access.sql') > files.indexOf('20260923_p0_16c_device_credentials.sql'), 'migration ordered after 20260923');
      const tables = [...code.matchAll(/public\.([a-z_]+)/gi)].map(m => m[1].toLowerCase());
      assert(tables.length >= 1 && tables.every(t => t === 'device_estate_access'), 'migration only targets device_estate_access');
    }

    // 2. Estate validation (canonical registry)
    {
      assert(isValidEstateId('FPM_TUNGGAL') === true, 'valid estate FPM_TUNGGAL accepted');
      assert(isValidEstateId('fpm_adela') === true, 'estate validation is case-insensitive');
      assert(isValidEstateId('WILAYAH_JB') === true, 'valid aggregate estate accepted');
      assert(isValidEstateId('BOGUS_ESTATE') === false, 'unknown estate rejected');
      assert(isValidEstateId('') === false && isValidEstateId(null) === false && isValidEstateId(undefined) === false, 'blank/null estate rejected');
    }

    // 3. Service semantics (fail-closed without DB)
    {
      assert((await grantDeviceEstateAccess('', 'FPM_TUNGGAL')) === null, 'grant rejects empty deviceId');
      assert((await grantDeviceEstateAccess('DEV-C2-X', 'BOGUS')) === null, 'grant rejects invalid estate');
      assert((await grantDeviceEstateAccess('DEV-C2-UNKNOWN', 'FPM_TUNGGAL')) === null, 'grant fails closed for unknown device / no DB');
      assert((await revokeDeviceEstateAccess('DEV-C2-UNKNOWN', 'FPM_TUNGGAL')) === false, 'revoke fails closed without DB');
      assert((await getDeviceEstateAccess('DEV-C2-UNKNOWN', 'FPM_TUNGGAL')) === null, 'getDeviceEstateAccess fails closed without DB');
      assert((await listDeviceEstateAccess('DEV-C2-UNKNOWN')).length === 0, 'listDeviceEstateAccess returns empty without DB');
      assert((await isDeviceAuthorizedForEstate('DEV-C2-UNKNOWN', 'FPM_TUNGGAL')) === false, 'missing grant is denied (fail-closed)');
      assert((await isDeviceAuthorizedForEstate('', 'FPM_TUNGGAL')) === false, 'empty device denied');
    }

    // 4. API authorization
    {
      const getRoute = findRoute('get', '/device-estate-access');
      const postRoute = findRoute('post', '/device-estate-access');
      const delRoute = findRoute('delete', '/device-estate-access');
      assert(!!getRoute && !!postRoute && !!delRoute, 'device-estate-access GET/POST/DELETE routes registered');

      for (const [label, route, http] of [['GET', getRoute, 'GET'], ['POST', postRoute, 'POST'], ['DELETE', delRoute, 'DELETE']] as Array<[string, any, string]>) {
        const unauth = await invokeHandlers(routeHandlers(route).slice(0, 1), buildReq(http));
        assert(unauth.status === 401, `unauthenticated ${label} returns 401`, `got ${unauth.status}`);
      }

      // non-admin role denied
      for (const [role, headers] of [['staff', PIN_STAFF], ['mandur', PIN_MANDUR]] as Array<[string, any]>) {
        const res = await invokeHandlers(routeHandlers(postRoute).slice(0, 2), buildReq('POST', { headers, body: { deviceId: 'DEV-C2-A', estateId: 'FPM_TUNGGAL' } }));
        assert(res.status === 403, `role '${role}' denied device-estate admin (403)`, `got ${res.status}`);
      }

      // admin same-estate allowed through auth middleware
      const allowed = await invokeHandlers(routeHandlers(postRoute).slice(0, 1), buildReq('POST', { headers: PIN_FC, body: { deviceId: 'DEV-C2-A', estateId: 'FPM_TUNGGAL' } }));
      assert(allowed.allowed, 'admin same-estate passes authentication', `status=${allowed.status}`);

      // cross-estate grant by single-estate branch fc rejected
      const cross = await invokeHandlers(routeHandlers(postRoute), buildReq('POST', { headers: PIN_FC_BRANCH, body: { deviceId: 'DEV-C2-A', estateId: 'FPM_TUNGGAL' } }));
      assert(cross.status === 403, 'single-estate admin cannot grant another estate (403)', `got ${cross.status}`);

      // invalid estate rejected before DB (cross-estate role passes middleware, handler validates)
      const badEstate = await invokeHandlers(routeHandlers(postRoute), buildReq('POST', { headers: PIN_RC, body: { deviceId: 'DEV-C2-A', estateId: 'BOGUS' } }));
      assert(badEstate.status === 400, 'invalid estate rejected (400)', `got ${badEstate.status}`);

      // missing deviceId rejected
      const noDevice = await invokeHandlers(routeHandlers(postRoute), buildReq('POST', { headers: PIN_FC, body: { estateId: 'FPM_TUNGGAL' } }));
      assert(noDevice.status === 400, 'missing deviceId rejected (400)', `got ${noDevice.status}`);

      // P0-ADMIN: RC is no longer a cross-estate device administrator. A target
      // estate other than the actor's home estate must be rejected with 403.
      const rc = await invokeHandlers(routeHandlers(postRoute), buildReq('POST', { headers: PIN_RC, body: { deviceId: 'DEV-C2-A', estateId: 'FPM_ADELA' } }));
      assert(rc.status === 403, 'RC cross-estate device-estate grant is rejected (403)', `got ${rc.status}`);
    }

    // 5. Source guards: pair-scoped, idempotent, no global mutation, no grant-all
    {
      const service = read(SERVICE_SRC);
      assert(/\.upsert\([\s\S]{0,260}onConflict:\s*'device_id,estate_id'/.test(service), 'grant is idempotent via upsert onConflict (device_id,estate_id)');
      assert(/\.eq\('device_id', deviceId\)\s*\n\s*\.eq\('estate_id', estateId\)/.test(service), 'revoke is scoped to exactly one device + estate pair');
      assert(!/isValidEstateId[\s\S]{0,80}(FPM_ADELA|FPM_KLEDANG|FPM_SENING)[\s\S]{0,40}ACTIVE/.test(service), 'no hardcoded multi-estate grant');
      assert(!/for\s*\([^)]*\)\s*\{[\s\S]{0,120}grantDeviceEstateAccess/.test(service), 'grant does not loop over estates (no auto grant-all)');

      // revoke must not touch registered_devices (scope to the revoke function body only)
      const revokeStart = service.indexOf('export async function revokeDeviceEstateAccess');
      const revokeBodyEnd = service.indexOf('\n}', revokeStart);
      const revokeBlock = service.slice(revokeStart, revokeBodyEnd > revokeStart ? revokeBodyEnd + 2 : undefined);
      assert(!/registered_devices/.test(revokeBlock), 'single-estate revoke never touches registered_devices');
      assert(/status:\s*'REVOKED'/.test(revokeBlock), 'revoke sets device_estate_access.status = REVOKED');

      const routes = read(ROUTES_SRC);
      assert(/enforceDeviceEstate\(req, res, estateId\)/.test(routes), 'grant/revoke enforce the target estate boundary');
      assert((routes.match(/requireDeviceAdmin/g) || []).length >= 3, 'device-estate-access routes require device admin');
      assert(/grantDeviceEstateAccess\(/.test(routes) && /revokeDeviceEstateAccess\(/.test(routes), 'routes call the grant/revoke service');
      // approval-flow integration (single estate only)
      assert((routes.match(/grantDeviceEstateAccess\(/g) || []).length >= 4, 'approval flows create a single-estate grant (approve-link/approve/quick-approve/approve-direct/bootstrap)');
    }

    // 6. NO login enforcement (C.3) introduced
    {
      const authRoutes = read(AUTH_ROUTES_SRC);
      assert(!/device_estate_access|isDeviceAuthorizedForEstate|grantDeviceEstateAccess/.test(authRoutes), 'login routes do not consume the estate-access layer yet');
      const middleware = read(MIDDLEWARE_SRC);
      assert(!/device_estate_access|isDeviceAuthorizedForEstate/.test(middleware), 'auth middleware does not consume the estate-access layer yet');
      const service = read(SERVICE_SRC);
      const getStatusBlock = service.slice(service.indexOf('async getDeviceStatus'), service.indexOf('async registerDevice'));
      assert(!/device_estate_access|isDeviceAuthorizedForEstate/.test(getStatusBlock), 'getDeviceStatus approval gate is unchanged');
    }

    // 7. Existing P0-16/16A/16B behaviour intact
    {
      const service = read(SERVICE_SRC);
      assert(/createApprovalCapability/.test(service) && /consumeApprovalCapability/.test(service) && /peekApprovalCapability/.test(service), 'P0-16A capability flow intact');
      assert(/requester_name:\s*params\.requesterName/.test(service), 'P0-16B requester metadata intact');
      assert(/crypto\.randomBytes\(DEVICE_CREDENTIAL_BYTES\)/.test(service), 'P0-16C.1 credential generation intact');
      const acl = read('supabase/migrations/20260921_p0_16_registered_devices_acl_reconciliation.sql');
      assert(/FORCE ROW LEVEL SECURITY/.test(acl) && /REVOKE ALL[\s\S]*FROM anon/.test(acl), 'registered_devices hardening intact');
    }
  } finally {
    for (const k of envKeys) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  }

  console.log(`\nMODULE 45 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_estate_access\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceEstateAccessTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16C.2 device estate access suite execution error:', err); process.exit(1); });
}
