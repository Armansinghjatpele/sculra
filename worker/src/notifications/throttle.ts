// ==============================================================================
// Sculra Notification Throttling Engine
// (worker/src/notifications/throttle.ts)
// ==============================================================================

import { NOTIFICATION_LIMITS } from './policy';
import { NotificationUrgency } from './types';

interface RateWindow {
  count: number;
  windowStart: number;
}

export class NotificationThrottler {
  private static userWindows = new Map<string, RateWindow>();
  private static projectWindows = new Map<string, RateWindow>();

  private static WINDOW_MS = 60 * 1000; // 1 minute rolling window

  /**
   * Evaluates if a notification should be throttled based on user or project rate.
   * If throttled and severity is CRITICAL, returns bypass: true so critical alerts are delivered
   * while still auditing the high-rate condition.
   */
  public static checkThrottle(params: {
    userId?: string | null;
    projectId?: string | null;
    severity: NotificationUrgency;
    now?: number;
  }): { throttled: boolean; reason?: string; bypass: boolean } {
    const now = params.now || Date.now();

    // 1. Check Project Rate
    if (params.projectId) {
      const projWindow = this.getWindow(this.projectWindows, params.projectId, now);
      if (projWindow.count >= NOTIFICATION_LIMITS.MAX_NOTIFICATIONS_PER_PROJECT_PER_MINUTE) {
        const reason = `Project rate limit exceeded (${NOTIFICATION_LIMITS.MAX_NOTIFICATIONS_PER_PROJECT_PER_MINUTE}/min).`;
        const bypass = params.severity === 'CRITICAL';
        return { throttled: true, reason, bypass };
      }
    }

    // 2. Check User Rate
    if (params.userId) {
      const userWindow = this.getWindow(this.userWindows, params.userId, now);
      if (userWindow.count >= NOTIFICATION_LIMITS.MAX_NOTIFICATIONS_PER_USER_PER_MINUTE) {
        const reason = `User rate limit exceeded (${NOTIFICATION_LIMITS.MAX_NOTIFICATIONS_PER_USER_PER_MINUTE}/min).`;
        const bypass = params.severity === 'CRITICAL';
        return { throttled: true, reason, bypass };
      }
    }

    return { throttled: false, bypass: false };
  }

  /**
   * Records a sent notification towards the user and project rate windows.
   */
  public static record(params: {
    userId?: string | null;
    projectId?: string | null;
    now?: number;
  }): void {
    const now = params.now || Date.now();

    if (params.projectId) {
      const projWindow = this.getWindow(this.projectWindows, params.projectId, now);
      projWindow.count++;
    }

    if (params.userId) {
      const userWindow = this.getWindow(this.userWindows, params.userId, now);
      userWindow.count++;
    }
  }

  private static getWindow(
    store: Map<string, RateWindow>,
    key: string,
    now: number
  ): RateWindow {
    let window = store.get(key);
    if (!window || now - window.windowStart >= this.WINDOW_MS) {
      window = { count: 0, windowStart: now };
      store.set(key, window);
    }
    return window;
  }

  /**
   * Reset store (useful for tests).
   */
  public static reset(): void {
    this.userWindows.clear();
    this.projectWindows.clear();
  }
}
