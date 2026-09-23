// ==============================================================================
// Sculra Notification Digest Aggregator
// (worker/src/notifications/digest.ts)
// ==============================================================================

import { NotificationDigest, NotificationEvent } from './types';
import { NOTIFICATION_LIMITS } from './policy';

export class DigestAggregator {
  /**
   * Aggregates factual low-priority events into a single digest summary.
   * Truthful: Only includes events that actually occurred. Zero fake counts.
   */
  public static aggregate(params: {
    recipientId: string;
    projectId?: string | null;
    period: 'HOURLY' | 'DAILY';
    events: NotificationEvent[];
  }): NotificationDigest | null {
    const { recipientId, projectId, period, events } = params;

    if (!events || events.length === 0) {
      return null;
    }

    const boundedEvents = events.slice(0, NOTIFICATION_LIMITS.MAX_DIGEST_EVENTS);

    // Group counts by eventType
    const countsByType: Record<string, number> = {};
    for (const evt of boundedEvents) {
      countsByType[evt.eventType] = (countsByType[evt.eventType] || 0) + 1;
    }

    const summaryParts = Object.entries(countsByType).map(
      ([type, count]) => `${count} ${type.replace(/_/g, ' ').toLowerCase()}`
    );

    const summary = `${period} Digest: ${boundedEvents.length} events recorded (${summaryParts.join(', ')}).`;

    return {
      id: `digest-${Date.now()}-${recipientId}`,
      period,
      recipientId,
      projectId: projectId || null,
      eventsCount: boundedEvents.length,
      events: boundedEvents.map((e) => ({
        eventType: e.eventType,
        title: e.title,
        occurredAt: e.occurredAt,
      })),
      summary,
      generatedAt: new Date().toISOString(),
    };
  }
}
