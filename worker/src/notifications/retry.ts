// ==============================================================================
// Sculra Notification Delivery Retry Engine
// (worker/src/notifications/retry.ts)
// ==============================================================================

import { NOTIFICATION_LIMITS } from './policy';

export class NotificationRetryEngine {
  private static BASE_BACKOFF_MS = 1000;
  private static MAX_BACKOFF_MS = 10000;

  /**
   * Determines whether another attempt should be scheduled.
   */
  public static shouldRetry(params: {
    attemptsCount: number;
    retryable: boolean;
    maxAttempts?: number;
  }): boolean {
    const maxAttempts = params.maxAttempts || NOTIFICATION_LIMITS.MAX_DELIVERY_ATTEMPTS;
    if (!params.retryable) return false;
    return params.attemptsCount < maxAttempts;
  }

  /**
   * Computes exponential backoff with bounded jitter.
   */
  public static computeBackoffMs(attemptNumber: number): number {
    const exponential = this.BASE_BACKOFF_MS * Math.pow(2, attemptNumber - 1);
    const capped = Math.min(exponential, this.MAX_BACKOFF_MS);
    // Add up to 25% jitter
    const jitter = Math.floor(Math.random() * (capped * 0.25));
    return capped + jitter;
  }
}
