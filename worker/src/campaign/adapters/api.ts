// ==============================================================================
// Sculra API QA Adapter (worker/src/campaign/adapters/api.ts)
// ==============================================================================

import { CampaignTask, CampaignTaskResult } from '../types';
import { ApiQAEngine, ApiEndpoint, ApiQAExecutionResult } from '../../api-qa';
import { ApplicationMap } from '../../types';

export class ApiAdapter {
  static async execute(
    task: CampaignTask,
    targetUrl: string,
    endpoints: ApiEndpoint[] = [],
    options: {
      applicationMap?: ApplicationMap;
      config?: any;
      allowLocalhost?: boolean;
    } = {}
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const apiEngine = new ApiQAEngine(options.config?.apiLimits);

      const executionResult: ApiQAExecutionResult = await apiEngine.execute({
        testRunId: task.id,
        projectId: task.target.identifier || 'unknown',
        targetUrl,
        applicationMap: options.applicationMap,
        projectConfig: options.config?.apiConfig,
        allowLocalhost: options.allowLocalhost,
      });

      const { testResults, coverage, bugObservations } = executionResult;
      const failures = testResults.filter((r) => r.status === 'FAILED');

      return {
        taskId: task.id,
        status: failures.length > 0 ? 'FAILED' : 'PASSED',
        target: task.target,
        domain: 'API',
        findings: failures,
        evidence: testResults.map((r) => ({
          type: r.status === 'FAILED' ? 'api_failure' : 'api_response',
          title: `API ${r.method} ${r.url}: ${r.status} (${r.durationMs}ms)`,
          url: r.url,
          metadata: { testResult: r },
        })),
        observations: bugObservations,
        durationMs: Date.now() - startTime,
        coverage: {
          endpointsChecked: testResults.length,
        },
        metadata: { apiResults: testResults, apiCoverage: coverage },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: 'API',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'API QA execution failed',
      };
    }
  }
}

