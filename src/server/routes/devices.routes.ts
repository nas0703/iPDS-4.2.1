/**
 * iPDS v4.1.0 — Device Whitelist & Registration Routes
 * Handles device verification, pending registration queue, and admin approvals.
 */

import express, { Request, Response } from 'express';
import { deviceSecurityService, verifyBootstrapToken, consumeApprovalCapability, peekApprovalCapability, createApprovalCapability, sendApprovalLink, type ConsumedApprovalCapability, issueDeviceCredential, listDeviceEstateAccess, grantDeviceEstateAccess, revokeDeviceEstateAccess, isValidEstateId, issueExistingDeviceCredential, getRegisteredDeviceById } from '../services/deviceSecurity.service.js';
import { runBulkDeviceCredentialRotation } from '../services/deviceBulkRotation.service.js';
import { mergeDevices, toSafeMergeCandidate } from '../services/deviceMerge.service.js';
import { requireAuth, isSuperAdminIdentity } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { AuthService } from '../services/auth.service.js';
import { IdentityService } from '../services/identity.service.js';
import { auditService } from '../services/audit.service.js';

const router = express.Router();

/**
 * P0-07 / P0-ADMIN: Device-management authorization + estate-boundary helpers.
 * Device approval/revocation is restricted to administrative roles. ONLY the
 * canonical Super Admin / FC Tunggal identity may operate across estates; every
 * other admin role is locked to its own estate and may never use estateId=ALL.
 */
const DEVICE_ADMIN_ROLES = ['rc', 'oc', 'pf', 'fc', 'superadmin', 'super_admin', 'admin', 'executive_hq', 'regional_controller'];

function normalizeRole(role?: string | null): string {
  return (role || '').toLowerCase().trim();
}

function isDeviceAdmin(role?: string | null): boolean {
  return DEVICE_ADMIN_ROLES.includes(normalizeRole(role));
}

/**
 * Canonical cross-estate authority: ONLY the Super Admin / FC Tunggal identity
 * (isSuperAdminIdentity SSOT) may administer devices across estates. RC/OC/PF
 * and branch-FC are limited to their own estate.
 */
function isCrossEstateDeviceActor(req: Request): boolean {
  return isSuperAdminIdentity(req.user);
}

/**
 * The actor's authoritative home estate, taken from the verified session (JWT)
 * — never from client-supplied body/query/header values.
 */
function getActorHomeEstate(req: Request): string {
  return String(req.user?.app_metadata?.estate_id || req.estateId || '').trim().toUpperCase();
}

function requireDeviceAdmin(req: Request, res: Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Sesi log masuk tidak sah.', code: 'UNAUTHORIZED' });
  }
  if (!isDeviceAdmin(req.authRole)) {
    return res.status(403).json({
      success: false,
      error: 'Akses dinafikan: Peranan anda tidak dibenarkan menguruskan peranti.',
      code: 'DEVICE_ADMIN_REQUIRED'
    });
  }
  next();
}

/**
 * P0-16C.2: whether the authenticated actor may administer the given estate.
 * Mirrors enforceDeviceEstate without writing a response (for list filtering).
 */
function actorCanAdministerEstate(req: Request, estateId: string): boolean {
  if (isCrossEstateDeviceActor(req)) return true;
  const own = getActorHomeEstate(req);
  return !!own && own === String(estateId || '').trim().toUpperCase();
}

function resolveRequestedEstate(req: Request): string {
  const raw =
    (req.body?.estateId as string) ||
    (req.body?.estate_id as string) ||
    (req.query?.estateId as string) ||
    (req.query?.estate_id as string) ||
    (req.headers['x-estate-id'] as string) ||
    req.estateId ||
    'FPM_TUNGGAL';
  return String(raw).trim().toUpperCase();
}

function enforceDeviceEstate(req: Request, res: Response, targetEstate: string): boolean {
  if (isCrossEstateDeviceActor(req)) return true;

  if (targetEstate === 'ALL') {
    res.status(403).json({
      success: false,
      error: 'Akses dinafikan: Peranan anda tidak dibenarkan mengakses semua ladang.',
      code: 'FORBIDDEN_ESTATE'
    });
    return false;
  }

  const ownEstate = getActorHomeEstate(req);
  if (ownEstate && targetEstate !== ownEstate) {
    res.status(403).json({
      success: false,
      error: `Akses dinafikan: Anda hanya dibenarkan menguruskan peranti ladang ${ownEstate}.`,
      code: 'FORBIDDEN_ESTATE'
    });
    return false;
  }
  return true;
}

/**
 * GET /api/devices/check
 * Checks status of a specific device
 */
router.get(['/check', '/status'], requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const deviceId = (req.query.deviceId as string) || (req.headers['x-device-id'] as string);
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan' });
    }

    const device = await deviceSecurityService.getDeviceStatus(deviceId);
    if (device && !enforceDeviceEstate(req, res, String(device.estate_id || '').toUpperCase())) {
      return;
    }
    return res.json({
      success: true,
      device: device || {
        device_id: deviceId,
        status: 'UNREGISTERED'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat menyemak peranti' });
  }
});

/**
 * POST /api/devices/register
 * Submits a new device registration request
 */
router.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { deviceId, deviceName, estateId, pin, operatorName } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan' });
    }

    // P0-07: restricted enrollment. A valid operator credential is required and
    // the device is ALWAYS created PENDING (never auto-approved).
    const cleanPin = String(pin || '').trim();
    const requestedEstate = String(estateId || '').trim().toUpperCase();
    const pinSession = /^\d{4,7}$/.test(cleanPin)
      ? (AuthService.verifyEstateStaffLogin(requestedEstate, cleanPin, cleanPin) || AuthService.verifyPin(cleanPin))
      : null;

    if (!pinSession) {
      return res.status(401).json({
        success: false,
        error: 'Pendaftaran peranti memerlukan kredensial pengendali yang sah.',
        code: 'ENROLLMENT_CREDENTIAL_REQUIRED'
      });
    }

    const verifiedRole = pinSession.app_metadata.app_role;
    const verifiedEstate = String(pinSession.app_metadata.estate_id || 'FPM_TUNGGAL').toUpperCase();

    if (!isSuperAdminIdentity(pinSession) && requestedEstate && requestedEstate !== verifiedEstate) {
      return res.status(403).json({
        success: false,
        error: 'Akses dinafikan: Pendaftaran peranti mesti berada dalam ladang pengendali.',
        code: 'FORBIDDEN_ESTATE'
      });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const record = await deviceSecurityService.registerDevice({
      deviceId,
      deviceName: deviceName || 'Peranti Baharu',
      estateId: verifiedEstate,
      pin: cleanPin,
      operatorName: operatorName || pinSession.user_metadata.operator_name,
      role: verifiedRole,
      ip: clientIp,
      userAgent,
      bootstrapToken: (req.headers['x-device-bootstrap-token'] as string) || (req.body && req.body.bootstrapToken) || undefined
    });

    // P0-16C.1: issue a cryptographic device credential. The plaintext credential
    // is returned to the newly-registering client exactly once; only its SHA-256
    // hash is persisted. Credential ENFORCEMENT is deferred to P0-16C.3.
    const deviceCredential = await issueDeviceCredential(record.device_id);

    return res.status(201).json({
      success: true,
      message: 'Permohonan pendaftaran peranti telah dihantar kepada Pentadbir untuk kelulusan.',
      device: record,
      ...(deviceCredential
        ? { deviceCredential, credentialNotice: 'Simpan kredensial peranti ini. Ia hanya dipaparkan sekali.' }
        : {})
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat mendaftar peranti' });
  }
});

/**
 * GET /api/devices/enrollment-status
 * Pre-auth, rate-limited, minimal status probe used by the device-approval
 * screen while the user is not yet authenticated. Returns ONLY the device
 * status (no operator/PII, no tenant data) so an unapproved device can detect
 * when an administrator has approved it. It does not bypass approval.
 */
router.get('/enrollment-status', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const deviceId = String((req.query.deviceId as string) || (req.headers['x-device-id'] as string) || '').trim();
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan' });
    }
    const record = await deviceSecurityService.getDeviceStatus(deviceId);
    return res.json({ success: true, deviceId, status: record?.status || 'UNREGISTERED' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat menyemak status peranti' });
  }
});

/**
 * POST /api/devices/bootstrap
 * P0-16 secure first-device bootstrap. Pre-auth but gated by BOTH:
 *   1. a valid operator PIN (verified server-side), and
 *   2. the server-side bootstrap secret (x-device-bootstrap-token).
 *
 * The secret is compared server-side, is never returned to the client, and is
 * never logged. Only the specific device is approved (persisted via the P0-16
 * mechanism). It does NOT restore master-PIN auto-approval and does not weaken
 * requireAuth/requireDeviceAdmin for the other device endpoints.
 */
router.post('/bootstrap', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { deviceId, deviceName, pin } = req.body || {};
    const bootstrapToken = (req.headers['x-device-bootstrap-token'] as string) || '';

    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan' });
    }

    if (!verifyBootstrapToken(bootstrapToken)) {
      return res.status(403).json({
        success: false,
        error: 'Kod bootstrap tidak sah atau tidak dikonfigurasikan.',
        code: 'INVALID_BOOTSTRAP_TOKEN'
      });
    }

    const cleanPin = String(pin || '').trim();
    const pinSession = /^\d{4,7}$/.test(cleanPin) ? AuthService.verifyPin(cleanPin) : null;
    if (!pinSession) {
      return res.status(401).json({ success: false, error: 'PIN pengendali tidak sah.', code: 'INVALID_PIN' });
    }

    const estateId = String(pinSession.app_metadata.estate_id || 'FPM_TUNGGAL').toUpperCase();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const record = await deviceSecurityService.registerDevice({
      deviceId,
      deviceName: deviceName || 'Peranti Pentadbir (Bootstrap)',
      estateId,
      pin: cleanPin,
      operatorName: pinSession.user_metadata.operator_name,
      role: pinSession.app_metadata.app_role,
      ip: clientIp,
      userAgent,
      bootstrapToken
    });

    if (record.status !== 'APPROVED') {
      return res.status(500).json({ success: false, error: 'Bootstrap peranti gagal.' });
    }

    // P0-16C.2: grant ACTIVE access for the bootstrap estate only.
    await grantDeviceEstateAccess(record.device_id, String(estateId).toUpperCase(), 'BOOTSTRAP_TOKEN');

    return res.json({
      success: true,
      message: 'Peranti berjaya di-bootstrap dan diluluskan.',
      device: { deviceId: record.device_id, status: record.status }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat bootstrap peranti' });
  }
});

/**
 * P0-16A: one-time FC approval link.
 *
 * GET  /api/devices/approve-link?cap=...  -> renders a confirmation page only
 *                                           (never mutates state).
 * POST /api/devices/approve-link (cap)    -> consumes the capability and
 *                                           approves the capability's device.
 *
 * The URL contains ONLY the opaque capability (no PIN, JWT, deviceId, estateId,
 * or PII). Device/estate are taken from the server-side capability record only.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function approvalHtml(title: string, message: string, cap?: string, isError: boolean = false): string {
  const form = cap
    ? `<form method="POST" action="/api/devices/approve-link" style="margin-top:20px;">
         <input type="hidden" name="cap" value="${escapeHtml(cap)}" />
         <button type="submit" style="width:100%;background:#10b981;color:#021a1d;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;cursor:pointer;">Luluskan Peranti Ini</button>
       </form>`
    : '';
  const icon = isError ? '✕' : (title.toLowerCase().includes('lulus') ? '✓' : 'ℹ');
  const iconColor = isError ? '#f87171' : '#10b981';
  const iconBg = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
  const iconBorder = isError ? 'rgba(239, 68, 68, 0.4)' : '#10b981';

  return `<!DOCTYPE html>
  <html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>iPDS — ${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background: #021214;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: linear-gradient(180deg, #062326 0%, #031416 100%);
      border: 1px solid ${isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'};
      border-radius: 24px;
      padding: 32px 28px;
      max-width: 460px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      text-align: center;
    }
    .icon-circle {
      width: 64px;
      height: 64px;
      background: ${iconBg};
      border: 2px solid ${iconBorder};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px auto;
      color: ${iconColor};
      font-size: 30px;
      font-weight: 900;
    }
    h1 { font-size: 20px; font-weight: 800; margin: 0 0 10px; color: #fff; }
    p { color: #94a3b8; font-size: 13.5px; line-height: 1.6; margin: 0 0 16px 0; }
    .btn-home { display: inline-block; margin-top: 16px; color: #34d399; font-size: 13px; font-weight: 700; text-decoration: none; }
  </style>
  </head><body>
    <div class="card">
      <div class="icon-circle">${icon}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${form}
      <div><a href="/" class="btn-home">Buka Sistem iPDS →</a></div>
    </div>
  </body></html>`;
}

function approvalSuccessHtml(meta: ConsumedApprovalCapability, title: string = 'Peranti Diluluskan'): string {
  const rows = [
    approvalRow('Status Kelulusan', '✓ AKTIF & DIBENARKAN'),
    approvalRow('Pemohon', meta.requesterName || 'Kakitangan'),
    approvalRow('No. Kakitangan', meta.requesterStaffId || '-'),
    approvalRow('Estate / Ladang', meta.estateId || 'FPM_TUNGGAL'),
    approvalRow('ID Peranti', meta.deviceId),
    approvalRow('Nama Peranti', meta.deviceName || 'Peranti Staf'),
    approvalRow('Masa Kelulusan', formatApprovalTime(new Date().toISOString()))
  ].join('');

  return `<!DOCTYPE html>
  <html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>iPDS — ${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background: #021214;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: linear-gradient(180deg, #062326 0%, #031416 100%);
      border: 1px solid rgba(16, 185, 129, 0.45);
      border-radius: 24px;
      padding: 32px 28px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 24px 48px rgba(0,0,0,0.7), 0 0 30px rgba(16,185,129,0.15);
      text-align: center;
    }
    .icon-circle {
      width: 72px;
      height: 72px;
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 18px auto;
      color: #10b981;
      font-size: 36px;
      font-weight: 900;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
    }
    .badge {
      display: inline-block;
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 4px 14px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 8px 0;
      color: #ffffff;
      letter-spacing: 0.5px;
    }
    p.lead {
      color: #94a3b8;
      font-size: 13.5px;
      line-height: 1.6;
      margin: 0 0 18px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      background: rgba(0,0,0,0.3);
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .notice-box {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: 14px;
      padding: 14px 16px;
      margin-top: 18px;
      text-align: left;
    }
    .notice-title {
      color: #34d399;
      font-weight: 800;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .notice-desc {
      color: #cbd5e1;
      font-size: 12.5px;
      line-height: 1.5;
      margin: 0;
    }
    .btn-action {
      display: block;
      width: 100%;
      background: #10b981;
      color: #021a1d;
      border: none;
      border-radius: 12px;
      padding: 14px;
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      text-decoration: none;
      margin-top: 22px;
      box-shadow: 0 4px 14px rgba(16,185,129,0.35);
      transition: all 0.2s;
    }
    .btn-action:hover {
      background: #34d399;
      transform: translateY(-1px);
    }
  </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-circle">✓</div>
      <span class="badge">iPDS KESELAMATAN PERANTI</span>
      <h1>${escapeHtml(title)}</h1>
      <p class="lead">Peranti ini telah berjaya diluluskan untuk akses penuh ke dalam sistem iPDS.</p>
      
      <table>${rows}</table>

      <div class="notice-box">
        <div class="notice-title">✓ Akses Peranti Aktif</div>
        <p class="notice-desc">Pemohon <strong>(${escapeHtml(meta.requesterName || 'Kakitangan')})</strong> kini boleh terus log masuk ke dalam aplikasi iPDS pada peranti mereka tanpa sebarang sekatan.</p>
      </div>

      <a href="/" class="btn-action">Buka Sistem iPDS</a>
    </div>
  </body>
  </html>`;
}

function formatApprovalTime(iso?: string | null): string {
  if (!iso) return 'Tidak diketahui';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Tidak diketahui';
  try {
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch {
    return d.toISOString();
  }
}

function approvalRow(label: string, value?: string | null): string {
  return `<tr>
    <td style="padding:8px 10px;color:#94a3b8;font-size:12px;text-align:left;border-bottom:1px solid rgba(148,163,184,0.15);white-space:nowrap;">${escapeHtml(label)}</td>
    <td style="padding:8px 10px;color:#f3f4f6;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid rgba(148,163,184,0.15);word-break:break-word;">${escapeHtml(value || 'Tidak diketahui')}</td>
  </tr>`;
}

/**
 * P0-16B: FC confirmation page. Shows WHO is requesting approval (requester
 * name + staff id) plus the server-side device/estate context so the FC can
 * verify before approving. The raw capability is only carried in hidden form
 * fields (the same opaque value the FC already holds); it is never displayed.
 */
function approvalConfirmHtml(meta: {
  deviceId?: string;
  estateId?: string;
  deviceName?: string | null;
  requesterName?: string | null;
  requesterStaffId?: string | null;
  createdAt?: string;
  expiresAt?: string;
}, cap: string): string {
  const rows = [
    approvalRow('Pemohon', meta.requesterName),
    approvalRow('No. Kakitangan', meta.requesterStaffId),
    approvalRow('Estate', meta.estateId),
    approvalRow('ID Peranti', meta.deviceId),
    approvalRow('Nama Peranti', meta.deviceName),
    approvalRow('Masa Permohonan', formatApprovalTime(meta.createdAt)),
    approvalRow('Sah Hingga', formatApprovalTime(meta.expiresAt))
  ].join('');

  const approveForm = `<form method="POST" action="/api/devices/approve-link" style="margin-top:18px;">
      <input type="hidden" name="cap" value="${escapeHtml(cap)}" />
      <input type="hidden" name="action" value="approve" />
      <button type="submit" style="width:100%;background:#10b981;color:#021a1d;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;cursor:pointer;">Luluskan Peranti Ini</button>
    </form>`;
  const rejectForm = `<form method="POST" action="/api/devices/approve-link" style="margin-top:10px;">
      <input type="hidden" name="cap" value="${escapeHtml(cap)}" />
      <input type="hidden" name="action" value="reject" />
      <button type="submit" style="width:100%;background:transparent;color:#f87171;border:1px solid rgba(248,113,113,0.5);border-radius:12px;padding:12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;cursor:pointer;">Tolak / Batal</button>
    </form>`;

  return `<!DOCTYPE html>
  <html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>iPDS — Kelulusan Peranti</title>
  <style>body{background:#031315;color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}
  .card{background:linear-gradient(180deg,#092629 0%,#05191b 100%);border:1px solid rgba(16,185,129,0.4);border-radius:24px;padding:28px;max-width:460px;width:100%;box-shadow:0 20px 40px rgba(0,0,0,0.6);}
  h1{font-size:20px;font-weight:800;margin:0 0 8px;color:#fff;text-align:center;} p{color:#94a3b8;font-size:13px;line-height:1.6;}
  table{width:100%;border-collapse:collapse;margin-top:16px;}</style>
  </head><body><div class="card">
    <h1>Kelulusan Peranti</h1>
    <p style="text-align:center;margin:0 0 4px;">Permohonan peranti baharu memerlukan kelulusan anda.</p>
    <table>${rows}</table>
    <p style="color:#fbbf24;font-weight:700;margin:16px 0 0;text-align:center;">Sila pastikan maklumat pemohon adalah betul sebelum meluluskan peranti.</p>
    ${approveForm}${rejectForm}
  </div></body></html>`;
}

router.get('/approve-link', authRateLimiter, async (req: Request, res: Response) => {
  const cap = String((req.query.cap as string) || '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!cap) {
    return res.status(400).send(approvalHtml('Pautan Tidak Sah', 'Pautan kelulusan ini tidak sah atau tidak lengkap.'));
  }

  // P0-16B: validate + read server-side requester context, but NEVER mutate.
  const peek = await peekApprovalCapability(cap);
  if (!peek.ok) {
    const message = peek.reason === 'expired'
      ? 'Pautan kelulusan telah tamat tempoh.'
      : peek.reason === 'used'
        ? 'Pautan kelulusan ini telah digunakan.'
        : 'Pautan kelulusan tidak sah.';
    const status = peek.reason === 'used' ? 409 : peek.reason === 'expired' ? 410 : 400;
    return res.status(status).send(approvalHtml('Kelulusan Tidak Sah', message));
  }

  // Render confirmation only — no state mutation. Device/estate/requester come
  // from the server-side capability record, never from the URL.
  return res.send(approvalConfirmHtml(peek, cap));
});

router.post('/approve-link', authRateLimiter, async (req: Request, res: Response) => {
  const wantsJson = (req.headers['accept']?.includes('application/json') || req.headers['content-type']?.includes('application/json') || req.body?.format === 'json');
  if (!wantsJson) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
  }
  try {
    const cap = String((req.body && (req.body.cap || req.body.capability)) || '');
    const action = String((req.body && req.body.action) || 'approve').toLowerCase();
    const consumed = await consumeApprovalCapability(cap);

    if (!consumed.ok) {
      const message = consumed.reason === 'expired'
        ? 'Pautan kelulusan telah tamat tempoh.'
        : consumed.reason === 'used'
          ? 'Pautan kelulusan ini telah digunakan.'
          : 'Pautan kelulusan tidak sah.';
      const status = consumed.reason === 'used' ? 409 : consumed.reason === 'expired' ? 410 : 400;
      if (wantsJson) {
        return res.status(status).json({ success: false, error: message });
      }
      return res.status(status).send(approvalHtml('Kelulusan Gagal', message));
    }

    // Reject/Cancel: the capability is already consumed above (single-use) so it
    // can never be reused, but NO device is approved and no new state is created.
    if (action === 'reject') {
      if (wantsJson) {
        return res.json({ success: true, message: 'Permohonan peranti ini telah ditolak.' });
      }
      return res.send(approvalHtml('Permohonan Ditolak', 'Permohonan peranti ini telah ditolak. Tiada peranti diluluskan.'));
    }

    // Device/estate come ONLY from the server-side capability record.
    const existing = await deviceSecurityService.getDeviceStatus(consumed.deviceId!);
    if (existing && existing.estate_id && consumed.estateId &&
        String(existing.estate_id).toUpperCase() !== String(consumed.estateId).toUpperCase()) {
      if (wantsJson) {
        return res.status(409).json({ success: false, error: 'Peranti tidak sepadan dengan kebenaran kelulusan.' });
      }
      return res.status(409).send(approvalHtml('Kelulusan Gagal', 'Peranti tidak sepadan dengan kebenaran kelulusan.'));
    }

    const updated = await deviceSecurityService.approveDevice(consumed.deviceId!, 'WhatsApp Link', 'fc');
    // P0-16C.2: grant ACTIVE access for the capability-bound estate only.
    await grantDeviceEstateAccess(consumed.deviceId!, consumed.estateId!, 'WhatsApp Link');
    if (wantsJson) {
      return res.json({
        success: true,
        message: 'Peranti berjaya diluluskan!',
        device: updated
      });
    }
    return res.send(approvalSuccessHtml(consumed, 'Peranti Diluluskan'));
  } catch (err) {
    if (wantsJson) {
      return res.status(500).json({ success: false, error: 'Ralat semasa meluluskan peranti.' });
    }
    return res.status(500).send(approvalHtml('Ralat', 'Ralat semasa meluluskan peranti.', undefined, true));
  }
});

/**
 * POST /api/devices/approve-with-pin
 * Instant pre-auth device approval for Google Studio Preview and local operations.
 * Allows an administrator / FC to directly approve a device by verifying their Admin PIN.
 */
router.post('/approve-with-pin', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { deviceId, pin, approverName } = req.body || {};
    const cleanPin = String(pin || '').trim().replace(/\s+/g, '');
    const targetDeviceId = String(deviceId || '').trim();

    if (!targetDeviceId) {
      return res.status(400).json({ success: false, error: 'ID Peranti diperlukan.' });
    }
    if (!cleanPin) {
      return res.status(400).json({ success: false, error: 'PIN Pentadbir diperlukan.' });
    }

    // Authenticate PIN against authoritative Identity registry and server auth
    const identityProfile = IdentityService.findIdentityByPin(cleanPin) || IdentityService.findIdentityByStaffNo(cleanPin);
    let resolvedRole = identityProfile?.app_role ? String(identityProfile.app_role).toLowerCase() : '';
    let resolvedApprover = approverName || identityProfile?.full_name || '';
    let targetEstate = identityProfile?.primary_estate_id || 'FPM_TUNGGAL';
    let operatorId = identityProfile?.operator_id || '';

    if (!identityProfile) {
      const session = AuthService.verifyPin(cleanPin);
      if (session) {
        resolvedRole = String(session.app_metadata.app_role || '').toLowerCase();
        resolvedApprover = approverName || session.user_metadata.operator_name || 'Pentadbir Ladang';
        targetEstate = session.app_metadata.estate_id || 'FPM_TUNGGAL';
        operatorId = session.app_metadata.operator_id;
      }
    }

    if (!resolvedRole) {
      return res.status(401).json({ success: false, error: 'PIN Pentadbir tidak sah atau tiada rekod identiti.' });
    }

    // Check if role is an authorized administrator (FC, RC, OC, Superadmin, PF)
    const isAllowedAdmin = isDeviceAdmin(resolvedRole) || ['fc', 'rc', 'oc', 'superadmin', 'admin', 'super_admin', 'pf'].includes(resolvedRole);

    if (!isAllowedAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Akses dinafikan: Hanya Pentadbir / FC dibenarkan meluluskan peranti.'
      });
    }

    if (!resolvedApprover) {
      resolvedApprover = 'Pentadbir Ladang';
    }

    const updated = await deviceSecurityService.approveDevice(
      targetDeviceId,
      resolvedApprover,
      (resolvedRole as any) || 'fc'
    );

    // Grant active access for the estate
    await grantDeviceEstateAccess(targetDeviceId, targetEstate, resolvedApprover);
    if (resolvedRole === 'rc' || resolvedRole === 'superadmin' || isSuperAdminIdentity({ app_metadata: { app_role: resolvedRole, estate_id: targetEstate } })) {
      await grantDeviceEstateAccess(targetDeviceId, 'FPM_TUNGGAL', resolvedApprover);
      await grantDeviceEstateAccess(targetDeviceId, 'FPM_ADELA', resolvedApprover);
      await grantDeviceEstateAccess(targetDeviceId, 'FPM_KLEDANG', resolvedApprover);
      await grantDeviceEstateAccess(targetDeviceId, 'FPM_SENING', resolvedApprover);
    }

    // Issue a device credential for the approved device
    let issuedCredential: string | null = null;
    try {
      issuedCredential = await issueDeviceCredential(targetDeviceId);
    } catch {
      // Non-blocking credential issuance
    }

    // Record audit log
    auditService.record({
      action: 'DEVICE_APPROVED',
      resource: 'devices/approve-with-pin',
      userId: operatorId || 'FC-ADMIN',
      userName: resolvedApprover,
      authorizedEstate: targetEstate,
      result: 'SUCCESS',
      ip: req.ip || '127.0.0.1',
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      details: {
        deviceId: targetDeviceId,
        approverRole: resolvedRole,
        approverName: resolvedApprover,
        method: 'ADMIN_PIN'
      }
    });

    return res.json({
      success: true,
      message: `Peranti berjaya diluluskan oleh ${resolvedApprover}!`,
      device: updated,
      credential: issuedCredential
    });
  } catch (err) {
    console.error('[DEVICE_SECURITY] Error in approve-with-pin:', err);
    return res.status(500).json({ success: false, error: 'Ralat sistem semasa meluluskan peranti.' });
  }
});

/**
 * POST /api/devices/request-approval
 * Pre-auth, rate-limited endpoint called by client device approval modal.
 * Creates a one-time cryptographic capability URL (/api/devices/approve-link?cap=...)
 * carrying the applicant's name and staff ID.
 */
router.post('/request-approval', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { deviceId, deviceName, estateId, requesterName, requesterStaffId } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan' });
    }

    const cleanEstate = String(estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const cleanRequesterName = String(requesterName || '').trim() || null;
    const cleanStaffId = String(requesterStaffId || '').trim() || null;
    const cleanDeviceName = String(deviceName || 'Peranti Baharu').trim();

    // Register or ensure device record exists as PENDING if not yet approved
    const existing = await deviceSecurityService.getDeviceStatus(deviceId);
    if (!existing) {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = (req.headers['user-agent'] as string) || 'unknown';
      await deviceSecurityService.registerDevice({
        deviceId,
        deviceName: cleanDeviceName,
        estateId: cleanEstate,
        operatorName: cleanRequesterName || 'Kakitangan',
        role: 'staff',
        ip: clientIp,
        userAgent
      });
    }

    const capabilityResult = await createApprovalCapability({
      deviceId,
      estateId: cleanEstate,
      deviceName: cleanDeviceName,
      requesterName: cleanRequesterName,
      requesterStaffId: cleanStaffId,
      createdBy: 'DEVICE_MODAL'
    });

    const approvalUrl = `/api/devices/approve-link?cap=${encodeURIComponent(capabilityResult.capability)}`;
    await sendApprovalLink({
      approvalUrl,
      estateId: cleanEstate,
      deviceId,
      deviceName: cleanDeviceName,
      requesterName: cleanRequesterName,
      requesterStaffId: cleanStaffId
    });

    return res.json({
      success: true,
      expiresAt: capabilityResult.expiresAt
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat memohon kelulusan peranti' });
  }
});

/**
 * GET /api/devices/list
 * List all registered devices (Admin only)
 */
router.get('/list', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const requestedEstate = resolveRequestedEstate(req);
    if (!enforceDeviceEstate(req, res, requestedEstate)) return;
    const estateId = requestedEstate === 'ALL' ? undefined : requestedEstate;
    const devices = await deviceSecurityService.listDevices(estateId);
    return res.json({
      success: true,
      devices
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat memuatkan senarai peranti' });
  }
});

/**
 * POST /api/devices/approve
 * Approves a pending device (Admin only)
 */
router.post('/approve', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan' });
    }

    const existing = await deviceSecurityService.getDeviceStatus(deviceId);
    if (existing && !enforceDeviceEstate(req, res, String(existing.estate_id || '').toUpperCase())) {
      return;
    }

    const approverName = req.user?.user_metadata?.operator_name || 'Pentadbir Ladang';
    const approverRole = req.authRole || 'fc';

    const updated = await deviceSecurityService.approveDevice(deviceId, approverName, approverRole);
    // P0-16C.2: grant ACTIVE access for this device's estate only.
    await grantDeviceEstateAccess(deviceId, String(existing?.estate_id || req.estateId || 'FPM_TUNGGAL').toUpperCase(), approverName);
    return res.json({
      success: true,
      message: 'Peranti berjaya diluluskan untuk akses penuh.',
      device: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat meluluskan peranti' });
  }
});

/**
 * POST /api/devices/revoke
 * Revokes / blocks a device (Admin only)
 */
router.post('/revoke', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const { deviceId, reason } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan' });
    }

    const existing = await deviceSecurityService.getDeviceStatus(deviceId);
    if (existing && !enforceDeviceEstate(req, res, String(existing.estate_id || '').toUpperCase())) {
      return;
    }

    const revokerName = req.user?.user_metadata?.operator_name || 'Pentadbir Ladang';
    await deviceSecurityService.revokeDevice(deviceId, revokerName, reason);
    return res.json({
      success: true,
      message: 'Peranti telah disekat serta-merta.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat menyekat peranti' });
  }
});

/**
 * GET /api/devices/pending-count
 * Returns pending devices count and list for admin notification badges
 */
router.get(['/pending-count', '/pending'], requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const requestedEstate = resolveRequestedEstate(req);
    if (!enforceDeviceEstate(req, res, requestedEstate)) return;
    const estateId = requestedEstate === 'ALL' ? undefined : requestedEstate;
    const allDevices = await deviceSecurityService.listDevices(estateId);
    const pendingDevices = allDevices.filter(d => d.status === 'PENDING');
    
    return res.json({
      success: true,
      count: pendingDevices.length,
      pendingDevices
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat memuatkan peranti menunggu' });
  }
});

/**
 * GET /api/devices/fc-contact
 * Returns active WhatsApp contact for FC/Admin
 */
router.get('/fc-contact', async (_req: Request, res: Response) => {
  try {
    await deviceSecurityService.loadFromSupabase();
  } catch (err) {
    console.warn('[DEVICE_ROUTER] Load contact warning:', err);
  }
  return res.json({
    success: true,
    contact: deviceSecurityService.getFcContact()
  });
});

/**
 * POST /api/devices/fc-contact
 * Updates active WhatsApp contact for FC/Admin
 */
router.post('/fc-contact', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const { phone, name } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Nombor telefon diperlukan' });
    }
    const updated = await deviceSecurityService.setFcContact(phone, name);
    return res.json({
      success: true,
      message: 'Nombor telefon FC berjaya dikemaskini dan disimpan kekal',
      contact: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat mengemaskini nombor telefon FC' });
  }
});

/**
 * GET /api/devices/quick-approve
 * Renders an instant approval page for FC clicking WhatsApp link
 */
router.get('/quick-approve', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string;
    const action = (req.query.action as string) || '';

    if (!deviceId) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="ms">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>iPDS - Ralat Kelulusan Peranti</title>
          <style>
            body { background: #020e10; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
            .card { background: #071f22; border: 1px solid rgba(239, 68, 68, 0.4); padding: 30px; border-radius: 20px; max-width: 420px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h1 { color: #f87171; font-size: 20px; margin-bottom: 10px; }
            p { color: #9ca3af; font-size: 14px; line-height: 1.6; }
            a { display: inline-block; margin-top: 20px; background: #10b981; color: #020e10; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Ralat: ID Peranti Tidak Sah</h1>
            <p>Pautan kelulusan ini tidak mengandungi ID peranti yang sah. Sila hubungi pengendali sistem atau kembali ke aplikasi.</p>
            <a href="/">Buka Aplikasi iPDS</a>
          </div>
        </body>
        </html>
      `);
    }

    const device = await deviceSecurityService.getDeviceStatus(deviceId);

    // P0-07: approval/revocation requires an authenticated device admin and
    // respects estate boundaries. No hardcoded PIN is used. Because this is a
    // GET-triggered state change, cross-site requests are rejected.
    let processedMessage = '';
    let isSuccess = false;

    if (action === 'approve' || action === 'revoke') {
      if ((req.headers['sec-fetch-site'] as string) === 'cross-site') {
        processedMessage = 'Ralat: Permintaan rentas tapak disekat.';
        isSuccess = false;
      } else if (!enforceDeviceEstate(req, res, String(device?.estate_id || req.estateId || 'FPM_TUNGGAL').toUpperCase())) {
        return;
      } else if (action === 'approve') {
        await deviceSecurityService.approveDevice(
          deviceId,
          req.user?.user_metadata?.operator_name || 'Pentadbir',
          req.authRole || 'fc'
        );
        // P0-16C.2: grant ACTIVE access for this device's estate only.
        await grantDeviceEstateAccess(
          deviceId,
          String(device?.estate_id || req.estateId || 'FPM_TUNGGAL').toUpperCase(),
          req.user?.user_metadata?.operator_name || 'Pentadbir'
        );
        processedMessage = 'Peranti telah berjaya diluluskan untuk akses penuh aplikasi iPDS!';
        isSuccess = true;
      } else {
        await deviceSecurityService.revokeDevice(
          deviceId,
          req.user?.user_metadata?.operator_name || 'Pentadbir',
          'Disekat oleh Pentadbir'
        );
        processedMessage = 'Peranti telah disekat serta-merta daripada mengakses sistem.';
        isSuccess = true;
      }
    }

    const updatedDevice = await deviceSecurityService.getDeviceStatus(deviceId) || device;
    const status = updatedDevice?.status || 'PENDING';

    return res.send(`
      <!DOCTYPE html>
      <html lang="ms">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>iPDS — Kelulusan Peranti FC</title>
        <style>
          * { box-sizing: border-box; }
          body {
            background: #031315;
            color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .card {
            background: linear-gradient(180deg, #092629 0%, #05191b 100%);
            border: 1px solid rgba(16, 185, 129, 0.4);
            border-radius: 24px;
            padding: 28px;
            max-width: 440px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
            text-align: center;
          }
          .badge-top {
            display: inline-block;
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            padding: 4px 12px;
            border-radius: 9999px;
            margin-bottom: 16px;
          }
          h1 {
            font-size: 20px;
            font-weight: 800;
            margin: 0 0 8px 0;
            color: #ffffff;
            letter-spacing: 0.5px;
          }
          .subtitle {
            font-size: 13px;
            color: #94a3b8;
            margin: 0 0 20px 0;
            line-height: 1.5;
          }
          .device-box {
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 16px;
            padding: 16px;
            text-align: left;
            margin-bottom: 20px;
            font-size: 13px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
          }
          .row:last-child { border-bottom: none; }
          .label { color: #94a3b8; font-size: 12px; }
          .value { font-weight: 700; color: #f1f5f9; }
          .val-id { font-family: monospace; color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 2px 6px; border-radius: 6px; }
          .status-approved { color: #34d399; font-weight: 800; background: rgba(16, 185, 129, 0.15); padding: 2px 8px; border-radius: 6px; }
          .status-pending { color: #fbbf24; font-weight: 800; background: rgba(251, 191, 36, 0.15); padding: 2px 8px; border-radius: 6px; }
          .status-revoked { color: #f87171; font-weight: 800; background: rgba(239, 68, 68, 0.15); padding: 2px 8px; border-radius: 6px; }
          .alert-success {
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid rgba(16, 185, 129, 0.5);
            color: #6ee7b7;
            padding: 12px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 20px;
          }
          .alert-error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.5);
            color: #fca5a5;
            padding: 12px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 20px;
          }
          .pin-input {
            width: 100%;
            background: #020d0f;
            border: 1px solid rgba(16, 185, 129, 0.4);
            border-radius: 12px;
            padding: 12px;
            font-size: 18px;
            text-align: center;
            font-weight: 800;
            letter-spacing: 4px;
            color: #34d399;
            margin-bottom: 12px;
            outline: none;
          }
          .pin-input:focus { border-color: #34d399; box-shadow: 0 0 10px rgba(52, 211, 153, 0.3); }
          .btn-approve {
            width: 100%;
            background: #10b981;
            color: #021a1d;
            border: none;
            border-radius: 12px;
            padding: 14px;
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          }
          .btn-approve:hover { background: #34d399; transform: translateY(-1px); }
          .btn-revoke {
            width: 100%;
            background: transparent;
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.4);
            border-radius: 12px;
            padding: 10px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            cursor: pointer;
            margin-top: 10px;
          }
          .btn-revoke:hover { background: rgba(239, 68, 68, 0.1); }
          .btn-home {
            display: inline-block;
            margin-top: 16px;
            color: #94a3b8;
            font-size: 12px;
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge-top">iPDS KESELAMATAN PERANTI</span>
          <h1>Pengurusan Kelulusan Peranti</h1>
          <p class="subtitle">Portal Kelulusan Pantas untuk Pengurus / Field Controller (FC)</p>

          ${processedMessage ? `<div class="${isSuccess ? 'alert-success' : 'alert-error'}">${isSuccess ? '✓' : '✕'} ${processedMessage}</div>` : ''}

          <div class="device-box">
            <div class="row">
              <span class="label">Nama Peranti:</span>
              <span class="value">${updatedDevice?.device_name || 'Peranti Baharu'}</span>
            </div>
            <div class="row">
              <span class="label">ID Peranti:</span>
              <span class="val-id">${deviceId}</span>
            </div>
            <div class="row">
              <span class="label">Pengendali:</span>
              <span class="value">${updatedDevice?.operator_name || 'Staf Ladang'}</span>
            </div>
            <div class="row">
              <span class="label">Ladang:</span>
              <span class="value">${updatedDevice?.estate_id || 'FPM_TUNGGAL'}</span>
            </div>
            <div class="row">
              <span class="label">Status Semasa:</span>
              <span class="value ${status === 'APPROVED' ? 'status-approved' : status === 'REVOKED' ? 'status-revoked' : 'status-pending'}">
                ${status === 'APPROVED' ? '✓ DILULUSKAN' : status === 'REVOKED' ? '✕ DISEKAT' : '⌛ MENUNGGU KELULUSAN'}
              </span>
            </div>
            ${updatedDevice?.approved_by ? `
            <div class="row">
              <span class="label">Diluluskan Oleh:</span>
              <span class="value">${updatedDevice.approved_by}</span>
            </div>` : ''}
          </div>

          ${status === 'PENDING' ? `
            <form method="GET" action="/api/devices/quick-approve">
              <input type="hidden" name="deviceId" value="${deviceId}" />
              <input type="hidden" name="action" value="approve" />
              <button type="submit" class="btn-approve">
                Luluskan Peranti Ini Sekarang
              </button>
            </form>

            <form method="GET" action="/api/devices/quick-approve" onsubmit="return confirm('Adakah anda pasti mahu menyekat peranti ini?');">
              <input type="hidden" name="deviceId" value="${deviceId}" />
              <input type="hidden" name="action" value="revoke" />
              <button type="submit" class="btn-revoke">
                Tolak / Sekat Peranti Ini
              </button>
            </form>
          ` : `
            <a href="/" class="btn-approve" style="display: block; text-decoration: none;">
              Buka Sistem iPDS
            </a>
          `}

          <div>
            <a href="/" class="btn-home">Kembali ke Menu Utama</a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send('Ralat sistem semasa memproses peranti.');
  }
});

/**
 * POST /api/devices/approve-direct
 * 1-step direct approval for an authenticated, authorized device administrator.
 * P0-07: no hardcoded PIN is accepted; authorization is derived from the session.
 */
router.post('/approve-direct', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const { deviceId, approverName } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan' });
    }

    const existing = await deviceSecurityService.getDeviceStatus(deviceId);
    if (existing && !enforceDeviceEstate(req, res, String(existing.estate_id || '').toUpperCase())) {
      return;
    }

    const updated = await deviceSecurityService.approveDevice(
      deviceId,
      approverName || req.user?.user_metadata?.operator_name || 'Pentadbir',
      req.authRole || 'fc'
    );

    // P0-16C.2: grant ACTIVE access for this device's estate only.
    await grantDeviceEstateAccess(deviceId, String(existing?.estate_id || req.estateId || 'FPM_TUNGGAL').toUpperCase(), approverName || req.user?.user_metadata?.operator_name || 'Pentadbir');

    return res.json({
      success: true,
      message: 'Peranti berjaya diluluskan!',
      device: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Ralat meluluskan peranti' });
  }
});

/**
 * P0-16C.2: device estate access management (admin-only).
 *
 * A device may be authorized for one or many estates independently. Global
 * device APPROVED status is a separate concern; these endpoints grant/revoke
 * exactly one device + estate pair and never change registered_devices.status.
 */
router.get('/device-estate-access', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const deviceId = String((req.query.deviceId as string) || '').trim();
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan' });
    }
    const device = await deviceSecurityService.getDeviceStatus(deviceId);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Peranti tidak dijumpai' });
    }
    const all = await listDeviceEstateAccess(deviceId);
    // The actor may only see estates they are allowed to administer.
    const access = all.filter((a) => actorCanAdministerEstate(req, a.estate_id));
    return res.json({ success: true, deviceId, access });
  } catch {
    return res.status(500).json({ success: false, error: 'Ralat mendapatkan akses ladang peranti' });
  }
});

router.post('/device-estate-access', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const deviceId = String((req.body?.deviceId as string) || '').trim();
    const estateId = String((req.body?.estateId || req.body?.estate_id) as string || '').trim().toUpperCase();
    if (!deviceId || !estateId) {
      return res.status(400).json({ success: false, error: 'Device ID dan Estate diperlukan' });
    }
    if (!isValidEstateId(estateId)) {
      return res.status(400).json({ success: false, error: 'Ladang tidak sah' });
    }
    // Actor must be allowed to administer the TARGET estate.
    if (!enforceDeviceEstate(req, res, estateId)) return;

    const device = await deviceSecurityService.getDeviceStatus(deviceId);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Peranti tidak dijumpai' });
    }

    const actor = req.user?.user_metadata?.operator_name || 'Pentadbir';
    const granted = await grantDeviceEstateAccess(deviceId, estateId, actor);
    if (!granted) {
      return res.status(503).json({ success: false, error: 'Gagal memberi akses ladang peranti' });
    }
    return res.json({ success: true, access: granted });
  } catch {
    return res.status(500).json({ success: false, error: 'Ralat memberi akses ladang peranti' });
  }
});

router.delete('/device-estate-access', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const deviceId = String((req.query.deviceId as string) || (req.body?.deviceId as string) || '').trim();
    const estateId = String((req.query.estateId || req.body?.estateId || req.body?.estate_id) as string || '').trim().toUpperCase();
    if (!deviceId || !estateId) {
      return res.status(400).json({ success: false, error: 'Device ID dan Estate diperlukan' });
    }
    if (!isValidEstateId(estateId)) {
      return res.status(400).json({ success: false, error: 'Ladang tidak sah' });
    }
    // Actor must be allowed to administer the TARGET estate.
    if (!enforceDeviceEstate(req, res, estateId)) return;

    const actor = req.user?.user_metadata?.operator_name || 'Pentadbir';
    const revoked = await revokeDeviceEstateAccess(deviceId, estateId, actor);
    if (!revoked) {
      return res.status(404).json({ success: false, error: 'Akses ladang peranti tidak dijumpai' });
    }
    return res.json({ success: true, message: 'Akses ladang peranti dibatalkan' });
  } catch {
    return res.status(500).json({ success: false, error: 'Ralat membatalkan akses ladang peranti' });
  }
});

/**
 * POST /api/devices/rotate-credential
 *
 * P0-16C.4: issue/rotate a cryptographic credential for an EXISTING approved
 * device (used to roll out credentials to devices approved before hashing).
 *
 * Security properties:
 *   - requires an authenticated device administrator (requireDeviceAdmin);
 *   - the device's estate is resolved from the authoritative registered_devices
 *     row (never from the request body/query);
 *   - the actor must be authorized for that estate (enforceDeviceEstate) and the
 *     service re-checks the same boundary (defense in depth);
 *   - only APPROVED devices may be rotated (PENDING/BLOCKED/REVOKED fail closed);
 *   - only the SHA-256 hash is persisted; the plaintext is returned ONCE;
 *   - the credential is never logged, placed in a URL, or written to audit data;
 *   - registered_devices.status, estate_id and device_estate_access are untouched.
 */
router.post('/rotate-credential', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const deviceId = String(req.body?.deviceId || req.body?.device_id || '').trim();
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID diperlukan', code: 'DEVICE_ID_REQUIRED' });
    }

    // Authoritative device lookup — estate is NOT taken from the client.
    const device = await getRegisteredDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Peranti tidak dijumpai', code: 'DEVICE_NOT_FOUND' });
    }

    const deviceEstate = String(device.estate_id || '').trim().toUpperCase();
    if (!enforceDeviceEstate(req, res, deviceEstate)) return;

    const actor = {
      name: req.user?.user_metadata?.operator_name || 'Pentadbir',
      role: req.authRole,
      estateId: req.estateId
    };

    const result = await issueExistingDeviceCredential(deviceId, actor);
    if (!result.ok) {
      switch (result.code) {
        case 'UNKNOWN_DEVICE':
          return res.status(404).json({ success: false, error: 'Peranti tidak dijumpai', code: 'DEVICE_NOT_FOUND' });
        case 'DEVICE_NOT_APPROVED':
          return res.status(409).json({ success: false, error: 'Hanya peranti DILULUSKAN boleh diputar kredensialnya.', code: 'DEVICE_NOT_APPROVED' });
        case 'UNAUTHORIZED_ACTOR':
          return res.status(403).json({ success: false, error: 'Akses dinafikan: anda tidak dibenarkan mengurus peranti ladang ini.', code: 'FORBIDDEN_ESTATE' });
        case 'INVALID_ESTATE':
          return res.status(422).json({ success: false, error: 'Ladang peranti tidak sah.', code: 'INVALID_ESTATE' });
        case 'CONFLICT':
          return res.status(409).json({ success: false, error: 'Ralat persaingan putaran kredensial. Sila cuba lagi.', code: 'CREDENTIAL_ROTATION_CONFLICT' });
        default:
          return res.status(503).json({ success: false, error: 'Storan kredensial tidak tersedia.', code: 'CREDENTIAL_STORE_UNAVAILABLE' });
      }
    }

    // Audit WITHOUT any credential material.
    auditService.record({
      action: 'DEVICE_CREDENTIAL_ROTATED',
      resource: 'devices',
      resourceId: deviceId,
      userId: req.user?.app_metadata?.operator_id,
      userName: actor.name || 'Pentadbir',
      role: req.authRole,
      authorizedEstate: deviceEstate,
      result: 'SUCCESS',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      details: { credentialVersion: result.credentialVersion, estateId: result.estateId }
    });

    return res.json({
      success: true,
      deviceId,
      estateId: result.estateId,
      credentialVersion: result.credentialVersion,
      rotatedAt: result.rotatedAt,
      deviceCredential: result.credential,
      credentialNotice: 'Simpan kredensial peranti ini. Ia dipaparkan sekali sahaja dan tidak boleh diperoleh semula.'
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Ralat memutar kredensial peranti' });
  }
});

/**
 * POST /api/devices/rotate-credential-bulk
 *
 * P1 operational bulk rotation with idempotency. Accepts an explicit device
 * list and a caller-supplied operation_id. Reuses the existing authorization
 * (requireDeviceAdmin + per-device estate check inside issueExistingDeviceCredential)
 * and never changes P0 behavior or strict-enforcement settings.
 *
 * Only devices in the requested list are processed. Plaintext credentials are
 * returned ONCE for devices rotated in this call and are never persisted/logged.
 */
router.post('/rotate-credential-bulk', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const operationId = String(req.body?.operationId || req.body?.operation_id || '').trim();
    const rawIds = Array.isArray(req.body?.deviceIds)
      ? req.body.deviceIds
      : Array.isArray(req.body?.device_ids)
        ? req.body.device_ids
        : null;

    if (!rawIds) {
      return res.status(400).json({ success: false, error: 'Senarai deviceIds diperlukan.', code: 'DEVICE_LIST_REQUIRED' });
    }

    const actor = {
      name: req.user?.user_metadata?.operator_name || 'Pentadbir',
      role: req.authRole,
      estateId: req.estateId
    };

    const outcome = await runBulkDeviceCredentialRotation({ operationId, deviceIds: rawIds, actor });

    if (!outcome.ok) {
      const status =
        outcome.code === 'STORE_UNAVAILABLE' ? 503 :
        outcome.code === 'OPERATION_SCOPE_MISMATCH' ? 409 :
        400;
      return res.status(status).json({
        success: false,
        error: outcome.error,
        code: outcome.code,
        operationId: outcome.operationId,
        enforcementActive: outcome.enforcementActive,
        enforcementState: outcome.enforcementState
      });
    }

    return res.json({
      success: true,
      operationId: outcome.operationId,
      resumed: outcome.resumed,
      resumedFrom: outcome.resumedFrom,
      aborted: outcome.aborted,
      abortReason: outcome.abortReason,
      idempotencyRecorded: outcome.idempotencyRecorded,
      // Distinct operational states — never conflate rotation with enforcement.
      credentialRotationState: outcome.summary && outcome.summary.rotated > 0
        ? 'CREDENTIAL_ROTATED'
        : 'CREDENTIAL_NOT_ROTATED',
      enforcementActive: outcome.enforcementActive,
      enforcementState: outcome.enforcementState,
      summary: outcome.summary,
      results: outcome.results,
      credentialNotice:
        'Kredensial peranti dipaparkan SEKALI sahaja dan tidak boleh diperoleh semula. ' +
        'Simpan dengan selamat. Jika respons hilang, jangan ulang operasi yang sama — mulakan operation_id BAHARU untuk menerbitkan semula. '
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Ralat memproses putaran kredensial pukal', code: 'BULK_ROTATION_ERROR' });
  }
});

/**
 * GET /api/devices/merge-candidates
 * Sanitized device list for the merge UI. NEVER returns credential material;
 * credential_present is a boolean only.
 */
router.get('/merge-candidates', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const requestedEstate = resolveRequestedEstate(req);
    if (!enforceDeviceEstate(req, res, requestedEstate)) return;
    const estateId = requestedEstate === 'ALL' ? undefined : requestedEstate;
    const devices = await deviceSecurityService.listDevices(estateId);
    return res.json({ success: true, devices: devices.map(toSafeMergeCandidate) });
  } catch {
    return res.status(500).json({ success: false, error: 'Ralat memuatkan calon gabungan', code: 'MERGE_CANDIDATES_ERROR' });
  }
});

/**
 * POST /api/devices/merge
 * Operator-confirmed soft-merge. Reuses requireAuth + requireDeviceAdmin and the
 * canonical-per-estate boundary; the atomic work runs in the SQL function
 * merge_registered_devices. Never deletes rows, never touches credential_hash.
 */
router.post('/merge', requireAuth, requireDeviceAdmin, async (req: Request, res: Response) => {
  try {
    const canonicalDeviceId = String(req.body?.canonicalDeviceId || req.body?.canonical_device_id || '').trim();
    const rawDuplicates = req.body?.duplicateDeviceIds ?? req.body?.duplicate_device_ids;
    const duplicateDeviceIds = Array.isArray(rawDuplicates) ? rawDuplicates : [];
    const providedOp = String(req.body?.operationId || req.body?.operation_id || '').trim();
    const operationId = providedOp || `MERGE-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (!canonicalDeviceId) {
      return res.status(400).json({ success: false, error: 'Peranti kanonikal diperlukan.', code: 'CANONICAL_REQUIRED' });
    }

    const canonical = await getRegisteredDeviceById(canonicalDeviceId);
    if (!canonical) {
      return res.status(404).json({ success: false, error: 'Peranti kanonikal tidak dijumpai.', code: 'CANONICAL_NOT_FOUND' });
    }
    if (!enforceDeviceEstate(req, res, String(canonical.estate_id || '').toUpperCase())) return;

    const actor = {
      name: req.user?.user_metadata?.operator_name || 'Pentadbir',
      role: req.authRole,
      estateId: req.estateId
    };

    const result = await mergeDevices({ operationId, canonicalDeviceId, duplicateDeviceIds, actor });

    if (!result.ok) {
      const status =
        result.code === 'CANONICAL_NOT_FOUND' || result.code === 'DUPLICATE_NOT_FOUND' ? 404 :
        result.code === 'CROSS_ESTATE' || result.code === 'DUPLICATE_ALREADY_MERGED' || result.code === 'CANONICAL_IS_DUPLICATE' ? 409 :
        result.code === 'DB_UNAVAILABLE' ? 503 :
        400;
      return res.status(status).json({ success: false, error: result.error, code: result.code, operationId: result.operationId });
    }

    return res.json({
      success: true,
      operationId: result.operationId,
      canonicalDeviceId: result.canonicalDeviceId,
      estateId: result.estateId,
      mergedDuplicateIds: result.mergedDuplicateIds,
      alreadyMergedIds: result.alreadyMergedIds,
      mergedAt: result.mergedAt,
      idempotent: result.idempotent,
      message: 'Peranti duplikat kini REVOKED dan dihalakan ke peranti kanonikal.'
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Ralat menggabungkan peranti', code: 'MERGE_ERROR' });
  }
});

export default router;
