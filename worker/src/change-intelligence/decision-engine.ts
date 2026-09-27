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
} from './types';

export interface EvaluateDecisionsInput {
  snapshot: ChangeSnapshot;
  candidates: RegressionCandidate[];
  activeDomains?: Set<string>;
  maxTasksBudget?: number;
}

export class ChangeDecisionEngine {
  /**
   * Deterministically evaluates every candidate target and produces an auditable
   * TEST, SKIP, DEFER, or REVIEW decision with structured explanations and evidence references.
   * Enforces Critical Workflow Override (critical workflows CANNOT be skipped).
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
    } = input;

    const decisions: ChangeDecision[] = [];
    let scheduledTestCount = 0;

    for (const candidate of candidates) {
      const isCritical = candidate.businessCriticality === 'CRITICAL';
      const isDomainActive = activeDomains.has(candidate.domain);
      const evidence = [
        `commit:${snapshot.commitSha.slice(0, 7)}`,
        `source:${candidate.source}`,
        `domain:${candidate.domain}`,
        `criticality:${candidate.businessCriticality}`,
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
          reason: snapshot.isDocumentationOnly
            ? `CRITICAL_WORKFLOW_OVERRIDE: Business-critical workflow "${candidate.targetIdentifier}" verified despite documentation-only commit`
            : `CRITICAL_WORKFLOW: High-priority execution for critical workflow "${candidate.targetIdentifier}"`,
          criticalOverride: true,
          confidence: 'HIGH',
          evidence: [...evidence, 'policy:critical_override'],
          createdAt: new Date().toISOString(),
          metadata: {
            source: candidate.source,
            criticality: candidate.businessCriticality,
          },
        });
        scheduledTestCount++;
        continue;
      }

      // 2. Safe Skip: Documentation-Only change
      if (snapshot.isDocumentationOnly) {
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
          metadata: {
            source: candidate.source,
            files: snapshot.files.map((f) => f.path),
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
        });
        continue;
      }

      // 4. Test-Only commit optimization: If change is purely test files and candidate is UI/API
      if (
        snapshot.isTestOnly &&
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
        });
        continue;
      }

      // 6. Default: TEST candidate
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
