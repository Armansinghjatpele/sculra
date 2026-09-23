// ==============================================================================
// Sculra Notification & Alerting Policy Controls
// (worker/src/notifications/policy.ts)
// ==============================================================================

import { NotificationUrgency } from './types';

export const NOTIFICATION_LIMITS = {
  // Throttling thresholds
  MAX_NOTIFICATIONS_PER_USER_PER_MINUTE: 30,
  MAX_NOTIFICATIONS_PER_PROJECT_PER_MINUTE: 100,
  MAX_WEBHOOK_DELIVERIES_PER_EVENT: 3,
  MAX_EMAIL_DELIVERIES_PER_EVENT: 3,

  // Outbound Webhook security bounds
  MAX_WEBHOOK_REDIRECTS: 3,
  MAX_WEBHOOK_RESPONSE_BYTES: 1024 * 1024, // 1MB
  MAX_WEBHOOK_TIMEOUT_MS: 10000, // 10s

  // Delivery & Processing bounds
  MAX_DELIVERY_ATTEMPTS: 3,
  MAX_NOTIFICATION_RECIPIENTS_PER_EVENT: 100,
  MAX_EVENT_METADATA_BYTES: 65536, // 64KB
  MAX_INCIDENT_EVENTS: 500,
  MAX_DIGEST_EVENTS: 200,
  MAX_SUBSCRIPTIONS_PER_USER: 100,
  MAX_PROJECT_SUBSCRIPTIONS: 500,
  MAX_NOTIFICATION_PROCESSING_TIME_MS: 30000,
} as const;

export const SEVERITY_RANKS: Record<NotificationUrgency, number> = {
  INFO: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  CRITICAL: 5,
};

export const DEDUPE_WINDOWS_MS: Record<NotificationUrgency, number> = {
  CRITICAL: 15 * 60 * 1000, // 15 minutes
  HIGH: 30 * 60 * 1000,     // 30 minutes
  MEDIUM: 60 * 60 * 1000,   // 1 hour
  LOW: 120 * 60 * 1000,     // 2 hours
  INFO: 240 * 60 * 1000,    // 4 hours (prefer digest)
};

/**
 * Checks whether an event severity satisfies a minimum configured threshold.
 */
export function meetsMinSeverity(
  eventSeverity: NotificationUrgency,
  minSeverity: NotificationUrgency
): boolean {
  return SEVERITY_RANKS[eventSeverity] >= SEVERITY_RANKS[minSeverity];
}
