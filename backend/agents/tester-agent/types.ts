// ==============================================================================
// Tester Agent Type Definitions (backend/agents/tester-agent/types.ts)
// ==============================================================================

export interface DOMNode {
  tagName: string;
  selector: string;
  attributes: Record<string, string>;
  textContext?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface TesterAgentInput {
  targetUrl: string;
  discoveredNodes: DOMNode[];
  previousSteps: { action: string; selector: string; result: string }[];
  maxSteps?: number;
}

export interface TesterAgentAction {
  actionType: 'click' | 'type' | 'navigate' | 'hover' | 'wait' | 'conclude';
  targetSelector?: string;
  inputValue?: string;
  reasoning: string;
}

export interface TesterAgentOutput {
  action: TesterAgentAction;
  detectedBugs?: { title: string; severity: 'low' | 'medium' | 'high'; log?: string }[];
}
