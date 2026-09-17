// ==============================================================================
// Sculra Visual & Responsive QA Adapter (worker/src/campaign/adapters/visual.ts)
// ==============================================================================

import { Browser } from 'playwright';
import { CampaignTask, CampaignTaskResult } from '../types';
import { ResponsiveVisualEngine, ResponsiveExecutionResult } from '../../visual';
import { ApplicationMap } from '../../types';

export class VisualAdapter {
  static async execute(
    task: CampaignTask,
    browser: Browser,
    targetUrl: string,
    appMap?: ApplicationMap
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const visualEngine = new ResponsiveVisualEngine(browser, {
        maxPages: 5,
      });

      const { result, bugObservations } = await visualEngine.execute(
        task.id,
        task.target.identifier || 'unknown',
        targetUrl,
        appMap?.pages || []
      );

      const hasVisualDefects = result.observations.some(
        (o) => o.severity === 'critical' || o.severity === 'high'
      );

      return {
        taskId: task.id,
        status: hasVisualDefects ? 'FAILED' : 'PASSED',
        target: task.target,
        domain: task.domain,
        findings: result.observations,
        evidence: [
          ...result.comparisons.map((c) => ({
            type: 'visual_comparison',
            title: `Visual Comparison: ${c.pageUrl} (${c.viewport.name})`,
            url: c.pageUrl,
            metadata: { comparison: c },
          })),
          ...result.observations.map((o) => ({
            type: 'responsive_observation',
            title: `[${o.severity.toUpperCase()}] ${o.title}`,
            url: o.pageUrl || targetUrl,
            metadata: { observation: o },
          })),
        ],
        observations: bugObservations,
        durationMs: Date.now() - startTime,
        coverage: {
          pagesEvaluated: result.snapshots.length,
        },
        metadata: { visualResult: result },
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
        error: err.message || 'Visual/Responsive QA execution failed',
      };
    }
  }
}

