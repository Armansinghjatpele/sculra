// ==============================================================================
// Sculra Deterministic Deployment Correlation Engine
// (worker/src/signals/correlation-engine.ts)
//
// Invariants (Prompt 64):
// - NO EVIDENCE -> NO INFERENCE
// - Temporal proximity is strictly TEMPORAL_ONLY, NEVER causality
// - Only mark EXACT_MATCH or STRONG_CORRELATION when factual identifiers support it
// - Multiple competing matches without distinguishing evidence are AMBIGUOUS
// - Missing evidence produces INSUFFICIENT_EVIDENCE, never HEALTHY or causal links
// ==============================================================================

import crypto from 'crypto';
import { CorrelationState, ProductionSignal, SignalCorrelation } from './types';

export interface DeploymentCandidate {
  id: string;
  projectId: string;
  organizationId?: string | null;
  environmentId?: string | null;
  releaseId?: string | null;
  commitSha?: string | null;
  branch?: string | null;
  deploymentUrl?: string | null;
  status?: string | null;
  deployedAt?: string | null;
  createdAt: string;
}

export class DeploymentCorrelationEngine {
  /**
   * Correlates a production signal against candidate deployments deterministically.
   */
  public static correlate(
    signal: ProductionSignal,
    candidates: DeploymentCandidate[]
  ): SignalCorrelation {
    const reasons: string[] = [];
    const evidenceDetails: Record<string, any> = {
      signalId: signal.id,
      signalFingerprint: signal.fingerprint,
      signalType: signal.signalType,
      provider: signal.provider,
      observedAt: signal.firstObservedAt,
    };

    // Guard: Empty candidate pool
    if (!candidates || candidates.length === 0) {
      const hasIdentifiers = Boolean(
        signal.deploymentId ||
        signal.affectedCommit ||
        signal.releaseId
      );

      if (hasIdentifiers) {
        return {
          id: crypto.randomUUID(),
          signalId: signal.id,
          projectId: signal.projectId,
          organizationId: signal.organizationId,
          deploymentId: signal.deploymentId,
          releaseId: signal.releaseId,
          correlationState: 'NO_CORRELATION',
          confidence: 0.0,
          reasons: ['Signal references deployment or commit identifiers, but no matching deployments exist in project.'],
          evidenceDetails,
          evaluatedAt: new Date().toISOString(),
        };
      }

      return {
        id: crypto.randomUUID(),
        signalId: signal.id,
        projectId: signal.projectId,
        organizationId: signal.organizationId,
        deploymentId: null,
        releaseId: null,
        correlationState: 'INSUFFICIENT_EVIDENCE',
        confidence: 0.0,
        reasons: ['No candidate deployments available and signal contains no deployment identifiers.'],
        evidenceDetails,
        evaluatedAt: new Date().toISOString(),
      };
    }

    // 1. Check for Exact Deployment ID Match
    if (signal.deploymentId) {
      const match = candidates.find((c) => c.id === signal.deploymentId);
      if (match) {
        reasons.push(`Exact deployment ID match: '${match.id}'.`);
        evidenceDetails.matchedDeploymentId = match.id;

        // Check if commit also matches
        if (signal.affectedCommit && match.commitSha) {
          const c1 = signal.affectedCommit.toLowerCase();
          const c2 = match.commitSha.toLowerCase();
          if (c1 === c2 || c1.startsWith(c2) || c2.startsWith(c1)) {
            reasons.push(`Commit SHA confirms deployment: '${match.commitSha}'.`);
            evidenceDetails.matchedCommit = match.commitSha;
          }
        }

        return {
          id: crypto.randomUUID(),
          signalId: signal.id,
          projectId: signal.projectId,
          organizationId: signal.organizationId,
          deploymentId: match.id,
          releaseId: match.releaseId || signal.releaseId || null,
          correlationState: 'EXACT_MATCH',
          confidence: 1.0,
          reasons,
          evidenceDetails,
          evaluatedAt: new Date().toISOString(),
        };
      }
    }

    // 2. Check for Commit SHA Match
    if (signal.affectedCommit) {
      const normSignalCommit = signal.affectedCommit.toLowerCase().trim();
      const matchingCommitCandidates = candidates.filter((c) => {
        if (!c.commitSha) return false;
        const normCandCommit = c.commitSha.toLowerCase().trim();
        return (
          normSignalCommit === normCandCommit ||
          (normSignalCommit.length >= 7 && normCandCommit.startsWith(normSignalCommit)) ||
          (normCandCommit.length >= 7 && normSignalCommit.startsWith(normCandCommit))
        );
      });

      if (matchingCommitCandidates.length === 1) {
        const match = matchingCommitCandidates[0];
        reasons.push(`Factual commit SHA match: '${match.commitSha}'.`);
        evidenceDetails.matchedCommit = match.commitSha;
        evidenceDetails.matchedDeploymentId = match.id;

        const isExact = Boolean(
          (signal.environmentId && signal.environmentId === match.environmentId) ||
          (signal.releaseId && signal.releaseId === match.releaseId)
        );

        if (isExact) {
          reasons.push('Environment or release identifier confirms exact candidate.');
        }

        return {
          id: crypto.randomUUID(),
          signalId: signal.id,
          projectId: signal.projectId,
          organizationId: signal.organizationId,
          deploymentId: match.id,
          releaseId: match.releaseId || signal.releaseId || null,
          correlationState: isExact ? 'EXACT_MATCH' : 'STRONG_CORRELATION',
          confidence: isExact ? 0.95 : 0.85,
          reasons,
          evidenceDetails,
          evaluatedAt: new Date().toISOString(),
        };
      } else if (matchingCommitCandidates.length > 1) {
        // Multiple deployments share this commit SHA (e.g. staging vs prod)
        // If signal has environmentId, disambiguate
        if (signal.environmentId) {
          const envMatch = matchingCommitCandidates.find(
            (c) => c.environmentId === signal.environmentId
          );
          if (envMatch) {
            reasons.push(
              `Commit SHA '${normSignalCommit}' disambiguated by matching environment ID '${signal.environmentId}'.`
            );
            return {
              id: crypto.randomUUID(),
              signalId: signal.id,
              projectId: signal.projectId,
              organizationId: signal.organizationId,
              deploymentId: envMatch.id,
              releaseId: envMatch.releaseId || signal.releaseId || null,
              correlationState: 'EXACT_MATCH',
              confidence: 0.95,
              reasons,
              evidenceDetails,
              evaluatedAt: new Date().toISOString(),
            };
          }
        }

        reasons.push(
          `Multiple candidate deployments (${matchingCommitCandidates.length}) share commit SHA '${normSignalCommit}' without distinguishing environment or release evidence.`
        );
        evidenceDetails.ambiguousDeploymentIds = matchingCommitCandidates.map((c) => c.id);

        return {
          id: crypto.randomUUID(),
          signalId: signal.id,
          projectId: signal.projectId,
          organizationId: signal.organizationId,
          deploymentId: null,
          releaseId: null,
          correlationState: 'AMBIGUOUS',
          confidence: 0.5,
          reasons,
          evidenceDetails,
          evaluatedAt: new Date().toISOString(),
        };
      }
    }

    // 3. Check for Release ID Match
    if (signal.releaseId) {
      const matchRelease = candidates.filter((c) => c.releaseId === signal.releaseId);
      if (matchRelease.length === 1) {
        const match = matchRelease[0];
        reasons.push(`Release identifier match: '${signal.releaseId}'.`);
        evidenceDetails.matchedReleaseId = signal.releaseId;
        evidenceDetails.matchedDeploymentId = match.id;

        return {
          id: crypto.randomUUID(),
          signalId: signal.id,
          projectId: signal.projectId,
          organizationId: signal.organizationId,
          deploymentId: match.id,
          releaseId: match.releaseId || null,
          correlationState: 'STRONG_CORRELATION',
          confidence: 0.8,
          reasons,
          evidenceDetails,
          evaluatedAt: new Date().toISOString(),
        };
      } else if (matchRelease.length > 1) {
        reasons.push(`Multiple deployments share release ID '${signal.releaseId}'.`);
        return {
          id: crypto.randomUUID(),
          signalId: signal.id,
          projectId: signal.projectId,
          organizationId: signal.organizationId,
          deploymentId: null,
          releaseId: signal.releaseId || null,
          correlationState: 'AMBIGUOUS',
          confidence: 0.45,
          reasons,
          evidenceDetails,
          evaluatedAt: new Date().toISOString(),
        };
      }
    }

    // 4. Temporal Proximity Check
    // If NO factual identifiers (deploymentId, commit, releaseId) matched:
    // We check if signal occurred within a bounded deployment window (e.g. 0 to 60 minutes after deployment)
    const signalObservedTime = new Date(signal.firstObservedAt).getTime();
    if (!isNaN(signalObservedTime)) {
      // Find candidate deployment that occurred just before the signal
      const temporalCandidates = candidates
        .map((c) => {
          const depTime = new Date(c.deployedAt || c.createdAt).getTime();
          const diffMinutes = (signalObservedTime - depTime) / (1000 * 60);
          return { candidate: c, depTime, diffMinutes };
        })
        .filter((item) => !isNaN(item.depTime) && item.diffMinutes >= 0 && item.diffMinutes <= 60)
        .sort((a, b) => a.diffMinutes - b.diffMinutes);

      if (temporalCandidates.length > 0) {
        const nearest = temporalCandidates[0];
        reasons.push(
          `Signal observed ~${Math.round(nearest.diffMinutes)} minutes after deployment '${nearest.candidate.id}'.`
        );
        reasons.push(
          'Temporal proximity observed without factual commit or deployment identifier correlation. Under strict invariant NO EVIDENCE -> NO INFERENCE, this cannot be inferred as deployment-caused.'
        );

        evidenceDetails.temporalCandidateId = nearest.candidate.id;
        evidenceDetails.diffMinutes = Math.round(nearest.diffMinutes);

        return {
          id: crypto.randomUUID(),
          signalId: signal.id,
          projectId: signal.projectId,
          organizationId: signal.organizationId,
          deploymentId: nearest.candidate.id,
          releaseId: nearest.candidate.releaseId || null,
          correlationState: 'TEMPORAL_ONLY',
          confidence: 0.35,
          reasons,
          evidenceDetails,
          evaluatedAt: new Date().toISOString(),
        };
      }
    }

    // 5. No Correlation or Insufficient Evidence
    const hasAnyIdentifier = Boolean(
      signal.affectedRoute ||
      signal.affectedService ||
      signal.affectedUrl ||
      signal.environmentId
    );

    if (!hasAnyIdentifier) {
      return {
        id: crypto.randomUUID(),
        signalId: signal.id,
        projectId: signal.projectId,
        organizationId: signal.organizationId,
        deploymentId: null,
        releaseId: null,
        correlationState: 'INSUFFICIENT_EVIDENCE',
        confidence: 0.0,
        reasons: ['Signal contains no deployment ID, commit SHA, release ID, environment, or temporal proximity to candidate deployments.'],
        evidenceDetails,
        evaluatedAt: new Date().toISOString(),
      };
    }

    return {
      id: crypto.randomUUID(),
      signalId: signal.id,
      projectId: signal.projectId,
      organizationId: signal.organizationId,
      deploymentId: null,
      releaseId: null,
      correlationState: 'NO_CORRELATION',
      confidence: 0.0,
      reasons: ['No factual identifier or temporal correlation found with candidate deployments.'],
      evidenceDetails,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
