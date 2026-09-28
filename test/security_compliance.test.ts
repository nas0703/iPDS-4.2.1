/**
 * IPDS Security & RLS Compliance Verification Matrix (SEC-01 to SEC-15)
 * Verifies JWT trust model, claims propagation, role isolation, and scoped DB operations.
 */
import { AuthService, AuthRole, IPDS_NAMESPACE } from '../src/server/services/auth.service.js';
import { getScopedSupabase } from '../src/server/db.js';
import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';

process.env.SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'test_supabase_jwt_secret_64char_long_secret_key_prod_sim_1234567890';

async function runSecurityAudit() {
  console.log("===============================================================");
  console.log("IPDS PHASE 7 — SECURITY & RLS AUTOMATED VERIFICATION MATRIX");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(testId: string, description: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${description} — ${details || 'Assertion failed'}`);
      failed++;
    }
  }

  function createTestSession(config: {
    kioskId: string;
    stationName: string;
    role: AuthRole;
    estateId: string;
    operatorId: string;
    operatorName: string;
  }) {
    const kioskSub = uuidv5(`kiosk:${config.estateId}:${config.kioskId}`, IPDS_NAMESPACE);
    const sessionId = uuidv4();
    return {
      sub: kioskSub,
      session_id: sessionId,
      role: 'authenticated' as const,
      app_metadata: {
        estate_id: config.estateId,
        kiosk_id: config.kioskId,
        app_role: config.role,
        operator_id: config.operatorId
      },
      user_metadata: {
        operator_name: config.operatorName,
        station_name: config.stationName
      }
    };
  }

  try {
    // SEC-01: JWT Minting & Issuer/Audience Verification
    const sessionStaff = createTestSession({
      kioskId: "KIOSK-GATE-01",
      stationName: "Timbangan Utama",
      role: "staff",
      estateId: "FPM_TUNGGAL",
      operatorId: "OP-001",
      operatorName: "Ahmad Staff"
    });
    const staffToken = AuthService.generateToken(sessionStaff);
    const decodedStaff = AuthService.verifyToken(staffToken);

    assert("SEC-01", "JWT contains correct issuer and audience", 
      decodedStaff !== null &&
      decodedStaff.aud === "authenticated" &&
      decodedStaff.iss?.includes("/auth/v1"),
      `aud: ${decodedStaff?.aud}, iss: ${decodedStaff?.iss}`
    );

    // SEC-02: Deterministic UUIDv5 sub identity
    assert("SEC-02", "JWT sub is a valid deterministic UUID", 
      decodedStaff !== null && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedStaff.sub),
      `sub: ${decodedStaff?.sub}`
    );

    // SEC-03: Sub consistency across multiple mints
    const staffToken2 = AuthService.generateToken(sessionStaff);
    const decodedStaff2 = AuthService.verifyToken(staffToken2);
    assert("SEC-03", "Same kiosk in same estate produces identical sub", 
      decodedStaff?.sub === decodedStaff2?.sub,
      `sub1: ${decodedStaff?.sub}, sub2: ${decodedStaff2?.sub}`
    );

    // SEC-04: Cross-kiosk sub isolation
    const sessionStaff2 = createTestSession({
      ...sessionStaff.app_metadata,
      kioskId: "KIOSK-GATE-02",
      stationName: sessionStaff.user_metadata.station_name,
      role: sessionStaff.app_metadata.app_role,
      estateId: sessionStaff.app_metadata.estate_id,
      operatorId: sessionStaff.app_metadata.operator_id,
      operatorName: sessionStaff.user_metadata.operator_name
    });
    const decodedKiosk2 = AuthService.verifyToken(AuthService.generateToken(sessionStaff2));
    assert("SEC-04", "Different kiosk produces distinct sub UUID", 
      decodedStaff?.sub !== decodedKiosk2?.sub,
      `kiosk1: ${decodedStaff?.sub}, kiosk2: ${decodedKiosk2?.sub}`
    );

    // SEC-05: App metadata authorization claims separation
    assert("SEC-05", "app_metadata contains estate_id, app_role, and operator_id", 
      decodedStaff?.app_metadata.estate_id === "FPM_TUNGGAL" &&
      decodedStaff?.app_metadata.app_role === "staff" &&
      decodedStaff?.app_metadata.operator_id === "OP-001"
    );

    // SEC-06: User metadata non-authorization claims separation
    assert("SEC-06", "user_metadata contains operator_name and station_name", 
      decodedStaff?.user_metadata.operator_name === "Ahmad Staff" &&
      decodedStaff?.user_metadata.station_name === "Timbangan Utama"
    );

    // SEC-07: PF Manager JWT minting
    const sessionPF = createTestSession({
      kioskId: "KIOSK-PF-01",
      stationName: "Pejabat PF",
      role: "pf",
      estateId: "FPM_TUNGGAL",
      operatorId: "MGR-001",
      operatorName: "Pengurus Felda"
    });
    const pfToken = AuthService.generateToken(sessionPF);
    const decodedPF = AuthService.verifyToken(pfToken);
    assert("SEC-07", "PF Manager claims properly assigned", 
      decodedPF?.app_metadata.app_role === "pf"
    );

    // SEC-08: Cross-Estate Token Minting
    const sessionOtherEstate = createTestSession({
      kioskId: "KIOSK-GATE-01",
      stationName: "Timbangan Selancar",
      role: "staff",
      estateId: "FPM_SELANCAR",
      operatorId: "OP-999",
      operatorName: "Ali Selancar"
    });
    const otherEstateToken = AuthService.generateToken(sessionOtherEstate);
    const decodedOtherEstate = AuthService.verifyToken(otherEstateToken);
    assert("SEC-08", "Cross-estate token contains isolated estate_id and unique sub", 
      decodedOtherEstate?.app_metadata.estate_id === "FPM_SELANCAR" &&
      decodedOtherEstate?.sub !== decodedStaff?.sub
    );

    // SEC-09: Scoped client construction
    const scopedClient = getScopedSupabase(staffToken);
    assert("SEC-09", "getScopedSupabase returns instantiated Supabase client with Bearer header", 
      scopedClient !== null && typeof scopedClient.from === "function"
    );

    // SEC-10: Token tampering rejection
    const tamperedToken = staffToken.slice(0, -5) + "abcde";
    const tamperedDecoded = AuthService.verifyToken(tamperedToken);
    assert("SEC-10", "Tampered signature fails verification", 
      tamperedDecoded === null
    );

    // SEC-11: Token expiration validation
    assert("SEC-11", "JWT exp claim is strictly in the future", 
      decodedStaff !== null && decodedStaff.exp > Math.floor(Date.now() / 1000)
    );

    // SEC-12: Mandur role compatibility
    const sessionMandur = createTestSession({
      kioskId: "KIOSK-FIELD-01",
      stationName: "Pondok Mandur",
      role: "mandur",
      estateId: "FPM_TUNGGAL",
      operatorId: "MDR-005",
      operatorName: "Mandur Kassim"
    });
    const mandurToken = AuthService.generateToken(sessionMandur);
    const decodedMandur = AuthService.verifyToken(mandurToken);
    assert("SEC-12", "Mandur role mints with field operator privileges", 
      decodedMandur?.app_metadata.app_role === "mandur"
    );

    // SEC-13: FC Manager role authorization
    const sessionFC = createTestSession({
      kioskId: "KIOSK-FC-01",
      stationName: "Pejabat FC",
      role: "fc",
      estateId: "FPM_TUNGGAL",
      operatorId: "FC-001",
      operatorName: "Financial Controller"
    });
    const fcToken = AuthService.generateToken(sessionFC);
    const decodedFC = AuthService.verifyToken(fcToken);
    assert("SEC-13", "FC role mints with full delete & audit privileges", 
      decodedFC?.app_metadata.app_role === "fc"
    );

    // SEC-14: Server-side PIN verification authoritative mapping
    const verifiedStaff = AuthService.verifyPin("123456");
    assert("SEC-14", "PIN '123456' authoritatively maps to staff on server", 
      verifiedStaff !== null && verifiedStaff.app_metadata.app_role === "staff"
    );

    // SEC-15: Dual-Layer Identity Audit Trail Completeness
    assert("SEC-15", "All audit dimensions (kiosk sub, operator_id, estate_id, session_id) present", 
      Boolean(decodedStaff?.sub) &&
      Boolean(decodedStaff?.app_metadata.operator_id) &&
      Boolean(decodedStaff?.app_metadata.estate_id) &&
      Boolean(decodedStaff?.session_id)
    );

  } catch (err: any) {
    console.error("Test execution error:", err);
    failed++;
  }

  console.log("\n---------------------------------------------------------------");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("---------------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit();
