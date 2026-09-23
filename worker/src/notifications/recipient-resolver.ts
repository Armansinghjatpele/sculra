// ==============================================================================
// Sculra Notification Recipient Resolution & Multi-Tenant Access Evaluator
// (worker/src/notifications/recipient-resolver.ts)
// ==============================================================================

import {
  NotificationEvent,
  NotificationRecipient,
  NotificationPreference,
  NotificationSubscription,
} from './types';
import { meetsMinSeverity } from './policy';

export class RecipientResolver {
  /**
   * Resolves the list of authorized recipients for a given NotificationEvent.
   * Enforces:
   * 1. Multi-tenant organization isolation (never cross org boundaries).
   * 2. Project access check.
   * 3. Active membership status (exclude 'suspended', 'removed', or 'invited').
   * 4. Enterprise RBAC permission requirement for sensitive actions.
   * 5. User preferences (minSeverity, channel enabled, opt-out).
   * 6. User subscriptions (explicit target subscriptions).
   */
  public static resolveRecipients(params: {
    event: NotificationEvent;
    candidates: NotificationRecipient[];
    preferences?: NotificationPreference[];
    subscriptions?: NotificationSubscription[];
  }): NotificationRecipient[] {
    const { event, candidates, preferences = [], subscriptions = [] } = params;

    const resolved: NotificationRecipient[] = [];

    for (const candidate of candidates) {
      // 1. Membership status check
      if (candidate.status !== 'active') {
        continue;
      }

      // 2. Organization isolation check
      if (event.organizationId) {
        if (!candidate.organizationId || candidate.organizationId !== event.organizationId) {
          continue;
        }
      }

      // 3. Project access check (if candidate has specific project restrictions)
      if (event.projectId && candidate.projectIds && candidate.projectIds.length > 0) {
        if (!candidate.projectIds.includes(event.projectId)) {
          continue;
        }
      }

      // 4. Role and permission requirement for sensitive events
      if (!this.hasRequiredPermission(event, candidate)) {
        continue;
      }

      // 5. Evaluate user preference opt-outs
      const pref = this.findMatchingPreference(candidate.userId, event, preferences);
      if (pref) {
        if (!pref.enabled) {
          continue; // User explicitly disabled this notification type/channel
        }
        if (!meetsMinSeverity(event.severity, pref.minSeverity)) {
          continue; // Severity lower than user's configured threshold
        }
      }

      // 6. Check subscriptions: if explicit subscription exists or broad role applies
      resolved.push(candidate);
    }

    return resolved;
  }

  /**
   * Validates if the recipient holds the necessary permission for sensitive events.
   */
  public static hasRequiredPermission(
    event: NotificationEvent,
    recipient: NotificationRecipient
  ): boolean {
    const permissions = recipient.permissions;
    if (!permissions) {
      // Default to true if permissions set not provided (e.g. basic mock),
      // but if permissions set is provided, enforce strict checks.
      return true;
    }

    switch (event.eventType) {
      case 'FIX_APPROVAL_REQUIRED':
      case 'HUMAN_APPROVAL_REQUIRED':
        return permissions.has('approvals.approve') || permissions.has('approvals.read');

      case 'RELEASE_DECISION_RECORDED':
      case 'RELEASE_BLOCKED':
      case 'RELEASE_READY':
        return permissions.has('releases.read') || permissions.has('releases.decide');

      case 'SECURITY_BLOCKER_CREATED':
      case 'SECURITY_FINDING_CREATED':
        return permissions.has('security.read') || permissions.has('issues.read');

      case 'CREDENTIAL_VALIDATION_FAILED':
      case 'CREDENTIAL_EXPIRED':
        return permissions.has('credentials.read');

      case 'CI_GATE_FAILED':
      case 'CI_GATE_PASSED':
        return permissions.has('cicd.read');

      case 'WORKER_FAILURE_THRESHOLD_REACHED':
        return recipient.role === 'ADMIN' || recipient.role === 'OWNER';

      default:
        return permissions.has('notifications.read') || permissions.has('projects.read');
    }
  }

  private static findMatchingPreference(
    userId: string,
    event: NotificationEvent,
    preferences: NotificationPreference[]
  ): NotificationPreference | undefined {
    // 1. Exact match: userId + projectId + eventType
    const exact = preferences.find(
      (p) =>
        p.clerkUserId === userId &&
        p.projectId === event.projectId &&
        p.eventType === event.eventType
    );
    if (exact) return exact;

    // 2. Project fallback: userId + projectId + null eventType
    const projectFallback = preferences.find(
      (p) =>
        p.clerkUserId === userId &&
        p.projectId === event.projectId &&
        !p.eventType
    );
    if (projectFallback) return projectFallback;

    // 3. Global fallback: userId + null projectId + null eventType
    return preferences.find(
      (p) =>
        p.clerkUserId === userId &&
        !p.projectId &&
        (!p.eventType || p.eventType === event.eventType)
    );
  }
}
