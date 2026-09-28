/**
 * iPDS v4.1.0 — Test Module 42: P0-16 Stale Device Approval Read-Path Fix
 *
 * Proves getDeviceStatus() no longer lets a stale in-memory PENDING mask a
 * persisted registered_devices APPROVED record:
 *   1. cached PENDING + persisted APPROVED  -> APPROVED
 *   2. cached APPROVED                      -> remains APPROVED
 *   3. cached PENDING + persisted PENDING   -> remains PENDING
 *   4. persisted APPROVED refreshes the cache
 *   5. existing P0-16A/P0-16B capability & approval behaviour unchanged
 */

import fs from 'fs';
import path from 'path';
import {
  deviceSecurityService,
  resolveDeviceStatusRecord
} from '../../../src/server/services/deviceSecurity.service.js';
import type { RegisteredDeviceRecord } from '../../../src/server/services/deviceSecurity.service.js';

const SERVICE_SRC = 'src/server/services/deviceSecurity.service.ts';
const DEVICES_SRC = 'src/server/routes/devices.routes.ts';
const AUTH_SRC = 'src/server/routes/auth.routes.ts';

function read(rel: string): string { return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8'); }

function rec(deviceId: string, status: RegisteredDeviceRecord['status'], extra: Partial<RegisteredDeviceRecord> = {}): RegisteredDeviceRecord {
  return {
    device_id: deviceId,
    device_name: `Peranti ${deviceId}`,
    estate_id: 'FPM_TUNGGAL',
    status,
    ...extra
  };
}

export async function runStaleDeviceApprovalReadPathTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 42: P0-16 STALE DEVICE APPROVAL READ-PATH FIX');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 42.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 42.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 42.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  // 1. Precedence rules (pure resolver — the exact rules getDeviceStatus uses)
  {
    const pending = rec('DEV-42-A', 'PENDING');
    const approved = rec('DEV-42-A', 'APPROVED', { approved_by: 'WhatsApp Link', approved_at: new Date().toISOString() });

    const r1 = resolveDeviceStatusRecord(pending, approved);
    assert(r1?.status === 'APPROVED' && r1 === approved, 'cached PENDING + persisted APPROVED -> APPROVED');

    const r2 = resolveDeviceStatusRecord(approved, pending);
    assert(r2?.status === 'APPROVED' && r2 === approved, 'cached APPROVED remains APPROVED even if persistence is stale PENDING');

    const r3 = resolveDeviceStatusRecord(pending, rec('DEV-42-A', 'PENDING'));
    assert(r3?.status === 'PENDING', 'cached PENDING + persisted PENDING -> remains PENDING');

    const r4 = resolveDeviceStatusRecord(pending, null);
    assert(r4?.status === 'PENDING' && r4 === pending, 'cached PENDING + no persisted row -> remains PENDING');

    const r5 = resolveDeviceStatusRecord(undefined, approved);
    assert(r5?.status === 'APPROVED' && r5 === approved, 'no cache + persisted APPROVED -> APPROVED');

    const r6 = resolveDeviceStatusRecord(undefined, undefined);
    assert(r6 === null, 'no cache + no persisted row -> null');

    const r7 = resolveDeviceStatusRecord(rec('DEV-42-A', 'BLOCKED'), rec('DEV-42-A', 'PENDING'));
    assert(r7?.status === 'BLOCKED', 'more restrictive cached BLOCKED is preserved over persisted PENDING');

    const r8 = resolveDeviceStatusRecord(rec('DEV-42-A', 'REVOKED'), rec('DEV-42-A', 'PENDING'));
    assert(r8?.status === 'REVOKED', 'more restrictive cached REVOKED is preserved over persisted PENDING');

    const r9 = resolveDeviceStatusRecord(rec('DEV-42-A', 'BLOCKED'), approved);
    assert(r9?.status === 'APPROVED' && r9 === approved, 'persisted APPROVED still takes precedence over cached BLOCKED');
  }

  // 2. Real getDeviceStatus() cache behaviour (no DB creds => memory only)
  {
    const envKeys = ['NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
    const saved: Record<string, string | undefined> = {};
    for (const k of envKeys) saved[k] = process.env[k];

    try {
      process.env.NODE_ENV = 'production';
      for (const k of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k];

      await deviceSecurityService.registerDevice({ deviceId: 'DEV-42-PENDING', deviceName: 'P42 Pending', estateId: 'FPM_TUNGGAL', role: 'staff' });
      const pendingStatus = await deviceSecurityService.getDeviceStatus('DEV-42-PENDING');
      assert(pendingStatus?.status === 'PENDING', 'unapproved device stays PENDING (no persisted APPROVED)', `got ${pendingStatus?.status}`);

      const approved = await deviceSecurityService.approveDevice('DEV-42-APPROVED', 'Admin', 'fc');
      assert(approved?.status === 'APPROVED', 'approveDevice returns APPROVED');
      const cachedApproved = await deviceSecurityService.getDeviceStatus('DEV-42-APPROVED');
      assert(cachedApproved?.status === 'APPROVED', 'cached APPROVED remains APPROVED');

      const master = await deviceSecurityService.getDeviceStatus('DEV-MASTER-NAS-FC');
      assert(master?.status === 'APPROVED', 'seeded master device remains APPROVED');

      const empty = await deviceSecurityService.getDeviceStatus('');
      assert(empty === null, 'empty deviceId returns null');
    } finally {
      for (const k of envKeys) {
        if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
      }
    }
  }

  // 3. Source guards: smallest safe read-path change
  {
    const src = read(SERVICE_SRC);
    assert(/export function resolveDeviceStatusRecord\(/.test(src), 'pure precedence resolver is exported');
    assert(/resolveDeviceStatusRecord\(cached,\s*persisted\)/.test(src), 'getDeviceStatus uses the precedence resolver');
    assert(/if \(cached && cached\.status === 'APPROVED'\)\s*\{\s*return cached;/.test(src), 'APPROVED fast path returns cached APPROVED');
    assert(/deviceMemoryCache\.set\(deviceId,\s*resolved\)/.test(src), 'persisted record refreshes the in-memory cache');
    assert(!/\/\/ Check memory cache first[\s\S]{0,80}if \(cached\) \{\s*return cached;/.test(src), 'unconditional cache-first return removed');
    assert(/\.from\('registered_devices'\)[\s\S]*?\.eq\('device_id',\s*deviceId\)/.test(src), 'still reads the authoritative registered_devices row');
  }

  // 4. No secret/PII logging in the read path
  {
    const src = read(SERVICE_SRC);
    const fnStart = src.indexOf('async getDeviceStatus(');
    const fnEnd = src.indexOf('async registerDevice(', fnStart);
    const fn = fnStart >= 0 && fnEnd > fnStart ? src.slice(fnStart, fnEnd) : src;
    assert(!/console\.[a-z]+\([^)]*(token|pin|capability|operator|requester)/i.test(fn), 'getDeviceStatus logs no secrets/PII');
    assert(/Supabase lookup error/.test(fn), 'read-path errors are logged safely (no device payload)');
  }

  // 5. Existing P0-16A/P0-16B security & approval behaviour unchanged
  {
    const src = read(SERVICE_SRC);
    assert(/export function verifyBootstrapToken/.test(src), 'bootstrap token verification unchanged');
    assert(/createApprovalCapability/.test(src) && /consumeApprovalCapability/.test(src) && /peekApprovalCapability/.test(src), 'capability create/consume/peek unchanged');
    assert(/randomBytes\(32\)/.test(src) && /createHash\('sha256'\)/.test(src) && /timingSafeEqual/.test(src), 'capability security (256-bit, SHA-256, constant-time) unchanged');
    assert(/APPROVAL_CAPABILITY_TTL_MS = 12 \* 60 \* 1000/.test(src), 'capability TTL unchanged (12 min)');
    assert(/requester_name:\s*params\.requesterName/.test(src), 'P0-16B requester metadata unchanged');

    const devices = read(DEVICES_SRC);
    assert(/router\.get\('\/enrollment-status',\s*authRateLimiter/.test(devices), 'enrollment-status remains pre-auth + status-only');
    assert(/router\.get\('\/quick-approve',\s*requireAuth,\s*requireDeviceAdmin/.test(devices) && /router\.post\('\/approve-direct',\s*requireAuth,\s*requireDeviceAdmin/.test(devices),
      'quick-approve/approve-direct auth requirements unchanged');
    assert(/peekApprovalCapability/.test(devices) && /consumeApprovalCapability/.test(devices), 'approve-link capability flow unchanged');
    assert(!/\b(2401199|888888|654321)\b/.test(devices), 'no master PIN auto-approval restored');

    const auth = read(AUTH_SRC);
    assert(/createApprovalCapability\(\{[\s\S]*?requesterName:/.test(auth), 'DEVICE_NOT_APPROVED requester metadata still populated');
  }

  console.log(`\nMODULE 42 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_status_read_path\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runStaleDeviceApprovalReadPathTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16 stale device approval read-path suite execution error:', err); process.exit(1); });
}
