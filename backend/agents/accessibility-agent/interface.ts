import { AccessibilityAgentInput, AccessibilityAgentOutput } from './types';

export interface IAccessibilityAgent {
  auditAccessibility(input: AccessibilityAgentInput): Promise<AccessibilityAgentOutput>;
}

export class AccessibilityAgent implements IAccessibilityAgent {
  async auditAccessibility(input: AccessibilityAgentInput): Promise<AccessibilityAgentOutput> {
    return {
      compliancePercentage: 100,
      violations: [],
    };
  }
}
