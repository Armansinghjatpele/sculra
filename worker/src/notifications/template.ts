// ==============================================================================
// Sculra Notification Templating & Presentation Engine
// (worker/src/notifications/template.ts)
// ==============================================================================

import { NotificationEvent } from './types';

export interface RenderedTemplate {
  title: string;
  body: string;
  markdown: string;
  actionUrl?: string;
  actionText?: string;
}

export class NotificationTemplater {
  /**
   * Generates a factual, truthful rendering of the notification event.
   * Enforces non-causal language and clear deep-links.
   */
  public static render(event: NotificationEvent): RenderedTemplate {
    const actionUrl = event.deepLink || this.resolveActionUrl(event);
    const actionText = this.resolveActionText(event);

    const title = event.title;
    const body = event.summary;
    const markdown = [
      `### ${title}`,
      ``,
      body,
      ``,
      `- **Severity**: ${event.severity}`,
      `- **Observed At**: ${new Date(event.occurredAt).toUTCString()}`,
      `- **Entity**: ${event.entityType} (${event.entityId})`,
      actionUrl ? `\n[${actionText || 'View in Sculra'}](${actionUrl})` : '',
    ].join('\n');

    return {
      title,
      body,
      markdown,
      actionUrl,
      actionText,
    };
  }

  private static resolveActionUrl(event: NotificationEvent): string | undefined {
    if (!event.projectId) return undefined;

    switch (event.eventType) {
      case 'RELEASE_BLOCKED':
      case 'RELEASE_READY':
      case 'RELEASE_RELEASED':
      case 'RELEASE_ABANDONED':
      case 'RELEASE_DECISION_RECORDED':
        return `/projects/${event.projectId}/releases`;

      case 'FIX_APPROVAL_REQUIRED':
      case 'FIX_VERIFICATION_FAILED':
      case 'FIX_PR_CREATED':
      case 'HUMAN_APPROVAL_REQUIRED':
        return `/projects/${event.projectId}/fixes`;

      case 'CI_GATE_FAILED':
      case 'CI_GATE_PASSED':
      case 'CI_GATE_INSUFFICIENT_EVIDENCE':
        return `/projects/${event.projectId}/cicd`;

      case 'DEPLOYMENT_STARTED':
      case 'DEPLOYMENT_COMPLETED':
      case 'DEPLOYMENT_FAILED':
      case 'DEPLOYMENT_HEALTH_DEGRADED':
      case 'POST_RELEASE_REGRESSION_CONFIRMED':
      case 'POST_RELEASE_SIGNAL_CRITICAL':
      case 'POST_RELEASE_POSSIBLE_REGRESSION':
      case 'POST_RELEASE_RECOVERY_OBSERVED':
      case 'POST_RELEASE_VERIFICATION_FAILED':
      case 'POST_RELEASE_INSUFFICIENT_EVIDENCE':
        return `/projects/${event.projectId}/deployments`;

      case 'ENVIRONMENT_UNREACHABLE':
      case 'ENVIRONMENT_RECOVERED':
        return `/projects/${event.projectId}/environments`;

      case 'ISSUE_CREATED':
      case 'ISSUE_ESCALATED':
      case 'ISSUE_RESOLVED':
      case 'SECURITY_FINDING_CREATED':
      case 'SECURITY_BLOCKER_CREATED':
        return `/projects/${event.projectId}?tab=issues`;

      default:
        return `/projects/${event.projectId}`;
    }
  }

  private static resolveActionText(event: NotificationEvent): string {
    switch (event.eventType) {
      case 'FIX_APPROVAL_REQUIRED':
      case 'HUMAN_APPROVAL_REQUIRED':
        return 'Review Approval Request';
      case 'RELEASE_BLOCKED':
      case 'RELEASE_READY':
        return 'Inspect Release Candidate';
      case 'CI_GATE_FAILED':
        return 'Inspect CI/CD Gate Trace';
      case 'SECURITY_BLOCKER_CREATED':
        return 'Inspect Security Blocker';
      case 'POST_RELEASE_REGRESSION_CONFIRMED':
      case 'POST_RELEASE_POSSIBLE_REGRESSION':
      case 'POST_RELEASE_SIGNAL_CRITICAL':
        return 'Inspect Post-Release Correlation';
      case 'POST_RELEASE_VERIFICATION_FAILED':
        return 'Inspect Verification Campaign';
      case 'POST_RELEASE_RECOVERY_OBSERVED':
        return 'Inspect Recovery Evidence';
      default:
        return 'View Details';
    }
  }
}
