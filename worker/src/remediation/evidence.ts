// ==============================================================================
// Sculra Remediation Evidence Formatter (worker/src/remediation/evidence.ts)
// ==============================================================================

import { RemediationAnalysis } from './types';
import { TestEvidencePayload } from '../campaign/evidence';

export class RemediationEvidenceFormatter {
  /**
   * Generates traceable test_evidence records for all facets of a remediation analysis.
   */
  static formatEvidence(
    analysis: RemediationAnalysis,
    testRunId?: string
  ): TestEvidencePayload[] {
    const payloads: TestEvidencePayload[] = [];
    const runId = testRunId || analysis.testRunId;

    // 1. Root Cause Analysis Evidence
    payloads.push({
      test_run_id: runId,
      project_id: analysis.projectId,
      type: 'root_cause_analysis',
      title: `AI Root Cause Diagnosis: ${analysis.diagnosis.summary} (${analysis.confidence})`,
      message: analysis.diagnosis.explanation,
      metadata: {
        diagnosis: analysis.diagnosis,
        status: analysis.status,
        confidence: analysis.confidence,
        fingerprint: analysis.fingerprint,
        issueId: analysis.issueId,
      },
    });

    // 2. Hypotheses
    for (const h of analysis.hypotheses) {
      payloads.push({
        test_run_id: runId,
        project_id: analysis.projectId,
        type: 'root_cause_hypothesis',
        title: `Hypothesis [${h.status}]: ${h.category}`,
        message: h.statement,
        metadata: {
          hypothesis: h,
        },
      });
    }

    // 3. Code Context
    payloads.push({
      test_run_id: runId,
      project_id: analysis.projectId,
      type: 'code_context',
      title: `Code Context Summary: ${analysis.codeContextSummary.filesRetrieved} files evaluated`,
      message: analysis.codeContextSummary.isPartial
        ? `Partial context: ${analysis.codeContextSummary.partialReason}`
        : 'Full code context retrieved within resource bounds',
      metadata: {
        summary: analysis.codeContextSummary,
      },
    });

    // 4. Change Context
    if (analysis.changeContextSummary.hasRelevantChanges) {
      payloads.push({
        test_run_id: runId,
        project_id: analysis.projectId,
        type: 'change_context',
        title: `Change Context: ${analysis.changeContextSummary.relationship}`,
        message: `Correlated with commit ${analysis.changeContextSummary.commitSha || 'HEAD'}`,
        metadata: {
          changeSummary: analysis.changeContextSummary,
        },
      });
    }

    // 5. Historical Context
    if (analysis.historicalContextSummary.isRecurring || analysis.historicalContextSummary.isRecentRegression) {
      payloads.push({
        test_run_id: runId,
        project_id: analysis.projectId,
        type: 'historical_context',
        title: `Historical QA Context: ${analysis.historicalContextSummary.totalOccurrences} occurrences`,
        message: analysis.historicalContextSummary.isRecurring
          ? 'Recurring defect confirmed by historical runs'
          : 'Recent regression detected',
        metadata: {
          historySummary: analysis.historicalContextSummary,
        },
      });
    }

    // 6. Fix Plan
    payloads.push({
      test_run_id: runId,
      project_id: analysis.projectId,
      type: 'fix_plan',
      title: `Remediation Plan: ${analysis.fixPlan.summary}`,
      message: `${analysis.fixPlan.steps.length} recommended remediation steps. Risk: ${analysis.fixPlan.riskAssessment}`,
      metadata: {
        fixPlan: analysis.fixPlan,
      },
    });

    // 7. Verification Plan
    payloads.push({
      test_run_id: runId,
      project_id: analysis.projectId,
      type: 'verification_plan',
      title: `Verification Plan (${analysis.verificationPlan.suggestedDomains.join(', ')})`,
      message: `${analysis.verificationPlan.regressionTests.length} regression test recommendations`,
      metadata: {
        verificationPlan: analysis.verificationPlan,
      },
    });

    return payloads;
  }
}
