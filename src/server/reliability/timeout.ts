import { TimeoutOptions } from './types.js';

export class TimeoutError extends Error {
  public readonly operationName: string;
  public readonly timeoutMs: number;

  constructor(operationName: string, timeoutMs: number) {
    super(`Operation '${operationName}' timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.operationName = operationName;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Wraps an async operation in an explicit deadline timer with deterministic cleanup.
 * If the timeout expires, cancels the AbortController (if provided) and rejects with TimeoutError.
 */
export async function withTimeout<T>(
  task: (signal?: AbortSignal) => Promise<T>,
  options: TimeoutOptions | number
): Promise<T> {
  const opts: TimeoutOptions = typeof options === 'number' ? { timeoutMs: options } : options;
  const timeoutMs = Math.max(1, opts.timeoutMs);
  const operationName = opts.operationName || 'anonymous_operation';

  // Use provided AbortController or create a dedicated local one
  const controller = opts.abortController || new AbortController();
  const { signal } = controller;

  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // Ignore errors if already aborted
      }
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([task(signal), timeoutPromise]);
    return result;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }
}
