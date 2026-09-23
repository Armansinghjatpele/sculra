// ==============================================================================
// Sculra Notification Deduplication Engine
// (worker/src/notifications/dedupe.ts)
// ==============================================================================

import crypto from 'crypto';
import { NotificationEvent } from './types';
import { DEDUPE_WINDOWS_MS } from './policy';

export class NotificationDeduplicator {
  private static dedupeCache = new Map<string, number>(); // dedupeKey -> expirationTimestamp

  /**
   * Computes a deterministic deduplication key bounded by the event severity window.
   */
  public static computeDedupeKey(
    event: NotificationEvent,
    now: number = Date.now()
  ): { dedupeKey: string; windowExpiresAt: number } {
    const windowMs = DEDUPE_WINDOWS_MS[event.severity] || DEDUPE_WINDOWS_MS.INFO;
    const windowSlot = Math.floor(now / windowMs);
    const windowExpiresAt = (windowSlot + 1) * windowMs;

    const raw = [
      event.organizationId || 'org-global',
      event.projectId || 'proj-global',
      event.eventType,
      event.entityId,
      event.fingerprint,
      windowSlot,
    ].join(':');

    const dedupeKey = crypto.createHash('sha256').update(raw).digest('hex');

    return { dedupeKey, windowExpiresAt };
  }

  /**
   * Checks whether the event is a duplicate within its active time window.
   */
  public static isDuplicate(
    event: NotificationEvent,
    now: number = Date.now()
  ): { isDuplicate: boolean; dedupeKey: string; windowExpiresAt: number } {
    this.cleanExpired(now);

    const { dedupeKey, windowExpiresAt } = this.computeDedupeKey(event, now);
    const existingExpiry = this.dedupeCache.get(dedupeKey);

    if (existingExpiry && existingExpiry > now) {
      return { isDuplicate: true, dedupeKey, windowExpiresAt: existingExpiry };
    }

    return { isDuplicate: false, dedupeKey, windowExpiresAt };
  }

  /**
   * Records an event delivery into the deduplication window cache.
   */
  public static record(event: NotificationEvent, now: number = Date.now()): string {
    const { dedupeKey, windowExpiresAt } = this.computeDedupeKey(event, now);
    this.dedupeCache.set(dedupeKey, windowExpiresAt);
    return dedupeKey;
  }

  /**
   * Cleans up expired cache items to prevent memory unbounded growth.
   */
  public static cleanExpired(now: number = Date.now()): void {
    for (const [key, expiresAt] of this.dedupeCache.entries()) {
      if (expiresAt <= now) {
        this.dedupeCache.delete(key);
      }
    }
  }

  /**
   * Reset cache (useful for isolated unit testing).
   */
  public static reset(): void {
    this.dedupeCache.clear();
  }
}
