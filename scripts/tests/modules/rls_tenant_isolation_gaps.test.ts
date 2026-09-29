import fs from 'fs';
import path from 'path';
import workersRoutes from '../../../src/server/routes/workers.routes.js';
import hujanRoutes from '../../../src/server/routes/hujan.routes.js';
import merumputRoutes from '../../../src/server/routes/merumput.routes.js';
import { tokenForRole, authHeaders } from '../helpers/authTestTokens.js';

type HttpMethod = 'get' | 'post' | 'put' | 'delete';

function findRoute(router: any, method: HttpMethod, exactPaths: string[]) {
  const stack = router?.stack || [];
  return stack.find((l: any) => {
    const p = l.route?.path;
    const paths = Array.isArray(p) ? p : [p];
    return l.route?.methods?.[method] && paths.some((x: string) => exactPaths.includes(x));
  });
}

function routeHandlers(route: any): any[] {
  return (route?.route?.stack || []).map((s: any) => s.handle);
}

interface MockResult {
  status: number;
  body: any;
  allowed: boolean;
}

function invokeHandlers(handlers: any[], req: any): Promise<MockResult> {
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
      status(code: number) {
        status = code;
        return res;
      },
      json(data: any) {
        body = data;
        finish(false);
        return res;
      },
      send(data: any) {
        body = data;
        finish(false);
        return res;
      },
      end() {
        finish(false);
        return res;
      }
    };

    let idx = 0;
    const next = (err?: any) => {
      if (err) {
        status = 500;
        body = { error: err.message || err };
        finish(false);
        return;
      }
      if (idx >= handlers.length) {
        finish(true);
        return;
      }
      const handler = handlers[idx++];
      try {
        handler(req, res, next);
      } catch (e: any) {
        status = 500;
        body = { error: e.message || e };
        finish(false);
      }
    };

    next();
  });
}

/**
 * Migration policy state tracker to simulate PostgreSQL migration application in order
 */
interface PolicyRecord {
  table: string;
  name: string;
  cmd: string;
  permissive: boolean;
  using?: string;
  withCheck?: string;
}

function simulateMigrationsPolicyState(): Map<string, Map<string, PolicyRecord[]>> {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  // table -> command -> PolicyRecord[]
  const tablePolicies = new Map<string, Map<string, PolicyRecord[]>>();

  const initTable = (tbl: string) => {
    if (!tablePolicies.has(tbl)) {
      tablePolicies.set(tbl, new Map([
        ['SELECT', []],
        ['INSERT', []],
        ['UPDATE', []],
        ['DELETE', []],
        ['ALL', []]
      ]));
    }
  };

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    // Parse DROP POLICY statements: DROP POLICY IF EXISTS "name" ON table;
    const dropRegex = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?["']?([^"'\s]+)["']?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
    let dropMatch;
    while ((dropMatch = dropRegex.exec(content)) !== null) {
      const policyName = dropMatch[1];
      const tableName = dropMatch[2];
      if (tablePolicies.has(tableName)) {
        const cmdMap = tablePolicies.get(tableName)!;
        for (const [cmd, list] of cmdMap.entries()) {
          cmdMap.set(cmd, list.filter(p => p.name !== policyName));
        }
      }
    }

    // Parse CREATE POLICY statements
    const createRegex = /CREATE\s+POLICY\s+["']?([^"'\s]+)["']?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)(?:[^\w]+AS\s+(RESTRICTIVE|PERMISSIVE))?\s+FOR\s+([A-Z]+)/gi;
    let createMatch;
    while ((createMatch = createRegex.exec(content)) !== null) {
      const policyName = createMatch[1];
      const tableName = createMatch[2];
      const cmd = createMatch[4].toUpperCase();
      initTable(tableName);
      const cmdMap = tablePolicies.get(tableName)!;
      const list = cmdMap.get(cmd) || [];
      // Remove any existing with same name (if recreated)
      const filtered = list.filter(p => p.name !== policyName);
      filtered.push({
        table: tableName,
        name: policyName,
        cmd,
        permissive: true
      });
      cmdMap.set(cmd, filtered);
    }
  }

  return tablePolicies;
}

export async function runRlsTenantIsolationGapsTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 62: RLS TENANT ISOLATION GAPS & POLICY CONSOLIDATION PROOF');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 62.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 62.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 62.${total}: ${name}`);
    }
  }

  // Tokens for test identities
  const staffTunggalToken = tokenForRole('staff', 'FPM_TUNGGAL');
  const mandurTunggalToken = tokenForRole('mandur', 'FPM_TUNGGAL');
  const pfTunggalToken = tokenForRole('pf', 'FPM_TUNGGAL');
  const fcTunggalToken = tokenForRole('fc', 'FPM_TUNGGAL');
  const rcToken = tokenForRole('rc', 'WILAYAH_JB');
  const ocToken = tokenForRole('oc', 'WILAYAH_JB');
  const eqiTunggalToken = tokenForRole('eqi', 'FPM_TUNGGAL');

  // ============================================================================
  // SECTION 1: Static Migration Analysis - Assert No Duplicate Permissive Policies
  // ============================================================================
  const finalPolicies = simulateMigrationsPolicyState();
  const targetTables = ['merumput_progress', 'hujan_rekod', 'workers'];
  const checkedCmds = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

  for (const tbl of targetTables) {
    const cmdMap = finalPolicies.get(tbl);
    assert(!!cmdMap, `Static policy tracking: Table ${tbl} exists in parsed migrations`);

    if (cmdMap) {
      for (const cmd of checkedCmds) {
        const list = (cmdMap.get(cmd) || []).concat(cmdMap.get('ALL') || []);
        const count = list.length;
        assert(
          count === 1,
          `Static policy verification: ${tbl} has exactly 1 permissive policy for ${cmd} (found: ${count})`,
          count !== 1 ? `Policies found: ${list.map(p => p.name).join(', ')}` : undefined
        );
      }
    }
  }

  // Verify that the migration 20261002 specifically drops stale policies
  const migration20261002Path = path.join(process.cwd(), 'supabase', 'migrations', '20261002_consolidate_rls_hujan_workers.sql');
  const migration20261002Exists = fs.existsSync(migration20261002Path);
  assert(migration20261002Exists, 'Migration 20261002_consolidate_rls_hujan_workers.sql exists on disk');

  if (migration20261002Exists) {
    const sql = fs.readFileSync(migration20261002Path, 'utf-8');
    assert(
      sql.includes('DROP POLICY IF EXISTS "hujan_rekod_tenant_isolation_select" ON public.hujan_rekod') &&
      sql.includes('DROP POLICY IF EXISTS "hujan_rekod_tenant_isolation_insert" ON public.hujan_rekod') &&
      sql.includes('DROP POLICY IF EXISTS "workers_tenant_isolation_select" ON public.workers') &&
      sql.includes('DROP POLICY IF EXISTS "workers_tenant_isolation_insert" ON public.workers') &&
      sql.includes('DROP POLICY IF EXISTS "workers_tenant_isolation_delete" ON public.workers'),
      'Migration 20261002 drops all stale 20260910 policy names without wildcards'
    );

    assert(
      sql.includes('DO $$') &&
      sql.includes('RAISE EXCEPTION') &&
      sql.includes('DUPLICATE_PERMISSIVE_POLICY_DETECTED'),
      'Migration 20261002 includes runtime guard DO block asserting max 1 permissive policy per command'
    );
  }

  const rollbackPath = path.join(process.cwd(), 'supabase', 'rollbacks', '20261002_consolidate_rls_hujan_workers_rollback.sql');
  assert(fs.existsSync(rollbackPath), 'Rollback migration 20261002 exists on disk');

  // ============================================================================
  // SECTION 2: API Tenant Isolation Proof: hujan_rekod
  // ============================================================================
  const hujanGetRoute = findRoute(hujanRoutes, 'get', ['/hujan', '/api/hujan']);
  const hujanPostRoute = findRoute(hujanRoutes, 'post', ['/hujan']);

  // (a) Estate A staff cannot read Estate B rows via API
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      query: { estate_id: 'FPM_ADELA' },
      url: '/api/hujan?estate_id=FPM_ADELA'
    };
    const res = await invokeHandlers(routeHandlers(hujanGetRoute), req);
    assert(
      res.status === 403 && (res.body?.code === 'FORBIDDEN_ESTATE' || res.body?.error?.includes('dilarang')),
      'Hujan GET: Single-estate staff (Tunggal) cannot read foreign estate (Adela) - rejected with 403'
    );
  }

  // (b) Estate A staff cannot insert foreign estate rows via API
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      body: { bulan: 'JAN', tahun: 2026, jumlah: 150, estate_id: 'FPM_ADELA' },
      query: { estate_id: 'FPM_ADELA' },
      url: '/api/hujan'
    };
    const res = await invokeHandlers(routeHandlers(hujanPostRoute), req);
    assert(
      res.status === 403 && (res.body?.code === 'FORBIDDEN_ESTATE' || res.body?.error?.includes('dilarang')),
      'Hujan POST: Single-estate staff cannot insert with foreign estate_id query parameter - rejected with 403'
    );
  }

  // (c) Estate A staff CAN read own estate
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      query: { estate_id: 'FPM_TUNGGAL' },
      url: '/api/hujan?estate_id=FPM_TUNGGAL'
    };
    const res = await invokeHandlers(routeHandlers(hujanGetRoute), req);
    assert(
      res.allowed || res.status === 200,
      'Hujan GET: Staff CAN read own estate (FPM_TUNGGAL)'
    );
  }

  // (d) Estate A staff CAN insert own estate
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      body: { bulan: 'JAN', tahun: 2026, jumlah: 120 },
      url: '/api/hujan'
    };
    const res = await invokeHandlers(routeHandlers(hujanPostRoute), req);
    assert(
      res.allowed || res.status === 200,
      'Hujan POST: Staff CAN write own estate record'
    );
  }

  // ============================================================================
  // SECTION 3: API Tenant Isolation Proof: workers
  // ============================================================================
  const workersGetRoute = findRoute(workersRoutes, 'get', ['/workers']);
  const workersPostRoute = findRoute(workersRoutes, 'post', ['/workers']);
  const workersDeleteRoute = findRoute(workersRoutes, 'delete', ['/workers/:id']);

  // (a) Estate A staff cannot read Estate B workers
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      query: { estate_id: 'FPM_ADELA' },
      url: '/api/workers?estate_id=FPM_ADELA'
    };
    const res = await invokeHandlers(routeHandlers(workersGetRoute), req);
    assert(
      res.status === 403 && (res.body?.code === 'FORBIDDEN_ESTATE' || res.body?.error?.includes('dilarang')),
      'Workers GET: Single-estate staff (Tunggal) cannot read foreign estate (Adela) - rejected with 403'
    );
  }

  // (b) Estate A staff cannot insert foreign estate workers
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      body: { id: 'w-foreign-1', name: 'Foreign Worker', estate_id: 'FPM_ADELA' },
      query: { estate_id: 'FPM_ADELA' },
      url: '/api/workers'
    };
    const res = await invokeHandlers(routeHandlers(workersPostRoute), req);
    assert(
      res.status === 403,
      'Workers POST: Foreign estate mutation by single-estate staff is rejected with 403'
    );
  }

  // (c) Estate A staff CAN read own estate workers
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      query: { estate_id: 'FPM_TUNGGAL' },
      url: '/api/workers'
    };
    const res = await invokeHandlers(routeHandlers(workersGetRoute), req);
    assert(
      res.allowed || res.status === 200,
      'Workers GET: Staff CAN read own estate workers'
    );
  }

  // (d) Role deletion capabilities on workers:
  // (d.1) PF CAN delete a worker in own estate
  {
    const req: any = {
      headers: { authorization: `Bearer ${pfTunggalToken}` },
      params: { id: 'w-test-123' },
      query: { estate_id: 'FPM_TUNGGAL' },
      url: '/api/workers/w-test-123'
    };
    const res = await invokeHandlers(routeHandlers(workersDeleteRoute), req);
    assert(
      res.allowed || res.status === 200,
      'Workers DELETE: PF role CAN delete worker in own estate'
    );
  }

  // (d.2) Staff CANNOT delete a worker (Route gated by requireRole(['pf', 'fc']))
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      params: { id: 'w-test-123' },
      url: '/api/workers/w-test-123'
    };
    const res = await invokeHandlers(routeHandlers(workersDeleteRoute), req);
    assert(
      res.status === 403,
      'Workers DELETE: Staff role CANNOT delete worker (rejected with 403)'
    );
  }

  // (d.3) Mandur CANNOT delete a worker
  {
    const req: any = {
      headers: { authorization: `Bearer ${mandurTunggalToken}` },
      params: { id: 'w-test-123' },
      url: '/api/workers/w-test-123'
    };
    const res = await invokeHandlers(routeHandlers(workersDeleteRoute), req);
    assert(
      res.status === 403,
      'Workers DELETE: Mandur role CANNOT delete worker (rejected with 403)'
    );
  }

  // (d.4) Cross-estate roles (RC / OC) cannot INSERT workers cross-estate
  // Under consolidated RLS policy: workers_insert_policy requires estate_id = auth_estate_id()
  // and role in ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')
  // Furthermore, rc/oc are not in the write allowlist.
  {
    const migrationSql = fs.readFileSync(migration20261002Path, 'utf-8').replace(/\r\n/g, '\n');
    const workerInsertCheckMatches = migrationSql.includes(
      "estate_id = public.auth_estate_id()\n    AND public.auth_app_role() IN ('staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'admin', 'super_admin')"
    );
    assert(
      workerInsertCheckMatches,
      'Workers RLS INSERT: Strictly binds to auth_estate_id() and excludes rc and oc from workers write'
    );

    const workerDeleteMatches = migrationSql.includes(
      "estate_id = public.auth_estate_id()\n    AND public.auth_app_role() IN ('pf', 'fc', 'admin', 'super_admin')"
    );
    assert(
      workerDeleteMatches,
      'Workers RLS DELETE: Strictly binds to auth_estate_id() and excludes rc and oc from worker deletion'
    );
  }

  // ============================================================================
  // SECTION 4: API Tenant Isolation Proof: merumput_progress
  // ============================================================================
  const merumputGetRoute = findRoute(merumputRoutes, 'get', ['/merumput/progress']);

  // (a) Single-estate staff cannot read foreign estate merumput progress
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      query: { estate_id: 'FPM_ADELA' },
      url: '/api/merumput/progress?estate_id=FPM_ADELA'
    };
    const res = await invokeHandlers(routeHandlers(merumputGetRoute), req);
    assert(
      res.status === 403 && (res.body?.code === 'FORBIDDEN_ESTATE' || res.body?.error?.includes('dilarang')),
      'Merumput GET: Single-estate staff (Tunggal) cannot read foreign estate (Adela) - rejected with 403'
    );
  }

  // (b) Single-estate staff CAN read own estate merumput progress
  {
    const req: any = {
      headers: { authorization: `Bearer ${staffTunggalToken}` },
      query: { estate_id: 'FPM_TUNGGAL' },
      url: '/api/merumput/progress?estate_id=FPM_TUNGGAL'
    };
    const res = await invokeHandlers(routeHandlers(merumputGetRoute), req);
    assert(
      res.allowed || res.status === 200,
      'Merumput GET: Staff CAN read own estate progress'
    );
  }

  // (c) Non-cross-estate role (eqi) cannot obtain cross-estate access
  {
    const req: any = {
      headers: { authorization: `Bearer ${eqiTunggalToken}` },
      query: { estate_id: 'ALL' },
      url: '/api/merumput/progress?estate_id=ALL'
    };
    const res = await invokeHandlers(routeHandlers(merumputGetRoute), req);
    assert(
      res.status === 403,
      'Merumput GET: Non-cross-estate role (eqi) attempting wildcard (ALL) is rejected with 403'
    );
  }

  return { passed, total, failedTests };
}

// Allow direct execution: npx tsx scripts/tests/modules/rls_tenant_isolation_gaps.test.ts
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /rls_tenant_isolation_gaps\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runRlsTenantIsolationGapsTests()
    .then((res) => {
      console.log(`\nMODULE 62 RESULT: ${res.passed}/${res.total} TESTS PASSED`);
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch((err) => {
      console.error('Module 62 execution error:', err);
      process.exit(1);
    });
}
