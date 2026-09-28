import { ClassifiedError, RetryOptions } from './types.js';
import { classifyError } from './classifyError.js';

const DEFAULT_RETRYABLE_CATEGORIES = ['TRANSIENT', 'TIMEOUT', 'RATE_LIMITED'] as const;

/**
 * Calculates exponential backoff with full randomized jitter to prevent thundering herds.
 */
function calculateJitteredDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  factor: number,
  useJitter: boolean
): number {
  const exponentialDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(factor, attempt - 1));
  if (!useJitter) {
    return exponentialDelay;
  }
  // Full jitter: uniformly distributed between 0 and exponentialDelay
  return Math.floor(Math.random() * exponentialDelay);
}

/**
 * Non-blocking asynchronous sleep with Promise.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an async operation with bounded retries and exponential backoff + jitter.
 * ONLY retries transient/timeout/rate-limited errors. Fails fast on permanent errors.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const initialDelayMs = Math.max(10, options.initialDelayMs ?? 500);
  const maxDelayMs = Math.max(initialDelayMs, options.maxDelayMs ?? 5000);
  const backoffFactor = Math.max(1, options.backoffFactor ?? 2);
  const useJitter = options.jitter ?? true;
  const retryableCategories = options.retryableCategories ?? DEFAULT_RETRYABLE_CATEGORIES;

  let lastClassifiedError: ClassifiedError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      const classified = classifyError(error);
      lastClassifiedError = classified;

      const isRetryAllowed =
        attempt < maxAttempts &&
        classified.isRetryable &&
        retryableCategories.includes(classified.category as any);

      if (!isRetryAllowed) {
        // Fast-fail: permanent error or exhausted max attempts
        throw error;
      }

      const delayMs = calculateJitteredDelay(
        attempt,
        initialDelayMs,
        maxDelayMs,
        backoffFactor,
        useJitter
      );

      if (options.onRetry) {
        try {
          options.onRetry(attempt, delayMs, classified);
        } catch {
          // Prevent onRetry callback errors from crashing the retry loop
        }
      }

      await sleep(delayMs);
    }
  }

  throw lastClassifiedError?.originalError || new Error('Retry attempts exhausted');
}
