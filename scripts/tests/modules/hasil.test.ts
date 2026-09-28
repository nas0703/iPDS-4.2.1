import hasilRoutes from '../../../src/server/routes/hasil.routes.js';

export async function runHasilTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 3: HASIL (HARVESTING & ABW RECORDS) REGRESSION TESTS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 3.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 3.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Router definition check
  assert(typeof hasilRoutes === 'function', 'Hasil router exports an Express router function');

  const stack = (hasilRoutes as any).stack || [];
  const registeredPaths = stack.map((layer: any) => ({
    path: layer.route?.path,
    methods: Object.keys(layer.route?.methods || {})
  })).filter((r: any) => r.path);

  // 2. Verify registered routes
  const getAbwRoute = registeredPaths.find((r: any) => r.path === '/hasil/abw' && r.methods.includes('get'));
  assert(!!getAbwRoute, 'GET /hasil/abw route is registered');

  const postAbwRoute = registeredPaths.find((r: any) => r.path === '/hasil/abw' && r.methods.includes('post'));
  assert(!!postAbwRoute, 'POST /hasil/abw route is registered');

  // 3. GET /hasil/abw execution handler test
  const getAbwLayer = stack.find((l: any) => l.route?.path === '/hasil/abw' && l.route?.methods?.get);
  assert(!!getAbwLayer, 'GET /hasil/abw handler stack layer exists');

  let responseCode = 200;
  let jsonOutput: any = null;

  const mockReq: any = { headers: {}, cookies: {} };
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

  const handlers = getAbwLayer.route.stack.map((s: any) => s.handle);
  let idx = 0;
  const runNext = () => {
    if (idx < handlers.length) {
      const handler = handlers[idx++];
      handler(mockReq, mockRes, runNext);
    }
  };
  runNext();

  assert(responseCode === 401, 'GET /hasil/abw rejects unauthenticated requests with 401');

  // 4. Role check on POST /hasil/abw
  const postAbwLayer = stack.find((l: any) => l.route?.path === '/hasil/abw' && l.route?.methods?.post);
  assert(!!postAbwLayer, 'POST /hasil/abw handler stack layer exists');

  let postResponseCode = 200;
  let postJsonOutput: any = null;

  const mockPostReq: any = { headers: {}, cookies: {}, body: { abwHistory: { "1": 18.5 } } };
  const mockPostRes: any = {
    status(code: number) {
      postResponseCode = code;
      return this;
    },
    json(data: any) {
      postJsonOutput = data;
      return this;
    }
  };

  const postHandlers = postAbwLayer.route.stack.map((s: any) => s.handle);
  postHandlers[0](mockPostReq, mockPostRes, () => {}); // requireRole middleware
  assert(postResponseCode === 401 && postJsonOutput?.code === 'UNAUTHORIZED', 'POST /hasil/abw enforces role permissions check');

  return { passed, total };
}
