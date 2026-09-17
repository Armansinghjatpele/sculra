// ==============================================================================
// Sculra Discovery Adapter (worker/src/campaign/adapters/discovery.ts)
// ==============================================================================

import { Browser, BrowserContext } from 'playwright';
import { CampaignTask, CampaignTaskResult } from '../types';
import { ApplicationDiscovery, DiscoveryOptions } from '../../discovery';
import { ApplicationMap } from '../../types';

export class DiscoveryAdapter {
  static async execute(
    task: CampaignTask,
    browser: Browser,
    targetUrl: string,
    options: DiscoveryOptions = {}
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const discovery = new ApplicationDiscovery(browser, targetUrl, options);
      const appMap: ApplicationMap = await discovery.discover();

      return {
        taskId: task.id,
        status: 'PASSED',
        target: task.target,
        domain: 'DISCOVERY',
        findings: [],
        evidence: [
          {
            type: 'application_map',
            title: `Discovered ${appMap.totalPages} pages, ${appMap.totalForms} forms, ${appMap.totalButtons} buttons`,
            url: targetUrl,
            metadata: { applicationMap: appMap },
          },
        ],
        observations: [],
        durationMs: Date.now() - startTime,
        coverage: {
          pagesEvaluated: appMap.totalPages,
        },
        metadata: { applicationMap: appMap },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: 'DISCOVERY',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Discovery execution failed',
      };
    }
  }
}
