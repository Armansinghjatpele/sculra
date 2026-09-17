// ==============================================================================
// Sculra Historical QA Memory Adapter (worker/src/campaign/adapters/historical.ts)
// ==============================================================================

import { CampaignTask, CampaignTaskResult } from '../types';
import {
  HistoricalAnalyzer,
  RunNormalizer,
  HistoricalEvidenceFormatter,
  RunComparison,
  FormattedEvidenceItem,
  HistoricalRun,
} from '../../history';
import { TestExecutionResult } from '../../types';

export class HistoricalAdapter {
  static async execute(
    task: CampaignTask,
    targetUrl: string,
    currentRunResult: Partial<TestExecutionResult>,
    pastRuns: any[] = [],
    policy?: any
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      // Standardize current run
      const normalizedCurrent: HistoricalRun = RunNormalizer.normalizeRun({
        id: task.id,
        testRunId: task.id,
        projectId: task.target.identifier || 'unknown',
        targetUrl,
        url: targetUrl,
        status: currentRunResult.status || 'passed',
        durationMs: currentRunResult.durationMs,
        consoleErrors: currentRunResult.consoleErrors,
        networkErrors: currentRunResult.networkErrors,
        findings: currentRunResult.bugObservations || [],
      });

      // Standardize past runs
      const normalizedPast: HistoricalRun[] = pastRuns.map((r) => RunNormalizer.normalizeRun(r));

      const comparison: RunComparison = await HistoricalAnalyzer.analyze({
        currentRun: normalizedCurrent,
        historicalRuns: normalizedPast,
        policyConfig: policy,
      });

      const evidenceItems: FormattedEvidenceItem[] = HistoricalEvidenceFormatter.formatComparisonEvidence(
        comparison,
        task.id,
        task.target.identifier || 'unknown',
        targetUrl
      );

      const hasRegressions = (comparison.regressions?.length || 0) > 0;

      return {
        taskId: task.id,
        status: hasRegressions ? 'FAILED' : 'PASSED',
        target: task.target,
        domain: 'HISTORICAL',
        findings: comparison.regressions || [],
        evidence: evidenceItems.map((e: FormattedEvidenceItem) => ({
          type: e.type,
          title: e.title,
          url: e.url,
          metadata: e.metadata,
        })),
        observations: [],
        durationMs: Date.now() - startTime,
        coverage: {
          rulesAudited: normalizedPast.length,
        },
        metadata: { historicalComparison: comparison },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: 'HISTORICAL',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Historical QA analysis failed',
      };
    }
  }
}

