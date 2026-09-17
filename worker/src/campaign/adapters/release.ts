// ==============================================================================
// Sculra Deterministic Release Readiness Adapter (worker/src/campaign/adapters/release.ts)
// ==============================================================================

import { CampaignTask, CampaignTaskResult } from '../types';
import { DeterministicReleaseScorer, ReleaseReportGenerator, ReleaseAssessment } from '../../release';
import { TestExecutionResult } from '../../types';

export class ReleaseAdapter {
  static async execute(
    task: CampaignTask,
    targetUrl: string,
    executionResult: Partial<TestExecutionResult>,
    options: {
      projectId?: string;
      productModel?: any;
    } = {}
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const assessment: ReleaseAssessment = DeterministicReleaseScorer.calculateAssessment({
        testRunId: task.id,
        projectId: options.projectId || task.target.identifier || 'unknown',
        targetUrl,
        applicationMap: executionResult.applicationMap,
        journeyResults: executionResult.journeyResults,
        bugObservations: executionResult.bugObservations,
        visualResult: executionResult.visualResult,
        consoleErrors: executionResult.consoleErrors,
        networkErrors: executionResult.networkErrors,
        productModel: options.productModel || executionResult.productModel,
        authorizationResults: executionResult.authorizationResults,
        apiTestResults: executionResult.apiTestResults,
        apiCoverage: executionResult.apiCoverage,
        securityResult: executionResult.securityResult,
        securityFindings: executionResult.securityFindings,
        securityCoverage: executionResult.securityCoverage,
        performanceResult: executionResult.performanceResult,
        performanceFindings: executionResult.performanceFindings,
        accessibilityResult: executionResult.accessibilityResult,
        accessibilityFindings: executionResult.accessibilityFindings,
        accessibilityCoverage: executionResult.accessibilityCoverage,
      });

      const reportMarkdown = ReleaseReportGenerator.generateMarkdownReport(assessment, {
        targetUrl,
        projectName: options.projectId,
        durationMs: Date.now() - startTime,
      });

      const isBlocked = assessment.recommendation === 'DO_NOT_RELEASE';

      return {
        taskId: task.id,
        status: isBlocked ? 'FAILED' : 'PASSED',
        target: task.target,
        domain: 'RELEASE',
        findings: assessment.blockers || [],
        evidence: [
          {
            type: 'release_report',
            title: `Release Readiness Assessment: ${assessment.overallScore}/100 (${assessment.recommendation})`,
            url: targetUrl,
            metadata: { releaseAssessment: assessment, releaseReport: reportMarkdown },
          },
        ],
        observations: [],
        durationMs: Date.now() - startTime,
        coverage: {
          rulesAudited: 10,
        },
        metadata: { releaseAssessment: assessment, releaseReportMarkdown: reportMarkdown },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: 'RELEASE',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Release Readiness scoring failed',
      };
    }
  }
}

