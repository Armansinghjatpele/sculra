// ==============================================================================
// Sculra Release Entity & Lifecycle State Machine (worker/src/release/release.ts)
// ==============================================================================

import { ReleaseRecord, ReleaseStatus } from './types';

const VALID_TRANSITIONS: Record<ReleaseStatus, ReleaseStatus[]> = {
  DRAFT: ['CANDIDATE', 'ABANDONED'],
  CANDIDATE: ['TESTING', 'BLOCKED', 'ABANDONED'],
  TESTING: ['READY', 'BLOCKED', 'CANDIDATE', 'ABANDONED'],
  READY: ['RELEASED', 'BLOCKED', 'TESTING', 'ABANDONED'],
  BLOCKED: ['TESTING', 'CANDIDATE', 'ABANDONED'],
  RELEASED: [], // Terminal released state
  ABANDONED: [], // Terminal abandoned state
};

export class ReleaseLifecycleManager {
  /**
   * Asserts whether a transition between two release statuses is valid.
   */
  public static assertTransition(from: ReleaseStatus, to: ReleaseStatus): void {
    if (from === to) return;
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new Error(`Invalid release state transition from "${from}" to "${to}".`);
    }
  }

  /**
   * Constructs a release candidate record with semantic versioning.
   */
  public static createRecord(params: {
    id?: string;
    projectId: string;
    organizationId?: string | null;
    environmentId: string;
    deploymentId?: string | null;
    sourceId?: string | null;
    version: string;
    commitSha: string;
    branch?: string | null;
    status?: ReleaseStatus;
    previousReleaseId?: string | null;
    metadata?: Record<string, any>;
  }): ReleaseRecord {
    if (!params.version || !params.commitSha) {
      throw new Error('Release candidate requires a valid version and commitSha.');
    }

    const now = new Date().toISOString();

    return {
      id: params.id || `rel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: params.organizationId || null,
      projectId: params.projectId,
      environmentId: params.environmentId,
      deploymentId: params.deploymentId || null,
      sourceId: params.sourceId || null,
      version: params.version.trim(),
      commitSha: params.commitSha.trim(),
      branch: params.branch || null,
      status: params.status || 'CANDIDATE',
      previousReleaseId: params.previousReleaseId || null,
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now,
    };
  }

  public static createRelease = ReleaseLifecycleManager.createRecord;

  public static transitionStatus(release: ReleaseRecord, nextStatus: ReleaseStatus): ReleaseRecord {
    this.assertTransition(release.status, nextStatus);
    return {
      ...release,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const ReleaseManager = ReleaseLifecycleManager;

