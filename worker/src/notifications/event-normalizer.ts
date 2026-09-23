// ==============================================================================
// Sculra Notification Event Normalizer
// (worker/src/notifications/event-normalizer.ts)
// ==============================================================================

import crypto from 'crypto';
import { NotificationEvent, NotificationEventType, NotificationUrgency } from './types';
import { NotificationRedactor } from './redaction';

export class NotificationEventNormalizer {
  /**
   * Generates a deterministic SHA-256 fingerprint for the underlying event entity.
   */
  public static computeFingerprint(
    organizationId: string | null | undefined,
    projectId: string | null | undefined,
    eventType: NotificationEventType,
    entityType: string,
    entityId: string,
    extraSalt: string = ''
  ): string {
    const raw = `${organizationId || 'org-global'}:${projectId || 'proj-global'}:${eventType}:${entityType}:${entityId}:${extraSalt}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Normalizes a generic or domain event into a canonical NotificationEvent.
   */
  public static normalize(input: {
    id?: string;
    organizationId?: string | null;
    projectId?: string | null;
    sourceType?: string;
    eventType: NotificationEventType;
    severity?: NotificationUrgency;
    entityType: string;
    entityId: string;
    title: string;
    summary: string;
    occurredAt?: string;
    deepLink?: string;
    metadata?: Record<string, any>;
  }): NotificationEvent {
    const severity = input.severity || this.inferSeverity(input.eventType);
    const fingerprint = this.computeFingerprint(
      input.organizationId,
      input.projectId,
      input.eventType,
      input.entityType,
      input.entityId
    );

    const sanitizedTitle = NotificationRedactor.maskSecrets(input.title);
    const sanitizedSummary = NotificationRedactor.maskSecrets(input.summary);
    const boundMetadata = NotificationRedactor.boundMetadata(input.metadata || {});

    return {
      id: input.id || `notif-evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      organizationId: input.organizationId || null,
      projectId: input.projectId || null,
      sourceType: input.sourceType || 'DETERMINISTIC',
      eventType: input.eventType,
      severity,
      entityType: input.entityType,
      entityId: input.entityId,
      occurredAt: input.occurredAt || new Date().toISOString(),
      fingerprint,
      title: sanitizedTitle,
      summary: sanitizedSummary,
      deepLink: input.deepLink,
      metadata: boundMetadata,
    };
  }

  /**
   * Default severity inference when not explicitly provided by the event source.
   */
  public static inferSeverity(eventType: NotificationEventType): NotificationUrgency {
    switch (eventType) {
      case 'SECURITY_BLOCKER_CREATED':
      case 'RELEASE_BLOCKED':
      case 'WORKER_FAILURE_THRESHOLD_REACHED':
        return 'CRITICAL';

      case 'SECURITY_FINDING_CREATED':
      case 'CI_GATE_FAILED':
      case 'FIX_VERIFICATION_FAILED':
      case 'ENVIRONMENT_UNREACHABLE':
      case 'DEPLOYMENT_FAILED':
      case 'CAMPAIGN_FAILED':
      case 'ISSUE_CREATED':
      case 'ISSUE_ESCALATED':
      case 'HUMAN_APPROVAL_REQUIRED':
      case 'FIX_APPROVAL_REQUIRED':
      case 'CREDENTIAL_VALIDATION_FAILED':
        return 'HIGH';

      case 'PERFORMANCE_REGRESSION_DETECTED':
      case 'ACCESSIBILITY_BLOCKER_CREATED':
      case 'VISUAL_REGRESSION_DETECTED':
      case 'API_REGRESSION_DETECTED':
      case 'DEPLOYMENT_HEALTH_DEGRADED':
      case 'SOURCE_DEGRADED':
      case 'TEST_RUN_FAILED':
      case 'RELEASE_DECISION_RECORDED':
        return 'MEDIUM';

      case 'RELEASE_READY':
      case 'RELEASE_RELEASED':
      case 'FIX_PR_CREATED':
      case 'ENVIRONMENT_RECOVERED':
      case 'SOURCE_RECOVERED':
      case 'ISSUE_RESOLVED':
      case 'ISSUE_RECURRED':
      case 'CI_GATE_PASSED':
      case 'DEPLOYMENT_COMPLETED':
        return 'LOW';

      case 'TEST_RUN_COMPLETED':
      case 'CAMPAIGN_COMPLETED':
      case 'CAMPAIGN_CANCELLED':
      case 'DEPLOYMENT_STARTED':
      case 'AUTONOMOUS_DECISION_RECORDED':
      case 'CI_GATE_INSUFFICIENT_EVIDENCE':
      case 'RELEASE_ABANDONED':
      case 'CREDENTIAL_EXPIRED':
      default:
        return 'INFO';
    }
  }
}
