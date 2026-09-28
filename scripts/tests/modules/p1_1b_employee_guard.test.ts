/**
 * iPDS v4.1.0 — Test Module 56: P1.1-B Fail-Closed Employee Estate Guard
 *
 * Focused regression coverage for review findings B1, B2, B3:
 *   - B1 no/expired/transferred/other-estate assignment is denied (403)
 *   - B2 no scoped DB client => no shared local mutation, controlled error
 *   - B3 local PUT uses the same sanitized representation as the DB path
 *
 * Tenant isolation below is verified at the handler layer with a mocked
 * Supabase client. It does NOT prove live RLS/PostgREST behavior; staging
 * verification with a real database is still required.
 */

import fs from 'fs';
import path from 'path';
import employeesRoutes, { EMPLOYEE_WRITE_ROLES } from '../../../src/server/routes/employees.routes.js';
import { authHeadersForRole } from '../helpers/authTestTokens.js';

type Method = 'get' | 'post' | 'put' | 'delete';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

const TEST_ID = '11111111-1111-4111-8111-111111111111';
const TEST_JWT_SECRET = 'ipds-p1-1-test-jwt-secret';
const TEST_SUPABASE_URL = 'https://ipds-p1-1-test.supabase.co';
const EMP_FILE = path.join(process.cwd(), 'data', 'employees.json');

const FC_ADELA = {
  sub: 'FC-ADL-01',
  app_metadata: { app_role: 'fc', estate_id: 'FPM_ADELA', operator_id: 'FC-ADL-01' },
  user_metadata: { operator_name: 'FC Adela' }
};

const FC_TUNGGAL = {
  sub: 'FC-2401199',
  app_metadata: { app_role: 'fc', estate_id: 'FPM_TUNGGAL', operator_id: 'FC-2401199' },
  user_metadata: { operator_name: 'FC Tunggal' }
};

function findRoute(method: Method, exactPath: string) {
  const stack = (employeesRoutes as any).stack || [];
  return stack.find((l: any) => {
    const p = l.route?.path;
    const paths = Array.isArray(p) ? p : [p];
    return l.route?.methods?.[method] && paths.includes(exactPath);
  });
}

function routeHandlers(route: any): any[] {
  return (route?.route?.stack || []).map((s: any) => s.handle);
}

function runLastHandler(route: any, req: any): Promise<MockResult> {
  const handlers = routeHandlers(route);
  const handler = handlers[handlers.length - 1];
  return new Promise((resolve) => {
    let status = 200;
    let body: any = null;
    let settled = false;

    const finish = (allowed = false) => {
      if (!settled) {
        settled = true;
        resolve({ status, body, allowed });
      }
    };

    const res: any = {
      status(code: number) { status = code; return res; },
      json(data: any) { body = data; finish(false); return res; },
      send(data: any) { body = data; finish(false); return res; },
      setHeader() { return res; },
      getHeader() { return undefined; },
      end() { finish(false); return res; }
    };

    Promise.resolve(handler(req, res))
      .then(() => { if (!settled) finish(true); })
      .catch((e: any) => { status = 500; body = { error: String(e?.message || e) }; finish(false); });
  });
}

function invokeRouteGate(route: any, req: any): Promise<MockResult> {
  const gate = (route?.route?.stack || [])[0]?.handle;
  return new Promise((resolve) => {
    let status = 200;
    let body: any = null;
    let settled = false;
    const finish = (allowed = false) => {
      if (!settled) {
        settled = true;
        resolve({ status, body, allowed });
      }
    };
    const res: any = {
      status(code: number) { status = code; return res; },
      json(data: any) { body = data; finish(false); return res; },
      send(data: any) { body = data; finish(false); return res; },
      setHeader() { return res; },
      getHeader() { return undefined; },
      end() { finish(false); return res; }
    };
    try {
      const maybe = gate(req, res, () => finish(true));
      if (maybe && typeof maybe.then === 'function') maybe.catch((e: any) => { status = 500; body = { error: String(e?.message || e) }; finish(false); });
    } catch (e: any) {
      status = 500;
      body = { error: String(e?.message || e) };
      finish(false);
    }
  });
}

function buildReq(opts: {
  id?: string;
  body?: any;
  user?: any;
  estateId?: string;
  supabase?: any;
  method?: string;
  headers?: Record<string, string>;
}): any {
  const id = opts.id || TEST_ID;
  return {
    method: opts.method || 'PUT',
    params: { id },
    headers: opts.headers || {},
    cookies: {},
    query: {},
    body: opts.body || {},
    ip: '127.0.0.1',
    originalUrl: `/api/employees/${id}`,
    url: `/api/employees/${id}`,
    path: `/api/employees/${id}`,
    baseUrl: '',
    user: opts.user,
    estateId: opts.estateId,
    supabase: opts.supabase,
    get(name: string) { return this.headers[String(name).toLowerCase()]; }
  };
}

function createSupabaseMock(state: {
  assignmentRows: any[];
  assignmentError?: any;
  employeeUpdateError?: any;
}) {
  function makeBuilder(table: string) {
    const s: any = { table, op: 'select' };
    const builder: any = {
      select() { s.op = 'select'; return builder; },
      update(payload: any) { s.op = 'update'; s.payload = payload; return builder; },
      insert(payload: any) { s.op = 'insert'; s.payload = payload; return builder; },
      upsert() { return builder; },
      delete() { s.op = 'delete'; return builder; },
      eq() { return builder; },
      limit() { return builder; },
      order() { return builder; },
      ilike() { return builder; },
      maybeSingle() { return builder; },
      then(resolve: any) {
        if (table === 'employee_assignments' && s.op === 'select') {
          resolve({ data: state.assignmentRows, error: state.assignmentError ?? null });
        } else if (table === 'employees' && s.op === 'update') {
          resolve({ data: null, error: state.employeeUpdateError ?? null });
        } else {
          resolve({ data: null, error: null });
        }
      }
    };
    return builder;
  }
  return { from: (t: string) => makeBuilder(t) } as any;
}

function writeLocal(list: any[]) {
  const dir = path.dirname(EMP_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EMP_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

function readLocal(): any[] {
  try {
    return JSON.parse(fs.readFileSync(EMP_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export async function runP1_1BEmployeeGuardTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 56: P1.1-B FAIL-CLOSED EMPLOYEE ESTATE GUARD (B1/B2/B3)');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 56.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 56.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 56.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const envKeys = [
    'NODE_ENV',
    'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_POOLED_URL', 'SUPABASE_POOLER_URL',
    'SUPABASE_READ_REPLICA_URL', 'SUPABASE_JWT_SECRET', 'JWT_SECRET'
  ];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];

  const fileExisted = fs.existsSync(EMP_FILE);
  const fileContent = fileExisted ? fs.readFileSync(EMP_FILE, 'utf-8') : null;

  const putRoute = findRoute('put', '/employees/:id');
  const deleteRoute = findRoute('delete', '/employees/:id');

  try {
    // Force stateless no-DB mode so getScopedSupabase() returns null unless a mock is injected.
    process.env.NODE_ENV = 'production';
    for (const k of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_POOLED_URL', 'SUPABASE_POOLER_URL', 'SUPABASE_READ_REPLICA_URL', 'SUPABASE_JWT_SECRET', 'JWT_SECRET']) {
      delete process.env[k];
    }
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.SUPABASE_URL = TEST_SUPABASE_URL;

    assert(!!putRoute && !!deleteRoute, 'employees PUT/DELETE routes registered');

    const seed = () => writeLocal([{ id: TEST_ID, full_name: 'Old Name', employment_status: 'ACTIVE' }]);

    // B1 — no ACTIVE assignment => 403, no local mutation
    seed();
    let before = readLocal();
    let mock = createSupabaseMock({ assignmentRows: [] });
    let res = await runLastHandler(putRoute, buildReq({ body: { full_name: 'X' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    assert(res.status === 403, 'B1: no ACTIVE assignment denies PUT (403)', `got ${res.status}`);
    assert(JSON.stringify(readLocal()) === JSON.stringify(before), 'B1: denied PUT does not mutate local store');

    // B1 — expired assignment (ACTIVE-filtered query returns none) => 403
    seed();
    mock = createSupabaseMock({ assignmentRows: [] });
    res = await runLastHandler(putRoute, buildReq({ body: { full_name: 'X' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    assert(res.status === 403, 'B1: expired assignment denies PUT (403)', `got ${res.status}`);

    // B1 — transferred assignment (ACTIVE-filtered query returns none) => 403
    seed();
    mock = createSupabaseMock({ assignmentRows: [] });
    res = await runLastHandler(putRoute, buildReq({ body: { full_name: 'X' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    assert(res.status === 403, 'B1: transferred assignment denies PUT (403)', `got ${res.status}`);

    // B1 — ACTIVE assignment in a different estate => 403
    seed();
    mock = createSupabaseMock({ assignmentRows: [{ estate_id: 'FPM_TUNGGAL' }] });
    res = await runLastHandler(putRoute, buildReq({ body: { full_name: 'X' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    assert(res.status === 403, 'B1: other-estate ACTIVE assignment denies PUT (403)', `got ${res.status}`);

    // B1 — ACTIVE assignment in same estate => allowed
    seed();
    mock = createSupabaseMock({ assignmentRows: [{ estate_id: 'FPM_ADELA' }] });
    res = await runLastHandler(putRoute, buildReq({ body: { full_name: 'Same Estate' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    assert(res.status === 200, 'B1: same-estate ACTIVE assignment allows PUT (200)', `got ${res.status}`);

    // B1 — cross-estate authorized (FC Tunggal) preserves intended behavior
    seed();
    mock = createSupabaseMock({ assignmentRows: [{ estate_id: 'FPM_ADELA' }] });
    res = await runLastHandler(putRoute, buildReq({ body: { full_name: 'Cross Estate' }, user: FC_TUNGGAL, estateId: 'FPM_TUNGGAL', supabase: mock }));
    assert(res.status === 200, 'B1: cross-estate Super Admin behavior preserved (200)', `got ${res.status}`);

    // B2 — no DB client => PUT 503, no local mutation
    seed();
    before = readLocal();
    res = await runLastHandler(putRoute, buildReq({ body: { full_name: 'No DB' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: undefined }));
    assert(res.status === 503, 'B2: no DB client fails PUT closed (503)', `got ${res.status}`);
    assert(res.body?.code === 'EMPLOYEE_STORE_UNAVAILABLE', 'B2: controlled error code returned for PUT');
    assert(JSON.stringify(readLocal()) === JSON.stringify(before), 'B2: no-DB PUT does not mutate local store');

    // B2 — no DB client => DELETE 503, no local mutation
    seed();
    before = readLocal();
    res = await runLastHandler(deleteRoute, buildReq({ method: 'DELETE', user: FC_ADELA, estateId: 'FPM_ADELA', supabase: undefined }));
    assert(res.status === 503, 'B2: no DB client fails DELETE closed (503)', `got ${res.status}`);
    assert(JSON.stringify(readLocal()) === JSON.stringify(before), 'B2: no-DB DELETE does not mutate local store');

    // B3 — local PUT strips unauthorized/unexpected fields
    seed();
    mock = createSupabaseMock({ assignmentRows: [{ estate_id: 'FPM_ADELA' }] });
    res = await runLastHandler(putRoute, buildReq({
      body: { full_name: 'Sanitized', role: 'admin', permissions: ['*'], is_admin: true },
      user: FC_ADELA,
      estateId: 'FPM_ADELA',
      supabase: mock
    }));
    let stored = readLocal().find((e) => e.id === TEST_ID);
    assert(res.status === 200, 'B3: PUT with unknown fields succeeds after stripping', `got ${res.status}`);
    assert(stored?.full_name === 'Sanitized', 'B3: allowed field is updated');
    assert(stored?.role === undefined && stored?.permissions === undefined && stored?.is_admin === undefined, 'B3: unauthorized fields are stripped from local record');

    // B3 — estate_id injection is rejected and does not mutate local store
    seed();
    before = readLocal();
    res = await runLastHandler(putRoute, buildReq({ body: { estate_id: 'FPM_HACK' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    stored = readLocal().find((e) => e.id === TEST_ID);
    assert(res.status === 400 && res.body?.code === 'INVALID_UPDATE_FIELDS', 'B3: estate_id injection rejected (400)', `got ${res.status}`);
    assert(stored?.estate_id === undefined, 'B3: estate_id not injected into local record');
    assert(JSON.stringify(readLocal()) === JSON.stringify(before), 'B3: rejected injection does not mutate local store');

    // B3 — internal identity fields rejected
    seed();
    res = await runLastHandler(putRoute, buildReq({ body: { tenant_id: 'evil', id: 'other' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    assert(res.status === 400 && res.body?.code === 'INVALID_UPDATE_FIELDS', 'B3: internal identity fields rejected (400)', `got ${res.status}`);

    // Positive — valid same-estate PUT persists sanitized value
    seed();
    mock = createSupabaseMock({ assignmentRows: [{ estate_id: 'FPM_ADELA' }] });
    res = await runLastHandler(putRoute, buildReq({ body: { full_name: 'Valid Update', employment_status: 'ACTIVE' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    stored = readLocal().find((e) => e.id === TEST_ID);
    assert(res.status === 200 && stored?.full_name === 'Valid Update', 'Positive: valid same-estate PUT updates local record');

    // Positive — valid same-estate DELETE soft-deactivates
    seed();
    mock = createSupabaseMock({ assignmentRows: [{ estate_id: 'FPM_ADELA' }] });
    res = await runLastHandler(deleteRoute, buildReq({ method: 'DELETE', user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    stored = readLocal().find((e) => e.id === TEST_ID);
    assert(res.status === 200 && stored?.employment_status === 'INACTIVE', 'Positive: valid DELETE sets INACTIVE');

    // DB update failure => 500 and no local mutation
    seed();
    before = readLocal();
    mock = createSupabaseMock({ assignmentRows: [{ estate_id: 'FPM_ADELA' }], employeeUpdateError: { message: 'db down' } });
    res = await runLastHandler(putRoute, buildReq({ body: { full_name: 'Will Fail' }, user: FC_ADELA, estateId: 'FPM_ADELA', supabase: mock }));
    assert(res.status === 500 && res.body?.code === 'EMPLOYEE_UPDATE_FAILED', 'DB update error fails PUT closed (500)', `got ${res.status}`);
    assert(JSON.stringify(readLocal()) === JSON.stringify(before), 'DB update error does not mutate local store');

    // Route authorization must match the existing RLS employees_update_policy
    // (fc, pf, super_admin, admin). oc/rc pass the route but are rejected by
    // RLS, so PUT/DELETE must not advertise them as allowed.
    const writeRoles: readonly string[] = EMPLOYEE_WRITE_ROLES;
    assert(writeRoles.includes('fc') && writeRoles.includes('pf'), 'PUT/DELETE write roles retain RLS-allowed fc/pf');
    assert(!writeRoles.includes('oc') && !writeRoles.includes('rc'), 'PUT/DELETE write roles exclude RLS-denied oc/rc');

    for (const [label, route] of [['PUT', putRoute], ['DELETE', deleteRoute]] as Array<[string, any]>) {
      for (const role of ['oc', 'rc']) {
        const gateRes = await invokeRouteGate(route, buildReq({ method: label, headers: authHeadersForRole(role, 'FPM_ADELA') }));
        assert(gateRes.status === 403 && gateRes.body?.code === 'FORBIDDEN', `${label} gate denies ${role.toUpperCase()} before DB`, `status=${gateRes.status} code=${gateRes.body?.code}`);
      }
      for (const role of ['fc', 'pf']) {
        const gateRes = await invokeRouteGate(route, buildReq({ method: label, headers: authHeadersForRole(role, 'FPM_ADELA') }));
        assert(gateRes.allowed === true && gateRes.status === 200, `${label} gate admits RLS-compatible ${role.toUpperCase()}`, `status=${gateRes.status} allowed=${gateRes.allowed}`);
      }
    }
  } finally {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k] as string;
    }
    try {
      if (fileExisted && fileContent !== null) fs.writeFileSync(EMP_FILE, fileContent, 'utf-8');
      else if (!fileExisted && fs.existsSync(EMP_FILE)) fs.unlinkSync(EMP_FILE);
    } catch {}
  }

  return { passed, total, failedTests };
}
