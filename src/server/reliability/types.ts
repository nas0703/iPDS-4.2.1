/**
 * iPDS v3.8 — Enterprise Reliability Types
 * Lightweight definitions for error classification, retry, timeouts, and circuit breakers.
 */

export type ErrorCategory =
  | 'TRANSIENT'            // 429, 502, 503, 504, ECONNRESET, ETIMEDOUT, socket hangup
  | 'TIMEOUT'              // Explicit abort / timeout expiration
  | 'RATE_LIMITED'        // 429 / RESOURCE_EXHAUSTED specifically
  | 'PERMANENT'            // 400, 401, 403, 404, invalid syntax, unrecoverable
  | 'CIRCUIT_OPEN'         // Short-circuited by active circuit breaker
  | 'DEPENDENCY_UNAVAILABLE'; // Upstream service marked down

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ClassifiedError {
  category: ErrorCategory;
  isRetryable: boolean;
  statusCode?: number;
  message: string;
  originalError: unknown;
}

export interface RetryOptions {
  maxAttempts?: number;        // Maximum number of attempts (default: 3)
  initialDelayMs?: number;     // Initial delay before first retry in ms (default: 500)
  maxDelayMs?: number;         // Maximum cap on exponential delay in ms (default: 5000)
  backoffFactor?: number;      // Exponential multiplier (default: 2)
  jitter?: boolean;            // Whether to add full jitter (default: true)
  retryableCategories?: ErrorCategory[]; // Categories allowed to retry
  onRetry?: (attempt: number, delayMs: number, error: ClassifiedError) => void;
}

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;   // Number of consecutive failures before opening (default: 5)
  successThreshold?: number;   // Consecutive successes in HALF_OPEN to close (default: 2)
  cooldownMs?: number;         // Time to stay OPEN before moving to HALF_OPEN (default: 30000)
  onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
}

export interface TimeoutOptions {
  timeoutMs: number;
  operationName?: string;
  abortController?: AbortController;
}
