// ==============================================================================
// Sculra Autonomous Campaign Budget Manager (worker/src/campaign/budget.ts)
// ==============================================================================

import { CampaignBudget, CampaignConfig, CampaignTerminationReason } from './types';
import { createCampaignBudget } from './policy';

export class CampaignBudgetManager {
  private budget: CampaignBudget;
  private startTime: number;

  constructor(config: Partial<CampaignConfig> = {}) {
    this.budget = createCampaignBudget(config);
    this.startTime = Date.now();
  }

  /**
   * Returns a live snapshot of the campaign budget state.
   */
  getSnapshot(): CampaignBudget {
    const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    this.budget.elapsedSeconds = elapsedSeconds;
    this.budget.tasksRemaining = Math.max(0, this.budget.maxTasks - this.budget.tasksExecuted);
    return { ...this.budget };
  }

  /**
   * Checks whether an additional task can be started within budget bounds.
   */
  canExecuteTask(): { allowed: boolean; reason?: string } {
    const snap = this.getSnapshot();

    // 1. Check time limit
    if (snap.elapsedSeconds >= snap.maxDurationSeconds) {
      return {
        allowed: false,
        reason: `Campaign duration exceeded (${snap.elapsedSeconds}s >= ${snap.maxDurationSeconds}s)`,
      };
    }

    // 2. Check task count limit
    if (snap.tasksExecuted >= snap.maxTasks) {
      return {
        allowed: false,
        reason: `Maximum task budget reached (${snap.tasksExecuted} / ${snap.maxTasks} tasks executed)`,
      };
    }

    return { allowed: true };
  }

  /**
   * Checks whether an adaptive reactive task can be inserted.
   */
  canInsertAdaptiveTask(): boolean {
    const snap = this.getSnapshot();
    return (
      snap.adaptiveInsertionsCount < snap.maxAdaptiveInsertions &&
      snap.tasksExecuted < snap.maxTasks &&
      snap.elapsedSeconds < snap.maxDurationSeconds
    );
  }

  /**
   * Records execution of a task.
   */
  recordTaskExecuted(): void {
    this.budget.tasksExecuted += 1;
    this.budget.tasksRemaining = Math.max(0, this.budget.maxTasks - this.budget.tasksExecuted);
    this.budget.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Records insertion of an adaptive task.
   */
  recordAdaptiveInsertion(): void {
    this.budget.adaptiveInsertionsCount += 1;
  }

  /**
   * Evaluates if the campaign budget is exhausted.
   */
  checkExhaustion(): {
    isExhausted: boolean;
    reason?: CampaignTerminationReason;
    details?: string;
  } {
    const snap = this.getSnapshot();

    if (snap.elapsedSeconds >= snap.maxDurationSeconds) {
      return {
        isExhausted: true,
        reason: 'TIME_LIMIT_REACHED',
        details: `Campaign reached max duration limit of ${snap.maxDurationSeconds} seconds.`,
      };
    }

    if (snap.tasksExecuted >= snap.maxTasks) {
      return {
        isExhausted: true,
        reason: 'BUDGET_EXHAUSTED',
        details: `Campaign executed all ${snap.maxTasks} allotted tasks in its budget.`,
      };
    }

    return { isExhausted: false };
  }
}
