export interface AccessibilityAgentInput {
  htmlSnippet: string;
  viewportContrastChecks: { elementSelector: string; ratio: number }[];
}

export interface AccessibilityAgentOutput {
  compliancePercentage: number;
  violations: {
    ruleId: string;
    selector: string;
    impact: 'minor' | 'moderate' | 'serious' | 'critical';
    message: string;
  }[];
}
