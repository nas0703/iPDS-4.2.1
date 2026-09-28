import hantaranRoutes from '../../../src/server/routes/hantaran.routes.js';

export async function runHantaranTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 4: HANTARAN (WEIGHBRIDGE & DISPATCH LOGISTICS) REGRESSION TESTS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 4.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 4.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Router definition check
  assert(typeof hantaranRoutes === 'function', 'Hantaran router exports an Express router function');

  const stack = (hantaranRoutes as any).stack || [];
  const registeredPaths = stack.map((layer: any) => ({
    path: layer.route?.path,
    methods: Object.keys(layer.route?.methods || {})
  })).filter((r: any) => r.path);

  // 2. Verify registered routes
  const postHantaranRoute = registeredPaths.find((r: any) => r.path === '/hantaran' && r.methods.includes('post'));
  assert(!!postHantaranRoute, 'POST /hantaran route is registered');

  const getHantaranRoute = registeredPaths.find((r: any) => r.path === '/hantaran' && r.methods.includes('get'));
  assert(!!getHantaranRoute, 'GET /hantaran route is registered');

  const deleteResitRoute = registeredPaths.find((r: any) => r.path === '/hantaran/:no_resit' && r.methods.includes('delete'));
  assert(!!deleteResitRoute, 'DELETE /hantaran/:no_resit route is registered');

  const configCheckRoute = registeredPaths.find((r: any) => r.path === '/config-check' && r.methods.includes('get'));
  assert(!!configCheckRoute, 'GET /config-check route is registered');

  // 3. Validation test: Missing receipt or lori number on POST /hantaran
  const postHantaranLayer = stack.find((l: any) => l.route?.path === '/hantaran' && l.route?.methods?.post);
  assert(!!postHantaranLayer, 'POST /hantaran handler stack layer exists');

  let responseCode = 200;
  let jsonOutput: any = null;

  const mockReq: any = {
    headers: {},
    cookies: {},
    body: { no_resit: '', no_lori: 'JXX1234', blok: '1' },
    user: { sub: 'test_user', app_metadata: { app_role: 'staff' } }
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

  const handlers = postHantaranLayer.route.stack.map((s: any) => s.handle);
  const finalHandler = handlers[handlers.length - 1];
  await finalHandler(mockReq, mockRes, () => {});

  assert(responseCode === 400 && jsonOutput?.success === false, 'POST /hantaran rejects incomplete payloads (missing receipt number)');

  return { passed, total };
}
