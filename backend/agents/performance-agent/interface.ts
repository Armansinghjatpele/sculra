import { PerformanceAgentInput, PerformanceAgentOutput } from './types';

export interface IPerformanceAgent {
  auditPerformance(input: PerformanceAgentInput): Promise<PerformanceAgentOutput>;
}

export class PerformanceAgent implements IPerformanceAgent {
  async auditPerformance(input: PerformanceAgentInput): Promise<PerformanceAgentOutput> {
    return {
      performanceScore: 100,
      suggestions: [],
    };
  }
}
