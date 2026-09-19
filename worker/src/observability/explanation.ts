// ==============================================================================
// Sculra Universal Explainability Generator (worker/src/observability/explanation.ts)
// ==============================================================================

import { SkipReason } from './types';
import { ObservabilityRedactor } from './redaction';

export interface TaskExplainability {
  whyThisTarget: string;
  whyNow: string;
  whyThisAction: string;
  supportingEvidenceSummary: string;
  whatHappensNext: string;
  isAiGenerated: boolean;
}

export class ExplanationGenerator {
  /**
   * Generates deterministic human-readable skip explanations.
   */
  public static getSkipExplanation(reason: SkipReason, context?: { policyName?: string; target?: string }): string {
    switch (reason) {
      case 'AUTH_REQUIRED':
        return 'Target requires authenticated session or specific role credentials not configured in current campaign.';
      case 'POLICY_BLOCKED':
        return context?.policyName
          ? `Action blocked by policy rule "${context.policyName}".`
          : 'Action blocked by project safety policy or ceiling constraints.';
      case 'DESTRUCTIVE_ACTION':
        return 'Target involves state-destroying actions (e.g. account deletion or data purge) prohibited during automated QA.';
      case 'DUPLICATE_TARGET':
        return 'Target surface already verified with identical parameters in this execution cycle.';
      case 'BUDGET_EXHAUSTED':
        return 'Campaign reached task execution budget or time duration ceiling.';
      case 'LOW_PRIORITY':
        return 'Target prioritization score fell below execution threshold for this campaign objective.';
      case 'ALREADY_COVERED':
        return 'Workflow path was satisfied by a prerequisite journey or higher-priority verification.';
      case 'UNSUPPORTED_SURFACE':
        return 'Target involves protocols, formats, or platforms outside current engine support.';
      case 'INSUFFICIENT_CONTEXT':
        return 'Missing prerequisite state, route mapping, or parameter fixtures to execute target safely.';
      case 'SECURITY_RESTRICTION':
        return 'Target accesses isolated infrastructure, intranet endpoints, or restricted cloud metadata.';
      case 'CANCELLED':
        return 'Execution was explicitly cancelled by operator or overarching campaign termination.';
      default:
        return 'Target was skipped per autonomous prioritization rules.';
    }
  }

  /**
   * Generates factual "Why this target / Why now / What next" explanations.
   * Uses deterministic rules with safe fallback if AI synthesis fails.
   */
  public static explainTask(params: {
    targetIdentifier: string;
    targetType: string;
    criticalityScore?: number;
    hasRecentRegression?: boolean;
    historicalFailureCount?: number;
    priorityScore?: number;
    domain?: string;
    nextStepDescription?: string;
    aiNarrativeCandidate?: string;
  }): TaskExplainability {
    const {
      targetIdentifier,
      targetType,
      criticalityScore = 50,
      hasRecentRegression = false,
      historicalFailureCount = 0,
      priorityScore = 50,
      domain = 'FUNCTIONAL',
      nextStepDescription = 'Evaluate test assertions and update release scoring index.',
      aiNarrativeCandidate,
    } = params;

    // Check if AI narrative is valid and non-injected
    let isAi = false;
    let whyTarget = '';

    if (aiNarrativeCandidate && typeof aiNarrativeCandidate === 'string' && aiNarrativeCandidate.length > 10) {
      // Validate AI narrative does not contain prompt injection or hallucinated claims
      const sanitized = ObservabilityRedactor.maskSecrets(
        ObservabilityRedactor.sanitizePromptInjection(aiNarrativeCandidate)
      );
      if (!sanitized.includes('[NEUTRALIZED_')) {
        whyTarget = sanitized;
        isAi = true;
      }
    }

    // Deterministic fallback if AI narrative is absent or invalid
    if (!whyTarget) {
      const reasons: string[] = [];
      if (criticalityScore >= 80) {
        reasons.push(`Business criticality assessed as high (${criticalityScore}/100)`);
      }
      if (hasRecentRegression) {
        reasons.push('Recent regression detected in compatible baseline run');
      }
      if (historicalFailureCount > 0) {
        reasons.push(`Target has ${historicalFailureCount} recorded historical failure(s)`);
      }
      if (reasons.length === 0) {
        reasons.push(`Prioritized in strategy order (priority score: ${priorityScore}/100)`);
      }
      whyTarget = `${targetType} "${targetIdentifier}" selected: ${reasons.join('; ')}.`;
      isAi = false;
    }

    const whyNow = hasRecentRegression
      ? 'A compatible previous run recorded a regression that must be verified before release gate evaluation.'
      : historicalFailureCount > 0
      ? 'Historical QA memory flagged this surface as unstable or prone to intermittent regressions.'
      : 'Scheduled in normal sequence per autonomous campaign dependency graph.';

    const whyThisAction = `Execute targeted ${domain} verification to capture deterministic empirical evidence.`;

    const supportingEvidence = [
      hasRecentRegression ? 'Previous run regression record' : null,
      historicalFailureCount > 0 ? `${historicalFailureCount} historical failure signal(s)` : null,
      `Criticality index: ${criticalityScore}/100`,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      whyThisTarget: whyTarget,
      whyNow,
      whyThisAction,
      supportingEvidenceSummary: supportingEvidence || 'Autonomous strategy priority engine',
      whatHappensNext: nextStepDescription,
      isAiGenerated: isAi,
    };
  }
}
