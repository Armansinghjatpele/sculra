// ==============================================================================
// Sculra Notification Subscriptions Manager
// (worker/src/notifications/subscription.ts)
// ==============================================================================

import {
  NotificationSubscription,
  NotificationEvent,
  NotificationRecipient,
} from './types';
import { NOTIFICATION_LIMITS } from './policy';

export class SubscriptionManager {
  /**
   * Filters active subscriptions relevant to an incoming notification event.
   * Ensures the subscribed user is currently active and authorized.
   */
  public static matchSubscriptions(
    event: NotificationEvent,
    subscriptions: NotificationSubscription[],
    activeRecipients: NotificationRecipient[]
  ): NotificationSubscription[] {
    const activeUserIds = new Set(
      activeRecipients
        .filter((r) => r.status === 'active')
        .map((r) => r.userId)
    );

    const matches: NotificationSubscription[] = [];

    for (const sub of subscriptions) {
      // 1. Authorization check: user must currently have active access
      if (!activeUserIds.has(sub.clerkUserId)) {
        continue;
      }

      // 2. Organization boundary check
      if (event.organizationId && sub.organizationId && sub.organizationId !== event.organizationId) {
        continue;
      }

      // 3. Target matching
      const targetMatches =
        (sub.targetType === 'PROJECT' && sub.targetId === event.projectId) ||
        (sub.targetType === 'ISSUE' && sub.targetId === event.entityId) ||
        (sub.targetType === 'RELEASE' && sub.targetId === event.entityId) ||
        (sub.targetType === 'CAMPAIGN' && sub.targetId === event.entityId) ||
        (sub.targetType === 'ENVIRONMENT' && sub.targetId === event.entityId);

      if (!targetMatches) {
        continue;
      }

      // 4. Event types filter (if configured)
      if (sub.eventTypes && sub.eventTypes.length > 0) {
        if (!sub.eventTypes.includes(event.eventType)) {
          continue;
        }
      }

      matches.push(sub);
      if (matches.length >= NOTIFICATION_LIMITS.MAX_PROJECT_SUBSCRIPTIONS) {
        break; // bounded ceiling
      }
    }

    return matches;
  }

  /**
   * Validates if the requesting user has authorization to create a subscription.
   */
  public static validateSubscriptionAccess(params: {
    role: string;
    permissions: ReadonlySet<string>;
    targetType: string;
    channel?: string;
  }): { allowed: boolean; reason?: string } {
    if (params.channel === 'WEBHOOK' && params.role === 'VIEWER') {
      return {
        allowed: false,
        reason: 'VIEWER role cannot create WEBHOOK subscriptions. Requires DEVELOPER or above.',
      };
    }

    if (!params.permissions.has('notifications.manage') && params.role === 'VIEWER') {
      return {
        allowed: false,
        reason: 'Requires notifications.manage permission.',
      };
    }

    return { allowed: true };
  }
}
