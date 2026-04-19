export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
    failureThreshold: number;
    successThreshold: number;
    timeoutMs: number;
}

export class CircuitBreaker {
    private state: CircuitBreakerState = 'closed';
    private failureCount = 0;
    private successCount = 0;
    private nextAttempt = 0;

    constructor(private readonly options: CircuitBreakerOptions) {}

    async exec<T>(action: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is open');
            }
            this.state = 'half_open';
        }

        try {
            const result = await action();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        if (this.state === 'half_open') {
            this.successCount += 1;
            if (this.successCount >= this.options.successThreshold) {
                this.close();
            }
            return;
        }

        this.failureCount = 0;
    }

    private onFailure(): void {
        this.failureCount += 1;
        if (this.failureCount >= this.options.failureThreshold) {
            this.open();
        }
    }

    private open(): void {
        this.state = 'open';
        this.nextAttempt = Date.now() + this.options.timeoutMs;
        this.successCount = 0;
    }

    private close(): void {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
    }

    snapshot(): {
        state: CircuitBreakerState;
        failureCount: number;
        successCount: number;
        nextAttempt: number;
        msUntilNextAttempt: number;
    } {
        const now = Date.now();
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            nextAttempt: this.nextAttempt,
            msUntilNextAttempt: Math.max(this.nextAttempt - now, 0),
        };
    }
}
