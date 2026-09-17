// ==============================================================================
// Sculra Execution Reliability Policies & Backoff Rules (worker/src/execution/execution-policy.ts)
// ==============================================================================

import { ExecutionJob, RetryPolicyConfig } from './types';
import { isRetryableError } from './execution-errors';

export const DEFAULT_JOB_LEASE_SECONDS = 60;
export const DEFAULT_JOB_HEARTBEAT_SECONDS = 15;
export const DEFAULT_MAX_JOB_ATTEMPTS = 3;
export const DEFAULT_JOB_TIMEOUT_SECONDS = 900; // 15 minutes
export const DEFAULT_TASK_TIMEOUT_SECONDS = 120; // 2 minutes
export const DEFAULT_MAX_TASK_RETRIES = 2;
export const DEFAULT_MAX_ADAPTIVE_INSERTIONS = 10;
export const DEFAULT_BACKOFF_BASE_MS = 2000;
export const DEFAULT_MAX_BACKOFF_MS = 60000;

export class ExecutionPolicy {
  /**
   * Computes jittered exponential backoff for retrying failed transient jobs.
   */
  public static computeBackoffDelay(
    attempt: number,
    baseMs: number = DEFAULT_BACKOFF_BASE_MS,
    maxMs: number = DEFAULT_MAX_BACKOFF_MS
  ): number {
    const exponential = baseMs * Math.pow(2, Math.max(0, attempt - 1));
    const jitter = Math.random() * (baseMs * 0.5);
    return Math.min(exponential + jitter, maxMs);
  }

  /**
   * Evaluates if a job is eligible for retry based on error classification and remaining attempts.
   */
  public static shouldRetryJob(
    job: ExecutionJob,
    error: any,
    config?: RetryPolicyConfig
  ): boolean {
    const maxAttempts = config?.maxAttempts ?? job.maxAttempts ?? DEFAULT_MAX_JOB_ATTEMPTS;
    if (job.attempt >= maxAttempts) {
      return false;
    }
    return isRetryableError(error);
  }
}
