import merumputRoutes from '../../../src/server/routes/merumput.routes.js';

export async function runMerumputTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 6: MERUMPUT (WEED CONTROL & INVENTORY) REGRESSION TESTS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 6.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 6.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Router definition check
  assert(typeof merumputRoutes === 'function', 'Merumput router exports an Express router function');

  const stack = (merumputRoutes as any).stack || [];
  const registeredPaths = stack.map((layer: any) => ({
    path: layer.route?.path,
    methods: Object.keys(layer.route?.methods || {})
  })).filter((r: any) => r.path);

  // 2. Verify registered routes
  const getProgressRoute = registeredPaths.find((r: any) => r.path === '/merumput/progress' && r.methods.includes('get'));
  assert(!!getProgressRoute, 'GET /merumput/progress route is registered');

  const postBatchProgressRoute = registeredPaths.find((r: any) => r.path === '/merumput/progress/batch' && r.methods.includes('post'));
  assert(!!postBatchProgressRoute, 'POST /merumput/progress/batch route is registered');

  const getInventoryRoute = registeredPaths.find((r: any) => r.path === '/merumput/inventory' && r.methods.includes('get'));
  assert(!!getInventoryRoute, 'GET /merumput/inventory route is registered');

  const postInventoryRoute = registeredPaths.find((r: any) => r.path === '/merumput/inventory' && r.methods.includes('post'));
  assert(!!postInventoryRoute, 'POST /merumput/inventory route is registered');

  // 3. Role enforcement on POST /merumput/progress/batch
  const batchLayer = stack.find((l: any) => l.route?.path === '/merumput/progress/batch' && l.route?.methods?.post);
  assert(!!batchLayer, 'POST /merumput/progress/batch handler stack layer exists');

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

  const handlers = batchLayer.route.stack.map((s: any) => s.handle);
  handlers[0](mockReq, mockRes, () => {}); // requireRole middleware
  assert(responseCode === 401 && jsonOutput?.code === 'UNAUTHORIZED', 'POST /merumput/progress/batch rejects unauthenticated requests with 401 UNAUTHORIZED');

  return { passed, total };
}
