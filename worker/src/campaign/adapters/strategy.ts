// ==============================================================================
// Sculra Autonomous Strategy Adapter (worker/src/campaign/adapters/strategy.ts)
// ==============================================================================

import { CampaignTask, CampaignTaskResult } from '../types';
import { AutonomousStrategyEngine } from '../../strategy';
import { ApplicationMap } from '../../types';
import { ProductModel } from '../../product';

export class StrategyAdapter {
  static async execute(
    task: CampaignTask,
    targetUrl: string,
    appMap?: ApplicationMap,
    productModel?: ProductModel
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const engine = new AutonomousStrategyEngine(targetUrl);
      const plan = await engine.planIteration(task.id, appMap);

      return {
        taskId: task.id,
        status: 'PASSED',
        target: task.target,
        domain: 'PRODUCT',
        findings: [],
        evidence: [
          {
            type: 'strategy_decision',
            title: `AI Test Strategy Plan: ${plan.selectedTargets?.length || 0} targets prioritized`,
            url: targetUrl,
            metadata: { strategyPlan: plan },
          },
        ],
        observations: [],
        durationMs: Date.now() - startTime,
        coverage: {
          rulesAudited: plan.selectedTargets?.length || 0,
        },
        metadata: { strategyPlan: plan },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: 'PRODUCT',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Strategy execution failed',
      };
    }
  }
}

