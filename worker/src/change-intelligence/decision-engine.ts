// ==============================================================================
// Sculra Change Decision Engine (worker/src/change-intelligence/decision-engine.ts)
// Answers: "What should Sculra test?" & "What can safely be skipped?"
// ==============================================================================

import {
  ChangeDecision,
  RegressionCandidate,
  ChangeSnapshot,
  SkipReasonCode,
  ChangeDecisionType,
  EnvironmentSnapshot,
} from './types';
import { HistoricalRun } from '../history/types';

export interface EvaluateDecisionsInput {
  snapshot: ChangeSnapshot;
  candidates: RegressionCandidate[];
  activeDomains?: Set<string>;
  maxTasksBudget?: number;
  environment?: EnvironmentSnapshot;
  branch?: string;
  previousRun?: HistoricalRun;
  isDocsOnly?: boolean;
  hasHistoricalRegressions?: boolean;
  deploymentId?: string | null;
  deploymentStatus?: string | null;
}

export class ChangeDecisionEngine {
  /**
   * Deterministically evaluates every candidate target and produces an auditable
   * TEST, SKIP, DEFER, or REVIEW decision with structured explanations and evidence references.
   * Enforces Critical Workflow Override (critical workflows CANNOT be skipped).
   * Supports evidence-backed safe test reuse (REUSE vs RERUN).
   */
  static evaluate(input: EvaluateDecisionsInput): ChangeDecision[] {
    const {
      snapshot,
      candidates,
      activeDomains = new Set([
        'DISCOVERY',
        'PRODUCT',
        'FUNCTIONAL',
        'JOURNEY',
        'API',
        'SECURITY',
        'ACCESSIBILITY',
        'VISUAL',
        'PERFORMANCE',
        'HISTORICAL',
        'RELEASE',
      ]),
      maxTasksBudget = 100,
      environment,
      branch = snapshot?.headBranch || snapshot?.branch || input.branch,
      previousRun,
      deploymentId: inputDeploymentId,
      deploymentStatus: inputDeploymentStatus,
    } = input;

    const resolvedDeploymentId = inputDeploymentId || environment?.deploymentId || null;
    const resolvedDeploymentStatus = inputDeploymentStatus || null;

    const decisions: ChangeDecision[] = [];
    let scheduledTestCount = 0;

    for (const candidate of candidates) {
      const isCritical = candidate.businessCriticality === 'CRITICAL';
      const isDomainActive = activeDomains.has(candidate.domain);
      const envName = environment?.environmentName || null;
      const currentBranch = candidate.branch || branch || null;
      const depId = candidate.deploymentId || resolvedDeploymentId;
      const depStatus = resolvedDeploymentStatus;

      const evidence = [
        ...(snapshot?.commitSha ? [`commit:${snapshot.commitSha.slice(0, 7)}`] : []),
        `source:${candidate.source}`,
        `domain:${candidate.domain}`,
        `criticality:${candidate.businessCriticality}`,
        ...(envName ? [`env:${envName}`] : []),
        ...(currentBranch ? [`branch:${currentBranch}`] : []),
        ...(depId ? [`deployment:${depId}`] : []),
      ];

      // 1. Critical Workflow Override: Critical workflows are NEVER skipped
      if (isCritical) {
        decisions.push({
          id: `dec-${candidate.id}-${Date.now().toString(36)}`,
          candidateId: candidate.id,
          targetIdentifier: candidate.targetIdentifier,
          targetType: candidate.targetType,
          domain: candidate.domain,
          decision: 'TEST',
          priority: candidate.priority,
          reason: (snapshot?.isDocumentationOnly || input.isDocsOnly)
            ? `CRITICAL_WORKFLOW_OVERRIDE: Business-critical workflow "${candidate.targetIdentifier}" verified despite documentation-only commit`
            : `CRITICAL_WORKFLOW: High-priority execution for critical workflow "${candidate.targetIdentifier}"`,
          criticalOverride: true,
          confidence: 'HIGH',
          evidence: [...evidence, 'policy:critical_override'],
          createdAt: new Date().toISOString(),
          environmentId: candidate.environmentId || environment?.environmentId,
          environmentName: environment?.environmentName,
          branch: currentBranch,
          deploymentId: depId,
          deploymentStatus: depStatus,
          reuseClassification: 'RERUN',
          reuseJustification: 'Critical workflows require fresh execution to guarantee zero release risk',
          metadata: {
            source: candidate.source,
            criticality: candidate.businessCriticality,
          },
        });
        scheduledTestCount++;
        continue;
      }

      // 1.5 Deployment Lifecycle Gate: Defer non-critical targets if deployment is still in-flight
      if (depStatus === 'DEPLOYING') {
        decisions.push({
          id: `dec-${candidate.id}-${Date.now().toString(36)}`,
          candidateId: candidate.id,
          targetIdentifier: candidate.targetIdentifier,
          targetType: candidate.targetType,
          domain: candidate.domain,
          decision: 'DEFER',
          priority: candidate.priority,
          reason: `Target deferred: Deployment ${depId || 'target'} is currently in DEPLOYING state. Testing deferred until deployment reaches READY status.`,
          skipReason: 'DEPLOYMENT_IN_PROGRESS',
          criticalOverride: false,
          confidence: 'HIGH',
          evidence: [...evidence, 'deployment:deploying_in_progress'],
          createdAt: new Date().toISOString(),
          environmentId: candidate.environmentId || environment?.environmentId,
          environmentName: environment?.environmentName,
          branch: currentBranch,
          deploymentId: depId,
          deploymentStatus: depStatus,
          reuseClassification: 'DEFER',
          reuseJustification: 'Deferred until deployment rollout is complete',
        });
        continue;
      }

      // 2. Safe Skip: Documentation-Only change
      if (snapshot?.isDocumentationOnly || input.isDocsOnly) {
        decisions.push({
          id: `dec-${candidate.id}-${Date.now().toString(36)}`,
          candidateId: candidate.id,
          targetIdentifier: candidate.targetIdentifier,
          targetType: candidate.targetType,
          domain: candidate.domain,
          decision: 'SKIP',
          priority: candidate.priority,
          reason: `Safe test reduction: Commit only contains documentation files; runtime behavior unaffected for "${candidate.targetIdentifier}"`,
          skipReason: 'DOCS_ONLY',
          criticalOverride: false,
          confidence: 'HIGH',
          evidence: [...evidence, 'reason:docs_only'],
          createdAt: new Date().toISOString(),
          environmentId: candidate.environmentId || environment?.environmentId,
          environmentName: environment?.environmentName,
          branch: currentBranch,
          deploymentId: depId,
          deploymentStatus: depStatus,
          metadata: {
            source: candidate.source,
            files: snapshot?.files ? snapshot.files.map((f) => f.path) : [],
          },
        });
        continue;
      }

      // 3. Skip if domain is not active in current campaign
      if (!isDomainActive) {
        decisions.push({
          id: `dec-${candidate.id}-${Date.now().toString(36)}`,
          candidateId: candidate.id,
          targetIdentifier: candidate.targetIdentifier,
          targetType: candidate.targetType,
          domain: candidate.domain,
          decision: 'SKIP',
          priority: candidate.priority,
          reason: `Domain "${candidate.domain}" is not active in this campaign's domain configuration`,
          skipReason: 'UNSUPPORTED_SURFACE',
          criticalOverride: false,
          confidence: 'HIGH',
          evidence: [...evidence, 'reason:inactive_domain'],
          createdAt: new Date().toISOString(),
          environmentId: candidate.environmentId || environment?.environmentId,
          environmentName: environment?.environmentName,
          branch: currentBranch,
          deploymentId: depId,
          deploymentStatus: depStatus,
        });
        continue;
      }

      // 4. Test-Only commit optimization: If change is purely test files and candidate is UI/API
      if (
        snapshot?.isTestOnly &&
        candidate.source !== 'HISTORICAL_FAILURE' &&
        candidate.source !== 'RECOVERED_REGRESSION'
      ) {
        decisions.push({
          id: `dec-${candidate.id}-${Date.now().toString(36)}`,
          candidateId: candidate.id,
          targetIdentifier: candidate.targetIdentifier,
          targetType: candidate.targetType,
          domain: candidate.domain,
          decision: 'SKIP',
          priority: candidate.priority,
          reason: `Safe test reduction: Changes only affect test files/suites; production code untouched for "${candidate.targetIdentifier}"`,
          skipReason: 'UNTOUCHED',
          criticalOverride: false,
          confidence: 'HIGH',
          evidence: [...evidence, 'reason:test_only_change'],
          createdAt: new Date().toISOString(),
          environmentId: candidate.environmentId || environment?.environmentId,
          environmentName: environment?.environmentName,
          branch: currentBranch,
          deploymentId: depId,
          deploymentStatus: depStatus,
        });
        continue;
      }

      // 5. Budget Management: Defer lower-priority targets if budget exceeded
      if (scheduledTestCount >= maxTasksBudget && candidate.priority < 75) {
        decisions.push({
          id: `dec-${candidate.id}-${Date.now().toString(36)}`,
          candidateId: candidate.id,
          targetIdentifier: candidate.targetIdentifier,
          targetType: candidate.targetType,
          domain: candidate.domain,
          decision: 'DEFER',
          priority: candidate.priority,
          reason: `Target deferred to prevent budget exhaustion (${scheduledTestCount}/${maxTasksBudget} tasks scheduled); prioritized by rank`,
          skipReason: 'DEFERRED_CAPACITY',
          criticalOverride: false,
          confidence: 'MEDIUM',
          evidence: [...evidence, 'budget:capacity_reached'],
          createdAt: new Date().toISOString(),
          environmentId: candidate.environmentId || environment?.environmentId,
          environmentName: environment?.environmentName,
          branch: currentBranch,
          deploymentId: depId,
          deploymentStatus: depStatus,
          reuseClassification: 'DEFER',
          reuseJustification: 'Deferred due to capacity budget limits',
        });
        continue;
      }

      // 6. Safe Test Reuse Evaluation
      let reuseClassification: 'REUSE' | 'RERUN' | 'DEFER' | 'REVIEW' = 'RERUN';
      let reuseJustification = 'Fresh execution required: target affected by change or lacks previous passing baseline';
      let reusedEvidenceRef: string | undefined = undefined;

      if (previousRun) {
        const prevTargets = previousRun.targets || (previousRun as any).testResults || (previousRun as any).taskResults;
        const matchingTarget = prevTargets?.find(
          (t: any) => (t.targetIdentifier || t.target?.identifier || t.id) === candidate.targetIdentifier || (t.url && candidate.url && t.url === candidate.url)
        );
        const matchingFinding = previousRun.findings?.find(
          (f: any) => f.targetUrl && candidate.url && f.targetUrl === candidate.url
        );

        const isDirectlyMutated =
          candidate.source === 'DIRECT_WORKFLOW' ||
          candidate.source === 'AFFECTED_API' ||
          candidate.source === 'AFFECTED_ROUTE_OR_COMPONENT';
        const targetPassedInPrevious = matchingTarget ? matchingTarget.status === 'passed' : (!matchingFinding && previousRun.status === 'passed');

        if (targetPassedInPrevious && !isDirectlyMutated) {
          const runIdentifier = previousRun.testRunId || (previousRun as any).id || 'baseline';
          reuseClassification = 'REUSE';
          reuseJustification = `Safe test reuse: Target passed in previous run (${runIdentifier})${previousRun.environment || envName ? ` for environment ${previousRun.environment || envName}` : ''} with no code mutations in this changeset`;
          reusedEvidenceRef = `test_run:${runIdentifier}:target:${candidate.targetIdentifier}`;
        }
      }

      // 7. Default: TEST candidate
      decisions.push({
        id: `dec-${candidate.id}-${Date.now().toString(36)}`,
        candidateId: candidate.id,
        targetIdentifier: candidate.targetIdentifier,
        targetType: candidate.targetType,
        domain: candidate.domain,
        decision: 'TEST',
        priority: candidate.priority,
        reason: candidate.reason,
        criticalOverride: false,
        confidence: 'HIGH',
        evidence: [...evidence, 'action:execute_test'],
        createdAt: new Date().toISOString(),
        environmentId: candidate.environmentId || environment?.environmentId,
        environmentName: environment?.environmentName,
        branch: currentBranch,
        deploymentId: depId,
        deploymentStatus: depStatus,
        reuseClassification,
        reuseJustification,
        reusedEvidenceRef,
        metadata: {
          source: candidate.source,
          hasVisualBaseline: candidate.hasVisualBaseline,
        },
      });
      scheduledTestCount++;
    }

    return decisions;
  }
}
