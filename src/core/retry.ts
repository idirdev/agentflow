import { Logger } from "../utils/logger.js";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class RetryHandler {
  private options: RetryOptions;
  private logger: Logger;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = new Logger("RetryHandler");
  }

  async execute<T>(fn: () => Promise<T>, label?: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const result = await fn();
        if (attempt > 0) {
          this.logger.info(`${label ?? "Operation"} succeeded on attempt ${attempt + 1}`);
        }
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (!this.isRetryable(lastError)) {
          this.logger.error(`${label ?? "Operation"} failed with non-retryable error: ${lastError.message}`);
          throw lastError;
        }

        if (attempt >= this.options.maxRetries) {
          this.logger.error(`${label ?? "Operation"} exhausted all ${this.options.maxRetries} retries`);
          break;
        }

        const delayMs = this.calculateDelay(attempt);
        this.logger.warn(
          `${label ?? "Operation"} attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delayMs}ms...`
        );

        this.options.onRetry?.(attempt + 1, lastError, delayMs);
        await this.sleep(delayMs);
      }
    }

    throw lastError ?? new Error(`${label ?? "Operation"} failed after ${this.options.maxRetries} retries`);
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.options.baseDelayMs * Math.pow(this.options.backoffMultiplier, attempt);
    const jitter = Math.random() * this.options.baseDelayMs * 0.5;
    return Math.min(exponentialDelay + jitter, this.options.maxDelayMs);
  }

  private isRetryable(error: Error): boolean {
    if (!this.options.retryableErrors || this.options.retryableErrors.length === 0) {
      return true;
    }
    return this.options.retryableErrors.some(
      (pattern) => error.message.includes(pattern) || error.constructor.name === pattern
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getOptions(): Readonly<RetryOptions> {
    return { ...this.options };
  }

  static withDefaults(overrides: Partial<RetryOptions> = {}): RetryHandler {
    return new RetryHandler(overrides);
  }
}
