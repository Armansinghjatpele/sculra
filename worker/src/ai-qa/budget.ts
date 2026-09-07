// ==============================================================================
// Sculra AI QA Budget Tracker (worker/src/ai-qa/budget.ts)
// ==============================================================================
// Enforces strict bounded limits on AI iterations, provider calls, actions, and time.

import { AIQABudget, AIQAConfig, AIQAStopReason, DEFAULT_AI_QA_CONFIG } from './types';

export class AIQABudgetTracker {
  private maxIterations: number;
  private currentIteration: number = 0;
  private maxCalls: number;
  private callsMade: number = 0;
  private maxTotalActions: number;
  private actionsExecuted: number = 0;
  private maxAiTimeMs: number;
  private startTimeMs: number;
  private maxActionsPerJourney: number;

  constructor(config: Partial<AIQAConfig> = {}) {
    this.maxIterations = config.maxIterations || DEFAULT_AI_QA_CONFIG.maxIterations;
    this.maxCalls = config.maxCalls || DEFAULT_AI_QA_CONFIG.maxCalls;
    this.maxTotalActions = config.maxTotalActions || DEFAULT_AI_QA_CONFIG.maxTotalActions;
    this.maxAiTimeMs = config.maxAiTimeMs || DEFAULT_AI_QA_CONFIG.maxAiTimeMs;
    this.maxActionsPerJourney = config.maxActionsPerJourney || DEFAULT_AI_QA_CONFIG.maxActionsPerJourney;
    this.startTimeMs = Date.now();
  }

  getBudgetState(): AIQABudget {
    const elapsed = Date.now() - this.startTimeMs;
    return {
      maxIterations: this.maxIterations,
      currentIteration: this.currentIteration,
      remainingIterations: Math.max(0, this.maxIterations - this.currentIteration),
      maxCalls: this.maxCalls,
      callsMade: this.callsMade,
      maxTotalActions: this.maxTotalActions,
      actionsExecuted: this.actionsExecuted,
      maxAiTimeMs: this.maxAiTimeMs,
      elapsedTimeMs: elapsed,
      maxActionsPerJourney: this.maxActionsPerJourney,
    };
  }

  canStartNextIteration(): { allowed: boolean; reason?: AIQAStopReason; message?: string } {
    if (this.currentIteration >= this.maxIterations) {
      return {
        allowed: false,
        reason: 'BUDGET_EXHAUSTED',
        message: `Max iteration limit reached (${this.currentIteration}/${this.maxIterations}).`,
      };
    }

    if (this.callsMade >= this.maxCalls) {
      return {
        allowed: false,
        reason: 'BUDGET_EXHAUSTED',
        message: `Max provider call limit reached (${this.callsMade}/${this.maxCalls}).`,
      };
    }

    if (this.actionsExecuted >= this.maxTotalActions) {
      return {
        allowed: false,
        reason: 'BUDGET_EXHAUSTED',
        message: `Max action budget reached (${this.actionsExecuted}/${this.maxTotalActions}).`,
      };
    }

    const elapsed = Date.now() - this.startTimeMs;
    if (elapsed >= this.maxAiTimeMs) {
      return {
        allowed: false,
        reason: 'BUDGET_EXHAUSTED',
        message: `Max execution time exceeded (${elapsed}ms >= ${this.maxAiTimeMs}ms).`,
      };
    }

    return { allowed: true };
  }

  incrementIteration(): number {
    this.currentIteration++;
    return this.currentIteration;
  }

  recordCall(): void {
    this.callsMade++;
  }

  recordActions(count: number): void {
    this.actionsExecuted += count;
  }
}
