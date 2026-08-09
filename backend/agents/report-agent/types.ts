export interface ReportAgentInput {
  testRunId: string;
  stepsPassed: number;
  stepsFailed: number;
  detectedBugsCount: number;
  executionTimeMs: number;
}

export interface ReportAgentOutput {
  pdfReportPath: string;
  summaryText: string;
  recommendedReleaseScore: number;
}
