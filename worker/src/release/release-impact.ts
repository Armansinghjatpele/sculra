// ==============================================================================
// Sculra Deterministic Release Impact Analyzer (worker/src/release/release-impact.ts)
// Answers: "What is the release impact of this deployment?", "Are regressions introduced?",
// "Which user workflows or product areas are affected?", "Is this deployment safe to promote?"
// ==============================================================================

import {
  DeploymentSnapshot,
  ReleaseRecord,
  DeploymentChangeComparison,
  ReleaseImpact,
  ReleaseImpactStatus,
  DeploymentEvidenceReference,
} from './types';
import { RegressionComparisonResult } from '../change-intelligence/types';
import { CampaignTaskResult } from '../campaign/types';

export interface AnalyzeReleaseImpactInput {
  deployment?: DeploymentSnapshot | null;
  release?: ReleaseRecord | null;
  changeComparison?: DeploymentChangeComparison | null;
  regressionComparison?: RegressionComparisonResult | null;
  taskResults?: CampaignTaskResult[];
  environmentId?: string | null;
  metadata?: Record<string, any>;
}

export class ReleaseImpactAnalyzer {
  /**
   * Evaluates the multi-dimensional impact of a deployment or release.
   *
   * Strict Invariants (Prompt 62):
   * - NO EVIDENCE -> NO INFERENCE:
   *   Unknown impact dimensions (security, auth, perf, a11y, visual, api) MUST remain null.
   *   Never default unmeasured dimensions to false or fabricate scores.
   * - Missing dimensions are tracked explicitly in `unknownFields`.
   * - If baseline commit or regression comparison is unavailable, evaluate to INCONCLUSIVE.
   */
  public static analyze(input: AnalyzeReleaseImpactInput): ReleaseImpact {
    const {
      deployment,
      release,
      changeComparison,
      regressionComparison,
      taskResults = [],
      environmentId = deployment?.environmentId || release?.environmentId || null,
    } = input;

    const evidence: DeploymentEvidenceReference[] = [];
    const unknownFields: string[] = [];
    const now = new Date().toISOString();

    // 1. Ingest existing evidence
    if (deployment?.evidence) {
      evidence.push(...deployment.evidence);
    }
    if (changeComparison?.evidence) {
      evidence.push(...changeComparison.evidence);
    }

    // 2. Change Blast Radius & Workflow Impact
    let changedAreaCount = 0;
    let affectedWorkflowCount = 0;
    let criticalWorkflowCount = 0;

    if (changeComparison && changeComparison.status === 'ANALYZED') {
      changedAreaCount =
        changeComparison.classifications.length > 0
          ? changeComparison.classifications.length
          : changeComparison.changedFilesCount > 0
          ? 1
          : 0;
      affectedWorkflowCount = changeComparison.affectedWorkflows.length;
      criticalWorkflowCount = changeComparison.criticalWorkflows.length;

      evidence.push({
        kind: 'CHANGE_ANALYSIS',
        source: 'DEPLOYMENT_CHANGE_ANALYZER',
        ref: `comparison:${changeComparison.currentCommitSha || 'unknown'}`,
        description: `Analyzed diff: ${changeComparison.changedFilesCount} files changed, ${affectedWorkflowCount} workflows affected (${criticalWorkflowCount} critical)`,
        confidence: changeComparison.confidence,
      });
    } else if (changeComparison?.status === 'IDENTICAL_COMMITS') {
      changedAreaCount = 0;
      affectedWorkflowCount = 0;
      criticalWorkflowCount = 0;
    } else {
      unknownFields.push('changedAreaCount', 'affectedWorkflowCount', 'criticalWorkflowCount');
    }

    // 3. Regression & Failure Metrics
    let newRegressionCount = 0;
    let recoveredCount = 0;
    let persistentFailureCount = 0;
    let unresolvedIssueCount = 0;

    if (regressionComparison) {
      newRegressionCount = regressionComparison.regressionsCount || 0;
      recoveredCount = regressionComparison.recoveriesCount || 0;
      persistentFailureCount = regressionComparison.persistingFailuresCount || 0;
      unresolvedIssueCount =
        (regressionComparison.newFailuresCount || 0) + (regressionComparison.persistingFailuresCount || 0);

      evidence.push({
        kind: 'REGRESSION_COMPARISON',
        source: 'REGRESSION_COMPARATOR',
        ref: `baseline:${regressionComparison.baselineRunId || 'none'}`,
        description: `Compared ${regressionComparison.totalCompared} targets: ${newRegressionCount} regressions, ${recoveredCount} recoveries, ${persistentFailureCount} persistent failures`,
        confidence: 0.9,
      });
    } else if (taskResults.length > 0) {
      // We have raw task results but no baseline comparator
      const failedTasks = taskResults.filter((t) => t.status === 'FAILED' || t.error);
      unresolvedIssueCount = failedTasks.length;
      unknownFields.push('newRegressionCount', 'recoveredCount', 'persistentFailureCount');
    } else {
      unknownFields.push(
        'newRegressionCount',
        'recoveredCount',
        'persistentFailureCount',
        'unresolvedIssueCount'
      );
    }

    // 4. Domain Impact Dimensions (Deterministic — null when not measured)
    let securityImpact: boolean | null = null;
    let authenticationImpact: boolean | null = null;
    let performanceImpact: boolean | null = null;
    let accessibilityImpact: boolean | null = null;
    let visualImpact: boolean | null = null;
    let apiImpact: boolean | null = null;

    // Security Impact
    const securityEvaluated =
      (changeComparison && changeComparison.status === 'ANALYZED') ||
      taskResults.some((t) => t.domain === 'SECURITY' || (t.observations && t.observations.some((o) => o.category === 'security')));

    if (securityEvaluated) {
      const securityChange = changeComparison?.classifications.includes('SECURITY') || false;
      const securityTaskFailure = taskResults.some(
        (t) =>
          (t.domain === 'SECURITY' && (t.status === 'FAILED' || t.error)) ||
          (t.observations && t.observations.some((o) => o.category === 'security' && (o.severity === 'critical' || o.severity === 'high')))
      );
      securityImpact = securityChange || securityTaskFailure;
    } else {
      unknownFields.push('securityImpact');
    }

    // Authentication Impact
    const authEvaluated =
      (changeComparison && changeComparison.status === 'ANALYZED') ||
      taskResults.some(
        (t) =>
          t.domain === 'AUTH' ||
          (t.target && t.target.identifier.toLowerCase().includes('auth')) ||
          (t.target && t.target.identifier.toLowerCase().includes('login'))
      );

    if (authEvaluated) {
      const authChange =
        changeComparison?.classifications.includes('AUTH') ||
        (changeComparison?.affectedRoutes && changeComparison.affectedRoutes.some((r) => r.includes('auth') || r.includes('login') || r.includes('signin'))) ||
        false;
      const authTaskFailure = taskResults.some(
        (t) =>
          (t.domain === 'AUTH' || t.target?.identifier.toLowerCase().includes('login')) &&
          (t.status === 'FAILED' || t.error)
      );
      authenticationImpact = authChange || authTaskFailure;
    } else {
      unknownFields.push('authenticationImpact');
    }

    // Performance Impact
    const perfTasks = taskResults.filter((t) => t.domain === 'PERFORMANCE');
    if (perfTasks.length > 0) {
      performanceImpact = perfTasks.some((t) => t.status === 'FAILED' || t.error);
    } else {
      unknownFields.push('performanceImpact');
    }

    // Accessibility Impact
    const a11yTasks = taskResults.filter((t) => t.domain === 'ACCESSIBILITY');
    if (a11yTasks.length > 0) {
      accessibilityImpact = a11yTasks.some((t) => t.status === 'FAILED' || t.error);
    } else {
      unknownFields.push('accessibilityImpact');
    }

    // Visual Impact
    const visualTasks = taskResults.filter((t) => t.domain === 'VISUAL');
    if (visualTasks.length > 0) {
      visualImpact = visualTasks.some((t) => t.status === 'FAILED' || t.error);
    } else {
      unknownFields.push('visualImpact');
    }

    // API Impact
    const apiEvaluated =
      (changeComparison && changeComparison.status === 'ANALYZED' && changeComparison.affectedApis.length > 0) ||
      taskResults.some((t) => t.domain === 'API');

    if (apiEvaluated) {
      const apiTasks = taskResults.filter((t) => t.domain === 'API');
      const apiFailures = apiTasks.some((t) => t.status === 'FAILED' || t.error);
      const apiChanged = (changeComparison?.affectedApis.length || 0) > 0;
      apiImpact = apiFailures || apiChanged;
    } else {
      unknownFields.push('apiImpact');
    }

    // 5. Status Classification
    let status: ReleaseImpactStatus = 'INCONCLUSIVE';

    const hasAnyChangeEvidence = changeComparison && changeComparison.status !== 'INCONCLUSIVE';
    const hasAnyTestEvidence = regressionComparison !== null && regressionComparison !== undefined || taskResults.length > 0;

    if (!hasAnyChangeEvidence && !hasAnyTestEvidence) {
      status = 'INCONCLUSIVE';
    } else if (
      (criticalWorkflowCount > 0 && newRegressionCount > 0) ||
      securityImpact === true ||
      (authenticationImpact === true && newRegressionCount > 0) ||
      newRegressionCount >= 3
    ) {
      status = 'HIGH_IMPACT';
    } else if (
      newRegressionCount > 0 ||
      criticalWorkflowCount > 0 ||
      affectedWorkflowCount >= 2 ||
      changedAreaCount >= 3 ||
      apiImpact === true ||
      unresolvedIssueCount > 0
    ) {
      status = 'MATERIAL_IMPACT';
    } else {
      status = 'LOW_IMPACT';
    }

    // 6. Confidence Scoring
    let confidence = 0.0;
    if (deployment?.deploymentId) confidence += 0.2;
    if (deployment?.commitSha) confidence += 0.2;
    if (changeComparison && changeComparison.status === 'ANALYZED') confidence += 0.25;
    if (regressionComparison) confidence += 0.25;
    if (taskResults.length > 0) confidence += 0.1;

    // Deduct confidence for missing/unknown fields
    if (status === 'INCONCLUSIVE') {
      confidence = Math.min(0.3, Math.round(confidence * 100) / 100);
    } else {
      confidence = Math.min(1.0, Math.round(confidence * 100) / 100);
    }

    return {
      releaseId: release?.id || deployment?.releaseId || null,
      deploymentId: deployment?.deploymentId || null,
      environmentId,
      changedAreaCount,
      affectedWorkflowCount,
      criticalWorkflowCount,
      newRegressionCount,
      recoveredCount,
      persistentFailureCount,
      unresolvedIssueCount,
      securityImpact,
      authenticationImpact,
      performanceImpact,
      accessibilityImpact,
      visualImpact,
      apiImpact,
      confidence,
      status,
      evidence,
      unknownFields,
      calculatedAt: now,
    };
  }
}
