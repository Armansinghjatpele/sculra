// ==============================================================================
// Sculra Continuous Deployment & Release Gate Notifications Engine
// (worker/src/release/cd-notifications.ts)
//
// Invariants (Prompt 63):
// - Reuses existing Enterprise Notification engine
// - Supported events:
//   QA_TRIGGERED, QA_COMPLETED, RELEASE_GATE_PASSED, RELEASE_GATE_BLOCKED,
//   RELEASE_GATE_REVIEW, RELEASE_GATE_INSUFFICIENT_EVIDENCE, APPROVAL_REQUESTED,
//   APPROVAL_APPROVED, APPROVAL_REJECTED, DEPLOYMENT_FAILED
// - Notification content: project, environment, deployment, release, gate result,
//   campaign, critical blockers, evidence link/ref
// - Strict secret redaction: NO secrets, NO credentials, NO raw webhook payloads
// ==============================================================================

import { randomUUID } from 'crypto';
import {
  NotificationEvent,
  NotificationEventType,
  NotificationUrgency,
} from '../notifications/types';
import { NotificationEngine } from '../notifications/engine';
import { ReleaseGateDecision, DeploymentEvent } from './types';
import { redactSensitiveData } from '../change-intelligence/redaction';

export interface DispatchGateNotificationInput {
  eventType: NotificationEventType;
  projectId: string;
  organizationId?: string | null;
  deploymentId?: string | null;
  releaseId?: string | null;
  environmentName?: string | null;
  campaignId?: string | null;
  decision?: ReleaseGateDecision | null;
  blockers?: string[];
  evidenceRef?: string | null;
  summaryMessage?: string;
  metadata?: Record<string, any>;
}

export class CDNotificationDispatcher {
  /**
   * Builds a sanitized, evidence-backed NotificationEvent for CD lifecycle events.
   */
  public static buildEvent(input: DispatchGateNotificationInput): NotificationEvent {
    const {
      eventType,
      projectId,
      organizationId = null,
      deploymentId = null,
      releaseId = null,
      environmentName = null,
      campaignId = null,
      decision = null,
      blockers = [],
      evidenceRef = null,
      summaryMessage,
      metadata = {},
    } = input;

    let urgency: NotificationUrgency = 'INFO';
    if (eventType === 'RELEASE_GATE_BLOCKED' || eventType === 'DEPLOYMENT_FAILED') {
      urgency = 'CRITICAL';
    } else if (eventType === 'RELEASE_GATE_REVIEW' || eventType === 'APPROVAL_REQUESTED') {
      urgency = 'HIGH';
    } else if (eventType === 'RELEASE_GATE_INSUFFICIENT_EVIDENCE') {
      urgency = 'MEDIUM';
    }

    const titleMap: Partial<Record<NotificationEventType, string>> = {
      QA_TRIGGERED: `Automated QA Campaign Triggered (${environmentName || 'Environment'})`,
      QA_COMPLETED: `Automated QA Campaign Completed (${environmentName || 'Environment'})`,
      RELEASE_GATE_PASSED: `Release Gate Passed: Ready for Deployment`,
      RELEASE_GATE_BLOCKED: `Release Gate Blocked: Critical Regressions/Defects Detected`,
      RELEASE_GATE_REVIEW: `Release Gate Requires Human Review & Approval`,
      RELEASE_GATE_INSUFFICIENT_EVIDENCE: `Release Gate Inconclusive: Insufficient Evidence`,
      APPROVAL_REQUESTED: `Release Gate Approval Requested`,
      APPROVAL_APPROVED: `Release Gate Approved by Team Lead`,
      APPROVAL_REJECTED: `Release Gate Rejected by Team Lead`,
      DEPLOYMENT_FAILED: `Deployment Failed at Hosting Provider`,
    };

    const title = titleMap[eventType] || `Release Gate Notification: ${eventType}`;
    const safeMeta = redactSensitiveData({
      ...metadata,
      projectId,
      organizationId,
      deploymentId,
      releaseId,
      environmentName,
      campaignId,
      gateDecision: decision?.decision,
      blockersCount: blockers.length,
      blockersSummary: blockers.slice(0, 5),
      evidenceRef,
    }) as Record<string, any>;

    return {
      id: randomUUID(),
      eventType,
      severity: urgency,
      sourceType: 'DEPLOYMENT_GATE',
      entityType: 'deployment',
      entityId: deploymentId || projectId,
      fingerprint: `${eventType}:${projectId}:${deploymentId || 'none'}`,
      title,
      summary:
        summaryMessage ||
        `Release gate evaluation for project ${projectId} on ${environmentName || 'environment'}: ${
          decision?.decision || eventType
        }`,
      occurredAt: new Date().toISOString(),
      organizationId: organizationId || null,
      projectId: projectId || null,
      metadata: safeMeta,
    };
  }

  /**
   * Dispatches the notification event through the existing NotificationEngine.
   */
  public static async dispatch(
    engine: NotificationEngine | null | undefined,
    input: DispatchGateNotificationInput
  ): Promise<NotificationEvent> {
    const event = this.buildEvent(input);

    if (engine) {
      try {
        await engine.dispatch({
          eventType: event.eventType,
          entityType: event.entityType,
          entityId: event.entityId,
          title: event.title,
          summary: event.summary,
          organizationId: event.organizationId,
          projectId: event.projectId,
          severity: event.severity,
          metadata: event.metadata,
        });
      } catch (err: any) {
        // Notification delivery failure does not invalidate gate decision
        console.error(`[CDNotificationDispatcher]: Failed delivering notification event: ${err.message}`);
      }
    }

    return event;
  }
}
