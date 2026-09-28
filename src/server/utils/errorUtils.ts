/**
 * Type-Safe Error Handling Utilities
 * Provides structured error classification, safe message extraction, and consistent API error responses.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden for this role') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * Safely extracts error message from an unknown catch block variable
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as Record<string, unknown>).message === 'string') {
      return String((error as Record<string, unknown>).message);
    }
    if ('error' in error && typeof (error as Record<string, unknown>).error === 'string') {
      return String((error as Record<string, unknown>).error);
    }
    if ('error_description' in error && typeof (error as Record<string, unknown>).error_description === 'string') {
      return String((error as Record<string, unknown>).error_description);
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'An unexpected error occurred';
    }
  }
  return 'An unexpected error occurred';
}

/**
 * Returns a client-safe error message.
 *
 * Operational `AppError` messages are preserved (they are intentionally
 * user-facing). Any unexpected/internal error is mapped to a generic fallback
 * so raw exception details (SQL errors, file paths, stack fragments, upstream
 * messages) are never serialized to API clients. Detailed diagnostics should be
 * logged server-side instead.
 */
export function getSafeErrorMessage(error: unknown, fallback = 'Ralat dalaman pelayan. Sila cuba lagi.'): string {
  if (error instanceof AppError) {
    return error.message;
  }
  return fallback;
}

/**
 * Safely extracts HTTP status code from an unknown error
 */
export function getErrorStatusCode(error: unknown, defaultCode = 500): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  if (error && typeof error === 'object') {
    const code = (error as Record<string, unknown>).statusCode || (error as Record<string, unknown>).status;
    if (typeof code === 'number' && code >= 100 && code <= 599) {
      return code;
    }
  }
  return defaultCode;
}

/**
 * Returns a standardized API error payload
 */
export function formatErrorResponse(error: unknown): { error: string; code?: string; details?: unknown } {
  const message = getErrorMessage(error);
  if (error instanceof AppError) {
    return {
      error: message,
      code: error.code,
      details: error.details
    };
  }
  return { error: message };
}
