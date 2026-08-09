export interface MemoryAgentInput {
  queryText: string;
  projectId: string;
  limit?: number;
}

export interface MemoryAgentOutput {
  relevantBugs: {
    bugId: string;
    similarity: number;
    resolutionSummary?: string;
  }[];
}
