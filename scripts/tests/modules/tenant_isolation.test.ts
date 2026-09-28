import { AuthService } from '../../../src/server/services/auth.service.js';
import { authenticate, requireAuth, requireRole, requireEstateAccess, validateTenantAccess, isFCTunggalSuperAdmin } from '../../../src/server/middleware/auth.js';
import { auditService } from '../../../src/server/services/audit.service.js';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      res.body = payload;
      return res;
    }
  };
  return res;
}

export async function runTenantIsolationTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 17: P0-3 TENANT ISOLATION HARDENING & ADVERSARIAL CROSS-ESTATE TESTS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test 17.${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test 17.${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Generate active session tokens for test identities
  // Single-estate staff (FPM_TUNGGAL)
  const tunggalStaffSession = AuthService.verifyPin('123456'); // Default staff for FPM_TUNGGAL
  const tunggalStaffToken = tunggalStaffSession ? AuthService.generateToken(tunggalStaffSession) : '';

  // Multi-estate Pengurus Felda (PF for Zon Adela)
  const pfSession = AuthService.verifyPin('888888'); // Default PF
  const pfToken = pfSession ? AuthService.generateToken(pfSession) : '';

  // Regional Controller (RC - Wilayah Super Admin / HQ)
  const rcSession = AuthService.verifyPin('111111'); // Default RC / Super Admin
  const rcToken = rcSession ? AuthService.generateToken(rcSession) : '';

  // Designated Super Admin: Field Controller of FPM Tunggal
  const fcTunggalSession = AuthService.verifyPin('2401199');
  const fcTunggalToken = fcTunggalSession ? AuthService.generateToken(fcTunggalSession) : '';

  const fcTunggalAltSession = AuthService.verifyPin('654321');
  const fcTunggalAltToken = fcTunggalAltSession ? AuthService.generateToken(fcTunggalAltSession) : '';

  // Regular branch Field Controller locked to FPM_ADELA
  const fcBranchSession = AuthService.verifyPin('600300');
  const fcBranchToken = fcBranchSession ? AuthService.generateToken(fcBranchSession) : '';

  // Test 17.1: Single-estate staff (Tunggal) attempting cross-estate query (?estate_id=FPM_ADELA) is rejected with 403 FORBIDDEN_ESTATE
  {
    const req: any = {
      headers: { authorization: `Bearer ${tunggalStaffToken}` },
      query: { estate_id: 'FPM_ADELA' },
      body: {},
      ip: '127.0.0.1',
      url: '/api/hasil/abw?estate_id=FPM_ADELA'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      !nextCalled && res.statusCode === 403 && res.body?.code === 'FORBIDDEN_ESTATE',
      'Single-estate staff attempting query string estate manipulation (?estate_id=FPM_ADELA) is strictly blocked with 403 FORBIDDEN_ESTATE',
      `Status: ${res.statusCode}, Code: ${res.body?.code}`
    );
  }

  // Test 17.2: Single-estate staff (Tunggal) sending forged x-estate-id header (x-estate-id: FPM_ADELA) is rejected with 403
  {
    const req: any = {
      headers: {
        authorization: `Bearer ${tunggalStaffToken}`,
        'x-estate-id': 'FPM_ADELA'
      },
      query: {},
      body: {},
      ip: '127.0.0.1',
      url: '/api/hantaran'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      !nextCalled && res.statusCode === 403 && res.body?.code === 'FORBIDDEN_ESTATE',
      'Forged x-estate-id header (FPM_ADELA) by single-estate staff is strictly rejected with 403 FORBIDDEN_ESTATE'
    );
  }

  // Test 17.3: Single-estate staff sending forged JSON body (estate_id: "FPM_ADELA") to POST endpoint is rejected
  {
    const req: any = {
      headers: { authorization: `Bearer ${tunggalStaffToken}` },
      query: {},
      body: { estate_id: 'FPM_ADELA', bts_weight: 1200 },
      ip: '127.0.0.1',
      url: '/api/hantaran'
    };
    const res = createMockRes();
    let nextCalled = false;

    requireRole(['staff', 'mandur'])(req, res, () => { nextCalled = true; });

    assert(
      !nextCalled && res.statusCode === 403 && res.body?.code === 'FORBIDDEN_ESTATE',
      'Forged JSON body estate_id ("FPM_ADELA") on POST route is strictly rejected prior to route logic execution'
    );
  }

  // Test 17.4: Single-estate staff sending batch JSON array with target estate_id in items is rejected
  {
    const req: any = {
      headers: { authorization: `Bearer ${tunggalStaffToken}` },
      query: {},
      body: { data: [{ estate_id: 'FPM_ADELA', blok: 'A1' }] },
      ip: '127.0.0.1',
      url: '/api/pruning/batch'
    };
    const res = createMockRes();
    let nextCalled = false;

    requireRole(['staff'])(req, res, () => { nextCalled = true; });

    assert(
      !nextCalled && res.statusCode === 403 && res.body?.code === 'FORBIDDEN_ESTATE',
      'Forged nested array item estate_id ("FPM_ADELA") on batch POST route is strictly rejected'
    );
  }

  // Test 17.5: Single-estate staff sending cross-estate AI chatbot request (/api/ai/estate-chat) is rejected
  {
    const req: any = {
      headers: { authorization: `Bearer ${tunggalStaffToken}` },
      query: {},
      body: { estate_id: 'FPM_ADELA', message: 'Show me all yield metrics for Adela' },
      ip: '127.0.0.1',
      url: '/api/ai/estate-chat'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      !nextCalled && res.statusCode === 403 && res.body?.code === 'FORBIDDEN_ESTATE',
      'Cross-estate AI Chatbot query (estate_id="FPM_ADELA") by single-estate user is strictly rejected'
    );
  }

  // Test 17.6: Single-estate staff querying estate_id=ALL is strictly rejected
  {
    const req: any = {
      headers: { authorization: `Bearer ${tunggalStaffToken}` },
      query: { estate_id: 'ALL' },
      body: {},
      ip: '127.0.0.1',
      url: '/api/hantaran?estate_id=ALL'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      !nextCalled && res.statusCode === 403 && res.body?.code === 'FORBIDDEN_ESTATE',
      'Single-estate staff attempting wildcard query (estate_id=ALL) is strictly rejected with 403 FORBIDDEN_ESTATE'
    );
  }

  // Test 17.7: Legitimate single-estate request with estate_id=FPM_TUNGGAL succeeds and populates req.estateId
  {
    const req: any = {
      headers: { authorization: `Bearer ${tunggalStaffToken}` },
      query: { estate_id: 'FPM_TUNGGAL' },
      body: {},
      ip: '127.0.0.1',
      url: '/api/hasil/abw?estate_id=FPM_TUNGGAL'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      nextCalled && req.estateId === 'FPM_TUNGGAL',
      'Legitimate single-estate request (FPM_TUNGGAL) passes validation and populates req.estateId=FPM_TUNGGAL'
    );
  }

  // Test 17.8: Legitimate single-estate request with omitted estate_id defaults to user assigned estate (FPM_TUNGGAL)
  {
    const req: any = {
      headers: { authorization: `Bearer ${tunggalStaffToken}` },
      query: {},
      body: {},
      ip: '127.0.0.1',
      url: '/api/hasil/abw'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      nextCalled && req.estateId === 'FPM_TUNGGAL',
      'Omitted estate_id in request defaults automatically to user assigned SSOT estate (FPM_TUNGGAL)'
    );
  }

  // Test 17.9: Multi-estate manager (PF) querying an authorized estate in Zon Adela (FPM_ADELA) is permitted
  {
    const req: any = {
      headers: { authorization: `Bearer ${pfToken}` },
      query: { estate_id: 'FPM_ADELA' },
      body: {},
      ip: '127.0.0.1',
      url: '/api/hantaran?estate_id=FPM_ADELA'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      nextCalled && req.estateId === 'FPM_ADELA',
      'Multi-estate manager (PF) accessing authorized estate in Zon Adela (FPM_ADELA) is permitted'
    );
  }

  // Test 17.10: Multi-estate manager (PF) querying wildcard ALL in Zon Adela is permitted
  {
    const req: any = {
      headers: { authorization: `Bearer ${pfToken}` },
      query: { estate_id: 'ALL' },
      body: {},
      ip: '127.0.0.1',
      url: '/api/hantaran?estate_id=ALL'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      nextCalled && req.estateId === 'ALL',
      'Multi-estate manager (PF) querying wildcard estate_id=ALL is permitted'
    );
  }

  // Test 17.11: Multi-estate manager (PF) querying unauthorized estate outside Zon Adela is rejected with 403 FORBIDDEN_ZONE
  {
    const req: any = {
      headers: { authorization: `Bearer ${pfToken}` },
      query: { estate_id: 'FPM_SABAH_OUTSIDE' },
      body: {},
      ip: '127.0.0.1',
      url: '/api/hantaran?estate_id=FPM_SABAH_OUTSIDE'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      !nextCalled && res.statusCode === 403 && res.body?.code === 'FORBIDDEN_ZONE',
      'Multi-estate manager attempting access to estate outside Zone (FPM_SABAH_OUTSIDE) is strictly blocked with 403 FORBIDDEN_ZONE'
    );
  }

  // Test 17.12: Regional Controller / Superadmin (RC) querying any valid estate is permitted
  {
    const req: any = {
      headers: { authorization: `Bearer ${rcToken}` },
      query: { estate_id: 'FPM_SENING' },
      body: {},
      ip: '127.0.0.1',
      url: '/api/hasil/abw?estate_id=FPM_SENING'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      nextCalled && req.estateId === 'FPM_SENING',
      'Regional Controller / Enterprise Admin (RC) querying any estate (FPM_SENING) is permitted'
    );
  }

  // Test 17.13: Designated Super Admin (FC Tunggal) cross-estate request to FPM_ADELA is permitted
  {
    const req: any = {
      headers: {
        authorization: `Bearer ${fcTunggalToken}`,
        'x-estate-id': 'FPM_ADELA'
      },
      query: {},
      body: {},
      ip: '127.0.0.1',
      url: '/api/hasil/abw'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      nextCalled && res.statusCode === 200 && req.estateId === 'FPM_ADELA',
      'Designated Super Admin (FC Tunggal) is permitted cross-estate access to FPM_ADELA and req.estateId=FPM_ADELA'
    );
  }

  // Test 17.14: FC Tunggal UI estate switch to FPM_KLEDANG (x-estate-id) still passes (authority is role-based, not UI-estate-based)
  {
    const req: any = {
      headers: {
        authorization: `Bearer ${fcTunggalAltToken}`,
        'x-estate-id': 'FPM_KLEDANG'
      },
      query: {},
      body: {},
      ip: '127.0.0.1',
      url: '/api/hantaran'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      nextCalled && req.estateId === 'FPM_KLEDANG',
      'FC Tunggal switching UI estate to FPM_KLEDANG retains Super Admin authority (no 403)'
    );
  }

  // Test 17.15: FC Tunggal wildcard estate_id=ALL is permitted
  {
    const req: any = {
      headers: { authorization: `Bearer ${fcTunggalToken}` },
      query: { estate_id: 'ALL' },
      body: {},
      ip: '127.0.0.1',
      url: '/api/hantaran?estate_id=ALL'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      nextCalled && req.estateId === 'ALL',
      'FC Tunggal querying wildcard estate_id=ALL is permitted'
    );
  }

  // Test 17.16: Regular branch FC (FPM_ADELA) remains strictly isolated and cannot access FPM_TUNGGAL
  {
    const req: any = {
      headers: {
        authorization: `Bearer ${fcBranchToken}`,
        'x-estate-id': 'FPM_TUNGGAL'
      },
      query: {},
      body: {},
      ip: '127.0.0.1',
      url: '/api/hasil/abw'
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticate(req, res, () => { nextCalled = true; });

    assert(
      !nextCalled && res.statusCode === 403 && res.body?.code === 'FORBIDDEN_ESTATE',
      'Regular branch FC (FPM_ADELA) attempting cross-estate access to FPM_TUNGGAL is still blocked with 403 FORBIDDEN_ESTATE'
    );
  }

  // Test 17.17: isFCTunggalSuperAdmin recognizes only the designated FC Tunggal identities
  {
    const fcTunggalPayload = fcTunggalToken ? AuthService.verifyToken(fcTunggalToken) : null;
    const fcBranchPayload = fcBranchToken ? AuthService.verifyToken(fcBranchToken) : null;

    assert(
      isFCTunggalSuperAdmin(fcTunggalPayload) === true &&
        isFCTunggalSuperAdmin(fcBranchPayload) === false &&
        isFCTunggalSuperAdmin(null) === false,
      'isFCTunggalSuperAdmin identifies FC Tunggal (true) and rejects branch FC / null (false)'
    );
  }

  // Test 17.18: FC Tunggal (canonical Super Admin) RETAINS cross-estate access to a named estate
  {
    const req: any = {
      user: { app_metadata: { app_role: 'fc', estate_id: 'FPM_TUNGGAL' } },
      headers: { 'x-estate-id': 'FPM_ADELA' },
      query: {},
      body: {},
      ip: '127.0.0.1',
      url: '/api/hasil/abw'
    };
    const res = createMockRes();
    const allowed = validateTenantAccess(req, res) === true && req.estateId === 'FPM_ADELA';
    assert(allowed, 'FC Tunggal retains cross-estate access to FPM_ADELA', `status=${res.statusCode}`);
  }

  // Test 17.19: canonical Super Admin aliases (+ RC/HQ) are cross-estate at the app layer
  {
    const roles = ['superadmin', 'super_admin', 'admin', 'rc', 'executive_hq'];
    const results = roles.map((role) => {
      const req: any = {
        user: { app_metadata: { app_role: role, estate_id: 'FPM_TUNGGAL' } },
        headers: { 'x-estate-id': 'FPM_ADELA' },
        query: {},
        body: {},
        ip: '127.0.0.1',
        url: '/api/hasil/abw'
      };
      const res = createMockRes();
      return { role, allowed: validateTenantAccess(req, res) === true && req.estateId === 'FPM_ADELA' };
    });
    assert(
      results.every((r) => r.allowed),
      'Super Admin aliases + RC/HQ are cross-estate at the app layer',
      results.filter((r) => !r.allowed).map((r) => r.role).join(', ')
    );
  }

  // Test 17.20: normal estate users remain strictly estate-scoped (403 FORBIDDEN_ESTATE)
  {
    const branchReq: any = {
      user: { app_metadata: { app_role: 'fc', estate_id: 'FPM_ADELA' } },
      headers: { 'x-estate-id': 'FPM_TUNGGAL' },
      query: {},
      body: {},
      ip: '127.0.0.1',
      url: '/api/hasil/abw'
    };
    const branchRes = createMockRes();
    const branchBlocked = validateTenantAccess(branchReq, branchRes) === false && branchRes.statusCode === 403 && branchRes.body?.code === 'FORBIDDEN_ESTATE';

    const staffReq: any = {
      user: { app_metadata: { app_role: 'staff', estate_id: 'FPM_TUNGGAL' } },
      headers: { 'x-estate-id': 'FPM_ADELA' },
      query: {},
      body: {},
      ip: '127.0.0.1',
      url: '/api/hasil/abw'
    };
    const staffRes = createMockRes();
    const staffBlocked = validateTenantAccess(staffReq, staffRes) === false && staffRes.statusCode === 403 && staffRes.body?.code === 'FORBIDDEN_ESTATE';

    assert(
      branchBlocked && staffBlocked,
      'Branch FC and estate staff remain strictly estate-scoped (403 FORBIDDEN_ESTATE)'
    );
  }

  return { passed, total };
}
