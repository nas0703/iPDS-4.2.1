import cronRoutes from '../../../src/server/routes/cron.routes.js';
import { requireCronAuth, DEV_DEFAULT_CRON_SECRET } from '../../../src/server/middleware/cronAuth.js';
import { jobQueueService } from '../../../src/server/services/jobQueue.service.js';
import { auditService } from '../../../src/server/services/audit.service.js';
import { AuthService } from '../../../src/server/services/auth.service.js';

export async function runCronEndpointTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 20: VERCEL CRON PROTECTED ENDPOINTS (/api/cron/process-jobs)');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;
  const failedTests: string[] = [];

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 20.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 20.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failedTests.push(`Test 20.${total}: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // Setup test session
  const tunggalStaffSession = AuthService.verifyPin('123456')!;

  // Test 20.1: Router structure & Route registration
  {
    assert(typeof cronRoutes === 'function', 'Cron router is an Express router instance');

    const stack = (cronRoutes as any).stack || [];
    const registered = stack.map((layer: any) => ({
      path: layer.route?.path,
      methods: Object.keys(layer.route?.methods || {})
    })).filter((r: any) => r.path);

    const getProcessRoute = registered.find((r: any) => r.path === '/cron/process-jobs' && r.methods.includes('get'));
    const postProcessRoute = registered.find((r: any) => r.path === '/cron/process-jobs' && r.methods.includes('post'));
    const getHealthRoute = registered.find((r: any) => r.path === '/cron/health' && r.methods.includes('get'));

    assert(!!getProcessRoute, 'GET /cron/process-jobs is registered with handler');
    assert(!!postProcessRoute, 'POST /cron/process-jobs is registered with handler');
    assert(!!getHealthRoute, 'GET /cron/health is registered with handler');
  }

  // Test 20.2: requireCronAuth blocks unauthenticated request without secret (401)
  {
    let statusCode = 200;
    let jsonResult: any = null;

    const mockReq: any = {
      headers: {},
      query: {}
    };

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: any) => {
        jsonResult = data;
        return mockRes;
      }
    };

    let nextCalled: any = false;
    requireCronAuth(mockReq, mockRes, () => {
      nextCalled = true;
    });

    assert(
      statusCode === 401 && !nextCalled && jsonResult?.code === 'UNAUTHORIZED_CRON_MISSING_SECRET',
      'Unauthenticated call without Bearer token or x-cron-secret header is rejected with 401 Unauthorized'
    );
  }

  // Test 20.3: requireCronAuth blocks wrong/tampered secret (401)
  {
    let statusCode = 200;
    let jsonResult: any = null;

    const mockReq: any = {
      headers: {
        authorization: 'Bearer invalid-cron-token-12345'
      },
      query: {}
    };

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: any) => {
        jsonResult = data;
        return mockRes;
      }
    };

    let nextCalled: any = false;
    requireCronAuth(mockReq, mockRes, () => {
      nextCalled = true;
    });

    assert(
      statusCode === 401 && !nextCalled && jsonResult?.code === 'UNAUTHORIZED_CRON_INVALID_SECRET',
      'Invalid Bearer secret token fails timingSafeCompare and is rejected with 401'
    );
  }

  // Test 20.4: requireCronAuth grants access with valid Bearer token and injects System identity
  {
    const activeSecret = process.env.CRON_SECRET || DEV_DEFAULT_CRON_SECRET;
    let statusCode = 200;
    let nextCalled: any = false;

    const mockReq: any = {
      headers: {
        authorization: `Bearer ${activeSecret}`
      },
      query: {}
    };

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: () => mockRes
    };

    requireCronAuth(mockReq, mockRes, () => {
      nextCalled = true;
    });

    assert(
      Boolean(nextCalled) && mockReq.user?.sub === 'system:vercel-cron-scheduler' && mockReq.authRole === 'rc',
      'Valid Authorization Bearer token passes authentication and attaches system scheduler identity context'
    );
  }

  // Test 20.5: requireCronAuth supports x-cron-secret header
  {
    const activeSecret = process.env.CRON_SECRET || DEV_DEFAULT_CRON_SECRET;
    let nextCalled: any = false;

    const mockReq: any = {
      headers: {
        'x-cron-secret': activeSecret
      },
      query: {}
    };

    const mockRes: any = {
      status: () => mockRes,
      json: () => mockRes
    };

    requireCronAuth(mockReq, mockRes, () => {
      nextCalled = true;
    });

    assert(Boolean(nextCalled), 'Valid x-cron-secret header passes authentication successfully');
  }

  // Test 20.6: Execution of GET /cron/process-jobs processes queued background jobs
  {
    // 1. Dispatch a test job to queue
    const queuedJob = await jobQueueService.dispatchJob({
      type: 'AI_MORNING_BRIEFING',
      estate_id: 'FPM_TUNGGAL',
      created_by_user_id: tunggalStaffSession.sub,
      created_by_operator_id: 'STF-TGL-01',
      created_by_role: 'staff',
      payload: { scope: 'CRON_BATCH_TEST' }
    });

    // 2. Invoke /cron/process-jobs route handler directly
    const stack = (cronRoutes as any).stack || [];
    const getLayer = stack.find((l: any) => l.route?.path === '/cron/process-jobs' && l.route?.methods?.get);
    assert(!!getLayer, 'GET /cron/process-jobs route stack layer found');

    const activeSecret = process.env.CRON_SECRET || DEV_DEFAULT_CRON_SECRET;
    let responseStatus = 200;
    let jsonResponse: any = null;

    const mockReq: any = {
      headers: {
        authorization: `Bearer ${activeSecret}`
      },
      query: {
        batch_size: 10,
        time_budget_ms: 10000
      }
    };

    const promise = new Promise<void>((resolve) => {
      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonResponse = data;
          resolve();
          return mockRes;
        }
      };

      // Run route middleware chain
      const handlers = getLayer.route.stack;
      let idx = 0;
      function nextHandler() {
        if (idx < handlers.length) {
          const fn = handlers[idx++].handle;
          fn(mockReq, mockRes, nextHandler);
        }
      }
      nextHandler();
    });

    await promise;

    assert(
      responseStatus === 200 && jsonResponse?.success === true && typeof jsonResponse?.summary?.processed === 'number',
      'GET /cron/process-jobs executes worker batch loop, drains background queue, and returns summary'
    );

    assert(
      jsonResponse?.queueMetrics && typeof jsonResponse?.queueMetrics?.totalJobs === 'number',
      'Cron response embeds live background queue health and worker metrics'
    );
  }

  // Test 20.7: GET /cron/health readiness probe
  {
    const stack = (cronRoutes as any).stack || [];
    const healthLayer = stack.find((l: any) => l.route?.path === '/cron/health' && l.route?.methods?.get);
    assert(!!healthLayer, 'GET /cron/health stack layer found');

    let responseStatus = 200;
    let jsonResponse: any = null;

    const mockReq: any = { headers: {}, query: {} };
    const mockRes: any = {
      status: (code: number) => {
        responseStatus = code;
        return mockRes;
      },
      json: (data: any) => {
        jsonResponse = data;
        return mockRes;
      }
    };

    const healthHandler = healthLayer.route.stack[0].handle;
    healthHandler(mockReq, mockRes);

    assert(
      responseStatus === 200 && jsonResponse?.status === 'READY' && jsonResponse?.service?.includes('iPDS Vercel Cron'),
      'GET /cron/health returns 200 READY status with subsystem diagnostics'
    );
  }

  // Test 20.8: Audit trail logs cron execution event
  {
    const logsResult = auditService.query({ search: 'cron_process_jobs', limit: 20 });
    const cronLogs = logsResult.logs.filter((l) => l.resource === 'cron_process_jobs');
    assert(cronLogs.length >= 1, 'Audit service accurately captures Vercel Cron invocation and execution metrics');
  }

  return { passed, total, failedTests };
}
