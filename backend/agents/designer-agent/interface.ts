import { DesignerAgentInput, DesignerAgentOutput } from './types';

export interface IDesignerAgent {
  analyzeLayout(input: DesignerAgentInput): Promise<DesignerAgentOutput>;
}

export class DesignerAgent implements IDesignerAgent {
  async analyzeLayout(input: DesignerAgentInput): Promise<DesignerAgentOutput> {
    return {
      visualScore: 100,
      flaws: [],
    };
  }
}
