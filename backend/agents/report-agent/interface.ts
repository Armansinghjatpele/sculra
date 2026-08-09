import { ReportAgentInput, ReportAgentOutput } from './types';

export interface IReportAgent {
  compileReport(input: ReportAgentInput): Promise<ReportAgentOutput>;
}

export class ReportAgent implements IReportAgent {
  async compileReport(input: ReportAgentInput): Promise<ReportAgentOutput> {
    return {
      pdfReportPath: '/exports/report_mock.pdf',
      summaryText: 'All checks complete.',
      recommendedReleaseScore: 100,
    };
  }
}
