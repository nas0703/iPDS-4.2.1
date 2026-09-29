/**
 * P0-14 integration test helper.
 *
 * Mints signed JWT fixtures from the existing test PIN registry so integration
 * suites can exercise role/estate authorization without raw-PIN API auth.
 */

import crypto from 'crypto';
import { AuthService, UserSession } from '../../../src/server/services/auth.service.js';
import { sessionManager } from '../../../src/server/services/sessionManager.service.js';

const tokenCache = new Map<string, string>();

export function tokenForPin(pin: string): string {
  const cached = tokenCache.get(pin);
  if (cached) return cached;

  const session = AuthService.verifyPin(pin);
  if (!session) {
    throw new Error(`authTestTokens: invalid test PIN '${pin}'`);
  }
  sessionManager.registerSession(session, '127.0.0.1', 'p0-14-integration-test');
  const token = AuthService.generateToken(session);
  tokenCache.set(pin, token);
  return token;
}

export function authHeaders(pin: string): Record<string, string> {
  return { authorization: `Bearer ${tokenForPin(pin)}` };
}

/**
 * Mint a signed session token for an arbitrary role/estate. Used by the
 * administrative-authorization suites to exercise the canonical Super Admin
 * SSOT (e.g. the `admin` alias, or rc/oc/pf actors that are NOT Super Admin).
 */
export function tokenForRole(role: string, estateId: string = 'FPM_TUNGGAL'): string {
  const cacheKey = `role:${role.toLowerCase()}:${estateId.toUpperCase()}`;
  const cached = tokenCache.get(cacheKey);
  if (cached) return cached;

  const session: UserSession = {
    sub: `test-${role}-${estateId}`,
    session_id: crypto.randomUUID(),
    role: 'authenticated',
    app_metadata: {
      user_id: `test-user-${role}`,
      estate_id: estateId,
      assigned_estates: [estateId],
      kiosk_id: `kiosk-test-${role}`,
      app_role: role as UserSession['app_metadata']['app_role'],
      operator_id: `TEST-${role.toUpperCase()}`
    },
    user_metadata: {
      operator_name: `Test ${role.toUpperCase()}`,
      station_name: 'Integration Test'
    }
  };
  sessionManager.registerSession(session, '127.0.0.1', 'admin-authz-integration-test');
  const token = AuthService.generateToken(session);
  tokenCache.set(cacheKey, token);
  return token;
}

export function authHeadersForRole(role: string, estateId: string = 'FPM_TUNGGAL'): Record<string, string> {
  return { authorization: `Bearer ${tokenForRole(role, estateId)}` };
}
