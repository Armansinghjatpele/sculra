// ==============================================================================
// Sculra Performance & Reliability Adapter (worker/src/campaign/adapters/performance.ts)
// ==============================================================================

import { Page, BrowserContext } from 'playwright';
import { CampaignTask, CampaignTaskResult } from '../types';
import { PerformanceScanner, PerformanceScanResult } from '../../performance';
import { ApplicationMap } from '../../types';
import { ProductModel } from '../../product';
import { ApiEndpoint } from '../../api-qa';

export class PerformanceAdapter {
  static async execute(
    task: CampaignTask,
    page: Page,
    context: BrowserContext,
    targetUrl: string,
    options: {
      projectId?: string;
      appMap?: ApplicationMap;
      productModel?: ProductModel;
      apiEndpoints?: ApiEndpoint[];
      policy?: any;
      allowLocalhost?: boolean;
    } = {}
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const scanner = new PerformanceScanner(options.policy || {});
      const scanResult: PerformanceScanResult = await scanner.scan({
        testRunId: task.id,
        projectId: options.projectId || task.target.identifier || 'unknown',
        targetUrl,
        page,
        browserContext: context,
        applicationMap: options.appMap,
        productModel: options.productModel,
        apiEndpoints: options.apiEndpoints || [],
        allowLocalhost: options.allowLocalhost,
      });

      const hasCriticalRegressions = scanResult.findings.some(
        (f) => f.severity === 'critical' || f.type === 'PERFORMANCE_REGRESSION'
      );
      const score = scanResult.coverage?.performanceScore;

      return {
        taskId: task.id,
        status: hasCriticalRegressions ? 'FAILED' : 'PASSED',
        target: task.target,
        domain: task.domain,
        findings: scanResult.findings,
        evidence: [
          {
            type: 'performance_summary',
            title: `Performance Scan: ${scanResult.findings.length} findings${score !== undefined ? ` (Score: ${score}/100)` : ''}`,
            url: targetUrl,
            metadata: { coverage: scanResult.coverage, score },
          },
          ...scanResult.findings.map((f) => ({
            type: 'performance_finding',
            title: `[${f.severity.toUpperCase()}] ${f.title}`,
            url: f.targetUrl || targetUrl,
            metadata: { finding: f },
          })),
        ],
        observations: scanResult.bugObservations || [],
        durationMs: Date.now() - startTime,
        coverage: {
          pagesEvaluated: scanResult.coverage?.pagesMeasured || 0,
          endpointsChecked: scanResult.coverage?.apisMeasured || 0,
        },
        metadata: { scanResult },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: task.domain,
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Performance QA execution failed',
      };
    }
  }
}

