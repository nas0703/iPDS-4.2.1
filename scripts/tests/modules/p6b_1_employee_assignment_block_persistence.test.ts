/**
 * iPDS v4.2.1 — Test Module 70: P6B-1 Employee Assignment Block Persistence
 *
 * Proves, from migration configuration and route behaviour (no live database):
 *
 *   RPC / migration (static)
 *   1.  create_employee_with_assignment() gains exactly ONE optional
 *       p_block_ids parameter.
 *   2.  The original 15 parameters are unchanged, in the same order.
 *   3.  NULL block_ids is accepted (no block rows).
 *   4.  Empty block_ids is accepted (no block rows).
 *   5.  Valid same-estate codes resolve to org_blocks ids.
 *   6.  Multiple blocks persist (set-based insert).
 *   7.  Duplicate codes are deduplicated.
 *   8.  A nonexistent code is rejected (INVALID_ASSIGNMENT_BLOCK, 22023).
 *   9.  A foreign-estate code is rejected.
 *   10. A foreign-tenant code cannot resolve.
 *   11/12. Mixed valid+invalid / same-estate+foreign-estate rejects the WHOLE
 *       transaction (validation precedes every write; one function = one tx).
 *   13. The block rows use the new assignment_id.
 *   14. The stored block_id is the real org_blocks.id, never the client code.
 *   15. No duplicate (assignment_id, block_id) pair is created.
 *   16. Existing creation behaviour is intact when block_ids is omitted.
 *   17. Existing tenant/estate violation behaviour is intact.
 *   18. Existing role boundaries are unchanged.
 *   19. No service-role / privileged bypass is introduced.
 *   20. The rollback restores the original 15-parameter RPC and deletes no data.
 *
 *   Route (behavioural, mocked Supabase)
 *   - block codes are forwarded to the RPC; omitted when no blocks are supplied
 *   - the response carries the PERSISTED org_blocks ids, not synthetic UUIDs
 *   - an RPC failure fails closed (500) with no local-cache mutation
 *
 * IMPORTANT LIMITATION: STATIC/mocked verification only. It cannot prove live
 * PostgreSQL behaviour (tconstraint enforcement, trigger behaviour, RLS).
 */

import fs from 'fs';
import path from 'path';
import employeesRoutes from '../../../src/server/routes/employees.routes.js';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const ROLLBACKS_DIR = path.join(process.cwd(), 'supabase', 'rollbacks');
const MIGRATION_FILE = '20261008_create_employee_assignment_block_persistence.sql';
const ROLLBACK_FILE = '20261008_create_employee_assignment_block_persistence_rollback.sql';
const PREVIOUS_RPC_FILE = '20261004_employee_master_rls_estate_scoping.sql';
const RPC_MIGRATION_FILE = '20260929_p1_1d_employee_create_atomic_rpc.sql';
const EMP_FILE = path.join(process.cwd(), 'data', 'employees.json');
const ESTATE_A = 'FPM_ADELA';

function stripSqlComments(sql: string): string {
  return sql.split(/\r?\n/).map((line) => line.replace(/--.*$/, '')).join('\n');
}
function normalize(sql: string): string {
  return stripSqlComments(sql).replace(/\s+/g, ' ').trim();
}
function readSql(dir: string, file: string): string {
  const p = path.join(dir, file);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}
function readMigrations(): Array<{ file: string; sql: string }> {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: normalize(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')) }));
}
function findFunction(sql: string, name: string): string {
  const m = new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${name}\\b`).exec(sql);
  if (!m) return '';
  const end = sql.indexOf('$$;', m.index);
  return end === -1 ? sql.slice(m.index) : sql.slice(m.index, end + 3);
}
function findLastFunctionDefinition(name: string): { file: string; sql: string } | null {
  let found: { file: string; sql: string } | null = null;
  for (const { file, sql } of readMigrations()) {
    const body = findFunction(sql, name);
    if (body) found = { file, sql: body };
  }
  return found;
}
function paramsOf(sql: string): string[] {
  const start = sql.indexOf('(');
  const end = sql.indexOf(') RETURNS TABLE');
  if (start === -1 || end === -1) return [];
  return sql.slice(start + 1, end).split(',').map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
function returnsOf(sql: string): string {
  const m = /\)\s*RETURNS\s+TABLE\s*\(([^)]*)\)/i.exec(sql);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/* ---------------------------------------------------------------------------
 * Route harness (same pattern as modules 57/59)
 * ------------------------------------------------------------------------- */
interface BlockRow { block_id: string; org_blocks: { id: string; block_code: string; hectarage: number; division_id: string | null; is_active: boolean } }

function runLastHandler(route: any, req: any): Promise<{ status: number; body: any }> {
  const handlers = (route?.route?.stack || []).map((s: any) => s.handle);
  const handler = handlers[handlers.length - 1];
  return new Promise((resolve) => {
    let status = 200;
    let body: any = null;
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve({ status, body }); } };
    const res: any = {
      status(code: number) { status = code; return res; },
      json(data: any) { body = data; finish(); return res; },
      send(data: any) { body = data; finish(); return res; },
      setHeader() { return res; },
      getHeader() { return undefined; },
      end() { finish(); return res; }
    };
    Promise.resolve(handler(req, res))
      .then(() => { if (!settled) finish(); })
      .catch((e: any) => { status = 500; body = { error: String(e?.message || e) }; finish(); });
  });
}

function buildReq(opts: { body: any; user: any; estateId: string; supabase: any }): any {
  return {
    method: 'POST',
    params: {},
    headers: {},
    cookies: {},
    query: {},
    body: opts.body,
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

function createSupabaseMock(state: { rpcArgs?: any[]; rpcError?: any; blockRows?: BlockRow[] }) {
  state.rpcArgs = state.rpcArgs || [];
  function makeBuilder(table: string) {
    const s: any = { op: 'select' };
    const builder: any = {
      select() { return builder; },
      insert() { s.op = 'insert'; return builder; },
      update() { s.op = 'update'; return builder; },
      upsert() { s.op = 'upsert'; return builder; },
      eq() { return builder; },
      limit() { return builder; },
      order() { return builder; },
      ilike() { return builder; },
      maybeSingle() { return builder; },
      then(resolve: any) {
        if (table === 'org_positions') return resolve({ data: [{ id: 'pos-1' }], error: null });
        if (table === 'employee_assignment_blocks' && s.op === 'select') {
          return resolve({ data: state.blockRows ?? [], error: null });
        }
        return resolve({ data: null, error: null });
      }
    };
    return builder;
  }
  return {
    from: (t: string) => makeBuilder(t),
    rpc: (fnName: string, args: any) => {
      state.rpcArgs!.push({ fnName, args });
      return {
        then(resolve: any) {
          if (state.rpcError) return resolve({ data: null, error: state.rpcError });
          return resolve({ data: [{ employee_id: 'emp-1', assignment_id: 'asg-1' }], error: null });
        }
      };
    }
  } as any;
}

const USER_A = { sub: 'FC-ADL-01', app_metadata: { app_role: 'fc', estate_id: ESTATE_A, operator_id: 'FC-ADL-01' }, user_metadata: { operator_name: 'FC Adela' } };
const ORG_BLOCK_ID_1 = '9a1b0000-0000-4000-8000-00000000b001';
const ORG_BLOCK_ID_2 = '9a1b0000-0000-4000-8000-00000000b002';

export async function runP6B_1AssignmentBlockPersistenceTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 70: P6B-1 EMPLOYEE ASSIGNMENT BLOCK PERSISTENCE');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 70.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 70.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 70.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // ============================ A. MIGRATION / RPC ============================
  const raw = readSql(MIGRATIONS_DIR, MIGRATION_FILE);
  assert(raw.length > 0, `P6B-1 migration ${MIGRATION_FILE} exists`);
  const sql = normalize(raw);
  const sqlNoComments = stripSqlComments(raw);

  const effective = findLastFunctionDefinition('create_employee_with_assignment');
  assert(!!effective && effective.file === MIGRATION_FILE,
    `effective create_employee_with_assignment is defined by ${MIGRATION_FILE}`, `effective file: ${effective?.file}`);

  const rpcSql = effective?.sql || '';
  const originalSql = findFunction(normalize(readSql(MIGRATIONS_DIR, RPC_MIGRATION_FILE)), 'create_employee_with_assignment');

  // 1 + 2 + return type
  const originalParams = paramsOf(originalSql);
  const currentParams = paramsOf(rpcSql);
  assert(originalParams.length === 15, 'baseline 20260929 RPC exposes 15 parameters', `found ${originalParams.length}`);
  assert(currentParams.length === 16, 'RPC exposes exactly one additional parameter (16 total)', `found ${currentParams.length}`);
  assert(currentParams.slice(0, 15).join(' | ') === originalParams.join(' | '),
    'existing 15 parameters are unchanged and in the same order',
    `original: ${originalParams.join(' | ')} ||| current: ${currentParams.slice(0, 15).join(' | ')}`);
  assert(/^p_block_ids\s+text\[\]\s+DEFAULT\s+NULL$/i.test(currentParams[15]),
    'the appended parameter is optional: p_block_ids text[] DEFAULT NULL', `param16: ${currentParams[15]}`);
  assert(returnsOf(rpcSql) === returnsOf(originalSql) && returnsOf(rpcSql).length > 0,
    'return type is unchanged (employee_id uuid, assignment_id uuid)',
    `original: ${returnsOf(originalSql)} | current: ${returnsOf(rpcSql)}`);

  // 3 + 4. NULL / empty accepted
  assert(/IF p_block_ids IS NOT NULL AND array_length\(p_block_ids, 1\) IS NOT NULL THEN/i.test(rpcSql),
    'NULL or empty p_block_ids skips block persistence entirely (accepted)');
  assert(/array_length\(p_block_ids, 1\) IS NOT NULL/.test(rpcSql),
    "empty arrays are handled via array_length() (empty text[] has NULL length)");

  // 5 + 9 + 10. resolution scoped to tenant + estate by code
  assert(/FROM public\.org_blocks b/.test(rpcSql), 'block codes are resolved against public.org_blocks');
  assert(/b\.tenant_id\s*=\s*p_tenant_id/.test(rpcSql), 'resolution enforces the authenticated tenant');
  assert(/b\.estate_id\s*=\s*p_estate_id/.test(rpcSql), 'resolution enforces the authenticated estate');
  assert(/b\.block_code\s*=\s*c\.code/.test(rpcSql), 'resolution matches on block_code, never on a client-supplied id');
  assert(!/p_block_ids[\s\S]{0,200}::uuid/i.test(rpcSql) && !/block_id\s*=\s*c\.code/i.test(rpcSql),
    'client-supplied codes are never cast to uuid or stored directly as block_id');

  // 8. fail-closed error, 22023
  assert(/INVALID_ASSIGNMENT_BLOCK/.test(rpcSql), 'unresolvable block raises INVALID_ASSIGNMENT_BLOCK');
  assert(/USING ERRCODE = '22023'/.test(rpcSql), 'invalid block uses ERRCODE 22023 (matching existing validation)');
  assert(/NOT EXISTS \(/.test(rpcSql) && /WHERE c\.code = ''/.test(rpcSql),
    'blank codes and unresolved codes are both rejected');

  // 11/12. validation precedes every write -> whole transaction rolls back
  const validationIdx = rpcSql.indexOf('INVALID_ASSIGNMENT_BLOCK');
  const empInsertIdx = rpcSql.indexOf('INSERT INTO public.employees');
  assert(validationIdx !== -1 && empInsertIdx !== -1 && validationIdx < empInsertIdx,
    'block validation runs BEFORE any insert, so a mixed list aborts employee+assignment+blocks together');

  // 6 + 7 + 13 + 14. set-based, deduplicated, correct assignment + real block id
  const insertIdx = rpcSql.indexOf('INSERT INTO public.employee_assignment_blocks');
  assert(insertIdx !== -1, 'RPC inserts into public.employee_assignment_blocks');
  const insertSql = insertIdx === -1 ? '' : rpcSql.slice(insertIdx, rpcSql.indexOf('RETURN QUERY', insertIdx) === -1 ? undefined : rpcSql.indexOf('RETURN QUERY', insertIdx));
  assert(/SELECT DISTINCT btrim\(code\)/.test(insertSql), 'codes are deduplicated before insertion (multiple blocks persist)');
  assert(/v_assignment_id/.test(insertSql), 'persisted rows use the newly created assignment id');
  assert(/\(\s*SELECT b\.id\s+FROM public\.org_blocks b/.test(insertSql),
    'block_id is the resolved org_blocks.id (scalar subquery), never the client code');
  assert(/FROM \(SELECT DISTINCT btrim\(code\) AS code FROM unnest\(p_block_ids\) AS code\) c/.test(insertSql),
    'row set derives from the deduplicated unnest of p_block_ids');

  // 15. no duplicate pair
  assert(/UNIQUE \(assignment_id, block_id\)/.test(normalize(readSql(MIGRATIONS_DIR, '20260915_employee_master_data_foundation.sql'))),
    'the employee_assignment_blocks unique key (assignment_id, block_id) backstops duplicate pairs');

  // 16 + 17 + 18. existing behaviour intact
  const preserved = [
    'EMPLOYEE_VALIDATION_ERROR: staff_no required',
    'EMPLOYEE_VALIDATION_ERROR: full_name required',
    'EMPLOYEE_VALIDATION_ERROR: tenant/company/position required',
    'EMPLOYEE_VALIDATION_ERROR: estate_id required',
    'EMPLOYEE_TENANT_VIOLATION',
    'EMPLOYEE_ESTATE_VIOLATION',
    'EMPLOYEE_VALIDATION_ERROR: invalid employment_status',
    'EMPLOYEE_VALIDATION_ERROR: invalid assignment_role'
  ];
  assert(preserved.every((t) => rpcSql.includes(t)), 'all existing validation and boundary guards are preserved');
  assert(/v_employee_id := gen_random_uuid\(\)/.test(rpcSql) &&
    /INSERT INTO public\.employees[\s\S]{0,400}?coalesce\(p_hire_date, CURRENT_DATE\)\);/i.test(rpcSql) &&
    !/INSERT INTO public\.employees[\s\S]{0,400}?RETURNING/i.test(rpcSql),
    'employees INSERT strategy from P3-1 is preserved (explicit id, no RETURNING)');
  assert(/INSERT INTO public\.employee_assignments[\s\S]{0,500}?RETURNING id INTO v_assignment_id/i.test(rpcSql),
    'assignment INSERT with RETURNING id is preserved');
  const roleGuard = 'public.auth_app_role()';
  assert(rpcSql.includes('auth_is_cross_estate_role()'),
    `estate boundary still delegates to auth_is_cross_estate_role() (${roleGuard} semantics unchanged)`);

  // 19. no privileged bypass
  assert(/SECURITY INVOKER/i.test(rpcSql) && !/SECURITY DEFINER/i.test(sqlNoComments),
    'RPC remains SECURITY INVOKER (no service-role/definer bypass introduced)');
  assert(/SET search_path = ''/i.test(rpcSql), "RPC keeps SET search_path = ''");
  assert(/GRANT EXECUTE ON FUNCTION public\.create_employee_with_assignment\([^)]*\) TO authenticated/i.test(sql) &&
    !/GRANT EXECUTE ON FUNCTION public\.create_employee_with_assignment\([^)]*\) TO (anon|PUBLIC|service_role)/i.test(sql),
    'EXECUTE is granted to authenticated only (no anon/PUBLIC/service_role widening)');

  // DROP-before-CREATE + guards (section F)
  const dropIdx = sql.indexOf('DROP FUNCTION IF EXISTS public.create_employee_with_assignment');
  const createIdx = sql.indexOf('CREATE FUNCTION public.create_employee_with_assignment');
  assert(dropIdx !== -1 && createIdx !== -1 && dropIdx < createIdx,
    'the 15-argument function is DROPped before the 16-argument one is created (no stale overload)');
  assert(/DUPLICATE_FUNCTION_SIGNATURE_DETECTED/.test(sql), 'deploy guard: duplicate/overloaded signature detection');
  assert(/BLOCK_PARAMETER_GUARD_FAILED/.test(sql), 'deploy guard: block parameter presence');
  // Regression: the original guard used
  //   array_to_string(proargnames, ',') NOT LIKE '%p_block_ids'
  // which never matched, because proargnames appends the RETURNS TABLE output
  // columns after the input parameters (so the string ends with
  // '...,employee_id,assignment_id') and the pattern had no trailing wildcard.
  // The guard therefore raised even for a correct 16-argument function.
  assert(!/array_to_string\([\s\S]{0,200}NOT LIKE '%p_block_ids'/.test(sql),
    'block-parameter guard no longer uses the end-anchored LIKE pattern (false-negative bug)');
  assert(/p\.proargnames\[p\.pronargs\]\s*=\s*'p_block_ids'/.test(sql),
    'block-parameter guard verifies p_block_ids is the final input parameter (exact, wildcard-free)');
  assert(/p\.proargtypes\[p\.pronargs - 1\]\s*=\s*'text\[\]'::regtype/.test(sql),
    'block-parameter guard verifies the exact text[] type of p_block_ids');
  assert(/p\.pronargs = 16/.test(sql) && /p\.pronargdefaults >= 1/.test(sql),
    'block-parameter guard verifies the argument count and the presence of a DEFAULT');
  // Regression: pg_get_functiondef() reproduces the ALIGNED source, so a probe
  // written with single spaces did not match "b.tenant_id  = p_tenant_id" and the
  // guard raised a false negative. Whitespace must be normalised first.
  assert(/regexp_replace\([\s\S]{0,120}pg_get_functiondef/.test(sql),
    'validation guard normalises whitespace before probing the function body');
  assert(/b\.block_code = c\.code/.test(sql),
    'validation guard asserts the block lookup key is block_code');
  // Regression: pg_get_functiondef() OMITS the default SECURITY INVOKER keyword,
  // so a text probe was a false negative. The catalog attribute must be used.
  assert(!/v_def NOT LIKE '%SECURITY INVOKER%'/.test(sql),
    'privilege guard no longer text-probes SECURITY INVOKER (false-negative bug)');
  assert(/prosecdef/.test(sql),
    'privilege guard checks the pg_proc.prosecdef attribute instead');
  assert(/BLOCK_VALIDATION_GUARD_FAILED/.test(sql), 'deploy guard: fail-closed tenant+estate block validation');
  assert(/PRIVILEGE_WIDENING_DETECTED/.test(sql), 'deploy guard: privilege widening');
  assert(/BEGIN;/.test(raw) && /COMMIT;/.test(raw), 'migration is wrapped in a transaction');

  // 20. rollback
  const rollbackRaw = readSql(ROLLBACKS_DIR, ROLLBACK_FILE);
  assert(rollbackRaw.length > 0, `rollback ${ROLLBACK_FILE} exists`);
  const rb = normalize(rollbackRaw);
  assert(/DROP FUNCTION IF EXISTS public\.create_employee_with_assignment\([\s\S]*?text\[\]\s*\)/i.test(rb),
    'rollback drops the 16-argument function');
  const rbFn = findFunction(rb, 'create_employee_with_assignment');
  assert(paramsOf(rbFn).length === 15 && !/p_block_ids/.test(rbFn),
    'rollback restores the original 15-parameter implementation', `params: ${paramsOf(rbFn).length}`);
  assert(/GRANT EXECUTE ON FUNCTION public\.create_employee_with_assignment\([^)]*\) TO authenticated/i.test(rb),
    'rollback restores the original EXECUTE grant');
  assert(!/DELETE FROM public\.org_blocks/i.test(rb) && !/DELETE FROM public\.employee_assignment_blocks/i.test(rb),
    'rollback deletes no org_blocks master data and no assignment-block data');

  // =============================== B. ROUTE ==================================
  const routeSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'routes', 'employees.routes.ts'), 'utf-8');
  assert(/p_block_ids: blockIds/.test(routeSrc), 'route forwards the sanitized block codes to the RPC');
  assert(/blockIds\.length === 0 && rpcError/.test(routeSrc),
    'route only takes the schema-cache fallback when NO blocks were requested (cannot hide invalid persistence)');
  assert(!/hectarage: 50\.0/.test(routeSrc) && !/blockIds\.map\(\(code: string\)/.test(routeSrc),
    'route no longer fabricates block rows with synthetic ids');
  assert(/from\('employee_assignment_blocks'\)[\s\S]{0,120}org_blocks \(id, block_code, hectarage, division_id, is_active\)/.test(routeSrc),
    'route reads back the persisted blocks joined to org_blocks');

  const envKeys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_POOLED_URL', 'SUPABASE_POOLER_URL', 'SUPABASE_READ_REPLICA_URL', 'SUPABASE_JWT_SECRET', 'JWT_SECRET'];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];
  const fileExisted = fs.existsSync(EMP_FILE);
  const fileContent = fileExisted ? fs.readFileSync(EMP_FILE, 'utf-8') : null;

  try {
    process.env.NODE_ENV = 'production';
    for (const k of envKeys) if (k !== 'NODE_ENV') delete process.env[k];

    const postRoute = (employeesRoutes as any).stack.find((l: any) => l.route?.methods?.post && l.route?.path === '/employees');
    assert(!!postRoute, 'employees POST route registered');

    const blockRows: BlockRow[] = [
      { block_id: ORG_BLOCK_ID_1, org_blocks: { id: ORG_BLOCK_ID_1, block_code: 'B01', hectarage: 30.46, division_id: null, is_active: true } },
      { block_id: ORG_BLOCK_ID_2, org_blocks: { id: ORG_BLOCK_ID_2, block_code: 'B02', hectarage: 58.07, division_id: null, is_active: true } }
    ];

    // with blocks -> codes forwarded, persisted ids returned
    fs.writeFileSync(EMP_FILE, JSON.stringify([], null, 2), 'utf-8');
    const stateOk: any = { blockRows };
    let res = await runLastHandler(postRoute, buildReq({
      body: { staff_no: 'BLK01', full_name: 'Block Staff', block_ids: ['B01', 'B02'] },
      user: USER_A, estateId: ESTATE_A, supabase: createSupabaseMock(stateOk)
    }));
    assert(res.status === 201, 'POST with block codes returns 201', `got ${res.status}`);
    assert(Array.isArray(stateOk.rpcArgs[0]?.args?.p_block_ids) &&
      stateOk.rpcArgs[0].args.p_block_ids.join(',') === 'B01,B02',
      'route passes the block codes to the RPC as p_block_ids',
      `got ${JSON.stringify(stateOk.rpcArgs[0]?.args?.p_block_ids)}`);
    const returnedBlocks = res.body?.data?.current_assignment?.blocks;
    assert(Array.isArray(returnedBlocks) && returnedBlocks.length === 2,
      'response returns the persisted blocks', `got ${JSON.stringify(returnedBlocks)}`);
    assert(returnedBlocks?.[0]?.id === ORG_BLOCK_ID_1 && returnedBlocks?.[1]?.id === ORG_BLOCK_ID_2,
      'response block ids are the persisted org_blocks ids (no synthetic UUIDs)',
      `got ${returnedBlocks?.map((b: any) => b.id).join(',')}`);
    assert(returnedBlocks?.[0]?.block_code === 'B01' && returnedBlocks?.[0]?.hectarage === 30.46,
      'response blocks carry real block_code and hectarage from org_blocks');

    // without blocks -> parameter omitted entirely, no fabricated rows
    fs.writeFileSync(EMP_FILE, JSON.stringify([], null, 2), 'utf-8');
    const stateNoBlocks: any = {};
    res = await runLastHandler(postRoute, buildReq({
      body: { staff_no: 'BLK02', full_name: 'No Block Staff' },
      user: USER_A, estateId: ESTATE_A, supabase: createSupabaseMock(stateNoBlocks)
    }));
    assert(res.status === 201, 'POST without block_ids returns 201', `got ${res.status}`);
    assert(!Object.prototype.hasOwnProperty.call(stateNoBlocks.rpcArgs[0]?.args || {}, 'p_block_ids'),
      'p_block_ids is omitted when no blocks are requested (works against the previous RPC version)');
    assert(Array.isArray(res.body?.data?.current_assignment?.blocks) && res.body.data.current_assignment.blocks.length === 0,
      'response has no fabricated blocks when none were requested');

    // RPC rejects an invalid block -> fail closed, no local mutation
    fs.writeFileSync(EMP_FILE, JSON.stringify([], null, 2), 'utf-8');
    const before = fs.readFileSync(EMP_FILE, 'utf-8');
    const stateErr: any = { rpcError: { code: '22023', message: 'INVALID_ASSIGNMENT_BLOCK: block code B99 does not resolve' } };
    res = await runLastHandler(postRoute, buildReq({
      body: { staff_no: 'BLK03', full_name: 'Invalid Block Staff', block_ids: ['B01', 'B99'] },
      user: USER_A, estateId: ESTATE_A, supabase: createSupabaseMock(stateErr)
    }));
    assert(res.status === 500 && res.body?.code === 'EMPLOYEE_CREATE_FAILED',
      'an INVALID_ASSIGNMENT_BLOCK RPC error fails the request closed (500)', `got ${res.status}`);
    assert(fs.readFileSync(EMP_FILE, 'utf-8') === before,
      'a rejected block list leaves no employee/assignment/block trace in the local store');
  } finally {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k] as string;
    }
    try {
      if (fileExisted && fileContent !== null) fs.writeFileSync(EMP_FILE, fileContent, 'utf-8');
      else if (!fileExisted && fs.existsSync(EMP_FILE)) fs.unlinkSync(EMP_FILE);
    } catch { /* ignore */ }
  }

  return { passed, total, failedTests };
}
