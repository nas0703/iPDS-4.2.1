/**
 * IPDS VER 3.7 — Disaster Recovery Observability & Telemetry Integration
 * Emits structured audit events during DR workflows with zero-disruption failsafe guarantee.
 */

import { redactObject, truncateString } from '../../src/server/observability/logger.js';

export type DREventType =
  | 'backup_started'
  | 'backup_completed'
  | 'backup_failed'
  | 'restore_preflight_started'
  | 'restore_preflight_failed'
  | 'restore_preflight_passed'
  | 'dr_restore_started'
  | 'dr_restore_schema_started'
  | 'dr_restore_schema_completed'
  | 'dr_restore_data_started'
  | 'dr_restore_data_completed'
  | 'dr_restore_completed'
  | 'dr_restore_failed'
  | 'recovery_verification_started'
  | 'recovery_verification_failed'
  | 'recovery_verification_passed'
  | 'storage_verification_started'
  | 'storage_verification_completed'
  | 'storage_verification_failed'
  | 'drill_started'
  | 'drill_completed'
  | 'drill_failed';

export interface DREventPayload {
  eventType: DREventType;
  timestamp: string;
  environment: string;
  backupId?: string;
  details?: Record<string, any>;
  error?: string;
}

export function emitDREvent(type: DREventType, details: Record<string, any> = {}, error?: any): void {
  try {
    const timestamp = new Date().toISOString();
    const environment = process.env.NODE_ENV || 'development';
    const safeDetails = redactObject(details);

    const payload: DREventPayload = {
      eventType: type,
      timestamp,
      environment,
      details: safeDetails,
      ...(error ? { error: truncateString(error?.message || String(error), 300) } : {})
    };

    // Structured stdout logging for telemetry collection
    console.log(`[DR_TELEMETRY] ${JSON.stringify(payload)}`);
  } catch (err) {
    // FAILSAFE: Telemetry must NEVER throw or block DR execution
    console.warn('[DR_TELEMETRY_WARN] Failed to format DR telemetry event safely:', err);
  }
}
