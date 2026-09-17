// ==============================================================================
// Sculra Campaign Termination Evaluator (worker/src/campaign/termination.ts)
// ==============================================================================

import {
  CampaignState,
  CampaignTerminationReason,
  QACampaignStatus,
} from './types';
import { CampaignBudgetManager } from './budget';
import { CancellationToken } from '../types';

export interface TerminationDecision {
  shouldTerminate: boolean;
  status?: QACampaignStatus;
  reason?: CampaignTerminationReason;
  details?: string;
}

export class CampaignTerminationEvaluator {
  static evaluate(
    state: CampaignState,
    budgetManager: CampaignBudgetManager,
    cancellationToken?: CancellationToken
  ): TerminationDecision {
    // 1. Explicit User Cancellation
    if (cancellationToken?.isCancelled || state.status === 'CANCELLING' || state.status === 'CANCELLED') {
      return {
        shouldTerminate: true,
        status: 'CANCELLED',
        reason: 'CANCELLED_BY_USER',
        details: 'Campaign was cancelled upon user request.',
      };
    }

    // 2. Budget or Time Limits Exhaustion
    const budgetCheck = budgetManager.checkExhaustion();
    if (budgetCheck.isExhausted) {
      // If we have collected valid evidence on core domains, status is COMPLETED with BUDGET_EXHAUSTED
      const hasCoreEvidence = state.testedTargets.size > 0;
      return {
        shouldTerminate: true,
        status: hasCoreEvidence ? 'COMPLETED' : 'NEEDS_REVIEW',
        reason: budgetCheck.reason,
        details: budgetCheck.details,
      };
    }

    // 3. Critical Blocker Threshold
    const criticalObservations = state.observations.filter((o) => o.severity === 'critical');
    if (criticalObservations.length >= 3) {
      return {
        shouldTerminate: true,
        status: 'FAILED',
        reason: 'CRITICAL_BLOCKER_THRESHOLD',
        details: `Encountered ${criticalObservations.length} critical blockers exceeding campaign threshold.`,
      };
    }

    // 4. Task Completion Check
    const tasks = Array.from(state.tasks.values());
    const hasRemainingWork = tasks.some(
      (t) => t.status === 'QUEUED' || t.status === 'PENDING_DEPENDENCIES' || t.status === 'RUNNING'
    );

    if (tasks.length > 0 && !hasRemainingWork) {
      return {
        shouldTerminate: true,
        status: 'COMPLETED',
        reason: 'ALL_TASKS_COMPLETED',
        details: `All ${tasks.length} planned and scheduled tasks completed successfully.`,
      };
    }

    return { shouldTerminate: false };
  }
}
