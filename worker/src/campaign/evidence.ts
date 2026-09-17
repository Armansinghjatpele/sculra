// ==============================================================================
// Sculra Campaign Evidence Formatter (worker/src/campaign/evidence.ts)
// ==============================================================================

import { CampaignSummary, CampaignTaskResult, CampaignObservation } from './types';

export interface TestEvidencePayload {
  test_run_id?: string;
  project_id: string;
  type: string;
  title: string;
  url?: string;
  message?: string;
  metadata?: Record<string, any>;
  storage_path?: string;
}

export class CampaignEvidenceFormatter {
  /**
   * Formats the campaign summary into a structured test_evidence record.
   */
  static formatSummaryEvidence(
    projectId: string,
    summary: CampaignSummary,
    testRunId?: string
  ): TestEvidencePayload {
    return {
      test_run_id: testRunId,
      project_id: projectId,
      type: 'campaign_summary',
      title: `Autonomous QA Campaign: ${summary.objective.toUpperCase()} (${summary.status})`,
      message: summary.aiExecutiveSummary || `Executed ${summary.tasksExecuted} tasks across ${summary.domainsExecuted.length} domains.`,
      metadata: {
        campaignSummary: summary,
        status: summary.status,
        durationMs: summary.durationMs,
        tasksPassed: summary.tasksPassed,
        tasksFailed: summary.tasksFailed,
        regressionsCount: summary.regressionsCount,
        recoveriesCount: summary.recoveriesCount,
        coverage: summary.coverageSummary,
        releaseRecommendation: summary.releaseAssessment?.recommendation,
        releaseScore: summary.releaseAssessment?.overallScore,
      },
    };
  }

  /**
   * Formats a task result into a test_evidence record.
   */
  static formatTaskEvidence(
    projectId: string,
    result: CampaignTaskResult,
    testRunId?: string
  ): TestEvidencePayload {
    return {
      test_run_id: testRunId,
      project_id: projectId,
      type: 'campaign_task_result',
      title: `Campaign Task [${result.domain}]: ${result.target.identifier} (${result.status})`,
      url: result.target.url,
      message: result.error || `Task executed in ${result.durationMs}ms with ${result.findings.length} findings.`,
      metadata: {
        taskId: result.taskId,
        domain: result.domain,
        target: result.target,
        status: result.status,
        findingsCount: result.findings.length,
        observationsCount: result.observations.length,
        durationMs: result.durationMs,
        coverage: result.coverage,
      },
    };
  }

  /**
   * Formats a cross-domain correlation observation into a test_evidence record.
   */
  static formatCorrelationEvidence(
    projectId: string,
    correlation: {
      type: string;
      description: string;
      sourceDomain: string;
      correlatedDomain: string;
      targetIdentifier: string;
      severity: string;
    },
    testRunId?: string
  ): TestEvidencePayload {
    return {
      test_run_id: testRunId,
      project_id: projectId,
      type: 'campaign_correlation',
      title: `Cross-Domain Correlation [${correlation.sourceDomain} <-> ${correlation.correlatedDomain}]: ${correlation.type}`,
      message: correlation.description,
      metadata: {
        correlation,
        severity: correlation.severity,
        targetIdentifier: correlation.targetIdentifier,
      },
    };
  }
}
