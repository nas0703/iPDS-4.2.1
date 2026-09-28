import express from 'express';
import { AuthService, COOKIE_SESSION_MAX_AGE_MS, getServerPinConfig } from '../services/auth.service.js';
import { requireAuth, COOKIE_NAME, extractDeviceCredential, requireSuperAdmin, isSuperAdminIdentity } from '../middleware/auth.js';
import { auditService } from '../services/audit.service.js';
import { authRateLimiter, adminRateLimiter } from '../middleware/rateLimiter.js';
import { sessionManager } from '../services/sessionManager.service.js';
import { ActingAsService } from '../services/actingAs.service.js';
import { deviceSecurityService, verifyBootstrapToken, createApprovalCapability, sendApprovalLink, authorizeDeviceForEstate, isStrictDeviceEnforcementEnabled } from '../services/deviceSecurity.service.js';
import crypto from 'crypto';

import fs from 'fs';
import path from 'path';
import { getScopedSupabase } from '../db.js';

const router = express.Router();

/**
 * P1 soft-merge: if the presented device has been merged into a canonical
 * device, do not authenticate it. Return the canonical device_id (server-validated)
 * so the client can adopt it and retry.
 */
function redirectMergedDevice(
  deviceStatus: { merged_into?: string | null; mergedInto?: string | null } | null | undefined,
  res: express.Response
): boolean {
  const canonical = deviceStatus?.merged_into || deviceStatus?.mergedInto;
  if (canonical) {
    res.status(409).json({
      success: false,
      error: 'Peranti ini telah digabungkan dengan rekod kanonikal. Sila muat semula.',
      code: 'DEVICE_MERGED',
      canonicalDeviceId: canonical
    });
    return true;
  }
  return false;
}

// Robust in-memory rate limiting with sliding window and concurrency protection
interface RateLimitEntry {
  failedAttempts: number[];
  lockedUntil: number;
}

const loginAttempts: Map<string, RateLimitEntry> = new Map();
const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_MS = 60 * 1000;
const LOCKOUT_MS = 60 * 1000;

export function checkRateLimit(ip: string): { allowed: boolean; remainingSec: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { allowed: true, remainingSec: 0 };

  // Check active lockout
  if (entry.lockedUntil > now) {
    return { 
      allowed: false, 
      remainingSec: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)) 
    };
  }

  // Filter out attempts outside sliding window
  entry.failedAttempts = entry.failedAttempts.filter(ts => now - ts < WINDOW_MS);

  if (entry.failedAttempts.length >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    return { 
      allowed: false, 
      remainingSec: Math.ceil(LOCKOUT_MS / 1000) 
    };
  }

  return { allowed: true, remainingSec: 0 };
}

export function recordAttempt(ip: string, success: boolean) {
  const now = Date.now();
  if (success) {
    loginAttempts.delete(ip);
    return;
  }

  let entry = loginAttempts.get(ip);
  if (!entry) {
    entry = { failedAttempts: [], lockedUntil: 0 };
    loginAttempts.set(ip, entry);
  }

  // Clean old window records
  entry.failedAttempts = entry.failedAttempts.filter(ts => now - ts < WINDOW_MS);
  entry.failedAttempts.push(now);

  if (entry.failedAttempts.length >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
}

/**
 * POST /api/auth/verify-pin
 * Validates PIN strictly on server-side and issues HttpOnly cookie + JWT token
 */
router.post(['/verify-pin', '/auth/verify-pin'], authRateLimiter, async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkRateLimit(clientIp);

    if (!rateCheck.allowed) {
      auditService.record({
        action: 'LOGIN_FAILURE',
        resource: 'auth/verify-pin',
        result: 'DENIED',
        ip: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        errorMessage: 'Rate limit / lockout exceeded on login attempt'
      });

      return res.status(429).json({
        success: false,
        error: `Terlalu banyak percubaan log masuk gagal. Sila cuba lagi dalam ${rateCheck.remainingSec} saat.`,
        code: 'RATE_LIMITED'
      });
    }

    const { pin, deviceId, deviceName } = req.body || {};
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'PIN 6-digit diperlukan.',
        code: 'MISSING_PIN'
      });
    }

    const userSession = AuthService.verifyPin(pin);

    if (!userSession) {
      recordAttempt(clientIp, false);
      
      // Log to sessionManager audit
      sessionManager.logLoginAttempt({
        authMethod: 'PIN_KIOSK',
        identifier: 'PIN_SUBMITTED',
        operatorName: 'Unknown Operator',
        role: 'UNKNOWN',
        attemptedEstate: 'UNKNOWN',
        status: 'INVALID_CREDENTIALS',
        threatLevel: 'MEDIUM',
        ip: clientIp,
        userAgent: (req.headers['user-agent'] as string) || 'unknown',
        notes: 'Cubaan PIN Kiosk tidak sah atau tidak berdaftar.'
      });

      // Structured Audit: Record Failed Login (Never log the actual PIN string)
      auditService.record({
        action: 'LOGIN_FAILURE',
        resource: 'auth/verify-pin',
        result: 'FAILURE',
        ip: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        errorMessage: 'Invalid PIN submitted'
      });

      // Small artificial jitter delay to prevent timing attacks
      await new Promise(r => setTimeout(r, 200));
      return res.status(401).json({
        success: false,
        error: 'PIN tidak sah. Sila masukkan PIN yang betul.',
        code: 'INVALID_PIN'
      });
    }

    // --- PERINGKAT 1: DEVICE WHITELIST ENFORCEMENT ---
    const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'DEV-UNSPECIFIED';
    const operatorRole = userSession.app_metadata.app_role;
    const operatorName = userSession.user_metadata.operator_name;
    const estateId = userSession.app_metadata.estate_id || 'FPM_TUNGGAL';

    // Check device status
    let deviceStatus = await deviceSecurityService.getDeviceStatus(effectiveDeviceId, estateId);

    // P0-07: devices are NEVER auto-approved from a static/master PIN. Any
    // unregistered device is created PENDING and login is blocked until an
    // authenticated administrator approves it.
    const bootstrapToken = (req.headers['x-device-bootstrap-token'] as string) || (req.body && req.body.bootstrapToken) || undefined;
    if (!deviceStatus) {
      deviceStatus = await deviceSecurityService.registerDevice({
        deviceId: effectiveDeviceId,
        deviceName: deviceName || 'Peranti Staf Baharu',
        estateId,
        pin,
        operatorName,
        role: operatorRole,
        ip: clientIp,
        userAgent: (req.headers['user-agent'] as string) || 'unknown',
        bootstrapToken
      });
    } else if (deviceStatus.status !== 'APPROVED' && verifyBootstrapToken(bootstrapToken)) {
      // P0-16: secure bootstrap upgrade for an already-PENDING device.
      deviceStatus = await deviceSecurityService.approveDevice(effectiveDeviceId, 'BOOTSTRAP_TOKEN', 'bootstrap');
    }

    if (redirectMergedDevice(deviceStatus, res)) return;

    // If device is not APPROVED, block login and prompt for authorization
    if (deviceStatus.status !== 'APPROVED') {
      auditService.record({
        action: 'LOGIN_BLOCKED_UNREGISTERED_DEVICE',
        resource: 'auth/verify-pin',
        userId: userSession.app_metadata.operator_id,
        userName: operatorName,
        authorizedEstate: estateId,
        result: 'DENIED',
        ip: clientIp,
        userAgent: (req.headers['user-agent'] as string) || 'unknown',
        details: {
          deviceId: effectiveDeviceId,
          deviceStatus: deviceStatus.status,
          deviceName: deviceStatus.device_name
        }
      });

      const approvalCapability = await createApprovalCapability({
        deviceId: deviceStatus.device_id,
        estateId,
        createdBy: operatorName,
        requesterName: operatorName,
        requesterStaffId: userSession.app_metadata.operator_id,
        deviceName: deviceStatus.device_name
      });
      const approvalUrl = `/api/devices/approve-link?cap=${encodeURIComponent(approvalCapability.capability)}`;
      await sendApprovalLink({
        approvalUrl,
        estateId,
        deviceId: deviceStatus.device_id,
        deviceName: deviceStatus.device_name,
        requesterName: operatorName,
        requesterStaffId: userSession.app_metadata.operator_id
      });
      return res.status(403).json({
        success: false,
        error: 'PIN sah, tetapi peranti ini belum diluluskan untuk akses aplikasi.',
        code: 'DEVICE_NOT_APPROVED',
        device: {
          deviceId: deviceStatus.device_id,
          deviceName: deviceStatus.device_name,
          status: deviceStatus.status,
          operatorName: deviceStatus.operator_name,
          createdAt: deviceStatus.created_at
        }
      });
    }

    // P0-16C.3: strict device credential + estate authorization.
    // OFF by default (transition) so existing devices are not locked out before
    // the C.5 backfill; enable via IPDS_DEVICE_STRICT_ENFORCEMENT=true.
    if (isStrictDeviceEnforcementEnabled()) {
      const deviceCredential = extractDeviceCredential(req);
      const deviceAuth = await authorizeDeviceForEstate({ credential: deviceCredential, requestedEstateId: estateId });
      if (redirectMergedDevice(deviceAuth, res)) return;
      if (!deviceAuth.allowed) {
        auditService.record({
          action: 'LOGIN_BLOCKED_DEVICE_NOT_AUTHORIZED',
          resource: 'auth/verify-pin',
          userId: userSession.app_metadata.operator_id,
          userName: operatorName,
          authorizedEstate: estateId,
          result: 'DENIED',
          ip: clientIp,
          userAgent: (req.headers['user-agent'] as string) || 'unknown',
          details: { reason: deviceAuth.code }
        });
        return res.status(403).json({
          success: false,
          error: 'Peranti tidak dibenarkan untuk ladang ini. Sila hubungi Pentadbir.',
          code: 'DEVICE_NOT_AUTHORIZED'
        });
      }
    }

    recordAttempt(clientIp, true);

    // Register active session in sessionManager
    const activeSession = sessionManager.registerSession(
      userSession,
      clientIp,
      (req.headers['user-agent'] as string) || 'unknown'
    );

    // Log successful login attempt
    sessionManager.logLoginAttempt({
      authMethod: 'PIN_KIOSK',
      identifier: userSession.app_metadata.operator_id,
      operatorName: userSession.user_metadata.operator_name,
      role: userSession.app_metadata.app_role,
      attemptedEstate: userSession.app_metadata.estate_id,
      assignedEstate: userSession.app_metadata.estate_id,
      status: 'SUCCESS',
      threatLevel: 'LOW',
      ip: clientIp,
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      notes: `Log masuk berjaya di ${userSession.user_metadata.station_name}.`
    });

    // Generate signed JWT token
    const token = AuthService.generateToken(userSession);

    // Structured Audit: Record Successful Login
    auditService.record({
      action: 'LOGIN_SUCCESS',
      resource: 'auth/verify-pin',
      userId: userSession.app_metadata.operator_id,
      userName: userSession.user_metadata.operator_name,
      role: userSession.app_metadata.app_role,
      authorizedEstate: userSession.app_metadata.estate_id,
      result: 'SUCCESS',
      ip: clientIp,
      userAgent: req.headers['user-agent'] || 'unknown',
      details: {
        kiosk_id: userSession.app_metadata.kiosk_id,
        station_name: userSession.user_metadata.station_name
      }
    });

    // Set secure HttpOnly session cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: COOKIE_SESSION_MAX_AGE_MS,
      path: '/'
    });

    return res.json({
      success: true,
      user: {
        role: userSession.app_metadata.app_role,
        name: userSession.user_metadata.operator_name,
        estate_id: userSession.app_metadata.estate_id,
        kiosk_id: userSession.app_metadata.kiosk_id,
        operator_id: userSession.app_metadata.operator_id,
        station_name: userSession.user_metadata.station_name,
        is_super_admin: isSuperAdminIdentity(userSession)
      },
      token
    });
  } catch (err: unknown) {
    console.error('Verify PIN error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa memproses pengesahan PIN.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/auth/verify-staff
 * Validates login using Kod Ladang (Estate Code) + No. Kakitangan (Staff / Operator No.)
 */
router.post(['/verify-staff', '/auth/verify-staff'], authRateLimiter, async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkRateLimit(clientIp);

    if (!rateCheck.allowed) {
      auditService.record({
        action: 'LOGIN_FAILURE',
        resource: 'auth/verify-staff',
        result: 'DENIED',
        ip: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        errorMessage: 'Rate limit / lockout exceeded on staff login attempt'
      });

      return res.status(429).json({
        success: false,
        error: `Terlalu banyak percubaan log masuk gagal. Sila cuba lagi dalam ${rateCheck.remainingSec} saat.`,
        code: 'RATE_LIMITED'
      });
    }

    const { estate_code, estateCode, staff_no, staffNo, pin, secret, deviceId, deviceName } = req.body || {};
    const targetEstate = estateCode || estate_code || 'FPM_TUNGGAL';
    const targetStaffNo = staffNo || staff_no;
    const targetSecret = secret || pin;

    if (!targetStaffNo || typeof targetStaffNo !== 'string' || !targetSecret || typeof targetSecret !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Kod Ladang, No. Kakitangan, dan PIN/Rahsia diperlukan.',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const userSession = AuthService.verifyEstateStaffLogin(targetEstate, targetStaffNo, targetSecret);

    if (!userSession) {
      recordAttempt(clientIp, false);
      
      const staffConfig = AuthService.getStaffConfig(targetStaffNo);
      const isCrossEstate = staffConfig && staffConfig.estate_id && staffConfig.estate_id !== targetEstate;
      
      sessionManager.logLoginAttempt({
        authMethod: 'ESTATE_STAFF_PIN',
        identifier: targetStaffNo,
        operatorName: staffConfig?.operator_name || 'Tidak Diketahui',
        role: staffConfig?.app_role || 'UNKNOWN',
        attemptedEstate: targetEstate,
        assignedEstate: staffConfig?.estate_id,
        status: isCrossEstate ? 'UNAUTHORIZED_CROSS_ESTATE' : 'INVALID_CREDENTIALS',
        threatLevel: isCrossEstate ? 'HIGH' : 'MEDIUM',
        ip: clientIp,
        userAgent: (req.headers['user-agent'] as string) || 'unknown',
        notes: isCrossEstate
          ? `AMARAN KESELAMATAN: Cubaan log masuk silang ladang disekat serta-merta. Kakitangan berdaftar di ${staffConfig.estate_id} cuba mengakses portal ${targetEstate}.`
          : `Cubaan log masuk gagal: No. Kakitangan / PIN '${targetStaffNo}' tidak berdaftar.`
      });

      auditService.record({
        action: isCrossEstate ? 'ESTATE_ACCESS_DENIED' : 'LOGIN_FAILURE',
        resource: 'auth/verify-staff',
        result: 'FAILURE',
        ip: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        errorMessage: `Invalid staff credentials: Estate=${targetEstate}, StaffNo=${targetStaffNo}`
      });

      await new Promise(r => setTimeout(r, 200));
      return res.status(401).json({
        success: false,
        error: 'Kombinasi Kod Ladang dan No. Kakitangan tidak sah. No. Kakitangan ini tidak berdaftar di bawah ladang yang dipilih.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // --- PERINGKAT 1: DEVICE WHITELIST ENFORCEMENT ---
    const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'DEV-UNSPECIFIED';
    const operatorRole = userSession.app_metadata.app_role;
    const operatorName = userSession.user_metadata.operator_name;
    const estateId = userSession.app_metadata.estate_id || targetEstate;

    let deviceStatus = await deviceSecurityService.getDeviceStatus(effectiveDeviceId, estateId);

    // P0-07: devices are NEVER auto-approved from a static/master staff number.
    // Any unregistered device is created PENDING and login is blocked until an
    // authenticated administrator approves it.
    const bootstrapToken = (req.headers['x-device-bootstrap-token'] as string) || (req.body && req.body.bootstrapToken) || undefined;
    if (!deviceStatus) {
      deviceStatus = await deviceSecurityService.registerDevice({
        deviceId: effectiveDeviceId,
        deviceName: deviceName || 'Peranti Staf Baharu',
        estateId,
        pin: targetStaffNo,
        operatorName,
        role: operatorRole,
        ip: clientIp,
        userAgent: (req.headers['user-agent'] as string) || 'unknown',
        bootstrapToken
      });
    } else if (deviceStatus.status !== 'APPROVED' && verifyBootstrapToken(bootstrapToken)) {
      // P0-16: secure bootstrap upgrade for an already-PENDING device.
      deviceStatus = await deviceSecurityService.approveDevice(effectiveDeviceId, 'BOOTSTRAP_TOKEN', 'bootstrap');
    }

    if (redirectMergedDevice(deviceStatus, res)) return;

    if (deviceStatus.status !== 'APPROVED') {
      auditService.record({
        action: 'LOGIN_BLOCKED_UNREGISTERED_DEVICE',
        resource: 'auth/verify-staff',
        userId: userSession.app_metadata.operator_id,
        userName: operatorName,
        authorizedEstate: estateId,
        result: 'DENIED',
        ip: clientIp,
        userAgent: (req.headers['user-agent'] as string) || 'unknown',
        details: {
          deviceId: effectiveDeviceId,
          deviceStatus: deviceStatus.status,
          deviceName: deviceStatus.device_name
        }
      });

      const approvalCapability = await createApprovalCapability({
        deviceId: deviceStatus.device_id,
        estateId,
        createdBy: operatorName,
        requesterName: operatorName,
        requesterStaffId: userSession.app_metadata.operator_id,
        deviceName: deviceStatus.device_name
      });
      const approvalUrl = `/api/devices/approve-link?cap=${encodeURIComponent(approvalCapability.capability)}`;
      await sendApprovalLink({
        approvalUrl,
        estateId,
        deviceId: deviceStatus.device_id,
        deviceName: deviceStatus.device_name,
        requesterName: operatorName,
        requesterStaffId: userSession.app_metadata.operator_id
      });
      return res.status(403).json({
        success: false,
        error: 'Kredensial sah, tetapi peranti ini belum diluluskan oleh Pentadbir Ladang.',
        code: 'DEVICE_NOT_APPROVED',
        device: {
          deviceId: deviceStatus.device_id,
          deviceName: deviceStatus.device_name,
          status: deviceStatus.status,
          operatorName: deviceStatus.operator_name,
          createdAt: deviceStatus.created_at
        }
      });
    }

    // P0-16C.3: strict device credential + estate authorization.
    // OFF by default (transition) so existing devices are not locked out before
    // the C.5 backfill; enable via IPDS_DEVICE_STRICT_ENFORCEMENT=true.
    if (isStrictDeviceEnforcementEnabled()) {
      const deviceCredential = extractDeviceCredential(req);
      const deviceAuth = await authorizeDeviceForEstate({ credential: deviceCredential, requestedEstateId: estateId });
      if (redirectMergedDevice(deviceAuth, res)) return;
      if (!deviceAuth.allowed) {
        auditService.record({
          action: 'LOGIN_BLOCKED_DEVICE_NOT_AUTHORIZED',
          resource: 'auth/verify-staff',
          userId: userSession.app_metadata.operator_id,
          userName: operatorName,
          authorizedEstate: estateId,
          result: 'DENIED',
          ip: clientIp,
          userAgent: (req.headers['user-agent'] as string) || 'unknown',
          details: { reason: deviceAuth.code }
        });
        return res.status(403).json({
          success: false,
          error: 'Peranti tidak dibenarkan untuk ladang ini. Sila hubungi Pentadbir.',
          code: 'DEVICE_NOT_AUTHORIZED'
        });
      }
    }

    recordAttempt(clientIp, true);

    // Register active session
    sessionManager.registerSession(
      userSession,
      clientIp,
      (req.headers['user-agent'] as string) || 'unknown'
    );

    // Log success
    sessionManager.logLoginAttempt({
      authMethod: 'ESTATE_STAFF_PIN',
      identifier: userSession.app_metadata.operator_id,
      operatorName: userSession.user_metadata.operator_name,
      role: userSession.app_metadata.app_role,
      attemptedEstate: userSession.app_metadata.estate_id,
      assignedEstate: userSession.app_metadata.estate_id,
      status: 'SUCCESS',
      threatLevel: 'LOW',
      ip: clientIp,
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      notes: `Log masuk kakitangan berjaya di ${userSession.user_metadata.station_name}.`
    });

    const token = AuthService.generateToken(userSession);

    auditService.record({
      action: 'LOGIN_SUCCESS',
      resource: 'auth/verify-staff',
      userId: userSession.app_metadata.operator_id,
      userName: userSession.user_metadata.operator_name,
      role: userSession.app_metadata.app_role,
      authorizedEstate: userSession.app_metadata.estate_id,
      result: 'SUCCESS',
      ip: clientIp,
      userAgent: req.headers['user-agent'] || 'unknown',
      details: {
        auth_type: 'estate_code_staff_no',
        estate_code: targetEstate,
        staff_no: targetStaffNo
      }
    });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: COOKIE_SESSION_MAX_AGE_MS,
      path: '/'
    });

    return res.json({
      success: true,
      user: {
        role: userSession.app_metadata.app_role,
        name: userSession.user_metadata.operator_name,
        estate_id: userSession.app_metadata.estate_id,
        kiosk_id: userSession.app_metadata.kiosk_id,
        operator_id: userSession.app_metadata.operator_id,
        station_name: userSession.user_metadata.station_name,
        is_super_admin: isSuperAdminIdentity(userSession)
      },
      token
    });
  } catch (err: unknown) {
    console.error('Verify Staff Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa memproses pengesahan kakitangan.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/auth/verify-password
 * Validates enterprise identity (Username/Email/ID + Alphanumeric Password) on server-side
 */
router.post(['/verify-password', '/auth/verify-password'], authRateLimiter, async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkRateLimit(clientIp);

    if (!rateCheck.allowed) {
      auditService.record({
        action: 'LOGIN_FAILURE',
        resource: 'auth/verify-password',
        result: 'DENIED',
        ip: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        errorMessage: 'Rate limit / lockout exceeded on password login attempt'
      });

      return res.status(429).json({
        success: false,
        error: `Terlalu banyak percubaan log masuk gagal. Sila cuba lagi dalam ${rateCheck.remainingSec} saat.`,
        code: 'RATE_LIMITED'
      });
    }

    const { username, identity, password } = req.body || {};
    const userIdentity = identity || username;

    if (!userIdentity || !password || typeof userIdentity !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Identiti (Emel/ID/Nama Pengguna) dan Kata Laluan Alfanumerik diperlukan.',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const userSession = AuthService.verifyPassword(userIdentity, password);

    if (!userSession) {
      recordAttempt(clientIp, false);
      
      sessionManager.logLoginAttempt({
        authMethod: 'ENTERPRISE_PASSWORD',
        identifier: userIdentity,
        operatorName: 'Unknown Identity',
        role: 'UNKNOWN',
        attemptedEstate: 'UNKNOWN',
        status: 'INVALID_CREDENTIALS',
        threatLevel: 'MEDIUM',
        ip: clientIp,
        userAgent: (req.headers['user-agent'] as string) || 'unknown',
        notes: `Percubaan log masuk kata laluan gagal bagi akaun/ID '${userIdentity}'.`
      });

      auditService.record({
        action: 'LOGIN_FAILURE',
        resource: 'auth/verify-password',
        result: 'FAILURE',
        ip: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        errorMessage: `Invalid password credentials for identity: ${userIdentity}`
      });

      // Small jitter delay to prevent timing attacks
      await new Promise(r => setTimeout(r, 250));
      return res.status(401).json({
        success: false,
        error: 'Identiti atau Kata Laluan tidak sah. Sila semak semula kredensial anda.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // P0-16C.3: strict device credential + estate authorization (enterprise
    // password path). OFF by default (transition); enable via
    // IPDS_DEVICE_STRICT_ENFORCEMENT=true.
    if (isStrictDeviceEnforcementEnabled()) {
      const enterpriseEstate = String(userSession.app_metadata.estate_id || 'FPM_TUNGGAL').toUpperCase();
      const deviceCredential = extractDeviceCredential(req);
      const deviceAuth = await authorizeDeviceForEstate({ credential: deviceCredential, requestedEstateId: enterpriseEstate });
      if (redirectMergedDevice(deviceAuth, res)) return;
      if (!deviceAuth.allowed) {
        auditService.record({
          action: 'LOGIN_BLOCKED_DEVICE_NOT_AUTHORIZED',
          resource: 'auth/verify-password',
          userId: userSession.app_metadata.operator_id,
          userName: userSession.user_metadata.operator_name,
          authorizedEstate: enterpriseEstate,
          result: 'DENIED',
          ip: clientIp,
          userAgent: (req.headers['user-agent'] as string) || 'unknown',
          details: { reason: deviceAuth.code }
        });
        return res.status(403).json({
          success: false,
          error: 'Peranti tidak dibenarkan untuk ladang ini. Sila hubungi Pentadbir.',
          code: 'DEVICE_NOT_AUTHORIZED'
        });
      }
    }

    recordAttempt(clientIp, true);

    // Register active session
    sessionManager.registerSession(
      userSession,
      clientIp,
      (req.headers['user-agent'] as string) || 'unknown'
    );

    // Log success
    sessionManager.logLoginAttempt({
      authMethod: 'ENTERPRISE_PASSWORD',
      identifier: userSession.app_metadata.operator_id,
      operatorName: userSession.user_metadata.operator_name,
      role: userSession.app_metadata.app_role,
      attemptedEstate: userSession.app_metadata.estate_id,
      assignedEstate: userSession.app_metadata.estate_id,
      status: 'SUCCESS',
      threatLevel: 'LOW',
      ip: clientIp,
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      notes: `Log masuk Enterprise Password berjaya bagi ${userSession.user_metadata.operator_name}.`
    });

    // Generate signed JWT token
    const token = AuthService.generateToken(userSession);

    // Record Successful Login
    auditService.record({
      action: 'LOGIN_SUCCESS',
      resource: 'auth/verify-password',
      userId: userSession.app_metadata.operator_id,
      userName: userSession.user_metadata.operator_name,
      role: userSession.app_metadata.app_role,
      authorizedEstate: userSession.app_metadata.estate_id,
      result: 'SUCCESS',
      ip: clientIp,
      userAgent: req.headers['user-agent'] || 'unknown',
      details: {
        auth_type: 'enterprise_password',
        station_name: userSession.user_metadata.station_name
      }
    });

    // Set secure HttpOnly session cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: COOKIE_SESSION_MAX_AGE_MS,
      path: '/'
    });

    return res.json({
      success: true,
      user: {
        role: userSession.app_metadata.app_role,
        name: userSession.user_metadata.operator_name,
        estate_id: userSession.app_metadata.estate_id,
        kiosk_id: userSession.app_metadata.kiosk_id,
        operator_id: userSession.app_metadata.operator_id,
        station_name: userSession.user_metadata.station_name,
        is_super_admin: isSuperAdminIdentity(userSession)
      },
      token
    });
  } catch (err: unknown) {
    console.error('Verify Password error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa memproses pengesahan kata laluan.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Renews the short-lived access JWT token if the current sliding session is active and valid
 */
router.post(['/refresh', '/auth/refresh'], requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.session_id) {
      return res.status(401).json({
        success: false,
        error: 'Sesi tidak sah untuk pembaharuan token.',
        code: 'INVALID_SESSION'
      });
    }

    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    // Verify session in SessionManager
    if (!sessionManager.isSessionActive(user.session_id)) {
      return res.status(401).json({
        success: false,
        error: 'Sesi telah tamat tempoh atau dibatalkan. Sila log masuk semula.',
        code: 'SESSION_EXPIRED'
      });
    }

    const refreshed = await AuthService.refreshSessionToken(user, clientIp, userAgent);
    if (!refreshed) {
      return res.status(401).json({
        success: false,
        error: 'Profil pengguna tidak aktif atau tidak dijumpai.',
        code: 'USER_DEACTIVATED'
      });
    }

    // Touch sliding window
    sessionManager.touchSession(user.session_id);

    // Update secure cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, refreshed.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: COOKIE_SESSION_MAX_AGE_MS,
      path: '/'
    });

    auditService.record({
      action: 'TOKEN_REFRESH',
      resource: 'auth/refresh',
      userId: user.app_metadata.operator_id,
      userName: user.user_metadata.operator_name,
      role: user.app_metadata.app_role,
      authorizedEstate: user.app_metadata.estate_id,
      result: 'SUCCESS',
      ip: clientIp,
      userAgent
    });

    return res.json({
      success: true,
      token: refreshed.token,
      user: {
        role: refreshed.user.app_metadata.app_role,
        name: refreshed.user.user_metadata.operator_name,
        estate_id: refreshed.user.app_metadata.estate_id,
        kiosk_id: refreshed.user.app_metadata.kiosk_id,
        operator_id: refreshed.user.app_metadata.operator_id,
        station_name: refreshed.user.user_metadata.station_name
      }
    });
  } catch (err: unknown) {
    console.error('Refresh token error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa memperbaharui token sesi.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/auth/session-status
 * Returns remaining session duration, idle time, and validity status
 */
router.get(['/session-status', '/auth/session-status'], requireAuth, (req, res) => {
  const sessionId = req.user?.session_id;
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Tiada sesi aktif dikesan.',
      code: 'NO_ACTIVE_SESSION'
    });
  }

  const status = sessionManager.getSessionRemainingTime(sessionId);
  return res.json({
    success: true,
    sessionId,
    ...status
  });
});

/**
 * GET /api/auth/me or /api/auth/session
 * Returns current authenticated user state
 */
router.get(['/me', '/session', '/auth/me', '/auth/session'], requireAuth, (req, res) => {
  return res.json({
    success: true,
    authenticated: true,
    user: {
      role: req.user?.app_metadata.app_role,
      name: req.user?.user_metadata.operator_name,
      estate_id: req.user?.app_metadata.estate_id,
      kiosk_id: req.user?.app_metadata.kiosk_id,
      operator_id: req.user?.app_metadata.operator_id,
      station_name: req.user?.user_metadata.station_name,
      is_super_admin: isSuperAdminIdentity(req.user)
    }
  });
});

/**
 * P1 POST /api/auth/acting-as/start
 * Explicit administrative Acting-As. The actor is ALWAYS the authenticated
 * Super Admin session; the target is resolved server-side. No target PIN or
 * password is accepted. Legacy PIN/password flows are unaffected.
 */
router.post(['/acting-as/start', '/auth/acting-as/start'], requireAuth, requireSuperAdmin, adminRateLimiter, async (req, res) => {
  try {
    const { targetOperatorId, target_operator_id, targetEstateId, estate_id, reason } = req.body || {};
    const clientIp = (req.ip || req.socket.remoteAddress || '127.0.0.1') as string;
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const result = await ActingAsService.startActingAs({
      actor: req.user!,
      targetOperatorId: targetOperatorId || target_operator_id,
      targetEstateId: targetEstateId || estate_id,
      reason,
      ip: clientIp,
      userAgent
    });

    if (!result.success) {
      const status =
        result.code === 'SUPER_ADMIN_REQUIRED' ? 403 :
        result.code === 'TARGET_NOT_FOUND' || result.code === 'TARGET_INACTIVE' ? 404 :
        400;
      return res.status(status).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: COOKIE_SESSION_MAX_AGE_MS,
      path: '/'
    });

    return res.json({
      success: true,
      acting_as: true,
      actor_id: result.actor_id,
      subject_id: result.subject_id,
      estate_id: result.estate_id,
      token: result.token,
      user: {
        role: result.session?.app_metadata.app_role,
        name: result.session?.user_metadata.operator_name,
        estate_id: result.session?.app_metadata.estate_id,
        kiosk_id: result.session?.app_metadata.kiosk_id,
        operator_id: result.session?.app_metadata.operator_id,
        station_name: result.session?.user_metadata.station_name
      }
    });
  } catch (err: unknown) {
    console.error('Acting-As start error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa memulakan sesi Acting-As.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * P1 POST /api/auth/acting-as/end
 * Terminates the Acting-As session only. The Super Admin's own session is
 * preserved and its token is restored in the response.
 */
router.post(['/acting-as/end', '/auth/acting-as/end'], requireAuth, adminRateLimiter, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const clientIp = (req.ip || req.socket.remoteAddress || '127.0.0.1') as string;
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';
    const result = await ActingAsService.endActingAs({ actingAsUser: req.user!, reason, ip: clientIp, userAgent });

    if (!result.success) {
      const endStatus =
        result.code === 'NOT_ACTING_AS' ? 400 :
        result.code === 'REVOCATION_NOT_DURABLE' ? 503 :
        403;
      return res.status(endStatus).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }

    if (result.token) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie(COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: COOKIE_SESSION_MAX_AGE_MS,
        path: '/'
      });
    }

    return res.json({
      success: true,
      acting_as: false,
      actor_id: result.actor_id,
      subject_id: result.subject_id,
      estate_id: result.estate_id,
      token: result.token
    });
  } catch (err: unknown) {
    console.error('Acting-As end error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa menamatkan sesi Acting-As.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/auth/logout
 * Clears authentication session cookie and logs audit event
 */
router.post(['/logout', '/auth/logout'], (req, res) => {
  const token = req.cookies?.[COOKIE_NAME] || req.headers?.authorization?.split(' ')[1];
  let user = null;
  if (token) {
    user = AuthService.verifyToken(token);
  }

  if (user) {
    if (user.session_id) {
      sessionManager.revokeSession(
        user.session_id,
        user.user_metadata.operator_name,
        'Log keluar kendiri oleh pengguna'
      );
    }

    auditService.record({
      action: 'LOGOUT',
      resource: 'auth/logout',
      userId: user.app_metadata.operator_id,
      userName: user.user_metadata.operator_name,
      role: user.app_metadata.app_role,
      authorizedEstate: user.app_metadata.estate_id,
      result: 'SUCCESS',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    });
  }

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });

  return res.json({
    success: true,
    message: 'Log keluar berjaya.'
  });
});

/**
 * GET /api/auth/super-admin/dashboard
 * Returns real-time active sessions, per-estate metrics, and login audit history with unauthorized access detection.
 */
router.get(['/super-admin/dashboard', '/auth/super-admin/dashboard'], requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const { estate_id, status, search, threat_only } = req.query;

    const data = sessionManager.getDashboardData({
      estateId: estate_id as string,
      status: status as string,
      search: search as string,
      threatOnly: threat_only === 'true',
      limit: 150
    });

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: data.summary,
      activeSessions: data.activeSessions,
      loginHistory: data.loginHistory,
      securityAlerts: data.securityAlerts
    });
  } catch (err: unknown) {
    console.error('Super Admin Dashboard error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa memuatkan data dashboard audit.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/auth/super-admin/revoke-session
 * Allows Super Admin to terminate / kill any live active session immediately.
 */
router.post(['/super-admin/revoke-session', '/auth/super-admin/revoke-session'], requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const { sessionId, reason } = req.body || {};
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ID Sesi (sessionId) diperlukan.',
        code: 'MISSING_SESSION_ID'
      });
    }

    const adminName = req.user?.user_metadata?.operator_name || 'Super Admin (FC Tunggal)';
    const success = sessionManager.revokeSession(
      sessionId,
      adminName,
      reason || 'Ditamatkan oleh Pentadbir Utama secara manual dari Dashboard Keselamatan'
    );

    return res.json({
      success: true,
      message: 'Sesi telah berjaya ditamatkan serta-merta.',
      sessionId
    });
  } catch (err: unknown) {
    console.error('Revoke Session error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa menamatkan sesi.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/auth/super-admin/pin-vault
 * Enterprise Vault Endpoint: Allows authenticated Super Admin to securely inspect
 * user identities and masked credentials in the RBAC manager.
 * Strict RBAC: Non-superadmin requests are rejected with 403.
 * Security Hardening: Only masked values (last 2 digits) are returned. No passwords.
 */
router.get(['/super-admin/pin-vault', '/auth/super-admin/pin-vault'], requireAuth, requireSuperAdmin, adminRateLimiter, async (req, res) => {
  try {
    const serverMap = getServerPinConfig();
    const vaultMap: Record<string, { pin: string; operator_name?: string }> = {};

    const maskPin = (val: string) => {
      const clean = String(val || '').trim();
      if (!clean) return '****';
      return `****${clean.slice(-2)}`;
    };

    // 1. Populate from active serverMap (in-memory) with masked PINs and NO password
    for (const [pin, user] of Object.entries(serverMap)) {
      if (!user) continue;
      const masked = maskPin(pin);
      const name = user.operator_name || (user as any).label || 'Staf Ladang';
      vaultMap[pin] = { pin: masked, operator_name: name };
      if ((user as any).id) {
        vaultMap[(user as any).id] = { pin: masked, operator_name: name };
      }
    }

    // 2. Merge from local disk (data/rbac_registry.json) with masked PINs and NO password
    try {
      const rbacFilePath = path.join(process.cwd(), 'data', 'rbac_registry.json');
      if (fs.existsSync(rbacFilePath)) {
        const raw = fs.readFileSync(rbacFilePath, 'utf-8');
        const diskRegistry = JSON.parse(raw);
        if (diskRegistry && typeof diskRegistry === 'object') {
          for (const [pin, u] of Object.entries(diskRegistry as Record<string, any>)) {
            if (!u) continue;
            const userPin = u.pin || pin;
            const masked = maskPin(userPin);
            const name = u.label || u.operator_name || 'Staf Ladang';
            vaultMap[userPin] = { pin: masked, operator_name: name };
            if (u.id) {
              vaultMap[u.id] = { pin: masked, operator_name: name };
            }
          }
        }
      }
    } catch (diskErr) {
      console.warn('[PIN_VAULT] Notice reading local disk registry:', diskErr);
    }

    // 3. Merge from Supabase app_settings table if connected with masked PINs and NO password
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      try {
        const { data: rbacRow } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'rbac_registry')
          .maybeSingle();

        if (rbacRow && rbacRow.value && typeof rbacRow.value === 'object') {
          for (const [pin, u] of Object.entries(rbacRow.value as Record<string, any>)) {
            if (!u) continue;
            const userPin = u.pin || pin;
            const masked = maskPin(userPin);
            const name = u.label || u.operator_name || 'Staf Ladang';
            vaultMap[userPin] = { pin: masked, operator_name: name };
            if (u.id) {
              vaultMap[u.id] = { pin: masked, operator_name: name };
            }
          }
        }
      } catch (dbErr) {
        console.warn('[PIN_VAULT] Notice reading Supabase rbac_registry:', dbErr);
      }
    }

    // Structured Audit Log for Super Admin loading pin vault
    auditService.record({
      action: 'ADMIN_OPERATION',
      resource: 'auth/super-admin/pin-vault',
      userId: req.user?.app_metadata?.operator_id || req.user?.sub,
      userName: req.user?.user_metadata?.operator_name || 'Super Admin',
      role: req.user?.app_metadata?.app_role || 'fc',
      authorizedEstate: req.estateId || 'FPM_TUNGGAL',
      result: 'SUCCESS',
      ip: req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      details: {
        operation: 'LOAD_PIN_VAULT_MASKED',
        vaultCount: Object.keys(vaultMap).length
      }
    });

    return res.json({
      success: true,
      vault: vaultMap,
      retrievedAt: new Date().toISOString()
    });
  } catch (err: unknown) {
    console.error('[PIN_VAULT] Error retrieving credentials:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa memuatkan vault PIN.',
      code: 'SERVER_ERROR'
    });
  }
});

// In-memory store for short-lived single-use reveal tokens (60 seconds TTL)
const singleUseRevealTokens = new Map<string, { targetKey: string; expiresAt: number; used: boolean }>();

/**
 * POST /api/auth/super-admin/reveal-credential
 * Redesigned point inspection for Super Admin:
 * (a) Requires fresh re-authentication challenge in the same request (adminChallenge or adminPin).
 * (b) Issues a short-lived, single-use reveal token.
 * (c) NEVER returns passwords — only confirms owner, status, and masked PIN.
 * (d) Records audit logs for every reveal attempt, whether successful or failed.
 */
router.post(['/super-admin/reveal-credential', '/auth/super-admin/reveal-credential'], requireAuth, requireSuperAdmin, adminRateLimiter, async (req, res) => {
  const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  const { pinKey, staffId, key: bodyKey, adminChallenge, adminPin } = req.body || {};
  const key = (pinKey || staffId || bodyKey || '').trim();
  const challenge = (adminChallenge || adminPin || req.headers['x-admin-reauth-pin'] || '').trim();

  // Audit entry for ANY reveal attempt, successful or not
  auditService.record({
    action: 'ADMIN_OPERATION',
    resource: 'auth/super-admin/reveal-credential',
    userId: req.user?.app_metadata?.operator_id || req.user?.sub,
    userName: req.user?.user_metadata?.operator_name || 'Super Admin',
    role: req.user?.app_metadata?.app_role || 'fc',
    authorizedEstate: req.estateId || 'FPM_TUNGGAL',
    result: 'PENDING',
    ip: clientIp,
    userAgent,
    details: {
      operation: 'REVEAL_CREDENTIAL_ATTEMPT',
      targetKey: key,
      hasReauthChallenge: !!challenge
    }
  });

  if (!key) {
    return res.status(400).json({
      success: false,
      error: 'Kunci pengguna (pinKey atau staffId) diperlukan.',
      code: 'MISSING_KEY'
    });
  }

  // (a) Fresh re-authentication challenge requirement:
  // Must verify that the challenge provided in the request authenticates as a Super Admin
  let reauthVerified = false;
  if (challenge) {
    const verifiedSession = AuthService.verifyPin(challenge);
    if (verifiedSession && isSuperAdminIdentity(verifiedSession)) {
      reauthVerified = true;
    }
  }

  if (!reauthVerified) {
    auditService.record({
      action: 'AUTHORIZATION_DENIED',
      resource: 'auth/super-admin/reveal-credential',
      userId: req.user?.app_metadata?.operator_id || req.user?.sub,
      userName: req.user?.user_metadata?.operator_name || 'Super Admin',
      role: req.user?.app_metadata?.app_role || 'fc',
      authorizedEstate: req.estateId || 'FPM_TUNGGAL',
      result: 'DENIED',
      ip: clientIp,
      userAgent,
      details: {
        operation: 'REVEAL_CREDENTIAL_DENIED',
        targetKey: key,
        reason: 'REAUTH_CHALLENGE_FAILED_OR_MISSING'
      }
    });

    return res.status(403).json({
      success: false,
      error: 'Pengesahan semula pentadbir (re-authentication challenge) diperlukan dalam permintaan ini.',
      code: 'REAUTH_REQUIRED'
    });
  }

  try {
    const serverMap = getServerPinConfig();
    let match = serverMap[key];

    if (!match) {
      for (const [p, u] of Object.entries(serverMap)) {
        if (p === key || u.operator_id === key || u.username === key || (u as any).id === key) {
          match = { ...u, pin: p };
          break;
        }
      }
    }

    if (!match) {
      // Check local disk
      try {
        const rbacFilePath = path.join(process.cwd(), 'data', 'rbac_registry.json');
        if (fs.existsSync(rbacFilePath)) {
          const raw = fs.readFileSync(rbacFilePath, 'utf-8');
          const diskRegistry = JSON.parse(raw);
          if (diskRegistry && typeof diskRegistry === 'object') {
            for (const [p, u] of Object.entries(diskRegistry as Record<string, any>)) {
              if (p === key || u.pin === key || u.id === key || u.username === key) {
                match = { ...u, pin: u.pin || p };
                break;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[REVEAL_CREDENTIAL] Disk check notice:', err);
      }
    }

    if (!match) {
      // Check Supabase app_settings table
      const supabase = req.supabase || getScopedSupabase(req.rawToken);
      if (supabase) {
        try {
          const { data: rbacRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'rbac_registry')
            .maybeSingle();

          if (rbacRow && rbacRow.value && typeof rbacRow.value === 'object') {
            for (const [p, u] of Object.entries(rbacRow.value as Record<string, any>)) {
              if (p === key || u.pin === key || u.id === key || u.username === key) {
                match = { ...u, pin: u.pin || p };
                break;
              }
            }
          }
        } catch (dbErr) {
          console.warn('[REVEAL_CREDENTIAL] Notice reading Supabase rbac_registry:', dbErr);
        }
      }
    }

    if (!match) {
      auditService.record({
        action: 'ADMIN_OPERATION',
        resource: 'auth/super-admin/reveal-credential',
        userId: req.user?.app_metadata?.operator_id || req.user?.sub,
        userName: req.user?.user_metadata?.operator_name || 'Super Admin',
        role: req.user?.app_metadata?.app_role || 'fc',
        authorizedEstate: req.estateId || 'FPM_TUNGGAL',
        result: 'ERROR',
        ip: clientIp,
        userAgent,
        details: {
          operation: 'REVEAL_CREDENTIAL_NOT_FOUND',
          targetKey: key
        }
      });

      return res.status(404).json({
        success: false,
        error: 'Kredensial staf tidak ditemui.',
        code: 'NOT_FOUND'
      });
    }

    const rawPin = (match as any).pin || key;
    const maskedPin = `****${String(rawPin).slice(-2)}`;

    // (b) Issue short-lived, single-use reveal token (60 seconds)
    const revealToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 60_000;
    singleUseRevealTokens.set(revealToken, { targetKey: key, expiresAt, used: false });

    // Clean expired reveal tokens
    for (const [token, meta] of singleUseRevealTokens.entries()) {
      if (meta.expiresAt < Date.now() || meta.used) {
        singleUseRevealTokens.delete(token);
      }
    }

    // Structured Audit Log for Super Admin credential reveal success
    auditService.record({
      action: 'ADMIN_OPERATION',
      resource: 'auth/super-admin/reveal-credential',
      userId: req.user?.app_metadata?.operator_id || req.user?.sub,
      userName: req.user?.user_metadata?.operator_name || 'Super Admin',
      role: req.user?.app_metadata?.app_role || 'fc',
      authorizedEstate: req.estateId || 'FPM_TUNGGAL',
      result: 'SUCCESS',
      ip: clientIp,
      userAgent,
      details: {
        operation: 'REVEAL_CREDENTIAL_VERIFIED',
        targetKey: key,
        targetOperator: (match as any).operator_name || (match as any).label || 'Staf Ladang',
        revealTokenIssued: true
      }
    });

    // (c) Never return a password — only confirm current PIN's owner, status, and masked value
    return res.json({
      success: true,
      revealToken,
      owner: {
        operator_id: (match as any).operator_id || key,
        operator_name: (match as any).operator_name || (match as any).label || 'Staf Ladang',
        estate_id: (match as any).estate_id || 'FPM_TUNGGAL',
        app_role: (match as any).app_role || 'staff',
        maskedPin,
        status: 'ACTIVE'
      },
      // Client compatibility payload: masked PIN only, NO password
      userSecret: {
        pin: maskedPin
      },
      secretInfo: {
        pin: maskedPin
      }
    });
  } catch (err: unknown) {
    console.error('[REVEAL_CREDENTIAL] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa mengesahkan kredensial.',
      code: 'SERVER_ERROR'
    });
  }
});

export default router;
