/**
 * Operational Metrics Collector (In-Memory)
 * 
 * ZERO DISRUPTION GUARANTEE:
 * 1. Non-blocking & failsafe execution.
 * 2. Does NOT depend on any external database.
 * 3. Bounded memory usage (uses fixed size maps and circular buffers).
 * 4. Fails safely on error, allowing API requests to complete.
 */

import { alertManager } from './alerts.js';

export interface EndpointMetric {
  method: string;
  route: string;
  totalRequests: number;
  successRequests: number;
  clientErrors: number;
  serverErrors: number;
  durations: {
    min: number;
    max: number;
    sum: number;
    count: number;
    // Circular buffer for recent durations to calculate percentiles
    recent: number[];
    recentIndex: number;
  };
}

export interface DatabaseTimingMetric {
  operation: string;
  count: number;
  sumMs: number;
  minMs: number;
  maxMs: number;
  errors: number;
}

export interface AiTimingMetric {
  operation: string;
  category: string;
  count: number;
  sumMs: number;
  success: number;
  errors: number;
}

export type LatencyCategory = 'NORMAL' | 'SLOW' | 'VERY_SLOW';

export function getLatencyCategory(durationMs: number): LatencyCategory {
  if (durationMs < 500) return 'NORMAL';
  if (durationMs <= 2000) return 'SLOW';
  return 'VERY_SLOW';
}

export interface SecurityEventSummary {
  timestamp: string;
  type: 'auth_failure' | 'auth_denied' | 'estate_denied' | 'rate_limit_hit' | 'ai_failure' | 'suspicious_probe' | 'malformed_payload';
  details?: Record<string, any>;
}

const MAX_RECENT_DURATIONS = 100;
const MAX_ENDPOINTS = 500;
const MAX_RECENT_SECURITY_EVENTS = 50;

class MetricsCollector {
  private endpointMetrics = new Map<string, EndpointMetric>();
  private dbMetrics = new Map<string, DatabaseTimingMetric>();
  private aiMetrics = new Map<string, AiTimingMetric>();

  // Aggregate operational counters (in-memory bounded)
  private operationalCounters = {
    total_requests_total: 0,
    successful_requests_total: 0,
    failed_requests_total: 0,
    slow_requests_total: 0,
  };

  // Aggregate security signals (in-memory bounded)
  private securityCounters = {
    authFailures: 0,
    authDenials: 0,
    estateDenials: 0,
    rateLimitHits: 0,
    aiFailures: 0,
    suspiciousProbes: 0,
    malformedPayloads: 0,
  };
  private recentSecurityEvents: SecurityEventSummary[] = [];

  // Aggregate reliability signals (in-memory bounded)
  private reliabilityCounters = {
    reliability_timeout_total: 0,
    reliability_retry_total: 0,
    reliability_circuit_open_total: 0,
  };

  /**
   * Normalize route patterns to avoid high cardinality.
   * e.g., /api/hantaran/123 -> /api/hantaran/:id
   */
  private normalizeRoute(path: string): string {
    if (!path) return '/unknown';
    
    // Replace UUIDs
    let normalized = path.replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=\/|$)/g, '/:id');
    // Replace numeric IDs
    normalized = normalized.replace(/\/\d+(?=\/|$)/g, '/:id');
    
    return normalized;
  }

  public recordRequest(path: string, method: string = 'GET', statusCode: number = 200, durationMs: number = 50): void {
    this.recordApiRequest(method, path, statusCode, durationMs);
  }

  public recordApiRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    try {
      const route = this.normalizeRoute(path);
      const key = `${method} ${route}`;

      // Protect against unbounded memory growth
      if (!this.endpointMetrics.has(key) && this.endpointMetrics.size >= MAX_ENDPOINTS) {
        return; // Drop metric if too many unique endpoints
      }

      let metric = this.endpointMetrics.get(key);
      if (!metric) {
        metric = {
          method,
          route,
          totalRequests: 0,
          successRequests: 0,
          clientErrors: 0,
          serverErrors: 0,
          durations: {
            min: Number.MAX_SAFE_INTEGER,
            max: 0,
            sum: 0,
            count: 0,
            recent: new Array(MAX_RECENT_DURATIONS).fill(0),
            recentIndex: 0,
          }
        };
        this.endpointMetrics.set(key, metric);
      }

      metric.totalRequests++;
      
      this.operationalCounters.total_requests_total++;

      if (statusCode >= 500) {
        metric.serverErrors++;
        this.operationalCounters.failed_requests_total++;
      } else if (statusCode >= 400) {
        metric.clientErrors++;
        this.operationalCounters.failed_requests_total++;
      } else {
        metric.successRequests++;
        this.operationalCounters.successful_requests_total++;
      }

      // Check if duration exceeds slow request threshold (default 1500ms for standard API)
      if (durationMs >= 1500) {
        this.operationalCounters.slow_requests_total++;
      }

      metric.durations.count++;
      metric.durations.sum += durationMs;
      if (durationMs < metric.durations.min) metric.durations.min = durationMs;
      if (durationMs > metric.durations.max) metric.durations.max = durationMs;

      metric.durations.recent[metric.durations.recentIndex] = durationMs;
      metric.durations.recentIndex = (metric.durations.recentIndex + 1) % MAX_RECENT_DURATIONS;

      // Non-blocking threshold evaluation
      try {
        const validRecent = metric.durations.recent.filter(v => v > 0);
        alertManager.evaluate({
          totalRequests: metric.totalRequests,
          serverErrors: metric.serverErrors,
          p95LatencyMs: this.calculatePercentile(validRecent, 95),
          p99LatencyMs: this.calculatePercentile(validRecent, 99),
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        });
      } catch (alertErr) {
        // Failsafe: alert evaluation must never disrupt metrics recording
        console.warn('[METRICS_ALERT_FAILSAFE] Alert evaluation failed:', alertErr);
      }

    } catch (err) {
      // Failsafe: Log locally but do not crash
      console.warn('[METRICS_FAILSAFE] Failed to record API metric:', err);
    }
  }

  public recordDatabaseTiming(operation: string, durationMs: number, isError: boolean = false): void {
    try {
      if (!this.dbMetrics.has(operation) && this.dbMetrics.size >= 100) return;
      
      let metric = this.dbMetrics.get(operation);
      if (!metric) {
        metric = { operation, count: 0, sumMs: 0, minMs: Number.MAX_SAFE_INTEGER, maxMs: 0, errors: 0 };
        this.dbMetrics.set(operation, metric);
      }

      metric.count++;
      metric.sumMs += durationMs;
      if (isError) metric.errors++;
      if (durationMs < metric.minMs) metric.minMs = durationMs;
      if (durationMs > metric.maxMs) metric.maxMs = durationMs;
    } catch (err) {
      console.warn('[METRICS_FAILSAFE] Failed to record DB metric:', err);
    }
  }

  public recordAiTiming(operation: string, category: string, durationMs: number, isError: boolean = false): void {
    try {
      const key = `${category}:${operation}`;
      if (!this.aiMetrics.has(key) && this.aiMetrics.size >= 100) return;
      
      let metric = this.aiMetrics.get(key);
      if (!metric) {
        metric = { operation, category, count: 0, sumMs: 0, success: 0, errors: 0 };
        this.aiMetrics.set(key, metric);
      }

      metric.count++;
      metric.sumMs += durationMs;
      if (isError) {
        metric.errors++;
        this.recordSecurityEvent('ai_failure', { operation, category });
      } else {
        metric.success++;
      }
    } catch (err) {
      console.warn('[METRICS_FAILSAFE] Failed to record AI metric:', err);
    }
  }

  /**
   * Record security aggregate events (non-PII operational telemetry)
   */
  public recordSecurityEvent(
    type: 'auth_failure' | 'auth_denied' | 'estate_denied' | 'rate_limit_hit' | 'ai_failure' | 'suspicious_probe' | 'malformed_payload',
    details?: Record<string, any>
  ): void {
    try {
      switch (type) {
        case 'auth_failure':
          this.securityCounters.authFailures++;
          break;
        case 'auth_denied':
          this.securityCounters.authDenials++;
          break;
        case 'estate_denied':
          this.securityCounters.estateDenials++;
          break;
        case 'rate_limit_hit':
          this.securityCounters.rateLimitHits++;
          break;
        case 'ai_failure':
          this.securityCounters.aiFailures++;
          break;
        case 'suspicious_probe':
          this.securityCounters.suspiciousProbes++;
          break;
        case 'malformed_payload':
          this.securityCounters.malformedPayloads++;
          break;
      }

      const summary: SecurityEventSummary = {
        timestamp: new Date().toISOString(),
        type,
        details: details ? { ...details } : undefined,
      };

      if (this.recentSecurityEvents.length >= MAX_RECENT_SECURITY_EVENTS) {
        this.recentSecurityEvents.shift();
      }
      this.recentSecurityEvents.push(summary);
    } catch (err) {
      console.warn('[METRICS_FAILSAFE] Failed to record security event:', err);
    }
  }

  public getSecurityMetrics() {
    return {
      counters: { ...this.securityCounters },
      recentEvents: [...this.recentSecurityEvents],
    };
  }

  /**
   * Record reliability events (non-PII operational counters)
   */
  public recordReliabilityEvent(type: 'timeout' | 'retry' | 'circuit_open'): void {
    try {
      if (type === 'timeout') {
        this.reliabilityCounters.reliability_timeout_total++;
      } else if (type === 'retry') {
        this.reliabilityCounters.reliability_retry_total++;
      } else if (type === 'circuit_open') {
        this.reliabilityCounters.reliability_circuit_open_total++;
      }
    } catch (err) {
      console.warn('[METRICS_FAILSAFE] Failed to record reliability event:', err);
    }
  }

  public getReliabilityMetrics() {
    return {
      counters: { ...this.reliabilityCounters },
    };
  }

  public getOperationalMetrics() {
    return {
      counters: { ...this.operationalCounters },
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  public getSnapshot() {
    try {
      const endpoints = Array.from(this.endpointMetrics.values()).map(m => {
        const avg = m.durations.count > 0 ? m.durations.sum / m.durations.count : 0;
        const validRecent = m.durations.recent.filter(v => v > 0);
        
        return {
          method: m.method,
          route: m.route,
          requests: m.totalRequests,
          success: m.successRequests,
          clientErrors: m.clientErrors,
          serverErrors: m.serverErrors,
          errorRate: m.totalRequests > 0 ? (m.clientErrors + m.serverErrors) / m.totalRequests : 0,
          latency: {
            avg: Math.round(avg * 100) / 100,
            min: m.durations.min === Number.MAX_SAFE_INTEGER ? 0 : m.durations.min,
            max: m.durations.max,
            p50: this.calculatePercentile(validRecent, 50),
            p95: this.calculatePercentile(validRecent, 95),
            p99: this.calculatePercentile(validRecent, 99),
            category: getLatencyCategory(avg)
          }
        };
      });

      const database = Array.from(this.dbMetrics.values()).map(m => ({
        operation: m.operation,
        requests: m.count,
        errors: m.errors,
        latency: {
          avg: m.count > 0 ? Math.round((m.sumMs / m.count) * 100) / 100 : 0,
          min: m.minMs === Number.MAX_SAFE_INTEGER ? 0 : m.minMs,
          max: m.maxMs
        }
      }));

      const ai = Array.from(this.aiMetrics.values()).map(m => ({
        operation: m.operation,
        category: m.category,
        requests: m.count,
        success: m.success,
        errors: m.errors,
        avgLatency: m.count > 0 ? Math.round((m.sumMs / m.count) * 100) / 100 : 0
      }));

      const security = this.getSecurityMetrics();
      const reliability = this.getReliabilityMetrics();
      const operational = this.getOperationalMetrics();

      const baseSnapshot = {
        timestamp: new Date().toISOString(),
        process: {
          uptimeSeconds: Math.round(process.uptime()),
          memory: {
            heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
            heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
            rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100
          }
        },
        endpoints,
        database,
        ai,
        security,
        reliability,
        operational
      };

      const health = alertManager.getHealthSignal(baseSnapshot);

      return {
        ...baseSnapshot,
        health
      };
    } catch (err) {
      console.warn('[METRICS_FAILSAFE] Failed to generate metrics snapshot:', err);
      return { error: 'Failed to generate metrics snapshot' };
    }
  }
}

export const metricsCollector = new MetricsCollector();
