/**
 * @fileoverview Retry utilities with exponential backoff
 * Purpose: Handle transient failures with configurable retries
 * Max lines: 80
 */

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
};

function calculateBackoff(attempt: number, options: RetryOptions): number {
  const delay = options.initialDelayMs * Math.pow(options.factor, attempt);
  return Math.min(delay, options.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < opts.maxAttempts - 1) {
        const backoffMs = calculateBackoff(attempt, opts);
        opts.onRetry?.(attempt + 1, lastError);
        await sleep(backoffMs);
      }
    }
  }

  throw lastError!;
}

export function getNextBackoffSeconds(
  attempt: number,
  initialDelay: number = 5,
  factor: number = 2,
  maxDelay: number = 300
): number {
  const delay = initialDelay * Math.pow(factor, attempt);
  return Math.min(Math.floor(delay), maxDelay);
}
