// ==============================================================================
// Sculra Deterministic Deployment -> Release Correlator (worker/src/release/deployment-release-correlator.ts)
// Answers: "Which release is associated with the deployment?"
// ==============================================================================

import {
  DeploymentSnapshot,
  ReleaseRecord,
  DeploymentReleaseCorrelation,
  CorrelationMethod,
  CorrelationStatus,
  DeploymentEvidenceReference,
} from './types';

export interface CorrelateDeploymentReleaseInput {
  deployment: DeploymentSnapshot;
  candidateReleases: ReleaseRecord[];
}

export class DeploymentReleaseCorrelator {
  /**
   * Deterministically correlates a DeploymentSnapshot to a ReleaseRecord based
   * strictly on verifiable evidence.
   *
   * Invariants (Prompt 62):
   * - Never manufactures a release association.
   * - If explicit releaseId matches: confidence = 1.0 (EXPLICIT)
   * - If commit matches exactly 1 release in same project & environment: confidence = 0.85 (COMMIT_MATCH)
   * - If multiple releases match commit: status = AMBIGUOUS, releaseId = null, confidence = 0.0
   * - If branch matches in same project & env: lower confidence = 0.50 (BRANCH_MATCH)
   * - If no match: releaseId = null, status = NOT_FOUND, confidence = 0.0
   */
  public static correlate(input: CorrelateDeploymentReleaseInput): DeploymentReleaseCorrelation {
    const { deployment, candidateReleases = [] } = input;
    const now = new Date().toISOString();

    const evidence: DeploymentEvidenceReference[] = [];

    // Filter releases belonging strictly to the same project
    const scopedReleases = candidateReleases.filter(
      (r) => r.projectId === deployment.projectId
    );

    // 1. Explicit Linkage (highest precedence)
    if (deployment.releaseId) {
      const explicitMatch = scopedReleases.find((r) => r.id === deployment.releaseId);
      if (explicitMatch) {
        evidence.push({
          kind: 'EXPLICIT_RELEASE_ID',
          source: 'DEPLOYMENT_METADATA',
          ref: `release:${explicitMatch.id}`,
          description: `Deployment explicitly links to release ${explicitMatch.version} (${explicitMatch.id})`,
          confidence: 1.0,
        });

        return {
          deploymentId: deployment.deploymentId,
          releaseId: explicitMatch.id,
          releaseVersion: explicitMatch.version,
          correlationMethod: 'explicit_deployment_release_link',
          status: 'EXPLICIT',
          confidence: 1.0,
          evidence,
          timestamp: now,
          explanation: `Correlated via authoritative explicit deployment release linkage to version ${explicitMatch.version}.`,
        };
      } else {
        // Explicit release ID supplied but not found in scoped releases
        evidence.push({
          kind: 'ORPHAN_RELEASE_ID',
          source: 'DEPLOYMENT_METADATA',
          ref: `release:${deployment.releaseId}`,
          description: `Deployment has releaseId "${deployment.releaseId}" but no matching release record exists in project.`,
          confidence: 0.5,
        });

        return {
          deploymentId: deployment.deploymentId,
          releaseId: deployment.releaseId,
          releaseVersion: deployment.releaseVersion || null,
          correlationMethod: 'explicit_deployment_release_link',
          status: 'EXPLICIT',
          confidence: 0.9,
          evidence,
          timestamp: now,
          explanation: `Deployment references explicit release ID "${deployment.releaseId}" directly.`,
        };
      }
    }

    // Check if any release explicitly references this deploymentId
    if (deployment.deploymentId) {
      const reverseExplicitMatch = scopedReleases.find(
        (r) => r.deploymentId === deployment.deploymentId
      );
      if (reverseExplicitMatch) {
        evidence.push({
          kind: 'REVERSE_DEPLOYMENT_ID',
          source: 'RELEASE_RECORD',
          ref: `release:${reverseExplicitMatch.id}`,
          description: `Release ${reverseExplicitMatch.version} explicitly references deployment ${deployment.deploymentId}`,
          confidence: 1.0,
        });

        return {
          deploymentId: deployment.deploymentId,
          releaseId: reverseExplicitMatch.id,
          releaseVersion: reverseExplicitMatch.version,
          correlationMethod: 'explicit_deployment_release_link',
          status: 'EXPLICIT',
          confidence: 1.0,
          evidence,
          timestamp: now,
          explanation: `Correlated via authoritative release record pointing to this deployment ID.`,
        };
      }
    }

    // 2. Commit Match (Deterministic commit-level correlation within same project & environment)
    if (deployment.commitSha) {
      const commitMatches = scopedReleases.filter((r) => {
        // Must match commitSha exactly
        const commitMatches = r.commitSha.trim().toLowerCase() === deployment.commitSha!.trim().toLowerCase();
        // If environmentId is known on both, must match environment
        if (deployment.environmentId && r.environmentId) {
          return commitMatches && r.environmentId === deployment.environmentId;
        }
        return commitMatches;
      });

      if (commitMatches.length === 1) {
        const matched = commitMatches[0];
        evidence.push({
          kind: 'COMMIT_MATCH',
          source: 'GIT_COMMIT_SHA',
          ref: `commit:${deployment.commitSha}:release:${matched.id}`,
          description: `Unique commit SHA match between deployment and release ${matched.version}`,
          confidence: 0.85,
        });

        return {
          deploymentId: deployment.deploymentId,
          releaseId: matched.id,
          releaseVersion: matched.version,
          correlationMethod: 'commit_match',
          status: 'COMMIT_MATCH',
          confidence: 0.85,
          evidence,
          timestamp: now,
          explanation: `Correlated via exact commit SHA match (${deployment.commitSha.slice(0, 7)}) with release ${matched.version}.`,
        };
      } else if (commitMatches.length > 1) {
        // Ambiguous: multiple releases match the same commit
        for (const m of commitMatches) {
          evidence.push({
            kind: 'AMBIGUOUS_COMMIT_MATCH',
            source: 'GIT_COMMIT_SHA',
            ref: `release:${m.id}`,
            description: `Candidate release ${m.version} matches commit ${deployment.commitSha.slice(0, 7)}`,
            confidence: 0.0,
          });
        }

        return {
          deploymentId: deployment.deploymentId,
          releaseId: null,
          releaseVersion: null,
          correlationMethod: 'commit_match',
          status: 'AMBIGUOUS',
          confidence: 0.0,
          evidence,
          timestamp: now,
          explanation: `Ambiguous correlation: Found ${commitMatches.length} candidate releases matching commit ${deployment.commitSha.slice(0, 7)}. Cannot infer release without explicit linkage.`,
        };
      }
    }

    // 3. Branch Match (Fallback if commit is unavailable or doesn't match, but branch is explicit)
    if (deployment.branch && deployment.environmentId) {
      const branchMatches = scopedReleases.filter(
        (r) =>
          r.environmentId === deployment.environmentId &&
          r.branch &&
          r.branch.trim().toLowerCase() === deployment.branch!.trim().toLowerCase() &&
          (r.status === 'CANDIDATE' || r.status === 'TESTING' || r.status === 'DRAFT')
      );

      if (branchMatches.length === 1) {
        const matched = branchMatches[0];
        evidence.push({
          kind: 'BRANCH_MATCH',
          source: 'GIT_BRANCH',
          ref: `branch:${deployment.branch}:release:${matched.id}`,
          description: `Unique active candidate release on branch ${deployment.branch}`,
          confidence: 0.5,
        });

        return {
          deploymentId: deployment.deploymentId,
          releaseId: matched.id,
          releaseVersion: matched.version,
          correlationMethod: 'branch_match',
          status: 'BRANCH_MATCH',
          confidence: 0.5,
          evidence,
          timestamp: now,
          explanation: `Heuristic branch correlation to active release candidate ${matched.version} on branch "${deployment.branch}".`,
        };
      } else if (branchMatches.length > 1) {
        return {
          deploymentId: deployment.deploymentId,
          releaseId: null,
          releaseVersion: null,
          correlationMethod: 'branch_match',
          status: 'AMBIGUOUS',
          confidence: 0.0,
          evidence,
          timestamp: now,
          explanation: `Ambiguous correlation: Multiple releases (${branchMatches.length}) found on branch "${deployment.branch}".`,
        };
      }
    }

    // 4. No Association Found
    return {
      deploymentId: deployment.deploymentId,
      releaseId: null,
      releaseVersion: null,
      correlationMethod: 'unresolved',
      status: 'NOT_FOUND',
      confidence: 0.0,
      evidence,
      timestamp: now,
      explanation: `No authoritative release record found correlating to deployment ${deployment.deploymentId || 'unidentified'}.`,
    };
  }
}
