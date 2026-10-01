/**
 * iPDS v4.2.1 — Test Module 65: P2-1 Employee Create Server ID Reconciliation
 *
 * Verifies the CLIENT side of createEmployee() after Phase 2:
 *   - a successful POST /api/employees response is consumed
 *   - the server-issued employee id / assignment id are stored in the local cache
 *   - client-generated UUIDs are NOT persisted when the server issued ids
 *   - a non-2xx POST preserves the previous failure behaviour (local record, no throw)
 *   - a 201 without a usable id does not invent a contract (client id retained)
 *   - a network failure preserves the previous failure behaviour
 *   - no direct Supabase writes are reintroduced
 *
 * Phase 6C additions:
 *   - the persisted org_blocks rows returned by the API are adopted verbatim
 *     (block id, block_code, hectarage)
 *   - the client never manufactures block ids, hectarage or database identity
 *   - a response without a blocks field, and any RPC failure, leave no
 *     client-side phantom block state
 *
 * NOTE: this is a client-service unit test with a stubbed fetch + localStorage.
 * It does not prove live database id issuance; staging verification is still required.
 */

import fs from 'fs';
import path from 'path';
import { employeeMasterService, DEFAULT_POSITIONS } from '../../../src/features/pekerja/services/employeeMasterService.js';

const LS_EMPLOYEES = 'ipds_master_employees_v1';
const LS_ASSIGNMENTS = 'ipds_master_assignments_v1';
const SERVICE_SRC = path.join(process.cwd(), 'src', 'features', 'pekerja', 'services', 'employeeMasterService.ts');

const SERVER_EMPLOYEE_ID = '4f1c9a2e-1111-4222-8333-aaaaaaaaaaaa';
const SERVER_ASSIGNMENT_ID = '4f1c9a2e-4444-4555-8666-bbbbbbbbbbbb';

interface AssertResult { passed: number; total: number; failedTests: string[]; }

// Phase 6C: rows exactly as the API read-back returns them from
// employee_assignment_blocks JOIN org_blocks (real org_blocks.id, real hectarage).
const PERSISTED_BLOCK_A = {
  id: '6a2b3c4d-1111-4222-8333-cccccccccccc',
  tenant_id: '00000000-0000-0000-0000-000000000001',
  estate_id: 'FPM_TUNGGAL',
  division_id: 'DIV_TGL_P1',
  block_code: 'B01',
  hectarage: 30.46,
  is_active: true
};
const PERSISTED_BLOCK_B = {
  id: '6a2b3c4d-2222-4333-8444-dddddddddddd',
  tenant_id: '00000000-0000-0000-0000-000000000001',
  estate_id: 'FPM_TUNGGAL',
  division_id: 'DIV_TGL_P1',
  block_code: 'B02',
  hectarage: 28.93,
  is_active: true
};

function serverRecord(staffNo: string) {
  return {
    id: SERVER_EMPLOYEE_ID,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    staff_no: staffNo,
    full_name: 'Server Id Staff',
    position_id: DEFAULT_POSITIONS[0].id,
    position: { ...DEFAULT_POSITIONS[0] },
    employment_status: 'ACTIVE',
    id_card_passport: '900101-01-1234',
    contact_number: '012-3456789',
    email: 'srv@fpm.felda.gov.my',
    hire_date: '2026-09-30',
    created_at: '2026-09-30T00:00:00.000Z',
    current_assignment: {
      id: SERVER_ASSIGNMENT_ID,
      tenant_id: '00000000-0000-0000-0000-000000000001',
      employee_id: SERVER_EMPLOYEE_ID,
      company_id: '10000000-0000-0000-0000-000000000001',
      company_name: 'FPMSB',
      estate_id: 'FPM_TUNGGAL',
      estate_name: 'FPM Tunggal',
      division_id: 'DIV_TGL_P1',
      division_name: 'Peringkat 1',
      assignment_role: 'PRIMARY',
      status: 'ACTIVE',
      effective_from: '2026-09-30',
      effective_to: null,
      transfer_reason: 'Pendaftaran Awal Staf Baharu',
      blocks: []
    }
  };
}

function makeResponse(body: unknown, status: number) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => JSON.parse(text),
    text: async () => text
  } as unknown as Response;
}

function serverRecordWithBlocks(staffNo: string, blocks: unknown[]) {
  const rec = serverRecord(staffNo);
  (rec.current_assignment as any).blocks = blocks;
  return rec;
}

export async function runP2_1EmployeeIdReconciliationTests(): Promise<AssertResult> {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 65: P2-1 EMPLOYEE CREATE SERVER ID RECONCILIATION');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 65.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 65.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 65.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;
  const originalCustomEvent = (globalThis as any).CustomEvent;

  const store = new Map<string, string>();
  const localStorageStub = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear()
  };

  const payload = {
    staff_no: 'P21NEW01',
    full_name: 'Server Id Staff',
    position_id: DEFAULT_POSITIONS[0].id,
    employment_status: 'ACTIVE' as const,
    id_card_passport: '900101-01-1234',
    contact_number: '012-3456789',
    email: 'srv@fpm.felda.gov.my',
    hire_date: '2026-09-30',
    estate_id: 'FPM_TUNGGAL',
    division_id: 'DIV_TGL_P1',
    block_ids: ['B01']
  };

  function seedStore() {
    store.clear();
    store.set(LS_EMPLOYEES, JSON.stringify([{
      id: 'seed-emp',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      staff_no: 'SEED0001',
      full_name: 'Seed Staff',
      position_id: DEFAULT_POSITIONS[0].id,
      position: DEFAULT_POSITIONS[0],
      employment_status: 'ACTIVE',
      hire_date: '2026-01-01',
      current_assignment: {
        id: 'seed-asg',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        employee_id: 'seed-emp',
        company_id: '10000000-0000-0000-0000-000000000001',
        estate_id: 'FPM_TUNGGAL',
        assignment_role: 'PRIMARY',
        status: 'ACTIVE',
        effective_from: '2026-01-01',
        effective_to: null
      }
    }]));
    store.set(LS_ASSIGNMENTS, JSON.stringify([]));
  }

  function installBrowserEnvironment(fetchImpl: typeof fetch) {
    seedStore();
    (globalThis as any).CustomEvent = (globalThis as any).CustomEvent || class { constructor() {} };
    (globalThis as any).localStorage = localStorageStub;
    (globalThis as any).window = {
      __IPDS_ACTIVE_ESTATE_ID__: 'FPM_TUNGGAL',
      localStorage: localStorageStub,
      dispatchEvent: () => {}
    };
    (globalThis as any).fetch = fetchImpl;
  }

  const clientUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  try {
    // ---- Case 1: successful 201 with server-issued ids ----
    installBrowserEnvironment(async () => makeResponse(
      { success: true, message: 'ok', data: serverRecord(payload.staff_no) },
      201
    ));

    const created = await employeeMasterService.createEmployee(payload);

    assert(created.id === SERVER_EMPLOYEE_ID,
      'createEmployee returns the server-issued employee id', `got ${created.id}`);
    assert(created.current_assignment?.id === SERVER_ASSIGNMENT_ID,
      'createEmployee returns the server-issued assignment id', `got ${created.current_assignment?.id}`);
    assert(created.current_assignment?.employee_id === SERVER_EMPLOYEE_ID,
      'assignment.employee_id is the server-issued employee id', `got ${created.current_assignment?.employee_id}`);

    const storedEmployees = JSON.parse(store.get(LS_EMPLOYEES) || '[]');
    const stored = storedEmployees.find((e: any) => e.staff_no === payload.staff_no);
    assert(!!stored, 'created employee is persisted to the local cache');
    assert(stored?.id === SERVER_EMPLOYEE_ID,
      'local cache stores the server-issued employee id', `got ${stored?.id}`);
    assert(stored?.current_assignment?.id === SERVER_ASSIGNMENT_ID,
      'local cache stores the server-issued assignment id', `got ${stored?.current_assignment?.id}`);
    assert(stored?.current_assignment?.employee_id === SERVER_EMPLOYEE_ID,
      'local cache assignment.employee_id is the server-issued employee id');
    assert(stored?.full_name === payload.full_name && stored?.position?.code === DEFAULT_POSITIONS[0].code,
      'reconciliation preserves the client-side local record fields');

    const storedAssignments = JSON.parse(store.get(LS_ASSIGNMENTS) || '[]');
    const storedAsg = storedAssignments.find((a: any) => a.employee_id === SERVER_EMPLOYEE_ID);
    assert(storedAsg?.id === SERVER_ASSIGNMENT_ID,
      'assignment history stores the server-issued assignment id', `got ${storedAsg?.id}`);

    // ---- Case 2: non-2xx => previous failure behaviour preserved ----
    installBrowserEnvironment(async () => makeResponse(
      { success: false, error: 'Gagal', code: 'EMPLOYEE_CREATE_FAILED' },
      500
    ));
    const rejected = await employeeMasterService.createEmployee({ ...payload, staff_no: 'P21NEW02' });
    assert(!!rejected.id, 'non-2xx POST still returns a local record (no throw)');
    const storedRejected = JSON.parse(store.get(LS_EMPLOYEES) || '[]')
      .find((e: any) => e.staff_no === 'P21NEW02');
    assert(!!storedRejected && storedRejected.id === rejected.id,
      'non-2xx POST preserves the existing local-cache behaviour');

    // ---- Case 3: 201 without a usable id => no invented contract ----
    installBrowserEnvironment(async () => makeResponse(
      { success: true, data: { staff_no: 'P21NEW03' } },
      201
    ));
    const malformed = await employeeMasterService.createEmployee({ ...payload, staff_no: 'P21NEW03' });
    assert(!!malformed.id && malformed.id !== 'undefined' && !malformed.id.includes('undefined'),
      '201 without server id falls back to the client-generated id without throwing');
    assert(clientUuidPattern.test(malformed.id) && malformed.id !== SERVER_EMPLOYEE_ID,
      'fallback path uses a client-generated UUID (contrast with the server-issued id)',
      `got ${malformed.id}`);

    // ---- Case 4: network failure => previous failure behaviour preserved ----
    installBrowserEnvironment(async () => { throw new Error('network down'); });
    const offline = await employeeMasterService.createEmployee({ ...payload, staff_no: 'P21NEW04' });
    assert(!!offline.id, 'network failure still returns a local record (no throw)');
    const storedOffline = JSON.parse(store.get(LS_EMPLOYEES) || '[]')
      .find((e: any) => e.staff_no === 'P21NEW04');
    assert(!!storedOffline, 'network failure still writes the local cache record');

    // ---- Case 5 (Phase 6C): persisted org_blocks rows are adopted verbatim ----
    installBrowserEnvironment(async () => makeResponse(
      { success: true, message: 'ok', data: serverRecordWithBlocks('P21NEW05', [PERSISTED_BLOCK_A, PERSISTED_BLOCK_B]) },
      201
    ));
    const withBlocks = await employeeMasterService.createEmployee({
      ...payload, staff_no: 'P21NEW05', block_ids: ['B01', 'B02']
    });
    const returnedBlocks = withBlocks.current_assignment?.blocks || [];
    assert(returnedBlocks.length === 2,
      'createEmployee adopts the persisted block list from the API response', `got ${returnedBlocks.length}`);
    assert(returnedBlocks[0]?.id === PERSISTED_BLOCK_A.id && returnedBlocks[1]?.id === PERSISTED_BLOCK_B.id,
      'persisted block ids (org_blocks.id) are preserved verbatim',
      `got ${returnedBlocks.map((b: any) => b.id).join(',')}`);
    assert(returnedBlocks[0]?.block_code === 'B01' && returnedBlocks[1]?.block_code === 'B02',
      'persisted block_code values are preserved verbatim',
      `got ${returnedBlocks.map((b: any) => b.block_code).join(',')}`);
    assert(Number(returnedBlocks[0]?.hectarage) === 30.46 && Number(returnedBlocks[1]?.hectarage) === 28.93,
      'persisted hectarage values are preserved verbatim',
      `got ${returnedBlocks.map((b: any) => b.hectarage).join(',')}`);
    assert(!returnedBlocks.some((b: any) => Number(b.hectarage) === 50),
      'no hardcoded 50.0 hectarage is introduced when persisted blocks exist');
    const storedWithBlocks = JSON.parse(store.get(LS_EMPLOYEES) || '[]')
      .find((e: any) => e.staff_no === 'P21NEW05');
    assert(JSON.stringify(storedWithBlocks?.current_assignment?.blocks) === JSON.stringify([PERSISTED_BLOCK_A, PERSISTED_BLOCK_B]),
      'local cache stores the persisted block rows unchanged (no synthetic substitution)');
    const storedAsgWithBlocks = JSON.parse(store.get(LS_ASSIGNMENTS) || '[]')
      .find((a: any) => a.id === SERVER_ASSIGNMENT_ID);
    assert(storedAsgWithBlocks?.blocks?.[0]?.id === PERSISTED_BLOCK_A.id,
      'assignment history uses the persisted org_blocks ids');

    // ---- Case 6 (Phase 6C): block-less creation still works ----
    installBrowserEnvironment(async () => makeResponse(
      { success: true, message: 'ok', data: serverRecord('P21NEW06') },
      201
    ));
    const noBlocks = await employeeMasterService.createEmployee({
      ...payload, staff_no: 'P21NEW06', block_ids: []
    });
    assert(noBlocks.id === SERVER_EMPLOYEE_ID && (noBlocks.current_assignment?.blocks || []).length === 0,
      'block-less creation still succeeds with an empty block list',
      `id=${noBlocks.id} blocks=${(noBlocks.current_assignment?.blocks || []).length}`);

    // ---- Case 7 (Phase 6C): response without a blocks field => no synthesis ----
    const noBlocksKey = serverRecord('P21NEW07');
    delete (noBlocksKey.current_assignment as any).blocks;
    installBrowserEnvironment(async () => makeResponse({ success: true, data: noBlocksKey }, 201));
    const missingBlocks = await employeeMasterService.createEmployee({ ...payload, staff_no: 'P21NEW07' });
    assert((missingBlocks.current_assignment?.blocks || []).length === 0,
      'a response without a blocks field does not trigger client-side block synthesis',
      `got ${(missingBlocks.current_assignment?.blocks || []).length}`);

    // ---- Case 8 (Phase 6C): RPC failure leaves no phantom block state ----
    installBrowserEnvironment(async () => makeResponse(
      { success: false, error: 'Gagal', code: 'EMPLOYEE_CREATE_FAILED' },
      500
    ));
    const failedWithBlocks = await employeeMasterService.createEmployee({ ...payload, staff_no: 'P21NEW08' });
    assert((failedWithBlocks.current_assignment?.blocks || []).length === 0,
      'RPC failure leaves no block state on the returned record',
      `got ${(failedWithBlocks.current_assignment?.blocks || []).length}`);
    const storedFailed = JSON.parse(store.get(LS_EMPLOYEES) || '[]')
      .find((e: any) => e.staff_no === 'P21NEW08');
    assert((storedFailed?.current_assignment?.blocks || []).length === 0,
      'RPC failure leaves no phantom block state in the local cache',
      `got ${(storedFailed?.current_assignment?.blocks || []).length}`);
    assert(!store.has('ipds_phantom_blocks'),
      'no phantom block store is introduced by the failure path');

    // ---- Static guard: no direct browser mutations reintroduced ----
    const src = fs.readFileSync(SERVICE_SRC, 'utf-8');
    assert(!/from\(['"]employees['"]\)[\s\S]{0,80}\.(insert|upsert|update|delete)\(/.test(src),
      'no direct browser INSERT/UPSERT/UPDATE/DELETE on employees');
    assert(!/from\(['"]employee_assignments['"]\)[\s\S]{0,80}\.(insert|upsert|update|delete)\(/.test(src),
      'no direct browser INSERT/UPSERT/UPDATE/DELETE on employee_assignments');
    assert(!/from\(['"]employee_assignment_blocks['"]\)/.test(src),
      'no browser access to employee_assignment_blocks');

    // ---- Static guard (Phase 6C): no manufactured block identity/hectarage ----
    const createSrc = src.slice(src.indexOf('async createEmployee'), src.indexOf('async transferAssignment'));
    assert(createSrc.length > 0, 'createEmployee source slice located for static analysis');
    assert(/Array\.isArray\(serverRecord\?\.current_assignment\?\.blocks\)/.test(createSrc),
      'createEmployee consumes the persisted blocks from the API response');
    assert(!/hectarage:\s*50/.test(createSrc),
      'createEmployee no longer hardcodes hectarage 50.0');
    assert(!/payload\.block_ids[\s\S]{0,240}id:\s*generateUUID\(\)/.test(createSrc),
      'createEmployee no longer synthesizes block UUIDs from block_ids');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
    if (originalLocalStorage === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = originalLocalStorage;
    if (originalCustomEvent === undefined) delete (globalThis as any).CustomEvent;
    else (globalThis as any).CustomEvent = originalCustomEvent;
  }

  return { passed, total, failedTests };
}
