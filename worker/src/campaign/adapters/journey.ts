// ==============================================================================
// Sculra User Journey & Functional QA Adapter (worker/src/campaign/adapters/journey.ts)
// ==============================================================================

import { Browser } from 'playwright';
import { CampaignTask, CampaignTaskResult } from '../types';
import { DeterministicJourneyPlanner, JourneyExecutor, JourneyResult, Journey } from '../../journeys';
import { ApplicationMap, CapturedScreenshot, CapturedConsoleError, CapturedNetworkError } from '../../types';
import { ProductModel } from '../../product';
import { BugObservation } from '../../issues/types';
import { computeBugFingerprint } from '../../issues/fingerprint';

export class JourneyAdapter {
  static async execute(
    task: CampaignTask,
    browser: Browser,
    targetUrl: string,
    appMap?: ApplicationMap,
    productModel?: ProductModel,
    options: {
      screenshots?: CapturedScreenshot[];
      consoleErrors?: CapturedConsoleError[];
      networkErrors?: CapturedNetworkError[];
      allowLocalhost?: boolean;
    } = {}
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const planner = new DeterministicJourneyPlanner();
      const baseAppMap: ApplicationMap = appMap || {
        startUrl: targetUrl,
        totalPages: 1,
        totalLinks: 0,
        totalButtons: 0,
        totalForms: 0,
        totalInputs: 0,
        pages: [{
          url: targetUrl,
          title: 'Target',
          depth: 0,
          elementsCount: 0,
          elements: [],
          forms: [],
          links: [],
          consoleErrors: [],
          networkErrors: [],
          timestamp: new Date().toISOString(),
        }],
        discoveredAt: new Date().toISOString(),
      };

      let journeys: Journey[] = await planner.plan(baseAppMap);

      // If task specifies a specific workflow or journey, filter to it
      if (task.target.workflowId || task.target.workflowName) {
        const wfId = task.target.workflowId || task.target.workflowName;
        const matching = journeys.filter((j: Journey) => j.id.includes(wfId!) || j.name.toLowerCase().includes(wfId!.toLowerCase()));
        if (matching.length > 0) {
          journeys = matching;
        }
      }

      const executor = new JourneyExecutor(browser, { allowLocalhost: options.allowLocalhost });
      const results: JourneyResult[] = await executor.executeJourneys(journeys);

      const allObservations: BugObservation[] = [];
      let anyFailed = false;

      for (const r of results) {
        if (r.status === 'FAILED') anyFailed = true;
        if (r.observations) {
          for (const obs of r.observations) {
            const fingerprint = computeBugFingerprint({
              projectId: task.target.identifier || 'unknown',
              url: obs.pageUrl || targetUrl,
              bugType: 'UNKNOWN_FUNCTIONAL_FAILURE',
              selector: obs.selector,
            });
            allObservations.push({
              id: `journey-obs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              testRunId: task.id,
              projectId: task.target.identifier || 'unknown',
              type: 'UNKNOWN_FUNCTIONAL_FAILURE',
              severity: obs.severity === 'error' ? 'high' : obs.severity === 'warning' ? 'medium' : 'low',
              confidence: 'high',
              status: 'open',
              title: `Journey Failure: ${obs.message}`,
              summary: obs.message,
              description: obs.message,
              url: obs.pageUrl || targetUrl,
              selector: obs.selector,
              fingerprint,
              reproductionSteps: [],
              timestamp: obs.timestamp || new Date().toISOString(),
              metadata: obs.metadata,
            });
          }
        }
      }

      return {
        taskId: task.id,
        status: anyFailed ? 'FAILED' : 'PASSED',
        target: task.target,
        domain: task.domain,
        findings: results.filter((r) => r.status === 'FAILED'),
        evidence: results.map((r) => ({
          type: 'journey_result',
          title: `Journey "${r.name}": ${r.status} (${r.actionsPassed}/${r.actionsAttempted} actions)`,
          url: task.target.url || targetUrl,
          metadata: { journeyResult: r },
        })),
        observations: allObservations,
        durationMs: Date.now() - startTime,
        coverage: {
          actionsExecuted: results.reduce((acc, r) => acc + (r.actionsAttempted || 0), 0),
        },
        metadata: { journeyResults: results },
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
        error: err.message || 'Journey execution failed',
      };
    }
  }
}
