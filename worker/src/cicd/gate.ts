// ==============================================================================
// Sculra Deterministic CI Gate Engine (worker/src/cicd/gate.ts)
// ==============================================================================

import {
  CIGateDecision,
  CIGateEvaluationOptions,
  CIGatePolicy,
  CIGateReasonCode,
  CIGateVerdict,
  CIGateBlocker,
} from './types';
import { CampaignSummary } from '../campaign/types';

export class CIGateEngine {
  /**
   * Deterministically evaluates a CampaignSummary against a project's CIGatePolicy.
   * Invariant: Never invents fake scores or metrics; missing data produces null or INSUFFICIENT_EVIDENCE.
   */
  public static evaluateGate(
    summary: CampaignSummary | null | undefined,
    policy: CIGatePolicy = 'BLOCK_ON_CRITICAL_ISSUE',
    options: CIGateEvaluationOptions = {}
  ): CIGateDecision {
    const evaluatedAt = new Date().toISOString();

    // 1. Guard against empty summary or missing execution
    if (!summary) {
      return {
        verdict: 'ERROR',
        gatePolicy: policy,
        passed: false,
        overallScore: null,
        reasonCodes: ['EXECUTION_ERROR'],
        summaryMessage: 'Execution failed or produced no summary evidence.',
        criticalFindingsCount: 0,
        highFindingsCount: 0,
        regressionCount: 0,
        recoveriesCount: 0,
        evidenceStatus: 'NO_DATA',
        blockers: [],
        regressions: [],
        evaluatedAt,
      };
    }

    // 2. Cancellation Check
    if (summary.status === 'CANCELLED' || summary.terminationReason === 'CANCELLED_BY_USER') {
      return {
        verdict: 'CANCELLED',
        gatePolicy: policy,
        passed: false,
        releaseVerdict: 'CANCELLED',
        overallScore: summary.releaseAssessment?.overallScore ?? null,
        reasonCodes: ['EXECUTION_CANCELLED'],
        summaryMessage: 'QA campaign execution was cancelled before gate evaluation completed.',
        criticalFindingsCount: 0,
        highFindingsCount: 0,
        regressionCount: summary.regressionsCount || 0,
        recoveriesCount: summary.recoveriesCount || 0,
        evidenceStatus: 'INSUFFICIENT',
        blockers: [],
        regressions: [],
        evaluatedAt,
      };
    }

    // 3. Extract Real Metrics (Zero Fabrication)
    const releaseAssessment = summary.releaseAssessment;
    const recommendation = releaseAssessment?.recommendation;
    const confidence = releaseAssessment?.confidenceLevel;
    const overallScore = typeof releaseAssessment?.overallScore === 'number'
      ? releaseAssessment.overallScore
      : null;

    const rawBlockers: CIGateBlocker[] = (releaseAssessment?.blockers || []).map((b) => ({
      id: b.id,
      title: b.title,
      severity: b.severity,
      reason: b.reason,
    }));

    const criticalFindingsCount = rawBlockers.filter((b) => b.severity === 'critical').length;
    const highFindingsCount = rawBlockers.filter((b) => b.severity === 'high').length;
    const regressionCount = summary.regressionsCount || 0;
    const recoveriesCount = summary.recoveriesCount || 0;

    const regressions: string[] = [];
    if (regressionCount > 0) {
      regressions.push(`${regressionCount} regression(s) detected across tested user journeys or pages`);
    }

    // 4. Evidence Sufficiency Evaluation
    const isEvidenceInsufficient =
      confidence === 'INSUFFICIENT' ||
      recommendation === 'INSUFFICIENT_EVIDENCE' ||
      (summary.tasksExecuted === 0 && summary.tasksPlanned > 0);

    if (isEvidenceInsufficient) {
      return {
        verdict: 'INSUFFICIENT_EVIDENCE',
        gatePolicy: policy,
        passed: false,
        releaseVerdict: recommendation || 'INSUFFICIENT_EVIDENCE',
        overallScore,
        reasonCodes: ['INSUFFICIENT_EVIDENCE_COVERAGE'],
        summaryMessage: 'Insufficient test coverage or evidence confidence to satisfy CI quality gate.',
        criticalFindingsCount,
        highFindingsCount,
        regressionCount,
        recoveriesCount,
        evidenceStatus: 'INSUFFICIENT',
        blockers: rawBlockers,
        regressions,
        evaluatedAt,
      };
    }

    // 5. Policy Decision Rules
    const reasonCodes: CIGateReasonCode[] = [];
    let isFailing = false;

    switch (policy) {
      case 'BLOCK_ON_CRITICAL_ISSUE': {
        if (criticalFindingsCount > 0) {
          isFailing = true;
          const hasSecurity = rawBlockers.some((b) => b.title.toLowerCase().includes('security'));
          reasonCodes.push(hasSecurity ? 'CRITICAL_SECURITY_ISSUE' : 'CRITICAL_BLOCKER_DETECTED');
        }
        if (recommendation === 'DO_NOT_RELEASE') {
          isFailing = true;
          reasonCodes.push('RECOMMENDATION_DO_NOT_RELEASE');
        }
        break;
      }

      case 'STRICT': {
        if (criticalFindingsCount > 0) {
          isFailing = true;
          reasonCodes.push('CRITICAL_BLOCKER_DETECTED');
        }
        if (highFindingsCount > 0) {
          isFailing = true;
          reasonCodes.push('HIGH_SEVERITY_FINDING');
        }
        if (regressionCount > 0) {
          isFailing = true;
          reasonCodes.push('NEW_REGRESSION_DETECTED');
        }
        if (recommendation === 'DO_NOT_RELEASE') {
          isFailing = true;
          reasonCodes.push('RECOMMENDATION_DO_NOT_RELEASE');
        } else if (recommendation === 'RELEASE_WITH_CAUTION' && !options.allowCaution) {
          isFailing = true;
          reasonCodes.push('RECOMMENDATION_CAUTION_EXCEEDED');
        }
        const minScore = options.minScoreThreshold ?? 80;
        if (overallScore !== null && overallScore < minScore) {
          isFailing = true;
          reasonCodes.push('SCORE_BELOW_THRESHOLD');
        }
        break;
      }

      case 'PERMISSIVE': {
        const maxCrit = options.maxCriticalIssues ?? 3;
        if (criticalFindingsCount >= maxCrit) {
          isFailing = true;
          reasonCodes.push('CRITICAL_BLOCKER_DETECTED');
        }
        if (recommendation === 'DO_NOT_RELEASE' && criticalFindingsCount > 0) {
          isFailing = true;
          reasonCodes.push('RECOMMENDATION_DO_NOT_RELEASE');
        }
        break;
      }

      case 'BLOCK_ON_REGRESSION': {
        if (regressionCount > 0) {
          isFailing = true;
          reasonCodes.push('NEW_REGRESSION_DETECTED');
        }
        if (criticalFindingsCount > 0) {
          isFailing = true;
          reasonCodes.push('CRITICAL_BLOCKER_DETECTED');
        }
        if (recommendation === 'DO_NOT_RELEASE') {
          isFailing = true;
          reasonCodes.push('RECOMMENDATION_DO_NOT_RELEASE');
        }
        break;
      }
    }

    if (!isFailing) {
      reasonCodes.push('PASS_CRITERIA_MET');
    }

    const verdict: CIGateVerdict = isFailing ? 'FAIL' : 'PASS';
    const passed = verdict === 'PASS';

    // Formulate descriptive summary message
    let summaryMessage = '';
    if (passed) {
      summaryMessage = `CI Gate passed under policy '${policy}'. All release criteria satisfied.`;
    } else {
      const details: string[] = [];
      if (criticalFindingsCount > 0) details.push(`${criticalFindingsCount} critical blocker(s)`);
      if (highFindingsCount > 0) details.push(`${highFindingsCount} high-severity issue(s)`);
      if (regressionCount > 0) details.push(`${regressionCount} regression(s)`);
      if (recommendation === 'DO_NOT_RELEASE') details.push('Release recommendation: DO NOT RELEASE');
      summaryMessage = `CI Gate failed under policy '${policy}': ${details.join(', ') || reasonCodes.join(', ')}.`;
    }

    return {
      verdict,
      gatePolicy: policy,
      passed,
      releaseVerdict: recommendation,
      overallScore,
      reasonCodes,
      summaryMessage,
      criticalFindingsCount,
      highFindingsCount,
      regressionCount,
      recoveriesCount,
      evidenceStatus: 'SUFFICIENT',
      blockers: rawBlockers,
      regressions,
      evaluatedAt,
    };
  }
}
