import { AuthTokenPayload, AuthService, UserSession } from './auth.service.js';
import { IdentityService } from './identity.service.js';
import { sessionManager } from './sessionManager.service.js';
import { auditService } from './audit.service.js';
import { isSuperAdminIdentity } from '../middleware/auth.js';
import {
  DurableSessionDescriptor,
  persistActingAsSession,
  revokeActingAsSessionDurable,
  isDurableSessionStoreConfigured
} from './durableSessionStore.service.js';

/**
 * P1 Administrative Acting-As
 *
 * A separate, explicit mechanism from the legacy Super Admin PIN workflow.
 * The actor is ALWAYS derived from the authenticated Super Admin session; the
 * subject is resolved server-side from an explicitly authorized target. The
 * legacy PIN/password visibility and authentication paths are untouched.
 */

const VALID_ESTATES = new Set([
  'FPM_TUNGGAL',
  'FPM_ADELA',
  'FPM_KLEDANG',
  'FPM_SENING',
  'WILAYAH_JB',
  '5155',
  '5136',
  '5176',
  '5156',
  '0001',
  'WJB'
]);

export type ActingAsErrorCode =
  | 'SUPER_ADMIN_REQUIRED'
  | 'TARGET_REQUIRED'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_INACTIVE'
  | 'TARGET_IS_ACTOR'
  | 'INVALID_ESTATE'
  | 'TARGET_ESTATE_DENIED'
  | 'NOT_ACTING_AS'
  | 'ACTOR_NOT_FOUND'
  | 'REVOCATION_NOT_DURABLE';

export interface ActingAsStartInput {
  actor: AuthTokenPayload;
  targetOperatorId: string;
  targetEstateId?: string;
  reason?: string;
  ip?: string;
  userAgent?: string;
}

export interface ActingAsStartResult {
  success: boolean;
  code?: ActingAsErrorCode;
  error?: string;
  token?: string;
  session?: UserSession;
  actor_id?: string;
  subject_id?: string;
  estate_id?: string;
}

export interface ActingAsEndInput {
  actingAsUser: AuthTokenPayload;
  reason?: string;
  ip?: string;
  userAgent?: string;
}

export interface ActingAsEndResult {
  success: boolean;
  code?: ActingAsErrorCode;
  error?: string;
  token?: string;
  actor_id?: string;
  subject_id?: string;
  estate_id?: string;
}

function descriptorFromSession(session: UserSession): DurableSessionDescriptor {
  return {
    sessionId: session.session_id,
    operatorId: session.app_metadata.operator_id,
    operatorName: session.user_metadata.operator_name,
    appRole: session.app_metadata.app_role,
    estateId: session.app_metadata.estate_id,
    kioskId: session.app_metadata.kiosk_id,
    stationName: session.user_metadata.station_name
  };
}

function descriptorFromPayload(user: AuthTokenPayload): DurableSessionDescriptor {
  return {
    sessionId: user.session_id,
    operatorId: user.app_metadata.operator_id,
    operatorName: user.user_metadata?.operator_name || 'Unknown Operator',
    appRole: user.app_metadata.app_role,
    estateId: user.app_metadata.estate_id,
    kioskId: user.app_metadata.kiosk_id,
    stationName: user.user_metadata?.station_name
  };
}

export class ActingAsService {
  /**
   * Start an explicit Acting-As session.
   *
   * actor_id is taken ONLY from the authenticated request principal. The target
   * is resolved server-side by operator_id / user UUID (never by PIN), so no
   * credential of the target user is required or accepted.
   */
  static async startActingAs(input: ActingAsStartInput): Promise<ActingAsStartResult> {
    const actor = input?.actor;
    if (!actor || !actor.app_metadata) {
      return { success: false, code: 'SUPER_ADMIN_REQUIRED', error: 'Sesi pentadbir tidak sah.' };
    }

    // Never trust actor identity from the client body/query/header.
    const actorId = actor.app_metadata.operator_id || actor.app_metadata.user_id;
    if (!actorId || !isSuperAdminIdentity(actor)) {
      return {
        success: false,
        code: 'SUPER_ADMIN_REQUIRED',
        error: 'Akses dinafikan: Hanya Pentadbir Utama (FC FPM Tunggal / Super Admin) dibenarkan Acting-As.'
      };
    }

    const targetKey = (input.targetOperatorId || '').trim();
    if (!targetKey) {
      return { success: false, code: 'TARGET_REQUIRED', error: 'Pengguna sasaran diperlukan.' };
    }

    const target = IdentityService.findIdentityById(targetKey);
    if (!target) {
      return { success: false, code: 'TARGET_NOT_FOUND', error: 'Pengguna sasaran tidak dijumpai.' };
    }
    if (target.is_active === false) {
      return { success: false, code: 'TARGET_INACTIVE', error: 'Akaun pengguna sasaran tidak aktif.' };
    }
    if (target.operator_id.toUpperCase() === actorId.toUpperCase()) {
      return { success: false, code: 'TARGET_IS_ACTOR', error: 'Sasaran Acting-As tidak boleh sama dengan aktor.' };
    }

    const requestedEstate = (input.targetEstateId || target.primary_estate_id || '').trim().toUpperCase();
    if (!VALID_ESTATES.has(requestedEstate)) {
      return { success: false, code: 'INVALID_ESTATE', error: 'Konteks ladang sasaran tidak sah.' };
    }

    const session = IdentityService.createUnifiedSession(target, 'ADMIN_ACTING_AS', requestedEstate);
    if (!session) {
      return {
        success: false,
        code: 'TARGET_ESTATE_DENIED',
        error: 'Sasaran Acting-As tidak mempunyai akses ke ladang yang dipilih.'
      };
    }

    // Attach server-trusted actor/subject context without destroying the
    // target's user_id / operator_id / app_role / estate_id / kiosk_id.
    session.app_metadata.actor_id = actorId;
    session.app_metadata.subject_id = target.operator_id;
    session.app_metadata.actor_session_id = actor.session_id;
    session.app_metadata.acting_as = true;

    const clientIp = input.ip || '127.0.0.1';
    const clientUserAgent = input.userAgent || 'unknown';
    sessionManager.registerSession(session, clientIp, clientUserAgent);
    const token = AuthService.generateToken(session);

    // Cross-instance durability (no-op when no durable store is configured).
    await persistActingAsSession(descriptorFromSession(session), clientIp, clientUserAgent);

    auditService.record({
      userId: actorId,
      userName: actor.user_metadata?.operator_name,
      role: actor.app_metadata.app_role,
      authorizedEstate: session.app_metadata.estate_id,
      action: 'IMPERSONATION_START',
      resource: 'auth/acting-as/start',
      result: 'SUCCESS',
      ip: clientIp,
      userAgent: clientUserAgent,
      details: {
        actor_id: actorId,
        subject_id: target.operator_id,
        subject_name: target.full_name,
        subject_role: target.app_role,
        estate_id: session.app_metadata.estate_id,
        reason: input.reason ? String(input.reason).slice(0, 500) : undefined,
        method: 'ADMIN_ACTING_AS'
      }
    });

    return {
      success: true,
      token,
      session,
      actor_id: actorId,
      subject_id: target.operator_id,
      estate_id: session.app_metadata.estate_id
    };
  }

  /**
   * End an Acting-As session. The Super Admin's own session is never revoked;
   * the original actor session token is restored for the caller.
   */
  static async endActingAs(input: ActingAsEndInput): Promise<ActingAsEndResult> {
    const user = input?.actingAsUser;
    const meta = user?.app_metadata;

    const actorId = meta?.actor_id;
    const subjectId = meta?.subject_id;

    if (!meta || !actorId || !subjectId || actorId.toUpperCase() === subjectId.toUpperCase() || meta.acting_as !== true) {
      return { success: false, code: 'NOT_ACTING_AS', error: 'Sesi semasa bukan sesi Acting-As.' };
    }

    const actorProfile = IdentityService.findIdentityById(actorId);
    if (
      !actorProfile ||
      !isSuperAdminIdentity({
        app_metadata: { app_role: actorProfile.app_role, estate_id: actorProfile.primary_estate_id }
      })
    ) {
      return { success: false, code: 'ACTOR_NOT_FOUND', error: 'Aktor Super Admin tidak sah atau tidak aktif.' };
    }

    const endIp = input.ip || '127.0.0.1';
    const endUserAgent = input.userAgent || 'unknown';
    const endReason = input.reason || 'Sesi Acting-As ditamatkan';

    if (user?.session_id) {
      // Cross-instance revocation first. When a durable store is configured it
      // must succeed before we claim the session ended; otherwise the session is
      // left active so /end remains retryable.
      if (isDurableSessionStoreConfigured()) {
        const durableRevoked = await revokeActingAsSessionDurable(
          descriptorFromPayload(user),
          actorProfile.full_name,
          endReason
        );
        if (!durableRevoked) {
          auditService.record({
            userId: actorId,
            userName: actorProfile.full_name,
            role: actorProfile.app_role,
            authorizedEstate: meta.estate_id,
            action: 'IMPERSONATION_END',
            resource: 'auth/acting-as/end',
            result: 'FAILURE',
            ip: endIp,
            userAgent: endUserAgent,
            details: {
              actor_id: actorId,
              subject_id: subjectId,
              estate_id: meta.estate_id,
              reason: 'DURABLE_REVOKE_FAILED'
            },
            errorMessage: 'Acting-As durable revocation failed; session left active for retry.'
          });
          return {
            success: false,
            code: 'REVOCATION_NOT_DURABLE',
            error: 'Gagal menamatkan sesi Acting-As secara kekal. Sila cuba lagi.'
          };
        }
      }

      sessionManager.revokeSession(user.session_id, actorProfile.full_name, endReason);
    }

    auditService.record({
      userId: actorId,
      userName: actorProfile.full_name,
      role: actorProfile.app_role,
      authorizedEstate: meta.estate_id,
      action: 'IMPERSONATION_END',
      resource: 'auth/acting-as/end',
      result: 'SUCCESS',
      ip: endIp,
      userAgent: endUserAgent,
      details: {
        actor_id: actorId,
        subject_id: subjectId,
        estate_id: meta.estate_id,
        reason: input.reason ? String(input.reason).slice(0, 500) : undefined
      }
    });

    // Restore the Super Admin's original session (same session_id, actor === subject).
    let restoredToken: string | undefined;
    if (meta.actor_session_id) {
      const restored = IdentityService.createUnifiedSession(
        actorProfile,
        'SESSION_RESTORE',
        actorProfile.primary_estate_id
      );
      if (restored) {
        restored.session_id = meta.actor_session_id;
        sessionManager.touchSession(meta.actor_session_id);
        restoredToken = AuthService.generateToken(restored);
      }
    }

    return {
      success: true,
      actor_id: actorId,
      subject_id: subjectId,
      estate_id: meta.estate_id,
      token: restoredToken
    };
  }
}
