import { truncateString, redactObject } from './logger.js';

export type AlertState = 'NORMAL' | 'WARNING' | 'CRITICAL';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertType =
  | 'error_rate'
  | 'latency_p95'
  | 'latency_p99'
  | 'memory_pressure'
  | 'database_health'
  | 'auth_security'
  | 'tenant_security'
  | 'cron_jobs'
  | 'backup_health'
  | 'critical_app_error';

export interface AlertThresholds {
  errorRate5xxWarn: number;       // default: 0.02 (2%)
  errorRate5xxCrit: number;       // default: 0.05 (5%)
  latencyP95WarnMs: number;       // default: 1000ms
  latencyP99CritMs: number;       // default: 3000ms
  memoryHeapUsedMbWarn: number;   // default: 450MB
  dbSlowQueryWarnMs: number;      // default: 2000ms
  dbErrorRateCrit: number;        // default: 0.05 (5%)
  authFailureBurstCrit: number;   // default: 5 failures within window
  tenantViolationBurstCrit: number;// default: 1 attempt (Zero-tolerance)
  cronFailedJobsCrit: number;     // default: 3 failed jobs
  backupAgeHoursWarn: number;     // default: 24 hours
  backupAgeHoursCrit: number;     // default: 48 hours
  minSampleCount: number;         // default: 10 requests before evaluating rate-based alerts
  cooldownMs: number;             // default: 60000ms (1 minute cooldown between repeat alerts)
}

export interface IncidentEvent {
  id: string;
  timestamp: string;
  eventType: 'observability.alert.warning' | 'observability.alert.critical' | 'observability.alert.recovered';
  alertType: AlertType;
  severity: AlertSeverity;
  previousState: AlertState;
  newState: AlertState;
  metricValue: number;
  thresholdValue: number;
  message: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface NotificationDeliveryRecord {
  id: string;
  incidentId: string;
  timestamp: string;
  channel: 'webhook' | 'console' | 'subscriber';
  severity: AlertSeverity;
  status: 'DELIVERED' | 'NO_WEBHOOK_CONFIGURED' | 'FAILED';
  httpStatus?: number;
  error?: string;
  recipient?: string;
}

export interface SystemHealthSignal {
  status: 'healthy' | 'degraded' | 'critical';
  overallState: AlertState;
  activeAlerts: {
    type: string;
    state: AlertState;
    severity: AlertSeverity;
    message: string;
    metricValue: number;
    threshold: number;
  }[];
  uptimeSeconds: number;
  sampleCount: number;
  errorRate5xx: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  memoryHeapMb: number;
  recentIncidents: IncidentEvent[];
  thresholds: AlertThresholds;
  notificationChannel: {
    webhookConfigured: boolean;
    totalNotificationsDelivered: number;
    lastDelivery?: NotificationDeliveryRecord;
  };
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRate5xxWarn: 0.02,
  errorRate5xxCrit: 0.05,
  latencyP95WarnMs: 1000,
  latencyP99CritMs: 3000,
  memoryHeapUsedMbWarn: 450,
  dbSlowQueryWarnMs: 2000,
  dbErrorRateCrit: 0.05,
  authFailureBurstCrit: 5,
  tenantViolationBurstCrit: 1,
  cronFailedJobsCrit: 3,
  backupAgeHoursWarn: 24,
  backupAgeHoursCrit: 48,
  minSampleCount: 10,
  cooldownMs: 60000,
};

const MAX_INCIDENT_HISTORY = 50;
const MAX_NOTIFICATION_HISTORY = 50;

type AlertSubscriber = (incident: IncidentEvent) => void;

class AlertIntelligenceManager {
  private thresholds: AlertThresholds = { ...DEFAULT_THRESHOLDS };

  // Domain state tracking
  private stateErrorRate: AlertState = 'NORMAL';
  private stateLatencyP95: AlertState = 'NORMAL';
  private stateLatencyP99: AlertState = 'NORMAL';
  private stateMemory: AlertState = 'NORMAL';
  private stateDatabase: AlertState = 'NORMAL';
  private stateAuth: AlertState = 'NORMAL';
  private stateTenantSecurity: AlertState = 'NORMAL';
  private stateCron: AlertState = 'NORMAL';
  private stateBackup: AlertState = 'NORMAL';

  private lastAlertTime: Record<string, number> = {
    error_rate: 0,
    latency_p95: 0,
    latency_p99: 0,
    memory_pressure: 0,
    database_health: 0,
    auth_security: 0,
    tenant_security: 0,
    cron_jobs: 0,
    backup_health: 0,
    critical_app_error: 0,
  };

  private incidentHistory: IncidentEvent[] = [];
  private notificationHistory: NotificationDeliveryRecord[] = [];
  private subscribers: Set<AlertSubscriber> = new Set();
  private incidentSeq = 1;
  private notifSeq = 1;

  public getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  public updateThresholds(newThresholds: Partial<AlertThresholds>): AlertThresholds {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds,
    };
    return this.getThresholds();
  }

  /**
   * Register a subscriber to receive live alert incident events.
   * Returns an unsubscribe function.
   */
  public subscribe(listener: AlertSubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  public getNotificationHistory(): NotificationDeliveryRecord[] {
    return [...this.notificationHistory];
  }

  /**
   * Dispatches alert notifications to configured webhook and subscribers.
   * Non-blocking, failsafe, and ensures zero secrets are exposed.
   */
  private async dispatchNotification(incident: IncidentEvent): Promise<NotificationDeliveryRecord> {
    const notifId = `notif_${Date.now()}_${this.notifSeq++}`;
    const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();

    // 1. Notify in-memory subscribers synchronously/safely
    for (const sub of this.subscribers) {
      try {
        sub(incident);
      } catch (subErr) {
        console.warn('[ALERTS_SUBSCRIBER_FAILSAFE] Alert subscriber error:', subErr);
      }
    }

    // 2. Dispatch to external webhook (if configured)
    if (webhookUrl && (webhookUrl.startsWith('http://') || webhookUrl.startsWith('https://'))) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const webhookPayload = {
          app: 'iPDS Palm Oil Plantation Management System',
          version: '4.1.0',
          environment: process.env.NODE_ENV || 'production',
          alert: {
            id: incident.id,
            timestamp: incident.timestamp,
            severity: incident.severity.toUpperCase(),
            type: incident.alertType,
            message: incident.message,
            metricValue: incident.metricValue,
            thresholdValue: incident.thresholdValue,
            state: incident.newState,
            previousState: incident.previousState,
            metadata: incident.metadata ? redactObject(incident.metadata) : undefined,
          },
        };

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'iPDS-Observability-AlertManager/4.1.0',
          },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const record: NotificationDeliveryRecord = {
          id: notifId,
          incidentId: incident.id,
          timestamp: new Date().toISOString(),
          channel: 'webhook',
          severity: incident.severity,
          status: res.ok ? 'DELIVERED' : 'FAILED',
          httpStatus: res.status,
          recipient: new URL(webhookUrl).hostname,
          error: res.ok ? undefined : `Webhook responded with HTTP ${res.status}`,
        };

        this.recordNotification(record);
        return record;
      } catch (fetchErr: any) {
        const record: NotificationDeliveryRecord = {
          id: notifId,
          incidentId: incident.id,
          timestamp: new Date().toISOString(),
          channel: 'webhook',
          severity: incident.severity,
          status: 'FAILED',
          recipient: 'external_webhook',
          error: fetchErr?.name === 'AbortError' ? 'Webhook delivery timed out after 5s' : (fetchErr?.message || 'Unknown network error'),
        };
        this.recordNotification(record);
        return record;
      }
    } else {
      // Console fallback when no external webhook is configured
      const record: NotificationDeliveryRecord = {
        id: notifId,
        incidentId: incident.id,
        timestamp: new Date().toISOString(),
        channel: 'console',
        severity: incident.severity,
        status: 'NO_WEBHOOK_CONFIGURED',
      };
      this.recordNotification(record);
      return record;
    }
  }

  private recordNotification(record: NotificationDeliveryRecord): void {
    if (this.notificationHistory.length >= MAX_NOTIFICATION_HISTORY) {
      this.notificationHistory.shift();
    }
    this.notificationHistory.push(record);
  }

  private recordIncident(event: Omit<IncidentEvent, 'id' | 'timestamp'>): IncidentEvent {
    try {
      const incident: IncidentEvent = {
        id: `inc_${Date.now()}_${this.incidentSeq++}`,
        timestamp: new Date().toISOString(),
        ...event,
        metadata: event.metadata ? redactObject(event.metadata) : undefined,
      };

      if (this.incidentHistory.length >= MAX_INCIDENT_HISTORY) {
        this.incidentHistory.shift();
      }
      this.incidentHistory.push(incident);

      // Structured log of incident transition (sanitized, zero secrets)
      if (incident.severity === 'critical') {
        console.error(`[INCIDENT_CRITICAL] ${JSON.stringify(incident)}`);
      } else if (incident.severity === 'warning') {
        console.warn(`[INCIDENT_WARN] ${JSON.stringify(incident)}`);
      } else {
        console.log(`[INCIDENT_RECOVERED] ${JSON.stringify(incident)}`);
      }

      // Non-blocking asynchronous notification dispatch
      this.dispatchNotification(incident).catch((err) => {
        console.warn('[ALERTS_FAILSAFE] Failed in async notification dispatch:', err);
      });

      return incident;
    } catch (err) {
      console.warn('[ALERTS_FAILSAFE] Failed to record incident:', err);
      return {
        id: `inc_fallback_${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...event,
      };
    }
  }

  /**
   * Non-blocking evaluation of operational API performance conditions
   */
  public evaluate(metrics: {
    totalRequests: number;
    serverErrors: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    heapUsedMb: number;
  }): void {
    try {
      const now = Date.now();
      const sampleCount = metrics.totalRequests;

      // 1. Evaluate 5xx Error Rate
      if (sampleCount >= this.thresholds.minSampleCount) {
        const errorRate5xx = sampleCount > 0 ? metrics.serverErrors / sampleCount : 0;
        let nextState: AlertState = 'NORMAL';
        let threshold = 0;

        if (errorRate5xx >= this.thresholds.errorRate5xxCrit) {
          nextState = 'CRITICAL';
          threshold = this.thresholds.errorRate5xxCrit;
        } else if (errorRate5xx >= this.thresholds.errorRate5xxWarn) {
          nextState = 'WARNING';
          threshold = this.thresholds.errorRate5xxWarn;
        }

        if (nextState !== this.stateErrorRate) {
          const prevState = this.stateErrorRate;
          this.stateErrorRate = nextState;
          this.lastAlertTime.error_rate = now;

          const isRecovery = nextState === 'NORMAL';
          this.recordIncident({
            eventType: isRecovery
              ? 'observability.alert.recovered'
              : nextState === 'CRITICAL'
              ? 'observability.alert.critical'
              : 'observability.alert.warning',
            alertType: 'error_rate',
            severity: nextState === 'CRITICAL' ? 'critical' : nextState === 'WARNING' ? 'warning' : 'info',
            previousState: prevState,
            newState: nextState,
            metricValue: Math.round(errorRate5xx * 1000) / 1000,
            thresholdValue: threshold,
            message: isRecovery
              ? `API 5xx error rate recovered to normal (${(errorRate5xx * 100).toFixed(1)}%)`
              : `API 5xx error rate reached ${nextState} threshold: ${(errorRate5xx * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`,
          });
        }
      }

      // 2. Evaluate P95 Latency
      if (sampleCount >= this.thresholds.minSampleCount) {
        const p95 = metrics.p95LatencyMs;
        let nextP95State: AlertState = 'NORMAL';
        if (p95 >= this.thresholds.latencyP95WarnMs) {
          nextP95State = 'WARNING';
        }

        if (nextP95State !== this.stateLatencyP95) {
          const prevState = this.stateLatencyP95;
          this.stateLatencyP95 = nextP95State;
          this.lastAlertTime.latency_p95 = now;

          const isRecovery = nextP95State === 'NORMAL';
          this.recordIncident({
            eventType: isRecovery ? 'observability.alert.recovered' : 'observability.alert.warning',
            alertType: 'latency_p95',
            severity: nextP95State === 'WARNING' ? 'warning' : 'info',
            previousState: prevState,
            newState: nextP95State,
            metricValue: p95,
            thresholdValue: this.thresholds.latencyP95WarnMs,
            message: isRecovery
              ? `P95 latency normalized to ${p95}ms`
              : `P95 latency exceeded WARNING threshold: ${p95}ms >= ${this.thresholds.latencyP95WarnMs}ms`,
          });
        }
      }

      // 3. Evaluate P99 Latency
      if (sampleCount >= this.thresholds.minSampleCount) {
        const p99 = metrics.p99LatencyMs;
        let nextP99State: AlertState = 'NORMAL';
        if (p99 >= this.thresholds.latencyP99CritMs) {
          nextP99State = 'CRITICAL';
        }

        if (nextP99State !== this.stateLatencyP99) {
          const prevState = this.stateLatencyP99;
          this.stateLatencyP99 = nextP99State;
          this.lastAlertTime.latency_p99 = now;

          const isRecovery = nextP99State === 'NORMAL';
          this.recordIncident({
            eventType: isRecovery ? 'observability.alert.recovered' : 'observability.alert.critical',
            alertType: 'latency_p99',
            severity: nextP99State === 'CRITICAL' ? 'critical' : 'info',
            previousState: prevState,
            newState: nextP99State,
            metricValue: p99,
            thresholdValue: this.thresholds.latencyP99CritMs,
            message: isRecovery
              ? `P99 latency normalized to ${p99}ms`
              : `P99 latency exceeded CRITICAL threshold: ${p99}ms >= ${this.thresholds.latencyP99CritMs}ms`,
          });
        }
      }

      // 4. Evaluate Memory Pressure
      const heapMb = metrics.heapUsedMb;
      let nextMemState: AlertState = 'NORMAL';
      if (heapMb >= this.thresholds.memoryHeapUsedMbWarn) {
        nextMemState = 'WARNING';
      }

      if (nextMemState !== this.stateMemory) {
        const prevState = this.stateMemory;
        this.stateMemory = nextMemState;
        this.lastAlertTime.memory_pressure = now;

        const isRecovery = nextMemState === 'NORMAL';
        this.recordIncident({
          eventType: isRecovery ? 'observability.alert.recovered' : 'observability.alert.warning',
          alertType: 'memory_pressure',
          severity: nextMemState === 'WARNING' ? 'warning' : 'info',
          previousState: prevState,
          newState: nextMemState,
          metricValue: heapMb,
          thresholdValue: this.thresholds.memoryHeapUsedMbWarn,
          message: isRecovery
            ? `Process heap memory normalized to ${heapMb}MB`
            : `Process heap memory exceeded WARNING threshold: ${heapMb}MB >= ${this.thresholds.memoryHeapUsedMbWarn}MB`,
        });
      }
    } catch (err) {
      console.warn('[ALERTS_FAILSAFE] Alert evaluation error:', err);
    }
  }

  /**
   * Evaluates database query performance and failures.
   */
  public evaluateDatabase(dbMetrics: { operation: string; durationMs: number; isError: boolean }): void {
    try {
      const now = Date.now();
      const isSlow = dbMetrics.durationMs >= this.thresholds.dbSlowQueryWarnMs;
      const isError = dbMetrics.isError;

      if ((isSlow || isError) && now - this.lastAlertTime.database_health > this.thresholds.cooldownMs) {
        this.lastAlertTime.database_health = now;
        const severity: AlertSeverity = isError ? 'critical' : 'warning';
        this.stateDatabase = isError ? 'CRITICAL' : 'WARNING';

        this.recordIncident({
          eventType: isError ? 'observability.alert.critical' : 'observability.alert.warning',
          alertType: 'database_health',
          severity,
          previousState: 'NORMAL',
          newState: this.stateDatabase,
          metricValue: dbMetrics.durationMs,
          thresholdValue: this.thresholds.dbSlowQueryWarnMs,
          message: isError
            ? `Database operation '${dbMetrics.operation}' failed with error.`
            : `Database operation '${dbMetrics.operation}' exceeded slow query threshold: ${dbMetrics.durationMs}ms >= ${this.thresholds.dbSlowQueryWarnMs}ms`,
          metadata: {
            operation: dbMetrics.operation,
            durationMs: dbMetrics.durationMs,
            isError: dbMetrics.isError,
          },
        });
      }
    } catch (err) {
      console.warn('[ALERTS_FAILSAFE] DB alert evaluation error:', err);
    }
  }

  /**
   * Immediate trigger for multi-tenant isolation violations (Zero-Tolerance).
   */
  public triggerSecurityViolation(details: {
    requestedEstate: string;
    userEstate: string;
    userId?: string;
    role?: string;
    ip?: string;
  }): IncidentEvent {
    const now = Date.now();
    this.lastAlertTime.tenant_security = now;
    this.stateTenantSecurity = 'CRITICAL';

    return this.recordIncident({
      eventType: 'observability.alert.critical',
      alertType: 'tenant_security',
      severity: 'critical',
      previousState: 'NORMAL',
      newState: 'CRITICAL',
      metricValue: 1,
      thresholdValue: this.thresholds.tenantViolationBurstCrit,
      message: `CRITICAL TENANT VIOLATION: User '${details.userId || 'unknown'}' (${details.role || 'unknown'}, estate: '${details.userEstate}') attempted unauthorized access to estate '${details.requestedEstate}'. Blocked by RLS/Tenant Boundary.`,
      metadata: {
        requestedEstate: details.requestedEstate,
        userEstate: details.userEstate,
        userId: details.userId || 'anonymous',
        role: details.role || 'anonymous',
        ip: details.ip || 'unknown',
      },
    });
  }

  /**
   * Evaluates authentication failure bursts (brute-force detection).
   */
  public evaluateAuthBurst(failuresInWindow: number, ipOrUser: string): void {
    const now = Date.now();
    if (failuresInWindow >= this.thresholds.authFailureBurstCrit && now - this.lastAlertTime.auth_security > this.thresholds.cooldownMs) {
      this.lastAlertTime.auth_security = now;
      this.stateAuth = 'CRITICAL';

      this.recordIncident({
        eventType: 'observability.alert.critical',
        alertType: 'auth_security',
        severity: 'critical',
        previousState: 'NORMAL',
        newState: 'CRITICAL',
        metricValue: failuresInWindow,
        thresholdValue: this.thresholds.authFailureBurstCrit,
        message: `SUSPICIOUS AUTH ACTIVITY: ${failuresInWindow} consecutive authentication failures detected for identifier/IP: '${ipOrUser}'.`,
        metadata: {
          failuresCount: failuresInWindow,
          identifier: ipOrUser,
        },
      });
    }
  }

  /**
   * Evaluates cron and background job queue status.
   */
  public evaluateCron(queueMetrics: { failed: number; totalJobs: number; queued: number }): void {
    const now = Date.now();
    if (queueMetrics.failed >= this.thresholds.cronFailedJobsCrit && now - this.lastAlertTime.cron_jobs > this.thresholds.cooldownMs) {
      this.lastAlertTime.cron_jobs = now;
      this.stateCron = 'WARNING';

      this.recordIncident({
        eventType: 'observability.alert.warning',
        alertType: 'cron_jobs',
        severity: 'warning',
        previousState: 'NORMAL',
        newState: 'WARNING',
        metricValue: queueMetrics.failed,
        thresholdValue: this.thresholds.cronFailedJobsCrit,
        message: `Background job queue warning: ${queueMetrics.failed} failed jobs detected in queue (queued: ${queueMetrics.queued}, total: ${queueMetrics.totalJobs}).`,
        metadata: {
          failedJobs: queueMetrics.failed,
          queuedJobs: queueMetrics.queued,
          totalJobs: queueMetrics.totalJobs,
        },
      });
    }
  }

  /**
   * Evaluates backup age and health.
   */
  public evaluateBackup(backupInfo: { lastBackupHoursAgo?: number; status?: string; error?: string }): void {
    const now = Date.now();
    const hours = backupInfo.lastBackupHoursAgo ?? 0;

    if (hours >= this.thresholds.backupAgeHoursCrit) {
      if (now - this.lastAlertTime.backup_health > this.thresholds.cooldownMs) {
        this.lastAlertTime.backup_health = now;
        this.stateBackup = 'CRITICAL';

        this.recordIncident({
          eventType: 'observability.alert.critical',
          alertType: 'backup_health',
          severity: 'critical',
          previousState: 'NORMAL',
          newState: 'CRITICAL',
          metricValue: Math.round(hours),
          thresholdValue: this.thresholds.backupAgeHoursCrit,
          message: `BACKUP CRITICAL: Latest verified backup is ${Math.round(hours)} hours old (critical threshold: ${this.thresholds.backupAgeHoursCrit}h). Immediate backup required!`,
        });
      }
    } else if (hours >= this.thresholds.backupAgeHoursWarn) {
      if (now - this.lastAlertTime.backup_health > this.thresholds.cooldownMs) {
        this.lastAlertTime.backup_health = now;
        this.stateBackup = 'WARNING';

        this.recordIncident({
          eventType: 'observability.alert.warning',
          alertType: 'backup_health',
          severity: 'warning',
          previousState: 'NORMAL',
          newState: 'WARNING',
          metricValue: Math.round(hours),
          thresholdValue: this.thresholds.backupAgeHoursWarn,
          message: `BACKUP WARNING: Latest backup is ${Math.round(hours)} hours old (warning threshold: ${this.thresholds.backupAgeHoursWarn}h).`,
        });
      }
    }
  }

  /**
   * Dispatches a synthetic test notification to verify end-to-end alert delivery.
   */
  public async dispatchTestNotification(reason: string = 'Operator Manual Probe'): Promise<{
    success: boolean;
    notification: NotificationDeliveryRecord;
    incident: IncidentEvent;
  }> {
    const testIncident: IncidentEvent = {
      id: `test_inc_${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'observability.alert.warning',
      alertType: 'critical_app_error',
      severity: 'warning',
      previousState: 'NORMAL',
      newState: 'WARNING',
      metricValue: 1,
      thresholdValue: 1,
      message: `[SYNTHETIC TEST ALERT] Verification probe triggered: ${reason}. All monitoring channels operational.`,
      metadata: {
        isTest: true,
        reason,
        verifiedAt: new Date().toISOString(),
      },
    };

    const delivery = await this.dispatchNotification(testIncident);
    return {
      success: delivery.status !== 'FAILED',
      notification: delivery,
      incident: testIncident,
    };
  }

  /**
   * Reset internal states for clean testing / simulation
   */
  public resetStatesForTesting(): void {
    this.stateErrorRate = 'NORMAL';
    this.stateLatencyP95 = 'NORMAL';
    this.stateLatencyP99 = 'NORMAL';
    this.stateMemory = 'NORMAL';
    this.stateDatabase = 'NORMAL';
    this.stateAuth = 'NORMAL';
    this.stateTenantSecurity = 'NORMAL';
    this.stateCron = 'NORMAL';
    this.stateBackup = 'NORMAL';
    this.lastAlertTime = {
      error_rate: 0,
      latency_p95: 0,
      latency_p99: 0,
      memory_pressure: 0,
      database_health: 0,
      auth_security: 0,
      tenant_security: 0,
      cron_jobs: 0,
      backup_health: 0,
      critical_app_error: 0,
    };
  }

  /**
   * Get composite health signals snapshot
   */
  public getHealthSignal(snapshot: any): SystemHealthSignal {
    try {
      const activeAlerts: SystemHealthSignal['activeAlerts'] = [];

      let overallState: AlertState = 'NORMAL';

      const isCritical =
        this.stateErrorRate === 'CRITICAL' ||
        this.stateLatencyP99 === 'CRITICAL' ||
        this.stateTenantSecurity === 'CRITICAL' ||
        this.stateAuth === 'CRITICAL' ||
        this.stateDatabase === 'CRITICAL' ||
        this.stateBackup === 'CRITICAL';

      const isWarning =
        this.stateErrorRate === 'WARNING' ||
        this.stateLatencyP95 === 'WARNING' ||
        this.stateMemory === 'WARNING' ||
        this.stateCron === 'WARNING' ||
        this.stateDatabase === 'WARNING' ||
        this.stateBackup === 'WARNING';

      if (isCritical) {
        overallState = 'CRITICAL';
      } else if (isWarning) {
        overallState = 'WARNING';
      }

      // Compute total aggregate server errors & total requests across endpoints
      let totalReqs = 0;
      let total5xx = 0;
      let maxP95 = 0;
      let maxP99 = 0;

      if (snapshot?.endpoints && Array.isArray(snapshot.endpoints)) {
        for (const ep of snapshot.endpoints) {
          totalReqs += ep.requests || 0;
          total5xx += ep.serverErrors || 0;
          if (ep.latency?.p95 && ep.latency.p95 > maxP95) maxP95 = ep.latency.p95;
          if (ep.latency?.p99 && ep.latency.p99 > maxP99) maxP99 = ep.latency.p99;
        }
      }

      const current5xxRate = totalReqs > 0 ? total5xx / totalReqs : 0;
      const heapMb = snapshot?.process?.memory?.heapUsedMb || Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

      if (this.stateErrorRate !== 'NORMAL') {
        activeAlerts.push({
          type: 'error_rate',
          state: this.stateErrorRate,
          severity: this.stateErrorRate === 'CRITICAL' ? 'critical' : 'warning',
          message: `High 5xx error rate: ${(current5xxRate * 100).toFixed(1)}%`,
          metricValue: Math.round(current5xxRate * 1000) / 1000,
          threshold: this.stateErrorRate === 'CRITICAL' ? this.thresholds.errorRate5xxCrit : this.thresholds.errorRate5xxWarn,
        });
      }

      if (this.stateLatencyP95 !== 'NORMAL') {
        activeAlerts.push({
          type: 'latency_p95',
          state: this.stateLatencyP95,
          severity: 'warning',
          message: `P95 latency elevated: ${maxP95}ms`,
          metricValue: maxP95,
          threshold: this.thresholds.latencyP95WarnMs,
        });
      }

      if (this.stateLatencyP99 !== 'NORMAL') {
        activeAlerts.push({
          type: 'latency_p99',
          state: this.stateLatencyP99,
          severity: 'critical',
          message: `P99 latency severe: ${maxP99}ms`,
          metricValue: maxP99,
          threshold: this.thresholds.latencyP99CritMs,
        });
      }

      if (this.stateMemory !== 'NORMAL') {
        activeAlerts.push({
          type: 'memory_pressure',
          state: this.stateMemory,
          severity: 'warning',
          message: `Memory heap elevated: ${heapMb}MB`,
          metricValue: heapMb,
          threshold: this.thresholds.memoryHeapUsedMbWarn,
        });
      }

      if (this.stateTenantSecurity !== 'NORMAL') {
        activeAlerts.push({
          type: 'tenant_security',
          state: this.stateTenantSecurity,
          severity: 'critical',
          message: `Cross-tenant boundary violation detected and blocked.`,
          metricValue: 1,
          threshold: this.thresholds.tenantViolationBurstCrit,
        });
      }

      if (this.stateDatabase !== 'NORMAL') {
        activeAlerts.push({
          type: 'database_health',
          state: this.stateDatabase,
          severity: this.stateDatabase === 'CRITICAL' ? 'critical' : 'warning',
          message: `Database latency or connection degraded.`,
          metricValue: 1,
          threshold: this.thresholds.dbSlowQueryWarnMs,
        });
      }

      if (this.stateCron !== 'NORMAL') {
        activeAlerts.push({
          type: 'cron_jobs',
          state: this.stateCron,
          severity: 'warning',
          message: `Background jobs failure backlog elevated.`,
          metricValue: 1,
          threshold: this.thresholds.cronFailedJobsCrit,
        });
      }

      if (this.stateBackup !== 'NORMAL') {
        activeAlerts.push({
          type: 'backup_health',
          state: this.stateBackup,
          severity: this.stateBackup === 'CRITICAL' ? 'critical' : 'warning',
          message: `Backup freshness alert: Stale or missing backup.`,
          metricValue: 1,
          threshold: this.thresholds.backupAgeHoursWarn,
        });
      }

      const lastDelivery = this.notificationHistory.length > 0
        ? this.notificationHistory[this.notificationHistory.length - 1]
        : undefined;

      return {
        status: overallState === 'CRITICAL' ? 'critical' : overallState === 'WARNING' ? 'degraded' : 'healthy',
        overallState,
        activeAlerts,
        uptimeSeconds: snapshot?.process?.uptimeSeconds || Math.round(process.uptime()),
        sampleCount: totalReqs,
        errorRate5xx: Math.round(current5xxRate * 1000) / 1000,
        latencyP95Ms: maxP95,
        latencyP99Ms: maxP99,
        memoryHeapMb: heapMb,
        recentIncidents: this.incidentHistory.slice(-20),
        thresholds: this.getThresholds(),
        notificationChannel: {
          webhookConfigured: !!(process.env.ALERT_WEBHOOK_URL && process.env.ALERT_WEBHOOK_URL.trim().length > 0),
          totalNotificationsDelivered: this.notificationHistory.filter(n => n.status === 'DELIVERED').length,
          lastDelivery,
        },
      };
    } catch (err) {
      console.warn('[ALERTS_FAILSAFE] Failed to generate health signal:', err);
      return {
        status: 'healthy',
        overallState: 'NORMAL',
        activeAlerts: [],
        uptimeSeconds: Math.round(process.uptime()),
        sampleCount: 0,
        errorRate5xx: 0,
        latencyP95Ms: 0,
        latencyP99Ms: 0,
        memoryHeapMb: 0,
        recentIncidents: [],
        thresholds: this.getThresholds(),
        notificationChannel: {
          webhookConfigured: false,
          totalNotificationsDelivered: 0,
        },
      };
    }
  }
}

export const alertManager = new AlertIntelligenceManager();
