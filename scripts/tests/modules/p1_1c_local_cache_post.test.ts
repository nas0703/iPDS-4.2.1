/**
 * iPDS v4.1.0 — Test Module 57: P1.1-C Local Employee Cache (B4) + POST Fail-Closed
 *
 * B4:
 *   - active employees remain visible in the local read fallback
 *   - inactive/terminal employees are not returned
 *   - stale cached employees cannot survive an authoritative inactive/empty state
 *   - estate A employees cannot appear in estate B local results
 *   - duplicate records are deduplicated deterministically
 *
 * POST:
 *   - normal DB path returns 201
 *   - no DB client => 503 and no shared local mutation (never 201)
 *   - client-supplied estate_id cannot override the validated tenant context
 *   - DB write errors fail closed with no local mutation
 *
 * Handler-layer tests with a mocked Supabase client. Live RLS/PostgREST
 * behavior still requires staging verification.
 */

import fs from 'fs';
import path from 'path';
import employeesRoutes from '../../../src/server/routes/employees.routes.js';

type Method = 'get' | 'post' | 'put' | 'delete';

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

const EMP_FILE = path.join(process.cwd(), 'data', 'employees.json');
const ESTATE_A = 'FPM_ADELA';
const ESTATE_B = 'FPM_KLEDANG';

const USER_A = { sub: 'FC-ADL-01', app_metadata: { app_role: 'fc', estate_id: ESTATE_A, operator_id: 'FC-ADL-01' }, user_metadata: { operator_name: 'FC Adela' } };
const USER_B = { sub: 'FC-KLD-01', app_metadata: { app_role: 'fc', estate_id: ESTATE_B, operator_id: 'FC-KLD-01' }, user_metadata: { operator_name: 'FC Kledang' } };

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

function buildReq(opts: {
  method?: string;
  id?: string;
  body?: any;
  user?: any;
  estateId?: string;
  supabase?: any;
}): any {
  const id = opts.id || 'x';
  return {
    method: opts.method || 'GET',
    params: { id },
    headers: {},
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
  viewRows?: any[];
  viewError?: any;
  positions?: any[];
  insertedEmployees?: any[];
  insertedAssignments?: any[];
  employeeInsertError?: any;
  assignmentInsertError?: any;
  rpcCalls?: Array<{ fnName: string; args: any }>;
  rpcData?: any;
  rpcError?: any;
}

function createSupabaseMock(state: MockState) {
  state.insertedEmployees = state.insertedEmployees || [];
  state.insertedAssignments = state.insertedAssignments || [];
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
        if (table === 'v_current_employee_assignments' && s.op === 'select') {
          resolve({ data: state.viewRows || [], error: state.viewError ?? null });
        } else if (table === 'employee_assignments' && s.op === 'select') {
          resolve({ data: [], error: null });
        } else if (table === 'org_positions') {
          if (s.op === 'select') resolve({ data: state.positions, error: null });
          else resolve({ data: null, error: null });
        } else if (table === 'employees' && s.op === 'insert') {
          state.insertedEmployees!.push(Array.isArray(s.payload) ? s.payload[0] : s.payload);
          resolve({ error: state.employeeInsertError ?? null });
        } else if (table === 'employee_assignments' && s.op === 'insert') {
          state.insertedAssignments!.push(Array.isArray(s.payload) ? s.payload[0] : s.payload);
          resolve({ error: state.assignmentInsertError ?? null });
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
            data: state.rpcData ?? [{ employee_id: 'emp-rpc-1', assignment_id: 'asg-rpc-1' }],
            error: state.rpcError ?? null
          });
        }
      };
    }
  } as any;
}

function writeLocal(list: any[]) {
  const dir = path.dirname(EMP_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EMP_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

function readLocal(): any[] {
  try { return JSON.parse(fs.readFileSync(EMP_FILE, 'utf-8')); } catch { return []; }
}

function activeRecord(id: string, estateId: string, name = 'Active') {
  return { id, full_name: name, employment_status: 'ACTIVE', current_assignment: { estate_id: estateId } };
}

export async function runP1_1CLocalCacheAndPostTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 57: P1.1-C LOCAL EMPLOYEE CACHE (B4) + POST FAIL-CLOSED');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 57.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 57.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 57.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  const envKeys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_POOLED_URL', 'SUPABASE_POOLER_URL', 'SUPABASE_READ_REPLICA_URL'];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];

  const fileExisted = fs.existsSync(EMP_FILE);
  const fileContent = fileExisted ? fs.readFileSync(EMP_FILE, 'utf-8') : null;

  const getRoute = findRoute('get', '/employees');
  const postRoute = findRoute('post', '/employees');

  try {
    process.env.NODE_ENV = 'production';
    for (const k of envKeys) if (k !== 'NODE_ENV') delete process.env[k];

    assert(!!getRoute && !!postRoute, 'employees GET/POST routes registered');

    // ---- B4: active employee remains visible (local fallback) ----
    writeLocal([activeRecord('E-A1', ESTATE_A, 'Active A')]);
    let res = await runLastHandler(getRoute, buildReq({ user: USER_A, estateId: ESTATE_A }));
    assert(res.status === 200 && Array.isArray(res.body?.data) && res.body.data.length === 1 && res.body.data[0].id === 'E-A1',
      'B4: active employee remains visible in local fallback');

    // ---- B4: inactive employee is not returned ----
    writeLocal([{ id: 'E-A2', full_name: 'Inactive A', employment_status: 'INACTIVE', current_assignment: { estate_id: ESTATE_A } }]);
    res = await runLastHandler(getRoute, buildReq({ user: USER_A, estateId: ESTATE_A }));
    assert(res.status === 200 && res.body.data.length === 0, 'B4: inactive employee is not returned');

    // ---- B4: stale cached employee cannot survive an authoritative empty state ----
    writeLocal([activeRecord('E-STALE', ESTATE_A)]);
    let mock = createSupabaseMock({ viewRows: [] });
    res = await runLastHandler(getRoute, buildReq({ user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 200 && res.body.source === 'supabase' && res.body.data.length === 0, 'B4: authoritative empty result is returned');
    assert(!readLocal().some((e) => e.id === 'E-STALE'), 'B4: stale cached employee removed by authoritative reconcile');

    // ---- B4: estate A employee cannot appear in estate B local results ----
    writeLocal([activeRecord('E-A3', ESTATE_A)]);
    res = await runLastHandler(getRoute, buildReq({ user: USER_B, estateId: ESTATE_B }));
    assert(res.status === 200 && res.body.data.length === 0, 'B4: estate A employee not visible in estate B results');

    // ---- B4: reconciliation preserves other-estate cache but does not return it ----
    writeLocal([activeRecord('E-B1', ESTATE_B), activeRecord('E-A4', ESTATE_A)]);
    mock = createSupabaseMock({ viewRows: [{ employee_id: 'E-A5', estate_id: ESTATE_A, staff_no: 'S5', full_name: 'A5', employment_status: 'ACTIVE', assignment_id: 'asg5' }] });
    res = await runLastHandler(getRoute, buildReq({ user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 200 && res.body.data.length === 1 && res.body.data[0].id === 'E-A5', 'B4: authoritative scope returns only that estate');
    assert(!res.body.data.some((e: any) => e.current_assignment?.estate_id === ESTATE_B), 'B4: other-estate employee not returned');

    // ---- B4: duplicates handled deterministically ----
    writeLocal([activeRecord('E-DUP', ESTATE_A, 'First'), activeRecord('E-DUP', ESTATE_A, 'Second')]);
    res = await runLastHandler(getRoute, buildReq({ user: USER_A, estateId: ESTATE_A }));
    assert(res.status === 200 && res.body.data.length === 1 && res.body.data[0].id === 'E-DUP', 'B4: duplicate local records deduplicated deterministically');

    // ================= POST (atomic RPC) =================
    const validBody = { staff_no: 'NEW01', full_name: 'New Staff' };

    // normal DB path -> 201
    writeLocal([]);
    const stateOk: MockState = {};
    mock = createSupabaseMock(stateOk);
    res = await runLastHandler(postRoute, buildReq({ method: 'POST', body: validBody, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 201, 'POST: normal DB path returns 201', `got ${res.status}`);
    assert(stateOk.rpcCalls!.length === 1 && stateOk.rpcCalls![0].fnName === 'create_employee_with_assignment',
      'POST: atomic employee+assignment RPC invoked');
    assert(readLocal().some((e) => e.staff_no === 'NEW01'), 'POST: successful create updates local cache');
    assert(res.body?.data?.id === 'emp-rpc-1' && res.body?.data?.current_assignment?.id === 'asg-rpc-1',
      'POST: returned record uses DB-generated ids');

    // no DB client -> 503, no local mutation, never 201
    writeLocal([]);
    let before = JSON.stringify(readLocal());
    res = await runLastHandler(postRoute, buildReq({ method: 'POST', body: validBody, user: USER_A, estateId: ESTATE_A, supabase: undefined }));
    assert(res.status === 503, 'POST: no DB client returns 503 (not 201)', `got ${res.status}`);
    assert(res.body?.code === 'EMPLOYEE_STORE_UNAVAILABLE', 'POST: controlled error code on no DB');
    assert(JSON.stringify(readLocal()) === before, 'POST: no-DB does not mutate local store');

    // estate_id injection cannot override validated tenant context
    const stateInject: MockState = {};
    mock = createSupabaseMock(stateInject);
    res = await runLastHandler(postRoute, buildReq({ method: 'POST', body: { ...validBody, estate_id: 'FPM_TUNGGAL' }, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 201 && stateInject.rpcCalls![0]?.args?.p_estate_id === ESTATE_A,
      'POST: body estate_id cannot override validated tenant context');

    // missing/ALL estate context -> 400
    writeLocal([]);
    before = JSON.stringify(readLocal());
    mock = createSupabaseMock({});
    res = await runLastHandler(postRoute, buildReq({ method: 'POST', body: validBody, user: USER_A, estateId: 'ALL', supabase: mock }));
    assert(res.status === 400 && res.body?.code === 'ESTATE_CONTEXT_REQUIRED', 'POST: ALL estate context rejected (400)', `got ${res.status}`);
    assert(JSON.stringify(readLocal()) === before, 'POST: rejected ALL estate does not mutate local store');

    // RPC error -> 500, no local mutation
    writeLocal([]);
    before = JSON.stringify(readLocal());
    mock = createSupabaseMock({ rpcError: { message: 'boom' } });
    res = await runLastHandler(postRoute, buildReq({ method: 'POST', body: validBody, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 500 && res.body?.code === 'EMPLOYEE_CREATE_FAILED', 'POST: RPC error fails closed (500)', `got ${res.status}`);
    assert(JSON.stringify(readLocal()) === before, 'POST: RPC error does not mutate local store');

    // RPC succeeds but returns no employee id -> 500, no local mutation
    writeLocal([]);
    before = JSON.stringify(readLocal());
    mock = createSupabaseMock({ rpcData: [] });
    res = await runLastHandler(postRoute, buildReq({ method: 'POST', body: validBody, user: USER_A, estateId: ESTATE_A, supabase: mock }));
    assert(res.status === 500 && res.body?.code === 'EMPLOYEE_CREATE_FAILED', 'POST: empty RPC result fails closed (500)', `got ${res.status}`);
    assert(JSON.stringify(readLocal()) === before, 'POST: empty RPC result does not mutate local store');
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
