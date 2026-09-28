// ==============================================================================
// Sculra Deterministic Previous Deployment Resolver (worker/src/release/previous-deployment-resolver.ts)
// Answers: "What was the previous deployed version on this environment?"
// ==============================================================================

import { DeploymentSnapshot, DeploymentRecord } from './types';
import { buildDeploymentSnapshot } from './deployment-snapshot';

export type PreviousDeploymentResolutionStatus =
  | 'RESOLVED'
  | 'NO_PREVIOUS'
  | 'INCONCLUSIVE';

export interface ResolvePreviousDeploymentResult {
  previousDeployment: DeploymentSnapshot | null;
  status: PreviousDeploymentResolutionStatus;
  reason: string;
  evidence: Array<{ kind: string; ref: string; description: string }>;
}

export interface ResolvePreviousDeploymentInput {
  currentDeployment: DeploymentSnapshot;
  candidateDeployments: Array<DeploymentRecord | DeploymentSnapshot>;
}

export class PreviousDeploymentResolver {
  /**
   * Deterministically identifies the immediately preceding successful deployment
   * within the exact same project and environment.
   *
   * Invariants (Prompt 62):
   * - If environment is missing/null => INCONCLUSIVE.
   * - If current deployment timestamp is missing and no explicit previous link => INCONCLUSIVE.
   * - Never selects a deployment from another project or environment.
   * - Never invents an ordering without authoritative timestamps.
   */
  public static resolve(input: ResolvePreviousDeploymentInput): ResolvePreviousDeploymentResult {
    const { currentDeployment, candidateDeployments = [] } = input;
    const evidence: Array<{ kind: string; ref: string; description: string }> = [];

    // 1. Guardrail: Missing environment identity
    if (!currentDeployment.environmentId && !currentDeployment.environmentName) {
      return {
        previousDeployment: null,
        status: 'INCONCLUSIVE',
        reason: 'Inconclusive: Current deployment lacks environment identity. Cannot resolve previous deployment across unknown environment boundary.',
        evidence: [
          {
            kind: 'MISSING_ENVIRONMENT',
            ref: `deployment:${currentDeployment.deploymentId || 'unknown'}`,
            description: 'Environment ID and name are both null/unavailable.',
          },
        ],
      };
    }

    // 2. Explicit Previous Deployment Linkage (highest priority)
    if (currentDeployment.previousDeploymentId) {
      const explicitMatch = candidateDeployments.find((d) => {
        const id = 'deploymentId' in d ? d.deploymentId : d.id;
        return id === currentDeployment.previousDeploymentId;
      });

      if (explicitMatch) {
        const snapshot =
          'deploymentStatus' in explicitMatch
            ? (explicitMatch as DeploymentSnapshot)
            : buildDeploymentSnapshot({
                deploymentId: explicitMatch.id,
                projectId: explicitMatch.projectId,
                organizationId: explicitMatch.organizationId,
                environmentId: explicitMatch.environmentId,
                commitSha: explicitMatch.commitSha,
                branch: explicitMatch.branch,
                deploymentUrl: explicitMatch.deploymentUrl,
                provider: explicitMatch.provider,
                deploymentStatus: explicitMatch.status === 'SUCCEEDED' ? 'READY' : (explicitMatch.status as any),
                startedAt: explicitMatch.startedAt,
                completedAt: explicitMatch.completedAt,
              });

        evidence.push({
          kind: 'EXPLICIT_PREVIOUS_LINK',
          ref: `deployment:${snapshot.deploymentId}`,
          description: `Authoritative explicit previous deployment link to ${snapshot.deploymentId}`,
        });

        return {
          previousDeployment: snapshot,
          status: 'RESOLVED',
          reason: `Resolved via explicit previous deployment linkage to ${snapshot.deploymentId}.`,
          evidence,
        };
      }
    }

    // 3. Scope candidates strictly to same project and same environment
    const scopedCandidates = candidateDeployments.filter((d) => {
      const dProj = 'projectId' in d ? d.projectId : '';
      if (dProj !== currentDeployment.projectId) return false;

      const dId = 'deploymentId' in d ? d.deploymentId : d.id;
      if (dId && currentDeployment.deploymentId && dId === currentDeployment.deploymentId) return false;

      // Must match environment
      const dEnvId = 'environmentId' in d ? d.environmentId : null;
      const dEnvName = 'environmentName' in d ? d.environmentName : null;

      if (currentDeployment.environmentId && dEnvId) {
        if (dEnvId !== currentDeployment.environmentId) return false;
      } else if (currentDeployment.environmentName && dEnvName) {
        if (dEnvName.toLowerCase() !== currentDeployment.environmentName.toLowerCase()) return false;
      } else {
        return false;
      }

      // Must be a completed/succeeded deployment
      const status = 'deploymentStatus' in d ? d.deploymentStatus : d.status;
      return status === 'READY' || status === 'SUCCEEDED';
    });

    if (scopedCandidates.length === 0) {
      return {
        previousDeployment: null,
        status: 'NO_PREVIOUS',
        reason: `Initial deployment: No prior successful deployments recorded in environment "${currentDeployment.environmentName || currentDeployment.environmentId}".`,
        evidence: [
          {
            kind: 'INITIAL_DEPLOYMENT',
            ref: `env:${currentDeployment.environmentName || currentDeployment.environmentId}`,
            description: 'No prior successful deployments found in scope.',
          },
        ],
      };
    }

    // 4. Timestamp-based Chronological Ordering
    const currentTime = currentDeployment.startedAt || currentDeployment.completedAt;
    if (!currentTime) {
      return {
        previousDeployment: null,
        status: 'INCONCLUSIVE',
        reason: 'Inconclusive: Current deployment lacks authoritative timestamp evidence (startedAt/completedAt). Ordering cannot be fabricated.',
        evidence: [
          {
            kind: 'MISSING_TIMESTAMP',
            ref: `deployment:${currentDeployment.deploymentId}`,
            description: 'Cannot order deployments without authoritative timestamp.',
          },
        ],
      };
    }

    const currentEpoch = new Date(currentTime).getTime();
    if (isNaN(currentEpoch)) {
      return {
        previousDeployment: null,
        status: 'INCONCLUSIVE',
        reason: `Inconclusive: Invalid timestamp format on current deployment ("${currentTime}").`,
        evidence: [],
      };
    }

    // Filter to deployments strictly prior to current deployment
    const priorCandidates = scopedCandidates.filter((d) => {
      const dTime = d.completedAt || d.startedAt;
      if (!dTime) return false;
      const dEpoch = new Date(dTime).getTime();
      return !isNaN(dEpoch) && dEpoch < currentEpoch;
    });

    if (priorCandidates.length === 0) {
      return {
        previousDeployment: null,
        status: 'NO_PREVIOUS',
        reason: `Initial deployment: No deployments found prior to timestamp ${currentTime}.`,
        evidence: [
          {
            kind: 'CHRONOLOGICAL_INITIAL',
            ref: `timestamp:${currentTime}`,
            description: 'All candidates are newer than or concurrent with current deployment.',
          },
        ],
      };
    }

    // Sort descending by completion/start time
    priorCandidates.sort((a, b) => {
      const timeA = new Date(a.completedAt || a.startedAt || 0).getTime();
      const timeB = new Date(b.completedAt || b.startedAt || 0).getTime();
      return timeB - timeA;
    });

    const chosen = priorCandidates[0];
    const previousSnapshot =
      'deploymentStatus' in chosen
        ? (chosen as DeploymentSnapshot)
        : buildDeploymentSnapshot({
            deploymentId: chosen.id,
            projectId: chosen.projectId,
            organizationId: chosen.organizationId,
            environmentId: chosen.environmentId,
            commitSha: chosen.commitSha,
            branch: chosen.branch,
            deploymentUrl: chosen.deploymentUrl,
            provider: chosen.provider,
            deploymentStatus: chosen.status === 'SUCCEEDED' ? 'READY' : (chosen.status as any),
            startedAt: chosen.startedAt,
            completedAt: chosen.completedAt,
          });

    evidence.push({
      kind: 'CHRONOLOGICAL_MATCH',
      ref: `deployment:${previousSnapshot.deploymentId}`,
      description: `Immediately preceding deployment completed at ${previousSnapshot.completedAt || previousSnapshot.startedAt}`,
    });

    return {
      previousDeployment: previousSnapshot,
      status: 'RESOLVED',
      reason: `Resolved previous deployment ${previousSnapshot.deploymentId} (${previousSnapshot.commitSha?.slice(0, 7) || 'no-sha'}) based on chronological completion in environment "${currentDeployment.environmentName || currentDeployment.environmentId}".`,
      evidence,
    };
  }
}
