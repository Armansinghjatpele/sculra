// ==============================================================================
// Sculra Deployment Provider Integrations (worker/src/release/deployment-provider.ts)
// Providers: Vercel, Railway, Generic CI/CD
// Normalizes provider-specific webhook/API payloads into canonical DeploymentSnapshot
// ==============================================================================

import {
  DeploymentSnapshot,
  DeploymentLifecycleStatus,
  DeploymentSource,
  DeploymentEvidenceReference,
} from './types';
import { buildDeploymentSnapshot } from './deployment-snapshot';
import { redactSensitiveData } from '../change-intelligence/redaction';

export interface DeploymentProvider {
  readonly name: string;
  readonly source: DeploymentSource;

  normalizeWebhook(
    payload: any,
    headers?: Record<string, string>
  ): DeploymentSnapshot;
}

/**
 * Normalizes Vercel deployment payloads.
 * Strictly avoids fabricating environment or commit when missing.
 */
export class VercelDeploymentProvider implements DeploymentProvider {
  public readonly name = 'VERCEL';
  public readonly source: DeploymentSource = 'VERCEL';

  public normalizeWebhook(
    payload: any,
    headers: Record<string, string> = {}
  ): DeploymentSnapshot {
    const deployment = payload.deployment || payload;
    const meta = deployment.meta || {};

    const deploymentId = deployment.id || deployment.uid || null;
    const deploymentUrl = deployment.url ? (deployment.url.startsWith('http') ? deployment.url : `https://${deployment.url}`) : null;
    const commitSha = meta.githubCommitSha || meta.gitlabCommitSha || meta.commitSha || deployment.commitSha || null;
    const branch = meta.githubCommitRef || meta.gitlabCommitRef || meta.branch || deployment.branch || null;

    // Vercel environment targets: production or preview
    // Strict: Only use explicit target/environment; do NOT infer from URL
    const target = deployment.target || meta.target || payload.target || null;
    let environmentName: string | null = null;
    if (typeof target === 'string' && target.trim().length > 0) {
      environmentName = target.trim().toLowerCase();
    }

    // Map Vercel readyState to canonical DeploymentLifecycleStatus
    const rawState = (deployment.readyState || deployment.state || deployment.status || '').toUpperCase();
    let deploymentStatus: DeploymentLifecycleStatus = 'UNKNOWN';
    if (rawState === 'READY') {
      deploymentStatus = 'READY';
    } else if (['BUILDING', 'INITIALIZING', 'QUEUED'].includes(rawState)) {
      deploymentStatus = 'DEPLOYING';
    } else if (['ERROR', 'FAILED'].includes(rawState)) {
      deploymentStatus = 'FAILED';
    } else if (['CANCELED', 'CANCELLED'].includes(rawState)) {
      deploymentStatus = 'CANCELLED';
    }

    const evidence: DeploymentEvidenceReference[] = [];
    if (deploymentId) {
      evidence.push({
        kind: 'VERCEL_DEPLOYMENT_ID',
        source: 'VERCEL',
        ref: `vercel:${deploymentId}`,
        description: `Vercel deployment ID: ${deploymentId}`,
        confidence: 1.0,
      });
    }

    const projectId = payload.projectId || meta.sculraProjectId || 'unknown-project';

    const safeMeta = redactSensitiveData({
      ...meta,
      regions: deployment.regions,
      creator: deployment.creator?.username,
      source: 'vercel_webhook',
    }) as Record<string, any>;

    return buildDeploymentSnapshot({
      deploymentId,
      projectId,
      environmentName,
      deploymentStatus,
      deploymentUrl,
      commitSha,
      branch,
      provider: 'VERCEL',
      startedAt: deployment.createdAt ? new Date(deployment.createdAt).toISOString() : null,
      completedAt: deployment.ready ? new Date(deployment.ready).toISOString() : null,
      source: 'VERCEL',
      evidence,
      metadata: safeMeta,
    });
  }
}

/**
 * Normalizes Railway deployment payloads.
 * Strictly avoids fabricating environment or commit when missing.
 */
export class RailwayDeploymentProvider implements DeploymentProvider {
  public readonly name = 'RAILWAY';
  public readonly source: DeploymentSource = 'RAILWAY';

  public normalizeWebhook(
    payload: any,
    headers: Record<string, string> = {}
  ): DeploymentSnapshot {
    const deployment = payload.deployment || payload;
    const meta = deployment.meta || payload.meta || {};

    const deploymentId = deployment.id || null;
    const deploymentUrl = deployment.staticUrl || deployment.url || null;
    const commitSha = meta.commitHash || deployment.commitHash || deployment.commitSha || null;
    const branch = meta.branch || deployment.branch || null;

    // Railway environment object or name
    let environmentName: string | null = null;
    if (payload.environment?.name && typeof payload.environment.name === 'string') {
      environmentName = payload.environment.name.trim();
    } else if (deployment.environmentName && typeof deployment.environmentName === 'string') {
      environmentName = deployment.environmentName.trim();
    }

    // Map Railway status to canonical DeploymentLifecycleStatus
    const rawStatus = (deployment.status || '').toUpperCase();
    let deploymentStatus: DeploymentLifecycleStatus = 'UNKNOWN';
    if (rawStatus === 'SUCCESS') {
      deploymentStatus = 'READY';
    } else if (['BUILDING', 'DEPLOYING', 'INITIALIZING'].includes(rawStatus)) {
      deploymentStatus = 'DEPLOYING';
    } else if (['FAILED', 'CRASHED'].includes(rawStatus)) {
      deploymentStatus = 'FAILED';
    } else if (['REMOVED', 'CANCELLED', 'CANCELED'].includes(rawStatus)) {
      deploymentStatus = 'CANCELLED';
    }

    const evidence: DeploymentEvidenceReference[] = [];
    if (deploymentId) {
      evidence.push({
        kind: 'RAILWAY_DEPLOYMENT_ID',
        source: 'RAILWAY',
        ref: `railway:${deploymentId}`,
        description: `Railway deployment ID: ${deploymentId}`,
        confidence: 1.0,
      });
    }

    const projectId = payload.projectId || meta.sculraProjectId || 'unknown-project';

    const safeMeta = redactSensitiveData({
      ...meta,
      serviceId: deployment.serviceId,
      environmentId: payload.environment?.id,
      source: 'railway_webhook',
    }) as Record<string, any>;

    return buildDeploymentSnapshot({
      deploymentId,
      projectId,
      environmentName,
      deploymentStatus,
      deploymentUrl,
      commitSha,
      branch,
      provider: 'RAILWAY',
      startedAt: deployment.createdAt || null,
      completedAt: deployment.updatedAt || null,
      source: 'RAILWAY',
      evidence,
      metadata: safeMeta,
    });
  }
}

/**
 * Generic CI/CD / Manual Webhook Provider.
 * Accepts structured payloads while maintaining strict validation and zero fabrication.
 */
export class GenericDeploymentProvider implements DeploymentProvider {
  public readonly name = 'GENERIC';
  public readonly source: DeploymentSource = 'CI';

  public normalizeWebhook(
    payload: any,
    headers: Record<string, string> = {}
  ): DeploymentSnapshot {
    const deploymentId = payload.deployment_id || payload.deploymentId || payload.id || null;
    const projectId = payload.project_id || payload.projectId || 'unknown-project';
    const commitSha = payload.commit_sha || payload.commitSha || payload.sha || null;
    const branch = payload.branch || payload.ref || null;
    const deploymentUrl = payload.deployment_url || payload.deploymentUrl || payload.url || null;
    const provider = payload.provider ? String(payload.provider).toUpperCase() : 'GENERIC';

    // Strict: No default environment
    const environmentName = payload.environment || payload.environment_name || payload.environmentName || null;
    const environmentId = payload.environment_id || payload.environmentId || null;

    const rawStatus = String(payload.status || '').toUpperCase();
    let deploymentStatus: DeploymentLifecycleStatus = 'UNKNOWN';
    if (['READY', 'SUCCESS', 'SUCCEEDED'].includes(rawStatus)) {
      deploymentStatus = 'READY';
    } else if (['DEPLOYING', 'BUILDING', 'RUNNING', 'IN_PROGRESS', 'QUEUED'].includes(rawStatus)) {
      deploymentStatus = 'DEPLOYING';
    } else if (['FAILED', 'ERROR'].includes(rawStatus)) {
      deploymentStatus = 'FAILED';
    } else if (['CANCELLED', 'CANCELED'].includes(rawStatus)) {
      deploymentStatus = 'CANCELLED';
    }

    const evidence: DeploymentEvidenceReference[] = [];
    if (deploymentId) {
      evidence.push({
        kind: 'GENERIC_DEPLOYMENT_ID',
        source: provider,
        ref: `deployment:${deploymentId}`,
        description: `${provider} deployment notification: ${deploymentId}`,
        confidence: 0.9,
      });
    }

    const safeMeta = redactSensitiveData(payload.metadata || {}) as Record<string, any>;

    return buildDeploymentSnapshot({
      deploymentId,
      projectId,
      environmentId,
      environmentName,
      deploymentStatus,
      deploymentUrl,
      commitSha,
      branch,
      provider,
      startedAt: payload.started_at || payload.startedAt || null,
      completedAt: payload.completed_at || payload.completedAt || null,
      source: 'CI',
      evidence,
      metadata: safeMeta,
    });
  }
}
