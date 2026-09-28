// ==============================================================================
// Sculra Deployment Change Analyzer (worker/src/release/deployment-change-analyzer.ts)
// Connects DeploymentSnapshot to existing ChangeSnapshot (XYZ -> ABC)
// Answers: "What changed between previous deployed version and new version?"
// ==============================================================================

import { DeploymentSnapshot, DeploymentChangeComparison, DeploymentEvidenceReference } from './types';
import { ChangeSnapshot, buildChangeSnapshot } from '../change-intelligence/snapshot';
import { ChangeIntelligenceAnalyzer } from '../change-intelligence/analyzer';

export interface AnalyzeDeploymentChangeInput {
  currentDeployment: DeploymentSnapshot;
  previousDeployment?: DeploymentSnapshot | null;
  cachedChangeSnapshot?: ChangeSnapshot | null;
  analyzer?: ChangeIntelligenceAnalyzer;
  gitDiffFiles?: any[];
}

export class DeploymentChangeAnalyzer {
  /**
   * Deterministically evaluates code changes between previous and current deployments.
   *
   * Invariants (Prompt 62):
   * - If current commit is null/missing => INCONCLUSIVE.
   * - If previous commit is null/missing => INCONCLUSIVE (initial deployment or missing baseline commit).
   * - Never compares against arbitrary refs (HEAD, main, latest commit).
   * - Connects to existing canonical ChangeSnapshot.
   */
  public static async analyze(input: AnalyzeDeploymentChangeInput): Promise<DeploymentChangeComparison> {
    const {
      currentDeployment,
      previousDeployment,
      cachedChangeSnapshot,
      gitDiffFiles,
    } = input;

    const currentCommit = currentDeployment.commitSha;
    const previousCommit = previousDeployment?.commitSha || currentDeployment.previousCommitSha;

    const evidence: DeploymentEvidenceReference[] = [];

    // 1. Guardrail: Missing Current Commit
    if (!currentCommit) {
      return {
        deploymentId: currentDeployment.deploymentId,
        previousDeploymentId: previousDeployment?.deploymentId || null,
        currentCommitSha: null,
        previousCommitSha: previousCommit || null,
        status: 'INCONCLUSIVE',
        reason: 'Inconclusive: Current deployment lacks commit SHA evidence. Cannot analyze code diff.',
        changedFilesCount: 0,
        classifications: [],
        affectedRoutes: [],
        affectedApis: [],
        affectedWorkflows: [],
        criticalWorkflows: [],
        confidence: 0.0,
        evidence: [
          {
            kind: 'MISSING_COMMIT_SHA',
            source: 'DEPLOYMENT_METADATA',
            ref: `deployment:${currentDeployment.deploymentId || 'unknown'}`,
            description: 'currentDeployment.commitSha is null/unavailable.',
            confidence: 0.0,
          },
        ],
      };
    }

    // 2. Guardrail: Missing Previous Commit (Initial deployment or baseline unavailable)
    if (!previousCommit) {
      return {
        deploymentId: currentDeployment.deploymentId,
        previousDeploymentId: previousDeployment?.deploymentId || null,
        currentCommitSha: currentCommit,
        previousCommitSha: null,
        status: 'INCONCLUSIVE',
        reason: 'Inconclusive: No prior deployed commit SHA available for comparison. Full initial baseline required.',
        changedFilesCount: 0,
        classifications: [],
        affectedRoutes: [],
        affectedApis: [],
        affectedWorkflows: [],
        criticalWorkflows: [],
        confidence: 0.0,
        evidence: [
          {
            kind: 'MISSING_PREVIOUS_COMMIT',
            source: 'DEPLOYMENT_METADATA',
            ref: `deployment:${currentDeployment.deploymentId}`,
            description: 'Previous deployment commit is null; cannot compute relative diff without inventing base.',
            confidence: 0.0,
          },
        ],
      };
    }

    // 3. Identical Commits (Redeploy or configuration-only rollout)
    if (currentCommit.trim().toLowerCase() === previousCommit.trim().toLowerCase()) {
      evidence.push({
        kind: 'IDENTICAL_COMMITS',
        source: 'GIT_COMMIT_SHA',
        ref: `commit:${currentCommit}`,
        description: `Both previous and current deployments point to commit ${currentCommit.slice(0, 7)}`,
        confidence: 1.0,
      });

      return {
        deploymentId: currentDeployment.deploymentId,
        previousDeploymentId: previousDeployment?.deploymentId || null,
        currentCommitSha: currentCommit,
        previousCommitSha: previousCommit,
        status: 'IDENTICAL_COMMITS',
        reason: `Zero code changes: Both deployments share identical commit SHA ${currentCommit.slice(0, 7)}. Behavior differences, if any, stem from environment or configuration drift.`,
        changedFilesCount: 0,
        classifications: [],
        affectedRoutes: [],
        affectedApis: [],
        affectedWorkflows: [],
        criticalWorkflows: [],
        confidence: 1.0,
        evidence,
      };
    }

    // 4. Reuse or build ChangeSnapshot (XYZ -> ABC)
    let snapshot: ChangeSnapshot;

    if (
      cachedChangeSnapshot &&
      (cachedChangeSnapshot.commitSha === currentCommit || cachedChangeSnapshot.headCommit === currentCommit) &&
      (cachedChangeSnapshot.baseSha === previousCommit || cachedChangeSnapshot.baseCommit === previousCommit)
    ) {
      snapshot = cachedChangeSnapshot;
    } else {
      snapshot = buildChangeSnapshot({
        commitSha: currentCommit,
        baseSha: previousCommit,
        headCommit: currentCommit,
        baseCommit: previousCommit,
        branch: currentDeployment.branch || undefined,
        headBranch: currentDeployment.branch || undefined,
        baseBranch: previousDeployment?.branch || undefined,
        files: gitDiffFiles || [],
      });
    }

    evidence.push({
      kind: 'COMMIT_DIFF',
      source: 'GIT_DIFF',
      ref: `diff:${previousCommit.slice(0, 7)}..${currentCommit.slice(0, 7)}`,
      description: `Code mutated between ${previousCommit.slice(0, 7)} and ${currentCommit.slice(0, 7)} (${snapshot.files.length} files)`,
      confidence: 1.0,
    });

    const classifications = snapshot.classifications.map((c) => String(c));
    const affectedRoutes = snapshot.changedRoutes || [];
    const affectedApis = snapshot.changedApis || [];

    // Extract critical workflows touched by mutations
    const criticalWorkflows: string[] = [];
    const affectedWorkflows: string[] = [];

    for (const r of affectedRoutes) {
      const lower = r.toLowerCase();
      if (lower.includes('checkout') || lower.includes('payment') || lower.includes('order') || lower.includes('auth') || lower.includes('login')) {
        criticalWorkflows.push(`Workflow: ${r}`);
      }
      affectedWorkflows.push(r);
    }

    return {
      deploymentId: currentDeployment.deploymentId,
      previousDeploymentId: previousDeployment?.deploymentId || null,
      currentCommitSha: currentCommit,
      previousCommitSha: previousCommit,
      status: 'ANALYZED',
      reason: `Analyzed code changes between deployments: ${previousCommit.slice(0, 7)} -> ${currentCommit.slice(0, 7)} (${snapshot.files.length} changed files, ${classifications.length} categories).`,
      changedFilesCount: snapshot.files.length,
      classifications,
      affectedRoutes,
      affectedApis,
      affectedWorkflows,
      criticalWorkflows,
      confidence: 0.95,
      evidence,
    };
  }
}
