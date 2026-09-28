/**
 * iPDS v4.1.0 — Test Module 59: P1.1-D Atomic Employee Create RPC Contract
 *
 * Verifies the APPLICATION side of the atomic create:
 *   - one `create_employee_with_assignment` RPC is invoked (not two INSERTs)
 *   - correct function name + argument contract
 *   - valid fields are passed (trimmed/uppercased as before)
 *   - body estate_id cannot override req.estateId
 *   - invalid input is rejected before any RPC call
 *   - RPC error / empty result => 500 with no local cache mutation
 *   - no DB client => 503 with no local cache mutation
 *   - the authenticated scoped client is used (no privileged client in the route)
 *
 * IMPORTANT: These are mocked handler tests. They CANNOT prove PostgreSQL
 * transaction atomicity/rollback. Real RPC execution, employee/assignment
 * INSERTs, rollback-on-assignment-failure, RLS and permissions require staging
 * database verification.
 */

import fs from 'fs';
import path from 'path';
import employeesRoutes, { EMPLOYEE_WRITE_ROLES } from '../../../src/server/routes/employees.routes.js';
import { authHeadersForRole } from '../helpers/authTestTokens.js';

type Method = 'get' | 'post' | 'put' | 'delete';

interface MockResult { status: number; body: any; allowed: boolean; }

const EMP_FILE = path.join(process.cwd(), 'data', 'employees.json');
const TEST_JWT_SECRET = 'ipds-p1-1-test-jwt-secret';
const TEST_SUPABASE_URL = 'https://ipds-p1-1-test.supabase.co';
const ESTATE_A = 'FPM_ADELA';
const USER_A = {
  sub: 'FC-ADL-01',
  app_metadata: { app_role: 'fc', estate_id: ESTATE_A, operator_id: 'FC-ADL-01' },
  user_metadata: { operator_name: 'FC Adela' }
};

function findRoute(method: Method, exactPath: string) {
  const stack = (employeesRoutes as any).stack || [];
  return stack.find((l: any) => {
    const p = l.route?.path;
    const paths = Array.isArray(p) ? p : [p];
    return l.route?.methods?.[method] && paths.includes(exactPath);
  });
}

function runLastHandler(route: any, req: any): Promise<MockResult> {
  const handlers = (route?.route?.stack || []).map((s: any) => s.handle);
  const handler = handlers[handlers.length - 1];
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
    Promise.resolve(handler(req, res))
      .then(() => { if (!settled) finish(true); })
      .catch((e: any) => { status = 500; body = { error: String(e?.message || e) }; finish(false); });
  });
}

function invokeRouteGate(route: any, req: any): Promise<MockResult> {
  const gate = ((route?.route?.stack || [])[0] || {}).handle;
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
    try {
      const maybe = gate(req, res, () => finish(true));
      if (maybe && typeof maybe.then === 'function') maybe.catch((e: any) => { status = 500; body = { error: String(e?.message || e) }; finish(false); });
    } catch (e: any) { status = 500; body = { error: String(e?.message || e) }; finish(false); }
  });
}

function buildReq(opts: { body?: any; user?: any; estateId?: string; supabase?: any; headers?: Record<string, string> }): any {
  return {
    method: 'POST',
    params: {},
    headers: opts.headers || {},
    cookies: {},
    query: {},
    body: opts.body || {},
    ip: '127.0.0.1',
    originalUrl: '/api/employees',
    url: '/api/employees',
    path: '/api/employees',
    baseUrl: '',
    user: opts.user,
    estateId: opts.estateId,
    supabase: opts.supabase,
    get(name: string) { return this.headers[String(name).toLowerCase()]; }
  };
}

interface MockState {
  positions?: any[];
  rpcCalls?: Array<{ fnName: string; args: any }>;
  rpcData?: any;
  rpcError?: any;
}

function createSupabaseMock(state: MockState) {
  state.positions = state.positions || [{ id: 'pos-1' }];
  state.rpcCalls = state.rpcCalls || [];
  function makeBuilder(table: string) {
    const s: any = { table, op: 'select' };
    const builder: any = {
      select() { s.op = 'select'; return builder; },
      update(p: any) { s.op = 'update'; s.payload = p; return builder; },
      insert(p: any) { s.op = 'insert'; s.payload = p; return builder; },
      upsert(p: any) { s.op = 'upsert'; s.payload = p; return builder; },
      delete() { s.op = 'delete'; return builder; },
      eq() { return builder; },
      limit() { return builder; },
      order() { return builder; },
      ilike() { return builder; },
      maybeSingle() { return builder; },
      then(resolve: any) {
        if (table === 'org_positions') {
          resolve({ data: s.op === 'select' ? state.positions : null, error: null });
        } else {
          resolve({ data: null, error: null });
        }
      }
    };
    return builder;
  }
  return {
    from: (t: string) => makeBuilder(t),
    rpc: (fnName: string, args: any) => {
      state.rpcCalls!.push({ fnName, args });
      return {
        then(resolve: any) {
          resolve({
            data: state.rpcData ?? [{ employee_id: 'emp-1', assignment_id: 'asg-1' }],
            error: state.rpcError ?? null
          });
        }
      };
    }
  } as any;
}

function readLocal(): any[] {
  try { return JSON.parse(fs.readFileSync(EMP_FILE, 'utf-8')); } catch { return []; }
}

export async function runP1_1DAtomicCreateTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 59: P1.1-D ATOMIC EMPLOYEE CREATE RPC CONTRACT');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 59.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 59.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 59.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  const envKeys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_POOLED_URL', 'SUPABASE_POOLER_URL', 'SUPABASE_READ_REPLICA_URL', 'SUPABASE_JWT_SECRET', 'JWT_SECRET'];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];

  const fileExisted = fs.existsSync(EMP_FILE);
  const fileContent = fileExisted ? fs.readFileSync(EMP_FILE, 'utf-8') : null;

  const postRoute = findRoute('post', '/employees');

  try {
    process.env.NODE_ENV = 'production';
    for (const k of envKeys) if (k !== 'NODE_ENV') delete process.env[k];
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.SUPABASE_URL = TEST_SUPABASE_URL;

    assert(!!postRoute, 'employees POST route registered');

    const body = { staff_no: '  ab12  ', full_name: '  Jane Doe  ', contact_number: '0123', email: 'jane@x.com' };

    // 1 + 5 + 7: success path, correct name/args, valid fields passed
    fs.writeFileSync(EMP_FILE, JSON.stringify([], null, 2), 'utf-8');
    const stateOk: MockState = {};
    let mock = createSupabaseMock(stateOk);
    let res = await runLastHandler(postRoute, buildReq({ body, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 201, 'successful RPC returns 201', `got ${res.status}`);
    assert(res.body?.data?.id === 'emp-1' && res.body?.data?.current_assignment?.id === 'asg-1', 'successful RPC returns DB ids');
    assert(stateOk.rpcCalls!.length === 1 && stateOk.rpcCalls![0].fnName === 'create_employee_with_assignment', 'correct RPC function invoked exactly once');
    const args = stateOk.rpcCalls![0].args;
    for (const key of ['p_tenant_id', 'p_company_id', 'p_position_id', 'p_staff_no', 'p_full_name', 'p_employment_status', 'p_estate_id', 'p_division_id', 'p_assignment_role', 'p_effective_from']) {
      assert(Object.prototype.hasOwnProperty.call(args, key), `RPC argument present: ${key}`);
    }
    assert(args.p_staff_no === 'AB12', 'RPC receives trimmed/uppercased staff_no', `got ${args.p_staff_no}`);
    assert(args.p_full_name === 'Jane Doe', 'RPC receives trimmed full_name', `got ${args.p_full_name}`);
    assert(args.p_contact_number === '0123' && args.p_email === 'jane@x.com', 'RPC receives contact/email');
    assert(args.p_position_id === 'pos-1', 'RPC receives resolved position_id');
    assert(args.p_employment_status === 'ACTIVE' && args.p_assignment_role === 'PRIMARY', 'RPC receives status/role defaults');

    // 4: body estate_id cannot override
    const stateInject: MockState = {};
    mock = createSupabaseMock(stateInject);
    res = await runLastHandler(postRoute, buildReq({ body: { ...body, estate_id: 'FPM_TUNGGAL' }, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 201 && stateInject.rpcCalls![0].args.p_estate_id === ESTATE_A, 'body estate_id cannot override req.estateId');

    // 2: RPC error -> 500 + no local mutation
    fs.writeFileSync(EMP_FILE, JSON.stringify([], null, 2), 'utf-8');
    const before = JSON.stringify(readLocal());
    mock = createSupabaseMock({ rpcError: { message: 'boom' } });
    res = await runLastHandler(postRoute, buildReq({ body, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 500 && res.body?.code === 'EMPLOYEE_CREATE_FAILED', 'RPC error returns 500', `got ${res.status}`);
    assert(JSON.stringify(readLocal()) === before, 'RPC error does not mutate local cache');

    // 2b: empty RPC result -> 500 + no local mutation
    fs.writeFileSync(EMP_FILE, JSON.stringify([], null, 2), 'utf-8');
    const beforeEmpty = JSON.stringify(readLocal());
    mock = createSupabaseMock({ rpcData: [] });
    res = await runLastHandler(postRoute, buildReq({ body, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 500, 'empty RPC result returns 500', `got ${res.status}`);
    assert(JSON.stringify(readLocal()) === beforeEmpty, 'empty RPC result does not mutate local cache');

    // 3: no DB client -> 503 + no local mutation
    fs.writeFileSync(EMP_FILE, JSON.stringify([], null, 2), 'utf-8');
    const beforeNoDb = JSON.stringify(readLocal());
    res = await runLastHandler(postRoute, buildReq({ body, user: USER_A, estateId: ESTATE_A, supabase: undefined }));
    assert(res.status === 503 && res.body?.code === 'EMPLOYEE_STORE_UNAVAILABLE', 'no DB client returns 503', `got ${res.status}`);
    assert(JSON.stringify(readLocal()) === beforeNoDb, 'no DB client does not mutate local cache');

    // 6: invalid input rejected before RPC
    const stateInvalid: MockState = {};
    mock = createSupabaseMock(stateInvalid);
    res = await runLastHandler(postRoute, buildReq({ body: { full_name: 'No Staff No' }, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 400, 'missing staff_no rejected with 400 before RPC', `got ${res.status}`);
    assert(stateInvalid.rpcCalls!.length === 0, 'invalid input never invokes RPC');

    const stateInvalid2: MockState = {};
    mock = createSupabaseMock(stateInvalid2);
    res = await runLastHandler(postRoute, buildReq({ body: {}, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 400 && stateInvalid2.rpcCalls!.length === 0, 'empty payload rejected before RPC');

    // ALL estate context rejected before RPC
    const stateAll: MockState = {};
    mock = createSupabaseMock(stateAll);
    res = await runLastHandler(postRoute, buildReq({ body, user: USER_A, estateId: 'ALL', supabase: mock }));
    assert(res.status === 400 && stateAll.rpcCalls!.length === 0, 'ALL estate context rejected before RPC');

    // 8: authenticated scoped client usage (static + injected-client behavior)
    const src = fs.readFileSync(path.join(process.cwd(), 'src/server/routes/employees.routes.ts'), 'utf-8');
    assert(/req\.supabase \|\| getScopedSupabase\(req\.rawToken\)/.test(src), 'route derives client from authenticated scoped client');
    assert(!/getSupabase\(/.test(src), 'route never constructs a privileged client');
    assert(!/\.from\('employees'\)[\s\S]{0,80}\.insert/.test(src) && !/\.from\('employee_assignments'\)[\s\S]{0,80}\.insert/.test(src), 'route no longer performs direct employee/assignment INSERTs');

    // 9: route authorization must be a subset of the existing RLS write policy
    //    (employees_insert_policy / assignments_write_policy allow fc, pf,
    //    super_admin, admin). oc/rc would pass the route but be rejected by the
    //    SECURITY INVOKER RPC, so they must not be accepted at the gate.
    const writeRoles: readonly string[] = EMPLOYEE_WRITE_ROLES;
    assert(writeRoles.includes('fc') && writeRoles.includes('pf'), 'employee write roles retain RLS-allowed fc/pf');
    assert(!writeRoles.includes('oc') && !writeRoles.includes('rc'), 'employee write roles exclude RLS-denied oc/rc');

    for (const role of ['oc', 'rc']) {
      const gateRes = await invokeRouteGate(postRoute, buildReq({ headers: authHeadersForRole(role, ESTATE_A) }));
      assert(gateRes.status === 403, `POST gate denies ${role.toUpperCase()} before RPC`, `got ${gateRes.status}`);
      assert(gateRes.body?.code === 'FORBIDDEN', `POST gate denial for ${role.toUpperCase()} is controlled`, `code=${gateRes.body?.code}`);
    }
    for (const role of ['fc', 'pf']) {
      const gateRes = await invokeRouteGate(postRoute, buildReq({ headers: authHeadersForRole(role, ESTATE_A) }));
      assert(gateRes.allowed === true && gateRes.status === 200, `POST gate admits RLS-compatible ${role.toUpperCase()}`, `status=${gateRes.status} allowed=${gateRes.allowed}`);
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
