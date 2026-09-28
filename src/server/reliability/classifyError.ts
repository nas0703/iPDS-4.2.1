import { ClassifiedError, ErrorCategory } from './types.js';

/**
 * Classify any unknown error into a structured category with retryability evaluation.
 * Handles HTTP statuses, Gemini SDK errors, Node.js network errors, and AbortErrors.
 */
export function classifyError(error: unknown): ClassifiedError {
  if (!error) {
    return {
      category: 'PERMANENT',
      isRetryable: false,
      message: 'Unknown empty error',
      originalError: error,
    };
  }

  const err = error as any;
  const message = typeof err.message === 'string' ? err.message : String(err);
  const status = err.status || err.statusCode || err.response?.status;

  // 1. Timeout / Abort detection
  if (
    err.name === 'AbortError' ||
    err.name === 'TimeoutError' ||
    err.code === 'ABORT_ERR' ||
    err.code === 'ETIMEDOUT' ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('aborted') ||
    status === 408 ||
    status === 504
  ) {
    return {
      category: 'TIMEOUT',
      isRetryable: true,
      statusCode: status || 504,
      message,
      originalError: error,
    };
  }

  // 2. Rate limiting / Quota exhaustion (HTTP 429 / RESOURCE_EXHAUSTED)
  if (
    status === 429 ||
    err.code === 429 ||
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.toLowerCase().includes('quota exceeded') ||
    message.toLowerCase().includes('rate limit')
  ) {
    return {
      category: 'RATE_LIMITED',
      isRetryable: true,
      statusCode: 429,
      message,
      originalError: error,
    };
  }

  // 3. Transient Network / Server errors (500, 502, 503, connection drops)
  const isNetworkTransient =
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'EAI_AGAIN' ||
    err.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    message.toLowerCase().includes('socket hang up') ||
    message.toLowerCase().includes('network error') ||
    message.toLowerCase().includes('fetch failed') ||
    message.toLowerCase().includes('econnreset') ||
    message.toLowerCase().includes('overloaded');

  const isServerTransient =
    status === 500 ||
    status === 502 ||
    status === 503;

  if (isNetworkTransient || isServerTransient) {
    return {
      category: 'TRANSIENT',
      isRetryable: true,
      statusCode: status || 503,
      message,
      originalError: error,
    };
  }

  // 4. Permanent Client & Auth Errors (400, 401, 403, 404, 422, etc.)
  if (status && status >= 400 && status < 500) {
    return {
      category: 'PERMANENT',
      isRetryable: false,
      statusCode: status,
      message,
      originalError: error,
    };
  }

  // Default fallback: treat unclassified errors as permanent to avoid blind retry storms
  return {
    category: 'PERMANENT',
    isRetryable: false,
    statusCode: status,
    message,
    originalError: error,
  };
}
