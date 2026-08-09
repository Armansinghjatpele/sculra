export interface PMAgentInput {
  rawException: string;
  reproduceTraceSteps: string[];
  screenshotUrl?: string;
}

export interface TicketMarkdown {
  title: string;
  body: string; // GitHub / Linear Markdown style
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface PMAgentOutput {
  ticket: TicketMarkdown;
}
