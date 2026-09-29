import { v4 as uuidv4 } from 'uuid';
import { AuthRole, UserSession } from './auth.service.js';
import { auditService } from './audit.service.js';

export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export type LoginAttemptStatus = 
  | 'SUCCESS' 
  | 'UNAUTHORIZED_CROSS_ESTATE' 
  | 'INVALID_CREDENTIALS' 
  | 'RATE_LIMITED' 
  | 'SESSION_REVOKED';

export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActiveSessionRecord {
  sessionId: string;
  sub: string;
  operatorId: string;
  operatorName: string;
  role: AuthRole;
  assignedEstate: string;
  connectedEstate: string;
  kioskId: string;
  stationName: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  status: SessionStatus;
  revokedBy?: string;
  revokedReason?: string;
}

export interface LoginAuditRecord {
  id: string;
  timestamp: string;
  authMethod: 'ESTATE_STAFF_PIN' | 'KIOSK_STAFF_NO' | 'PIN_KIOSK' | 'ENTERPRISE_PASSWORD' | 'TOKEN_RESUME';
  identifier: string; // Staff ID / PIN / Username
  operatorName?: string;
  role?: AuthRole | 'UNKNOWN';
  attemptedEstate: string;
  assignedEstate?: string;
  status: LoginAttemptStatus;
  threatLevel: ThreatLevel;
  ip: string;
  userAgent: string;
  notes: string;
  flagged: boolean;
}

export interface SecurityDashboardSummary {
  totalActiveSessions: number;
  activeSessionsByEstate: Record<string, number>;
  unauthorizedAttempts24h: number;
  failedLogins24h: number;
  totalSuccessfulLogins24h: number;
  threatSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

class SessionManagerService {
  private static instance: SessionManagerService;
  
  // In-memory active sessions map: sessionId -> ActiveSessionRecord
  private activeSessions: Map<string, ActiveSessionRecord> = new Map();
  
  // Set of revoked session IDs (blacklist for instantaneous revocation)
  private revokedSessionIds: Set<string> = new Set();
  
  // Login history buffer (persists in-memory with circular buffer limit of 1000 items)
  private loginHistory: LoginAuditRecord[] = [];
  private readonly MAX_HISTORY = 1000;
  
  // Clean session timeout in milliseconds (12 hours)
  private readonly SESSION_EXPIRY_MS = 12 * 60 * 60 * 1000;

  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Seed initial realistic audit trail history for demonstration & initial dashboard review
    this.seedInitialAuditHistory();

    // Periodic cleanup of expired sessions every 5 minutes (unref'd so process can exit naturally)
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);

    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  public stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  public static getInstance(): SessionManagerService {
    if (!SessionManagerService.instance) {
      SessionManagerService.instance = new SessionManagerService();
    }
    return SessionManagerService.instance;
  }

  /**
   * Register a new active session upon successful login
   */
  public registerSession(
    userSession: UserSession,
    ip: string,
    userAgent: string
  ): ActiveSessionRecord {
    const now = new Date().toISOString();
    
    // Invalidate prior identical active sessions for same operator if desired or allow multi-device
    const record: ActiveSessionRecord = {
      sessionId: userSession.session_id,
      sub: userSession.sub,
      operatorId: userSession.app_metadata.operator_id,
      operatorName: userSession.user_metadata.operator_name,
      role: userSession.app_metadata.app_role,
      assignedEstate: userSession.app_metadata.estate_id,
      connectedEstate: userSession.app_metadata.estate_id,
      kioskId: userSession.app_metadata.kiosk_id,
      stationName: userSession.user_metadata.station_name,
      ip: ip || '127.0.0.1',
      userAgent: userAgent || 'Unknown Device / Browser',
      createdAt: now,
      lastActiveAt: now,
      status: 'ACTIVE'
    };

    this.activeSessions.set(record.sessionId, record);
    return record;
  }

  /**
   * Check if a session ID is valid and active (not revoked or expired)
   */
  public isSessionActive(sessionId: string): boolean {
    if (!sessionId) return false;
    if (this.revokedSessionIds.has(sessionId)) return false;

    const session = this.activeSessions.get(sessionId);
    if (!session) return true; // Default fallback to JWT validity if session not tracked in memory

    if (session.status !== 'ACTIVE') return false;

    // Check expiry
    const lastActive = new Date(session.lastActiveAt).getTime();
    if (Date.now() - lastActive > this.SESSION_EXPIRY_MS) {
      session.status = 'EXPIRED';
      return false;
    }

    return true;
  }

  /**
   * Retrieve active session record by ID
   */
  public getSession(sessionId: string): ActiveSessionRecord | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Touch session heartbeat and extend sliding window
   */
  public touchSession(sessionId: string): boolean {
    if (!sessionId || this.revokedSessionIds.has(sessionId)) return false;
    const session = this.activeSessions.get(sessionId);
    if (session && session.status === 'ACTIVE') {
      session.lastActiveAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Get detailed session remaining validity and idle time
   */
  public getSessionRemainingTime(sessionId: string): {
    active: boolean;
    remainingMs: number;
    idleMs: number;
    expiresAt: string;
    status: SessionStatus;
  } {
    if (!sessionId || this.revokedSessionIds.has(sessionId)) {
      return { active: false, remainingMs: 0, idleMs: 0, expiresAt: new Date().toISOString(), status: 'REVOKED' };
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { active: true, remainingMs: this.SESSION_EXPIRY_MS, idleMs: 0, expiresAt: new Date(Date.now() + this.SESSION_EXPIRY_MS).toISOString(), status: 'ACTIVE' };
    }

    const now = Date.now();
    const lastActive = new Date(session.lastActiveAt).getTime();
    const idleMs = Math.max(0, now - lastActive);
    const remainingMs = Math.max(0, this.SESSION_EXPIRY_MS - idleMs);
    const expiresAt = new Date(lastActive + this.SESSION_EXPIRY_MS).toISOString();

    return {
      active: session.status === 'ACTIVE' && remainingMs > 0,
      remainingMs,
      idleMs,
      expiresAt,
      status: remainingMs === 0 ? 'EXPIRED' : session.status
    };
  }

  /**
   * Revoke / Kill an active session immediately (Super Admin action)
   */
  public revokeSession(
    sessionId: string,
    revokedBy: string = 'Super Admin (FC Tunggal)',
    reason: string = 'Ditamatkan oleh Pentadbir Utama'
  ): boolean {
    this.revokedSessionIds.add(sessionId);

    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'REVOKED';
      session.revokedBy = revokedBy;
      session.revokedReason = reason;

      auditService.record({
        action: 'ADMIN_OPERATION',
        resource: 'auth/session-revoke',
        userId: session.operatorId,
        userName: session.operatorName,
        role: session.role,
        authorizedEstate: session.assignedEstate,
        result: 'SUCCESS',
        details: {
          revokedSessionId: sessionId,
          revokedBy,
          reason
        }
      });
      return true;
    }

    return true;
  }

  /**
   * Log an incoming login attempt (both success and rejected/failed)
   */
  public logLoginAttempt(entry: {
    authMethod: 'ESTATE_STAFF_PIN' | 'KIOSK_STAFF_NO' | 'PIN_KIOSK' | 'ENTERPRISE_PASSWORD' | 'TOKEN_RESUME';
    identifier: string;
    operatorName?: string;
    role?: AuthRole | 'UNKNOWN';
    attemptedEstate: string;
    assignedEstate?: string;
    status: LoginAttemptStatus;
    threatLevel?: ThreatLevel;
    ip: string;
    userAgent: string;
    notes: string;
  }): LoginAuditRecord {
    const flagged = entry.status === 'UNAUTHORIZED_CROSS_ESTATE' || 
                    entry.status === 'RATE_LIMITED' || 
                    (entry.threatLevel === 'HIGH' || entry.threatLevel === 'CRITICAL');

    let threatLevel: ThreatLevel = entry.threatLevel || 'LOW';
    if (!entry.threatLevel) {
      if (entry.status === 'UNAUTHORIZED_CROSS_ESTATE') threatLevel = 'HIGH';
      else if (entry.status === 'RATE_LIMITED') threatLevel = 'CRITICAL';
      else if (entry.status === 'INVALID_CREDENTIALS') threatLevel = 'MEDIUM';
      else threatLevel = 'LOW';
    }

    const record: LoginAuditRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      authMethod: entry.authMethod,
      identifier: entry.identifier,
      operatorName: entry.operatorName || 'Tidak Diketahui',
      role: entry.role || 'UNKNOWN',
      attemptedEstate: entry.attemptedEstate,
      assignedEstate: entry.assignedEstate,
      status: entry.status,
      threatLevel,
      ip: entry.ip || '127.0.0.1',
      userAgent: entry.userAgent || 'Unknown Device',
      notes: entry.notes,
      flagged
    };

    this.loginHistory.unshift(record);

    // Limit buffer size
    if (this.loginHistory.length > this.MAX_HISTORY) {
      this.loginHistory.pop();
    }

    return record;
  }

  /**
   * Query sessions & audit metrics for Super Admin Dashboard
   */
  public getDashboardData(filters?: {
    estateId?: string;
    status?: string;
    search?: string;
    threatOnly?: boolean;
    limit?: number;
  }): {
    summary: SecurityDashboardSummary;
    activeSessions: ActiveSessionRecord[];
    loginHistory: LoginAuditRecord[];
    securityAlerts: LoginAuditRecord[];
  } {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Filter active sessions
    const activeList = Array.from(this.activeSessions.values()).filter(s => {
      if (s.status !== 'ACTIVE') return false;
      const lastActive = new Date(s.lastActiveAt).getTime();
      return now - lastActive <= this.SESSION_EXPIRY_MS;
    });

    // Compute summary metrics
    const sessionsByEstate: Record<string, number> = {
      'FPM_TUNGGAL': 0,
      'FPM_ADELA': 0,
      'FPM_KLEDANG': 0,
      'FPM_SENING': 0
    };

    activeList.forEach(s => {
      const est = s.assignedEstate || 'FPM_TUNGGAL';
      sessionsByEstate[est] = (sessionsByEstate[est] || 0) + 1;
    });

    const recent24hLogins = this.loginHistory.filter(l => new Date(l.timestamp).getTime() >= oneDayAgo);
    
    const unauthorizedAttempts24h = recent24hLogins.filter(
      l => l.status === 'UNAUTHORIZED_CROSS_ESTATE' || l.status === 'RATE_LIMITED'
    ).length;

    const failedLogins24h = recent24hLogins.filter(l => l.status !== 'SUCCESS').length;
    const totalSuccessfulLogins24h = recent24hLogins.filter(l => l.status === 'SUCCESS').length;

    const threatSummary = {
      critical: recent24hLogins.filter(l => l.threatLevel === 'CRITICAL').length,
      high: recent24hLogins.filter(l => l.threatLevel === 'HIGH').length,
      medium: recent24hLogins.filter(l => l.threatLevel === 'MEDIUM').length,
      low: recent24hLogins.filter(l => l.threatLevel === 'LOW').length,
    };

    // Filtered login history
    let filteredHistory = [...this.loginHistory];

    if (filters) {
      if (filters.estateId && filters.estateId !== 'ALL') {
        const est = filters.estateId.toUpperCase();
        filteredHistory = filteredHistory.filter(
          l => l.attemptedEstate?.toUpperCase() === est || l.assignedEstate?.toUpperCase() === est
        );
      }

      if (filters.status && filters.status !== 'ALL') {
        filteredHistory = filteredHistory.filter(l => l.status === filters.status);
      }

      if (filters.threatOnly) {
        filteredHistory = filteredHistory.filter(l => l.flagged);
      }

      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        filteredHistory = filteredHistory.filter(l => 
          l.identifier.toLowerCase().includes(q) ||
          l.operatorName?.toLowerCase().includes(q) ||
          l.ip.toLowerCase().includes(q) ||
          l.notes.toLowerCase().includes(q) ||
          l.attemptedEstate.toLowerCase().includes(q)
        );
      }
    }

    const limit = filters?.limit || 100;
    const paginatedHistory = filteredHistory.slice(0, limit);

    // Critical and high threats for alert banner
    const securityAlerts = this.loginHistory
      .filter(l => l.flagged && new Date(l.timestamp).getTime() >= oneDayAgo)
      .slice(0, 15);

    return {
      summary: {
        totalActiveSessions: activeList.length,
        activeSessionsByEstate: sessionsByEstate,
        unauthorizedAttempts24h,
        failedLogins24h,
        totalSuccessfulLogins24h,
        threatSummary
      },
      activeSessions: activeList.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()),
      loginHistory: paginatedHistory,
      securityAlerts
    };
  }

  /**
   * Cleanup expired or inactive sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.activeSessions.entries()) {
      const lastActive = new Date(session.lastActiveAt).getTime();
      if (now - lastActive > this.SESSION_EXPIRY_MS) {
        session.status = 'EXPIRED';
        this.activeSessions.delete(id);
      }
    }
  }

  /**
   * Seed initial sample security records for instant visibility
   */
  private seedInitialAuditHistory(): void {
    const now = Date.now();
    const minutesAgo = (m: number) => new Date(now - m * 60 * 1000).toISOString();
    const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

    // 1. Initial active Super Admin session
    const superAdminSession: ActiveSessionRecord = {
      sessionId: 'sess-superadmin-tunggal-01',
      sub: 'kiosk:FPM_TUNGGAL:kiosk-fc-tunggal',
      operatorId: 'FC-2401199',
      operatorName: 'MD NASRUDDIN BIN BHSERAN',
      role: 'fc',
      assignedEstate: 'FPM_TUNGGAL',
      connectedEstate: 'FPM_TUNGGAL',
      kioskId: 'kiosk-fc-tunggal',
      stationName: 'Pusat Kawalan Ladang Tunggal',
      ip: '10.20.1.45',
      userAgent: 'Chrome 122.0 / Windows 11 (Pusat Kawalan HQ)',
      createdAt: hoursAgo(2),
      lastActiveAt: minutesAgo(1),
      status: 'ACTIVE'
    };
    this.activeSessions.set(superAdminSession.sessionId, superAdminSession);

    // 2. Active Session for FC Kledang
    const fcKledangSession: ActiveSessionRecord = {
      sessionId: 'sess-fc-kledang-02',
      sub: 'kiosk:FPM_KLEDANG:kiosk-fc-kledang',
      operatorId: 'FC-KLD-01',
      operatorName: 'Field Controller (FC Kledang)',
      role: 'fc',
      assignedEstate: 'FPM_KLEDANG',
      connectedEstate: 'FPM_KLEDANG',
      kioskId: 'kiosk-fc-kledang',
      stationName: 'Pusat Kawalan Ladang Kledang',
      ip: '10.20.4.12',
      userAgent: 'Safari Mobile / iPadOS 17.4 (Kiosk Ladang)',
      createdAt: hoursAgo(3),
      lastActiveAt: minutesAgo(12),
      status: 'ACTIVE'
    };
    this.activeSessions.set(fcKledangSession.sessionId, fcKledangSession);

    // 3. Active Session for Mandur Sening
    const mandurSeningSession: ActiveSessionRecord = {
      sessionId: 'sess-mdr-sening-03',
      sub: 'kiosk:FPM_SENING:kiosk-mdr-sening',
      operatorId: 'MDR-5156-01',
      operatorName: 'Mandur Tua (Sening)',
      role: 'mandur',
      assignedEstate: 'FPM_SENING',
      connectedEstate: 'FPM_SENING',
      kioskId: 'kiosk-mdr-sening',
      stationName: 'Pondok Timbang Sening Blok 14',
      ip: '10.20.3.88',
      userAgent: 'Chrome Mobile / Android 14 (Handheld Rugged)',
      createdAt: hoursAgo(1),
      lastActiveAt: minutesAgo(4),
      status: 'ACTIVE'
    };
    this.activeSessions.set(mandurSeningSession.sessionId, mandurSeningSession);

    // Sample Audit History entries
    this.loginHistory = [
      {
        id: uuidv4(),
        timestamp: minutesAgo(2),
        authMethod: 'ESTATE_STAFF_PIN',
        identifier: '2401199',
        operatorName: 'MD NASRUDDIN BIN BHSERAN',
        role: 'fc',
        attemptedEstate: 'FPM_TUNGGAL',
        assignedEstate: 'FPM_TUNGGAL',
        status: 'SUCCESS',
        threatLevel: 'LOW',
        ip: '10.20.1.45',
        userAgent: 'Chrome 122.0 / Windows 11',
        notes: 'Log masuk berjaya sebagai Pentadbir Utama (Super Admin FC FPM Tunggal).',
        flagged: false
      },
      {
        id: uuidv4(),
        timestamp: minutesAgo(18),
        authMethod: 'ESTATE_STAFF_PIN',
        identifier: '600200',
        operatorName: 'Field Controller (FC Kledang)',
        role: 'fc',
        attemptedEstate: 'FPM_ADELA',
        assignedEstate: 'FPM_KLEDANG',
        status: 'UNAUTHORIZED_CROSS_ESTATE',
        threatLevel: 'HIGH',
        ip: '10.20.4.12',
        userAgent: 'Safari Mobile / iPadOS',
        notes: 'AMARAN KESELAMATAN: Cubaan log masuk silang ladang disekat serta-merta. Kakitangan berdaftar di LADANG KLEDANG cuba mengakses portal LADANG ADELA.',
        flagged: true
      },
      {
        id: uuidv4(),
        timestamp: minutesAgo(35),
        authMethod: 'ESTATE_STAFF_PIN',
        identifier: '600200',
        operatorName: 'Field Controller (FC Kledang)',
        role: 'fc',
        attemptedEstate: 'FPM_KLEDANG',
        assignedEstate: 'FPM_KLEDANG',
        status: 'SUCCESS',
        threatLevel: 'LOW',
        ip: '10.20.4.12',
        userAgent: 'Safari Mobile / iPadOS',
        notes: 'Log masuk berjaya ke Portal Operasi Ladang Kledang.',
        flagged: false
      },
      {
        id: uuidv4(),
        timestamp: hoursAgo(1),
        authMethod: 'ESTATE_STAFF_PIN',
        identifier: '999888',
        operatorName: 'Tidak Diketahui',
        role: 'UNKNOWN',
        attemptedEstate: 'FPM_TUNGGAL',
        status: 'INVALID_CREDENTIALS',
        threatLevel: 'MEDIUM',
        ip: '192.168.1.105',
        userAgent: 'Mozilla Firefox / Linux',
        notes: 'Cubaan log masuk gagal: No. Kakitangan / PIN 999888 tidak wujud dalam direktori kakitangan berdaftar.',
        flagged: true
      },
      {
        id: uuidv4(),
        timestamp: hoursAgo(2),
        authMethod: 'ESTATE_STAFF_PIN',
        identifier: '700400',
        operatorName: 'Mandur Tua (Sening)',
        role: 'mandur',
        attemptedEstate: 'FPM_SENING',
        assignedEstate: 'FPM_SENING',
        status: 'SUCCESS',
        threatLevel: 'LOW',
        ip: '10.20.3.88',
        userAgent: 'Chrome Mobile / Android 14',
        notes: 'Log masuk berjaya di Stesen Timbang Ladang Sening.',
        flagged: false
      },
      {
        id: uuidv4(),
        timestamp: hoursAgo(4),
        authMethod: 'ENTERPRISE_PASSWORD',
        identifier: 'admin_test_attack',
        operatorName: 'Unknown Adversary',
        role: 'UNKNOWN',
        attemptedEstate: 'FPM_TUNGGAL',
        status: 'RATE_LIMITED',
        threatLevel: 'CRITICAL',
        ip: '203.0.113.84',
        userAgent: 'Python-requests/2.31.0',
        notes: 'SEKATAN BRUTE-FORCE: 10 percubaan kata laluan gagal berturut-turut. Alamat IP disekat selama 60 saat secara automatik.',
        flagged: true
      }
    ];
  }
}

export const sessionManager = SessionManagerService.getInstance();
