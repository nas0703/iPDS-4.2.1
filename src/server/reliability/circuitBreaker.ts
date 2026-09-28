import { CircuitBreakerOptions, CircuitState } from './types.js';

export class CircuitBreakerOpenError extends Error {
  public readonly circuitName: string;
  public readonly cooldownRemainingMs: number;

  constructor(circuitName: string, cooldownRemainingMs: number) {
    super(
      `Circuit breaker '${circuitName}' is OPEN. Fast-failing request (cooldown remaining: ${Math.round(
        cooldownRemainingMs
      )}ms)`
    );
    this.name = 'CircuitBreakerOpenError';
    this.circuitName = circuitName;
    this.cooldownRemainingMs = cooldownRemainingMs;
  }
}

export class CircuitBreaker {
  public readonly name: string;
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly cooldownMs: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.cooldownMs = options.cooldownMs ?? 30000; // 30 seconds cooldown
    this.onStateChange = options.onStateChange;
  }

  public getState(): CircuitState {
    this.evaluateState();
    return this.state;
  }

  private evaluateState(): void {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.cooldownMs) {
        this.transitionTo('HALF_OPEN');
        this.consecutiveSuccesses = 0;
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      if (this.onStateChange) {
        try {
          this.onStateChange(oldState, newState, this.name);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.evaluateState();

    if (this.state === 'OPEN') {
      const remainingCooldown = Math.max(0, this.cooldownMs - (Date.now() - this.lastFailureTime));
      throw new CircuitBreakerOpenError(this.name, remainingCooldown);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.successThreshold) {
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures = 0;
    }
  }

  public recordFailure(): void {
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF_OPEN') {
      // In HALF_OPEN, a single failure flips back to OPEN immediately
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  public getStats() {
    this.evaluateState();
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      cooldownMs: this.cooldownMs,
    };
  }

  public reset(): void {
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = 0;
    this.transitionTo('CLOSED');
  }
}

// Bounded in-memory registry of circuit breakers
const circuitRegistry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: Omit<CircuitBreakerOptions, 'name'>): CircuitBreaker {
  let cb = circuitRegistry.get(name);
  if (!cb) {
    cb = new CircuitBreaker({ name, ...options });
    circuitRegistry.set(name, cb);
  }
  return cb;
}

export function getAllCircuitBreakersStats() {
  const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
  for (const [name, cb] of circuitRegistry.entries()) {
    stats[name] = cb.getStats();
  }
  return stats;
}
