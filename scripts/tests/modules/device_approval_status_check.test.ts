/**
 * iPDS v4.1.0 — Test Module 41: P0-16 Device Approval Status Check UX Fix
 *
 * Proves the DeviceApprovalModal status flow is now driven by ONE shared,
 * testable function used by BOTH the manual "Semak Status Sekarang" button and
 * the automatic poll:
 *   - PENDING  -> stays pending, modal remains open;
 *   - APPROVED -> updates state, exits the modal, resumes login;
 *   - errors   -> surfaced safely (no silent no-op, no sensitive data);
 *   - polling cadence stays within the enrollment-status rate-limit budget;
 *   - no security/authentication behaviour changed.
 */

import fs from 'fs';
import path from 'path';
import {
  normalizeDeviceApprovalStatus,
  isDeviceApproved,
  checkDeviceApprovalStatus,
  runDeviceApprovalCheck,
  DEVICE_APPROVAL_STATUS_ENDPOINT,
  DEVICE_APPROVAL_POLL_INTERVAL_MS
} from '../../../src/features/auth/services/deviceApprovalStatus.js';

const SERVICE_SRC = 'src/features/auth/services/deviceApprovalStatus.ts';
const MODAL_SRC = 'src/features/auth/components/DeviceApprovalModal.tsx';
const LOGIN_SRC = 'src/features/auth/components/LoginScreen.tsx';
const DEVICES_SRC = 'src/server/routes/devices.routes.ts';
const AUTH_SRC = 'src/server/routes/auth.routes.ts';

function read(rel: string): string { return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8'); }

interface FakeResponse { ok?: boolean; status?: number; body?: any; throwErr?: boolean; jsonThrows?: boolean; }

function fakeFetch(response: FakeResponse) {
  const calls: string[] = [];
  const impl = (async (input: any) => {
    calls.push(String(input));
    if (response.throwErr) throw new Error('simulated network failure');
    const status = response.status ?? 200;
    return {
      ok: response.ok ?? (status < 400),
      status,
      json: async () => {
        if (response.jsonThrows) throw new Error('invalid json');
        return response.body;
      }
    } as any;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

export async function runDeviceApprovalStatusCheckTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE 41: P0-16 DEVICE APPROVAL STATUS CHECK UX FIX');
  console.log('----------------------------------------------------');

  let passed = 0; let total = 0; const failedTests: string[] = [];
  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) { console.log(`  [PASS] Test 41.${total}: ${name}`); passed++; }
    else { console.error(`  [FAIL] Test 41.${total}: ${name}`); if (detail) console.error(`         Detail: ${detail}`); failedTests.push(`Test 41.${total}: ${name}${detail ? ` (${detail})` : ''}`); }
  }

  // 1. Status normalisation
  {
    assert(normalizeDeviceApprovalStatus('APPROVED') === 'APPROVED', 'normalize APPROVED');
    assert(normalizeDeviceApprovalStatus('approved') === 'APPROVED', 'normalize is case-insensitive');
    assert(normalizeDeviceApprovalStatus('PENDING') === 'PENDING', 'normalize PENDING');
    assert(normalizeDeviceApprovalStatus('UNREGISTERED') === 'UNREGISTERED', 'normalize UNREGISTERED');
    assert(normalizeDeviceApprovalStatus('WEIRD') === 'PENDING' && normalizeDeviceApprovalStatus(undefined) === 'PENDING', 'unknown statuses are treated as PENDING');
    assert(isDeviceApproved('APPROVED') === true && isDeviceApproved('PENDING') === false, 'isDeviceApproved only true for APPROVED');
  }

  // 2. checkDeviceApprovalStatus behaviour
  {
    const approved = fakeFetch({ status: 200, body: { success: true, status: 'APPROVED' } });
    const r1 = await checkDeviceApprovalStatus('DEV-41-A', approved.impl);
    assert(r1.status === 'APPROVED' && r1.retryable === false && !r1.error, 'APPROVED response -> APPROVED result', JSON.stringify(r1));

    const pending = fakeFetch({ status: 200, body: { success: true, status: 'PENDING' } });
    const r2 = await checkDeviceApprovalStatus('DEV-41-A', pending.impl);
    assert(r2.status === 'PENDING' && r2.retryable === false && !r2.error, 'PENDING response -> PENDING result', JSON.stringify(r2));

    const limited = fakeFetch({ status: 429, body: { success: false, code: 'RATE_LIMITED' } });
    const r3 = await checkDeviceApprovalStatus('DEV-41-A', limited.impl);
    assert(r3.status === 'PENDING' && r3.retryable === true && !!r3.error, 'rate-limited (429) -> retryable safe error', JSON.stringify(r3));

    const serverErr = fakeFetch({ status: 500, body: {} });
    const r4 = await checkDeviceApprovalStatus('DEV-41-A', serverErr.impl);
    assert(r4.status === 'PENDING' && r4.retryable === true && !!r4.error, 'server error (500) -> retryable safe error', JSON.stringify(r4));

    const netErr = fakeFetch({ throwErr: true });
    const r5 = await checkDeviceApprovalStatus('DEV-41-A', netErr.impl);
    assert(r5.status === 'PENDING' && r5.retryable === true && !!r5.error, 'network failure -> retryable safe error', JSON.stringify(r5));

    const badJson = fakeFetch({ status: 200, jsonThrows: true });
    const r6 = await checkDeviceApprovalStatus('DEV-41-A', badJson.impl);
    assert(r6.status === 'PENDING' && !r6.error, 'non-JSON 200 body handled safely (PENDING)', JSON.stringify(r6));

    const noCall = fakeFetch({ status: 200, body: { status: 'APPROVED' } });
    const r7 = await checkDeviceApprovalStatus('', noCall.impl);
    assert(!!r7.error && noCall.calls.length === 0, 'empty deviceId -> safe error, no request sent');
  }

  // 3. Request shape: only deviceId, no capability/PII
  {
    const f = fakeFetch({ status: 200, body: { status: 'PENDING' } });
    await checkDeviceApprovalStatus('DEV 41/A', f.impl);
    assert(f.calls.length === 1, 'exactly one enrollment-status request per check');
    const url = f.calls[0];
    assert(url.startsWith(`${DEVICE_APPROVAL_STATUS_ENDPOINT}?deviceId=`), 'request targets the status-only endpoint', url);
    assert(url === `${DEVICE_APPROVAL_STATUS_ENDPOINT}?deviceId=DEV%2041%2FA`, 'deviceId is URL-encoded', url);
    assert(!/cap=|token|pin=|approvalUrl|estateId/i.test(url), 'request carries no capability/PIN/token/estate data', url);
  }

  // 4. Shared dispatch used by manual button AND auto poll
  {
    let approved = 0; let pending = 0; let errors = 0; let lastError = '';
    const handlers = {
      onApproved: () => { approved++; },
      onPending: () => { pending++; },
      onError: (m: string) => { errors++; lastError = m; }
    };

    const approvedFetch = fakeFetch({ status: 200, body: { status: 'APPROVED' } });
    await runDeviceApprovalCheck('DEV-41-B', handlers, approvedFetch.impl);
    assert(approved === 1 && pending === 0 && errors === 0, 'APPROVED -> onApproved exactly once');

    const pendingFetch = fakeFetch({ status: 200, body: { status: 'PENDING' } });
    await runDeviceApprovalCheck('DEV-41-B', handlers, pendingFetch.impl);
    assert(pending === 1 && approved === 1, 'PENDING -> onPending, does not exit');

    const errFetch = fakeFetch({ status: 429, body: {} });
    await runDeviceApprovalCheck('DEV-41-B', handlers, errFetch.impl);
    assert(errors === 1 && lastError.length > 0 && approved === 1, 'failure -> onError with safe message');
    assert(!/cap|token|pin|DEV-41/i.test(lastError), 'error message exposes no capability/PII/device internals', lastError);
  }

  // 5. State machine: manual vs automatic produce identical APPROVED outcome
  {
    const makeState = () => ({ open: true, status: 'PENDING' as string, error: '' as string });
    const handlersFor = (state: any) => ({
      onApproved: () => { state.open = false; state.status = 'APPROVED'; },
      onPending: () => { state.status = 'PENDING'; },
      onError: (m: string) => { state.error = m; }
    });

    const manualPending = makeState();
    await runDeviceApprovalCheck('DEV-41-C', handlersFor(manualPending), fakeFetch({ status: 200, body: { status: 'PENDING' } }).impl);
    assert(manualPending.open === true && manualPending.status === 'PENDING', 'manual PENDING keeps modal open and pending');

    const manualApproved = makeState();
    await runDeviceApprovalCheck('DEV-41-C', handlersFor(manualApproved), fakeFetch({ status: 200, body: { status: 'APPROVED' } }).impl);
    assert(manualApproved.open === false && manualApproved.status === 'APPROVED', 'manual APPROVED updates state and exits the modal');

    const autoApproved = makeState();
    await runDeviceApprovalCheck('DEV-41-C', handlersFor(autoApproved), fakeFetch({ status: 200, body: { status: 'APPROVED' } }).impl);
    assert(autoApproved.open === false && autoApproved.status === 'APPROVED', 'automatic poll APPROVED produces the same result');
  }

  // 6. Poll cadence within the enrollment-status rate-limit budget
  {
    const perMinute = 60000 / DEVICE_APPROVAL_POLL_INTERVAL_MS;
    assert(perMinute <= 10, `poll cadence stays within the 10/min auth limiter budget (${perMinute}/min)`);
    assert(perMinute >= 1, 'poll cadence is at least once per minute');
  }

  // 7. Modal wiring: single shared check for both paths
  {
    const modal = read(MODAL_SRC);
    assert(/import\s*\{[^}]*runDeviceApprovalCheck[^}]*\}\s*from\s*'\.\.\/services\/deviceApprovalStatus'/.test(modal), 'modal imports the shared status-check function');
    assert(modal.includes('DEVICE_APPROVAL_POLL_INTERVAL_MS'), 'modal uses the shared poll interval constant');
    assert(/handleCheckStatus\s*=\s*\(\)\s*=>\s*runStatusCheck\('manual'\)/.test(modal), 'manual button uses the shared runStatusCheck');
    assert(/setInterval\(\(\)\s*=>\s*\{\s*runStatusCheck\('auto'\)/.test(modal), 'automatic poll uses the same runStatusCheck');
    assert(!/fetch\(\s*`\/api\/devices\/enrollment-status/.test(modal) && !/enrollment-status\?deviceId/.test(modal),
      'modal no longer performs its own ad-hoc enrollment-status fetch');
    assert(/onSuccessApprovedRef\.current\(\)/.test(modal), 'APPROVED exits the modal via onSuccessApproved');
    assert(/approvedHandledRef\.current\s*=\s*true/.test(modal), 'APPROVED handling is guarded against double execution');
  }

  // 8. Login continuation after approval
  {
    const login = read(LOGIN_SRC);
    assert(/lastStaffNoRef\s*=\s*useRef\(""\)/.test(login), 'LoginScreen remembers the last staff number in component state');
    assert(/lastStaffNoRef\.current\s*=\s*cleanStaffNo/.test(login), 'staff number is remembered on explicit submit');
    assert(/submitLogin\(lastStaffNoRef\.current\s*\|\|\s*undefined\)/.test(login), 'approval resumes the explicit kiosk login attempt');
    assert(/onClearDeviceApprovalState\?\.\(\)/.test(login), 'approval clears the modal state (closes the modal)');
  }

  // 9. No security / authentication changes
  {
    const service = read(SERVICE_SRC);
    assert(!/approveDevice|approve-link|requireAuth|requireDeviceAdmin/i.test(service), 'status service performs no approval/auth operations');
    assert(!/token_hash|bootstrap|deviceSecurityService|approveDevice|requireAuth/i.test(service), 'status service does not touch capability/bootstrap security');

    const devices = read(DEVICES_SRC);
    assert(/router\.get\('\/enrollment-status',\s*authRateLimiter/.test(devices), 'enrollment-status remains pre-auth and rate-limited');
    assert(/router\.get\('\/quick-approve',\s*requireAuth,\s*requireDeviceAdmin/.test(devices) && /router\.post\('\/approve-direct',\s*requireAuth,\s*requireDeviceAdmin/.test(devices),
      'quick-approve/approve-direct auth requirements unchanged');
    assert(/peekApprovalCapability/.test(devices) && /consumeApprovalCapability/.test(devices), '/approve-link capability flow unchanged');
    assert(!/\b(2401199|888888|654321)\b/.test(devices), 'no master PIN auto-approval restored');

    const auth = read(AUTH_SRC);
    assert(/createApprovalCapability\(\{[\s\S]*?requesterName:/.test(auth), 'P0-16B requester metadata still populated server-side');
  }

  console.log(`\nMODULE 41 RESULT: ${passed}/${total} TESTS PASSED`);
  return { passed, total, failedTests };
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /device_approval_status_check\.test\.[cm]?tsx?$/.test(process.argv[1] || '');

if (invokedDirectly) {
  runDeviceApprovalStatusCheckTests()
    .then((res) => { process.exit(res.passed === res.total ? 0 : 1); })
    .catch((err) => { console.error('P0-16 device approval status-check suite execution error:', err); process.exit(1); });
}
