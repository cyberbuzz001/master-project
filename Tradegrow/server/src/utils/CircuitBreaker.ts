export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name?: string;
  timeoutMs?: number;
  errorThresholdPercentage?: number;
  resetTimeoutMs?: number;
  volumeThreshold?: number;
}

export class CircuitBreaker {
  private name: string;
  private state: CircuitBreakerState = 'CLOSED';
  private timeoutMs: number;
  private errorThresholdPercentage: number;
  private resetTimeoutMs: number;
  private volumeThreshold: number;

  private totalCalls = 0;
  private failureCalls = 0;
  private consecutiveSuccesses = 0;
  private nextAttemptTimestamp = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name || 'CircuitBreaker';
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.errorThresholdPercentage = options.errorThresholdPercentage ?? 50;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 15000;
    this.volumeThreshold = options.volumeThreshold ?? 5;
  }

  public getState(): CircuitBreakerState {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTimestamp) {
      this.transitionTo('HALF_OPEN');
    }
    return this.state;
  }

  public isOpen(): boolean {
    return this.getState() === 'OPEN';
  }

  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      console.warn(`[CircuitBreaker:${this.name}] State change: ${this.state} ➡️ ${newState}`);
      this.state = newState;
      if (newState === 'OPEN') {
        this.nextAttemptTimestamp = Date.now() + this.resetTimeoutMs;
      } else if (newState === 'CLOSED') {
        this.resetStats();
      } else if (newState === 'HALF_OPEN') {
        this.consecutiveSuccesses = 0;
      }
    }
  }

  private resetStats(): void {
    this.totalCalls = 0;
    this.failureCalls = 0;
    this.consecutiveSuccesses = 0;
  }

  /**
   * Executes the given action within the circuit breaker with strict timeout and fallback execution.
   */
  public async execute<T>(action: () => Promise<T>, fallback?: (err: Error) => Promise<T> | T): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      const error = new Error(`CircuitBreaker '${this.name}' is OPEN. Fast-failing without calling upstream.`);
      if (fallback) {
        return fallback(error);
      }
      throw error;
    }

    let timer: NodeJS.Timeout | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Operation timed out after ${this.timeoutMs}ms in '${this.name}'`));
        }, this.timeoutMs);
      });

      const result = await Promise.race([action(), timeoutPromise]);
      if (timer) clearTimeout(timer);

      this.onSuccess();
      return result;
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      this.onFailure(err);

      if (fallback) {
        return fallback(err);
      }
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      // If half-open probe succeeds 2 consecutive times, close circuit
      if (this.consecutiveSuccesses >= 2) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.totalCalls++;
      // Periodically reset stats after every 50 calls to keep sliding window fresh
      if (this.totalCalls >= 50) {
        this.resetStats();
      }
    }
  }

  private onFailure(err: any): void {
    console.error(`[CircuitBreaker:${this.name}] Call failure: ${err.message || err}`);
    if (this.state === 'HALF_OPEN') {
      // Immediate trip back to OPEN if half-open probe fails
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      this.totalCalls++;
      this.failureCalls++;

      if (this.totalCalls >= this.volumeThreshold) {
        const failureRate = (this.failureCalls / this.totalCalls) * 100;
        if (failureRate >= this.errorThresholdPercentage) {
          console.error(`[CircuitBreaker:${this.name}] Failure rate ${failureRate.toFixed(1)}% exceeded threshold ${this.errorThresholdPercentage}%. Tripping circuit.`);
          this.transitionTo('OPEN');
        }
      }
    }
  }

  public getMetrics() {
    return {
      name: this.name,
      state: this.getState(),
      totalCalls: this.totalCalls,
      failureCalls: this.failureCalls,
      nextAttemptInMs: Math.max(0, this.nextAttemptTimestamp - Date.now())
    };
  }
}
