// ==============================================================================
// Sculra Deployment Entity & Lifecycle Manager (worker/src/release/deployment.ts)
// ==============================================================================

import { DeploymentRecord, DeploymentStatus, DeploymentTrigger } from './types';

export class DeploymentManager {
  /**
   * Constructs a factual deployment record ensuring non-null commit SHA and valid status.
   */
  public static createRecord(params: {
    id?: string;
    projectId: string;
    organizationId?: string | null;
    environmentId: string;
    sourceId?: string | null;
    commitSha: string;
    branch?: string | null;
    deploymentUrl?: string | null;
    provider?: string;
    status?: DeploymentStatus;
    trigger?: DeploymentTrigger;
    idempotencyKey?: string | null;
    metadata?: Record<string, any>;
    startedAt?: string | null;
    completedAt?: string | null;
  }): DeploymentRecord {
    if (!params.commitSha) {
      throw new Error('Deployment requires a valid commitSha.');
    }

    const now = new Date().toISOString();

    return {
      id: params.id || `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: params.organizationId || null,
      projectId: params.projectId,
      environmentId: params.environmentId,
      sourceId: params.sourceId || null,
      commitSha: params.commitSha.trim(),
      branch: params.branch || null,
      deploymentUrl: params.deploymentUrl || null,
      provider: (params.provider || 'GENERIC').toUpperCase(),
      status: params.status || 'UNKNOWN',
      trigger: params.trigger || 'MANUAL',
      idempotencyKey: params.idempotencyKey || null,
      metadata: params.metadata || {},
      startedAt: params.startedAt || now,
      completedAt: params.completedAt || (params.status === 'SUCCEEDED' || params.status === 'FAILED' ? now : null),
      createdAt: now,
      updatedAt: now,
    };
  }

  public static createDeployment = DeploymentManager.createRecord;
}

