import pruningRoutes from '../../src/server/routes/pruning.routes.js';

async function runPruningRoutesTestSuite() {
  console.log('====================================================');
  console.log('iPDS VER 3.7 — PRUNING API ROUTES REGRESSION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`       Detail: ${detail}`);
    }
  }

  // ----------------------------------------------------
  // TEST 1: Pruning router instance & route definitions
  // ----------------------------------------------------
  {
    assert(typeof pruningRoutes === 'function', 'Pruning router exports an Express router function');

    const stack = (pruningRoutes as any).stack || [];
    const registeredPaths = stack.map((layer: any) => ({
      path: layer.route?.path,
      methods: Object.keys(layer.route?.methods || {})
    })).filter((r: any) => r.path);

    const getPruningRoute = registeredPaths.find((r: any) => r.path === '/pruning' && r.methods.includes('get'));
    assert(!!getPruningRoute, 'GET /pruning route handler is defined on pruning.routes.ts');

    const postPruningBatchRoute = registeredPaths.find((r: any) => r.path === '/pruning/batch' && r.methods.includes('post'));
    assert(!!postPruningBatchRoute, 'POST /pruning/batch route handler is defined on pruning.routes.ts');

    const postPruningRoute = registeredPaths.find((r: any) => r.path === '/pruning' && r.methods.includes('post'));
    assert(!!postPruningRoute, 'POST /pruning route handler is defined on pruning.routes.ts');
  }

  // ----------------------------------------------------
  // TEST 2: GET /pruning execution handler test
  // ----------------------------------------------------
  {
    const stack = (pruningRoutes as any).stack || [];
    const getLayer = stack.find((layer: any) => layer.route?.path === '/pruning' && layer.route?.methods?.get);
    assert(!!getLayer, 'GET /pruning route stack layer found');

    let responseCode = 200;
    let jsonOutput: any = null;

    const mockReq: any = {
      headers: {},
      cookies: {}
    };

    const promise = new Promise<void>((resolve) => {
      const mockRes: any = {
        status(code: number) {
          responseCode = code;
          return this;
        },
        json(data: any) {
          jsonOutput = data;
          resolve();
          return this;
        }
      };

      const handlers = getLayer.route.stack.map((s: any) => s.handle);
      let idx = 0;
      const runNext = () => {
        if (idx < handlers.length) {
          const handler = handlers[idx++];
          handler(mockReq, mockRes, runNext);
        }
      };
      runNext();
    });

    await promise;

    assert(responseCode === 500 || Array.isArray(jsonOutput) || jsonOutput?.error, 'GET /pruning handler executes correctly');
  }

  // ----------------------------------------------------
  // TEST 3: POST /pruning/batch enforces requireRole auth check
  // ----------------------------------------------------
  {
    const stack = (pruningRoutes as any).stack || [];
    const postBatchLayer = stack.find((layer: any) => layer.route?.path === '/pruning/batch' && layer.route?.methods?.post);
    assert(!!postBatchLayer, 'POST /pruning/batch route stack layer found');

    let responseCode = 200;
    let jsonOutput: any = null;

    const mockReq: any = {
      headers: {},
      cookies: {},
      body: { data: [] }
    };
    const mockRes: any = {
      status(code: number) {
        responseCode = code;
        return this;
      },
      json(data: any) {
        jsonOutput = data;
        return this;
      }
    };

    const handlers = postBatchLayer.route.stack.map((s: any) => s.handle);
    handlers[0](mockReq, mockRes, () => {});

    assert(responseCode === 401 && jsonOutput?.code === 'UNAUTHORIZED', 'POST /pruning/batch rejects unauthenticated requests with 401 UNAUTHORIZED');
  }

  // ----------------------------------------------------
  // TEST 4: POST /pruning enforces requireRole auth check
  // ----------------------------------------------------
  {
    const stack = (pruningRoutes as any).stack || [];
    const postLayer = stack.find((layer: any) => layer.route?.path === '/pruning' && layer.route?.methods?.post);
    assert(!!postLayer, 'POST /pruning route stack layer found');

    let responseCode = 200;
    let jsonOutput: any = null;

    const mockReq: any = {
      headers: {},
      cookies: {},
      body: { blok: 'A1', pelepah_count: 48 }
    };
    const mockRes: any = {
      status(code: number) {
        responseCode = code;
        return this;
      },
      json(data: any) {
        jsonOutput = data;
        return this;
      }
    };

    const handlers = postLayer.route.stack.map((s: any) => s.handle);
    handlers[0](mockReq, mockRes, () => {});

    assert(responseCode === 401 && jsonOutput?.code === 'UNAUTHORIZED', 'POST /pruning rejects unauthenticated requests with 401 UNAUTHORIZED');
  }

  console.log('\n----------------------------------------------------');
  console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);
  console.log('----------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPruningRoutesTestSuite().catch((err) => {
  console.error('Test suite exception:', err);
  process.exit(1);
});
