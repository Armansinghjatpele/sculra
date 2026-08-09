// ==============================================================================
// Tester Agent Executor Interface (backend/agents/tester-agent/interface.ts)
// ==============================================================================

import { TesterAgentInput, TesterAgentOutput } from './types';

export interface ITesterAgent {
  /**
   * Evaluates the current webpage state and determines the next browser interaction.
   */
  evaluate(state: TesterAgentInput): Promise<TesterAgentOutput>;
}

export class TesterAgent implements ITesterAgent {
  async evaluate(state: TesterAgentInput): Promise<TesterAgentOutput> {
    // LLM Orchestrator will implement this.
    return {
      action: {
        actionType: 'wait',
        reasoning: 'Scaffolding placeholder. Not implemented yet.',
      },
    };
  }
}
