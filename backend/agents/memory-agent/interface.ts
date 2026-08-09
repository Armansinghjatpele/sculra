import { MemoryAgentInput, MemoryAgentOutput } from './types';

export interface IMemoryAgent {
  queryMemory(input: MemoryAgentInput): Promise<MemoryAgentOutput>;
}

export class MemoryAgent implements IMemoryAgent {
  async queryMemory(input: MemoryAgentInput): Promise<MemoryAgentOutput> {
    return {
      relevantBugs: [],
    };
  }
}
