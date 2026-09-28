import pruningRoutes from '../../../src/server/routes/pruning.routes.js';

export async function runPruningTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 5: PRUNING (PENYELENGGARAAN PELEPAH) REGRESSION TESTS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 5.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 5.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Router definition check
  assert(typeof pruningRoutes === 'function', 'Pruning router exports an Express router function');

  const stack = (pruningRoutes as any).stack || [];
  const registeredPaths = stack.map((layer: any) => ({
    path: layer.route?.path,
    methods: Object.keys(layer.route?.methods || {})
  })).filter((r: any) => r.path);

  // 2. Verify registered routes
  const getPruningRoute = registeredPaths.find((r: any) => r.path === '/pruning' && r.methods.includes('get'));
  assert(!!getPruningRoute, 'GET /pruning route handler is defined');

  const postPruningBatchRoute = registeredPaths.find((r: any) => r.path === '/pruning/batch' && r.methods.includes('post'));
  assert(!!postPruningBatchRoute, 'POST /pruning/batch route handler is defined');

  const postPruningRoute = registeredPaths.find((r: any) => r.path === '/pruning' && r.methods.includes('post'));
  assert(!!postPruningRoute, 'POST /pruning route handler is defined');

  // 3. Unauthenticated batch submission check
  const postBatchLayer = stack.find((l: any) => l.route?.path === '/pruning/batch' && l.route?.methods?.post);
  assert(!!postBatchLayer, 'POST /pruning/batch handler stack layer exists');

  let responseCode = 200;
  let jsonOutput: any = null;

  const mockReq: any = { headers: {}, cookies: {}, body: { data: [] } };
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
  handlers[0](mockReq, mockRes, () => {}); // requireRole middleware
  assert(responseCode === 401 && jsonOutput?.code === 'UNAUTHORIZED', 'POST /pruning/batch rejects unauthenticated requests with 401 UNAUTHORIZED');

  return { passed, total };
}
