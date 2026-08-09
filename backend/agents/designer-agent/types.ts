export interface DesignerAgentInput {
  screenshotPath: string;
  expectedLayoutPath?: string;
  viewportSize: { width: number; height: number };
}

export interface DesignerAgentOutput {
  visualScore: number; // 0 to 100
  flaws: {
    elementSelector: string;
    description: string;
    suggestedCssFix?: string;
  }[];
}
