export interface PerformanceAgentInput {
  loadDurationMs: number;
  networkRequests: { url: string; durationMs: number; sizeBytes: number }[];
  domNodesCount: number;
}

export interface PerformanceAgentOutput {
  performanceScore: number;
  suggestions: { rule: string; description: string; potentialSavingsKb?: number }[];
}
