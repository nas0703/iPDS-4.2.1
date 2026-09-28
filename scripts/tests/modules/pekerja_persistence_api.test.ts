/**
 * iPDS v4.1.0 — Test Module 43: P0-16B.1 Authenticated Pekerja Persistence API
 *
 * Verifies the authenticated attendance + work-assignment persistence endpoints:
 *   - authentication required (401 unauthenticated)
 *   - authorization follows the repository model (any authenticated session)
 *   - estate isolation (cross-estate read/write rejected; body estate_id is
 *     never the authorization boundary)
 *   - payload validation (malformed -> 400 before any DB access)
 *   - no direct browser Supabase access remains for the three protected tables
 *   - frontend write failures are surfaced (no silent localStorage success)
 */

import fs from 'fs';
import path from 'path';
import workersRoutes, {
  validateAttendancePayload,
  validateWorkAssignmentPayload,
  allItemsInEstate
} from '../../../src/server/routes/workers.routes.js';
import { authHeaders } from '../helpers/authTestTokens.js';

type Method = 'get' | 'post' | 'delete';

interface MockResult { status: number; body: any; allowed: boolean; }

function findRoute(method: Method, exactPath: string) {
  const stack = (workersRoutes as any).stack || [];
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
    ip: '127.0.0.1', originalUrl: '/api/workers', url: '/api/workers', path: '/api/workers', baseUrl: '',
    get(name: string) { return this.headers[String(name).toLowerCase()]; }
  };
}
function read(rel: string): string { return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8'); }

const SERVICE_SRC = 'src/features/pekerja/services.ts';
const ROUTES_SRC = 'src/server/routes/workers.routes.ts';

const PIN_STAFF = authHeaders('123456');
const PIN_MANDUR = authHeaders('222222');
const PIN_FC = authHeaders('2401199');
// FC Tunggal (2401199) is the designated cross-estate Super Admin; use a genuine
// single-estate branch FC (FC Adela 600300) for estate-isolation assertions.
const PIN_FC_BRANCH = authHeaders('600300');

export async function runPekerjaPersistenceApiTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 43: P0-16B.1 AUTHENTICATED PEKERJA PERSISTENCE API');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 43.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 43.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 43.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  const envKeys = ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of envKeys) savedEnv[k] = process.env[k];
  for (const k of envKeys) delete process.env[k];

  try {
    // 1. Route registration + auth wiring
    const getAttendance = findRoute('get', '/attendance');
    const postAttendance = findRoute('post', '/attendance');
    const postAssignments = findRoute('post', '/work-assignments');
    const getAssignments = findRoute('get', '/work-assignments');
    assert(!!getAttendance && !!postAttendance && !!postAssignments, 'attendance GET/POST and work-assignment POST routes are registered');
    assert(!!getAssignments, 'existing work-assignment GET route is preserved');

    const routesSrc = read(ROUTES_SRC);
    assert(/router\.get\('\/attendance',\s*requireAuth/.test(routesSrc), 'attendance GET requires authentication');
    assert(/router\.post\('\/attendance',\s*requireAuth/.test(routesSrc), 'attendance POST requires authentication');
    assert(/router\.post\('\/work-assignments',\s*requireAuth/.test(routesSrc), 'work-assignment POST requires authentication');
    assert(/router\.get\('\/work-assignments',\s*requireAuth/.test(routesSrc), 'work-assignment GET remains requireAuth');

    // 2. Unauthenticated -> 401
    for (const [label, route, http] of [
      ['GET /attendance', getAttendance, 'GET'],
      ['POST /attendance', postAttendance, 'POST'],
      ['POST /work-assignments', postAssignments, 'POST']
    ] as Array<[string, any, string]>) {
      const result = await invokeHandlers(routeHandlers(route).slice(0, 1), buildReq(http));
      assert(result.status === 401, `Unauthenticated ${label} returns 401`, `got ${result.status}`);
    }

    // 3. Authenticated same-estate -> allowed (auth middleware passes)
    for (const [label, route, http] of [
      ['GET /attendance', getAttendance, 'GET'],
      ['POST /attendance', postAttendance, 'POST'],
      ['POST /work-assignments', postAssignments, 'POST']
    ] as Array<[string, any, string]>) {
      const result = await invokeHandlers(routeHandlers(route).slice(0, 1), buildReq(http, { headers: PIN_STAFF }));
      assert(result.allowed, `Authenticated same-estate ${label} is allowed`, `status=${result.status}`);
    }

    // 4. Cross-estate via x-estate-id -> 403 (single-estate branch role)
    {
      const result = await invokeHandlers(routeHandlers(postAttendance).slice(0, 1),
        buildReq('POST', { headers: { ...PIN_FC_BRANCH, 'x-estate-id': 'FPM_TUNGGAL' }, body: { records: [] } }));
      assert(result.status === 403, 'Cross-estate request via x-estate-id rejected (403)', `got ${result.status}`);
    }

    // 5. Cross-estate item inside body -> 403 (handler-level guard, before DB)
    {
      const result = await invokeHandlers(routeHandlers(postAttendance), buildReq('POST', {
        headers: PIN_FC,
        body: { records: [{ worker_id: 'w1', date: '2026-09-13', status: 'Hadir', estate_id: 'FPM_ADELA' }] }
      }));
      assert(result.status === 403, 'Cross-estate item inside attendance batch rejected (403)', `got ${result.status}`);
    }
    {
      const result = await invokeHandlers(routeHandlers(postAssignments), buildReq('POST', {
        headers: PIN_FC,
        body: { assignments: [{ worker_id: 'w1', date: '2026-09-13', work_type: 'Menuai', blok: '1', peringkat: 'P1', estate_id: 'FPM_ADELA' }] }
      }));
      assert(result.status === 403, 'Cross-estate item inside work-assignment batch rejected (403)', `got ${result.status}`);
    }

    // 6. Malformed payloads -> 400 (validated before any DB access)
    {
      const cases: Array<[string, any]> = [
        ['missing worker_id', { records: [{ date: '2026-09-13', status: 'Hadir' }] }],
        ['invalid date', { records: [{ worker_id: 'w1', date: '13-09-2026', status: 'Hadir' }] }],
        ['unknown status', { records: [{ worker_id: 'w1', date: '2026-09-13', status: 'Bercuti' }] }],
        ['empty batch', { records: [] }]
      ];
      for (const [label, body] of cases) {
        const result = await invokeHandlers(routeHandlers(postAttendance), buildReq('POST', { headers: PIN_FC, body }));
        assert(result.status === 400, `Malformed attendance (${label}) rejected (400)`, `got ${result.status}`);
      }
    }
    {
      const cases: Array<[string, any]> = [
        ['missing work_type', { assignments: [{ worker_id: 'w1', date: '2026-09-13', blok: '1', peringkat: 'P1' }] }],
        ['missing blok', { assignments: [{ worker_id: 'w1', date: '2026-09-13', work_type: 'Menuai', peringkat: 'P1' }] }],
        ['missing peringkat', { assignments: [{ worker_id: 'w1', date: '2026-09-13', work_type: 'Menuai', blok: '1' }] }],
        ['empty batch', { assignments: [] }]
      ];
      for (const [label, body] of cases) {
        const result = await invokeHandlers(routeHandlers(postAssignments), buildReq('POST', { headers: PIN_FC, body }));
        assert(result.status === 400, `Malformed work-assignment (${label}) rejected (400)`, `got ${result.status}`);
      }
    }
    {
      const result = await invokeHandlers(routeHandlers(getAttendance), buildReq('GET', { headers: PIN_FC, query: { date: 'not-a-date' } }));
      assert(result.status === 400, 'Malformed attendance date query rejected (400)', `got ${result.status}`);
    }

    // 7. Valid payload without a configured DB -> no false success (500/503)
    {
      const result = await invokeHandlers(routeHandlers(postAttendance), buildReq('POST', {
        headers: PIN_FC,
        body: { records: [{ worker_id: 'w1', date: '2026-09-13', status: 'Hadir' }] }
      }));
      assert([500, 503].includes(result.status), 'Valid attendance write does not report false success without DB (500/503)', `got ${result.status}`);
      assert(result.body?.success !== true, 'Valid attendance write response is not success when DB unavailable');
    }
    {
      const result = await invokeHandlers(routeHandlers(postAssignments), buildReq('POST', {
        headers: PIN_FC,
        body: { assignments: [{ worker_id: 'w1', date: '2026-09-13', work_type: 'Menuai', blok: '1', peringkat: 'P1' }] }
      }));
      assert([500, 503].includes(result.status), 'Valid work-assignment write does not report false success without DB (500/503)', `got ${result.status}`);
    }

    // 8. Payload validators (pure)
    {
      const ok = validateAttendancePayload({ records: [{ worker_id: 'w1', date: '2026-09-13', status: 'Hadir', estate_id: 'FPM_TUNGGAL', notes: 'x' }] });
      assert(ok.ok === true && ok.records?.length === 1, 'attendance validator accepts a valid record');
      assert(ok.records?.[0]?.worker_id === 'w1' && ok.records?.[0]?.status === 'Hadir', 'attendance validator preserves worker_id/status');
      assert(!('estate_id' in (ok.records?.[0] as any)) && !('notes' in (ok.records?.[0] as any)), 'attendance validator whitelists columns (drops estate_id/notes)');

      assert(validateAttendancePayload({ records: [{ worker_id: '', date: '2026-09-13', status: 'Hadir' }] }).ok === false, 'attendance validator rejects empty worker_id');
      assert(validateAttendancePayload({ records: new Array(501).fill({ worker_id: 'w', date: '2026-09-13', status: 'Hadir' }) }).ok === false, 'attendance validator enforces batch size limit');

      const wa = validateWorkAssignmentPayload({ assignments: [{ worker_id: 'w1', date: '2026-09-13', work_type: 'Menuai', blok: '1', peringkat: 'P1', notes: 'ok' }] });
      assert(wa.ok === true && wa.assignments?.length === 1 && wa.assignments[0].notes === 'ok', 'work-assignment validator accepts a valid record');
      assert(validateWorkAssignmentPayload({ assignments: [{ worker_id: 'w1', date: '2026-09-13', work_type: 'Menuai', blok: '1' }] }).ok === false, 'work-assignment validator rejects missing peringkat');

      assert(allItemsInEstate({ records: [{ estate_id: 'FPM_TUNGGAL' }] }, 'records', 'FPM_TUNGGAL') === true, 'allItemsInEstate accepts matching estate');
      assert(allItemsInEstate({ records: [{ estate_id: 'FPM_ADELA' }] }, 'records', 'FPM_TUNGGAL') === false, 'allItemsInEstate rejects a foreign estate');
      assert(allItemsInEstate({ records: [{ worker_id: 'w1' }] }, 'records', 'FPM_TUNGGAL') === true, 'allItemsInEstate allows items without estate_id (server assigns)');
    }

    // 9. Backend estate-scoping + safe upsert source guards
    {
      const src = routesSrc;
      assert((src.match(/\.eq\('estate_id',\s*estateId\)/g) || []).length >= 6, 'all new DB operations scope by estate_id');
      assert(/const estateId = resolveAuthorizedEstate\(req\)/.test(src) && /req\.estateId/.test(src), 'authorized estate comes from req.estateId');
      assert(!/req\.body[^\n]*estate_id[^\n]*resolveAuthorizedEstate|estateId\s*=\s*String\(req\.body/.test(src), 'estate_id from the request body is never used as the authorization boundary');
      const postAssignmentsSrc = src.slice(src.indexOf("router.post('/work-assignments'"));
      assert(!/\.delete\(\)[\s\S]{0,80}\.eq\('date'/.test(postAssignmentsSrc), 'no delete-by-date replacement strategy in the new write path');
      assert(/\.delete\(\)[\s\S]{0,120}\.in\('id',\s*toRemove\)/.test(postAssignmentsSrc), 'removed rows are reconciled by id after upsert (never delete-then-reinsert)');
      assert(/upsert|\.update\(|\.insert\(/.test(src), 'work-assignment/attendance writes use update/insert (no delete-then-insert)');
      assert(/getEstateWorkerIds/.test(src) && /Pekerja tidak sah untuk ladang ini/.test(src), 'worker ownership is validated against the authorized estate');
    }

    // 9b. replaceDate reconciliation safety (source + behavior)
    {
      const postSrc = routesSrc.slice(routesSrc.indexOf("router.post('/work-assignments'"));
      const reconcileSrc = postSrc.slice(postSrc.indexOf('if (replaceDate)'));
      assert(/\.eq\('estate_id',\s*estateId\)[\s\S]{0,40}\.eq\('date',\s*replaceDateValue\)/.test(reconcileSrc),
        'replaceDate reconciliation selects only the authorized estate + requested date');
      assert(/\.delete\(\)[\s\S]{0,140}\.eq\('estate_id',\s*estateId\)[\s\S]{0,80}\.in\('id',\s*toRemove\)/.test(reconcileSrc),
        'replaceDate delete is scoped to the authorized estate and reconciled ids');
      assert(postSrc.indexOf('if (replaceDate)') > postSrc.indexOf('upsert(payloads'),
        'reconciliation runs after the upsert (never delete-before-insert)');
      assert(/const incoming = new Set\(assignments\.filter\(a => a\.date === replaceDateValue\)/.test(postSrc),
        'reconciliation set is limited to the requested date (deduplicated via Set)');
      assert(!/id:\s*a\.id/.test(postSrc), 'client-supplied assignment id is not trusted in the DB payload');
      assert(/if \(replaceDate && !isValidDateString\(replaceDateValue\)\)/.test(postSrc),
        'replaceDate value is validated before use');

      // Database-native ON CONFLICT upserts (P0-16B.2)
      assert(/\.upsert\(payloads,\s*\{\s*onConflict:\s*'estate_id,worker_id,date'\s*\}\)/.test(routesSrc),
        'attendance/work-assignment writes use ON CONFLICT (estate_id, worker_id, date)');
      const attendanceSrc = routesSrc.slice(routesSrc.indexOf("router.post('/attendance'"), routesSrc.indexOf("router.post('/work-assignments'"));
      assert(/\.from\('attendance_records'\)[\s\S]*?\.upsert\(payloads,\s*\{\s*onConflict:\s*'estate_id,worker_id,date'\s*\}\)/.test(attendanceSrc),
        'attendance upsert uses the database-native conflict target');
      assert(!/\.from\('attendance_records'\)[\s\S]{0,120}\.select\('id'\)/.test(attendanceSrc),
        'attendance no longer uses application-level select-then-write');
      assert(!/\.from\('work_assignments'\)[\s\S]{0,160}\.select\('id'\)[\s\S]{0,160}\.insert\(/.test(postSrc),
        'work assignments no longer use application-level select-then-insert');
    }
    {
      const result = await invokeHandlers(routeHandlers(postAssignments), buildReq('POST', {
        headers: PIN_FC,
        body: { replaceDate: true, date: '2026-09-13', assignments: [] }
      }));
      assert(result.status === 400, 'empty replaceDate batch is rejected (400) and cannot wipe a day', `got ${result.status}`);
    }
    {
      const result = await invokeHandlers(routeHandlers(postAssignments), buildReq('POST', {
        headers: PIN_FC,
        body: { replaceDate: true, date: '2026-09-13', assignments: [{ worker_id: 'w1', date: '2026-09-13', work_type: 'Menuai', blok: '1', peringkat: 'P1', estate_id: 'FPM_ADELA' }] }
      }));
      assert(result.status === 403, 'replaceDate batch containing another estate is rejected (403) before reconciliation', `got ${result.status}`);
    }
    {
      const result = await invokeHandlers(routeHandlers(postAssignments), buildReq('POST', {
        headers: PIN_FC,
        body: { replaceDate: true, date: '2026-09-13', assignments: [{ worker_id: 'w1', date: '2026-09-13', work_type: 'Menuai', blok: '1', peringkat: 'P1' }] }
      }));
      assert([500, 503].includes(result.status), 'valid replaceDate batch does not report false success without DB', `got ${result.status}`);
    }

    // 10. Frontend rewiring + failure propagation
    {
      const src = read(SERVICE_SRC);
      assert(!/supabase/.test(src), 'pekerja/services.ts has no direct Supabase import/usage');
      assert(!/from\('workers'\)|from\('attendance_records'\)|from\('work_assignments'\)/.test(src), 'pekerja/services.ts has no direct table access');
      assert(/const ATTENDANCE_API = '\/api\/workers\/attendance'/.test(src), 'frontend uses the attendance API endpoint');
      assert(/apiPostJson\(ATTENDANCE_API/.test(src), 'upsertAttendance posts through the authenticated API');
      assert(/apiPostJson\(WORK_ASSIGNMENTS_API,\s*\{\s*date,\s*replaceDate:\s*true/.test(src), 'saveWorkAssignmentsBatch sends replaceDate batch to the API');
      assert(/throw new Error\(json\?\.error \|\| `Permintaan API gagal/.test(src), 'apiPostJson throws on API failure (no silent success)');
      assert(!/return records as AttendanceRecord\[\];\s*$/m.test(src.split('apiPostJson(ATTENDANCE_API')[0].slice(-400)), 'upsertAttendance does not return before the API call');
    }

    // 11. P0-16B.2 unique-key migration (static)
    {
      const MIG = 'supabase/migrations/20260922_p0_16b_pekerja_unique_keys.sql';
      assert(fs.existsSync(path.join(process.cwd(), MIG)), 'unique-key migration 20260922 exists');
      const sql = read(MIG);
      const sqlCode = sql.replace(/--[^\n]*/g, '');
      assert(/CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_estate_worker_date\s+ON public\.attendance_records \(estate_id, worker_id, date\)/i.test(sql),
        'migration adds unique key on attendance_records (estate_id, worker_id, date)');
      assert(/CREATE UNIQUE INDEX IF NOT EXISTS uq_work_assignments_estate_worker_date\s+ON public\.work_assignments \(estate_id, worker_id, date\)/i.test(sql),
        'migration adds unique key on work_assignments (estate_id, worker_id, date)');
      assert(!/work_type/i.test(sqlCode), 'work_assignments unique key does not include work_type');
      assert(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/i.test(sqlCode), 'migration contains no destructive/DML statements');
      assert(!/(GRANT|REVOKE|ROW LEVEL SECURITY|CREATE POLICY|ALTER POLICY)/i.test(sqlCode), 'migration does not change RLS/grants/policies');
      assert(/BEGIN;/.test(sql) && /COMMIT;/.test(sql), 'migration is wrapped in a transaction');
      const tables = [...sqlCode.matchAll(/public\.([a-z_]+)/gi)].map(m => m[1].toLowerCase());
      assert(tables.length >= 2 && tables.every(t => t === 'attendance_records' || t === 'work_assignments'), 'migration only targets attendance_records/work_assignments');

      const files = fs.readdirSync(path.join(process.cwd(), 'supabase', 'migrations')).filter(f => f.endsWith('.sql')).sort();
      assert(files.indexOf('20260922_p0_16b_pekerja_unique_keys.sql') > files.indexOf('20260921_p0_16_registered_devices_acl_reconciliation.sql'),
        'migration ordering is after 20260921');
    }
  } finally {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
    }
  }

  console.log(`\nMODULE 43 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /pekerja_persistence_api\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runPekerjaPersistenceApiTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16B.1 pekerja persistence API suite execution error:', err); process.exit(1); });
}
