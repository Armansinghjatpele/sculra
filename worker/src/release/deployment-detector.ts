// ==============================================================================
// Sculra Deployment Detector & Webhook Correlator (worker/src/release/deployment-detector.ts)
// ==============================================================================

import { DeploymentStatus, DeploymentTrigger } from './types';

export interface DetectionResult {
  kind: 'DEPLOYMENT_CONFIRMED' | 'CODE_CHANGE_DETECTED' | 'DEPLOYMENT_FAILED' | 'UNKNOWN';
  commitSha?: string;
  branch?: string;
  environmentName?: string;
  deploymentUrl?: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  provider: string;
  idempotencyKey?: string;
  metadata: Record<string, any>;
  explanation: string;
}

export class DeploymentDetector {
  /**
   * Distinguishes factual deployment confirmation from mere code changes.
   * Never infers confirmed deployment from a raw push or PR event.
   */
  public static analyzeWebhookPayload(
    provider: string,
    eventType: string,
    payload: any,
    deliveryId?: string
  ): DetectionResult {
    // 1. GitHub Deployment Status Event
    if (eventType === 'deployment_status' && payload.deployment_status) {
      const depStatus = payload.deployment_status;
      const dep = payload.deployment || {};
      const state = (depStatus.state || '').toLowerCase();
      const commitSha = dep.sha || depStatus.target_url || '';
      const environmentName = dep.environment || payload.environment || 'production';
      const deploymentUrl = depStatus.environment_url || depStatus.target_url || undefined;
      const idempotencyKey = depStatus.id ? `gh-dep-${depStatus.id}` : deliveryId;

      let status: DeploymentStatus = 'UNKNOWN';
      let kind: DetectionResult['kind'] = 'UNKNOWN';

      if (state === 'success') {
        status = 'SUCCEEDED';
        kind = 'DEPLOYMENT_CONFIRMED';
      } else if (['failure', 'error'].includes(state)) {
        status = 'FAILED';
        kind = 'DEPLOYMENT_FAILED';
      } else if (['in_progress', 'queued', 'pending'].includes(state)) {
        status = state === 'queued' ? 'QUEUED' : 'RUNNING';
        kind = 'DEPLOYMENT_CONFIRMED';
      }

      return {
        kind,
        commitSha,
        branch: dep.ref || undefined,
        environmentName,
        deploymentUrl,
        status,
        trigger: 'WEBHOOK',
        provider: 'GITHUB',
        idempotencyKey,
        metadata: {
          deploymentId: dep.id,
          state,
          description: depStatus.description,
          logUrl: depStatus.log_url,
        },
        explanation: `Deployment event confirmed via GitHub deployment_status (${state}).`,
      };
    }

    // 2. Generic deployment webhook payload (e.g. from custom CI/CD or hosting provider)
    if (eventType === 'deployment' || payload.deployment_confirmed === true) {
      const commitSha = payload.commit_sha || payload.sha || payload.commit || '';
      const environmentName = payload.environment || payload.environment_name || 'production';
      const deploymentUrl = payload.deployment_url || payload.url;
      const statusRaw = (payload.status || 'SUCCEEDED').toUpperCase();
      const status: DeploymentStatus = ['SUCCEEDED', 'FAILED', 'RUNNING', 'QUEUED', 'CANCELLED'].includes(statusRaw)
        ? (statusRaw as DeploymentStatus)
        : 'UNKNOWN';

      return {
        kind: status === 'SUCCEEDED' ? 'DEPLOYMENT_CONFIRMED' : 'DEPLOYMENT_FAILED',
        commitSha,
        branch: payload.branch,
        environmentName,
        deploymentUrl,
        status,
        trigger: 'WEBHOOK',
        provider: provider.toUpperCase(),
        idempotencyKey: payload.event_id || payload.id || deliveryId,
        metadata: payload.metadata || {},
        explanation: `Deployment confirmed via external ${provider} webhook.`,
      };
    }

    // 3. Raw Git push or PR event — Represents CODE CHANGE, NOT deployment
    if (eventType === 'push' || eventType === 'pull_request') {
      const commitSha = payload.after || (payload.pull_request?.head?.sha) || (payload.head_commit?.id);
      const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : (payload.pull_request?.head?.ref);

      return {
        kind: 'CODE_CHANGE_DETECTED',
        commitSha,
        branch,
        status: 'UNKNOWN', // Critical: status must remain UNKNOWN until deployment is confirmed
        trigger: eventType === 'push' ? 'GITHUB_PUSH' : 'GITHUB_PR',
        provider: 'GITHUB',
        idempotencyKey: deliveryId,
        metadata: {
          note: 'Code change detected; awaiting deployment confirmation.',
          repository: payload.repository?.full_name,
        },
        explanation: 'Code change detected via repository push/PR. Deployment not yet confirmed; status remains UNKNOWN.',
      };
    }

    // 4. Fallback unknown event
    return {
      kind: 'UNKNOWN',
      status: 'UNKNOWN',
      trigger: 'UNKNOWN',
      provider: provider.toUpperCase(),
      idempotencyKey: deliveryId,
      metadata: {},
      explanation: `Unrecognized event "${eventType}" from ${provider}.`,
    };
  }

  public static detectDeploymentState(params: {
    commitSha: string;
    branch?: string;
    deploymentRecord?: import('./types').DeploymentRecord;
  }): {
    eventType: 'CODE_CHANGE_DETECTED' | 'DEPLOYMENT_CONFIRMED';
    deploymentConfirmed: boolean;
    status: DeploymentStatus;
    summary: string;
  } {
    if (!params.deploymentRecord || params.deploymentRecord.status !== 'SUCCEEDED') {
      return {
        eventType: 'CODE_CHANGE_DETECTED',
        deploymentConfirmed: false,
        status: 'UNKNOWN',
        summary: 'Code change detected via repository push/PR. Deployment not confirmed; status remains UNKNOWN.',
      };
    }

    return {
      eventType: 'DEPLOYMENT_CONFIRMED',
      deploymentConfirmed: true,
      status: 'SUCCEEDED',
      summary: `Deployment confirmed on environment.`,
    };
  }
}

