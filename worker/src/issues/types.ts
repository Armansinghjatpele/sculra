// ==============================================================================
// Sculra Deterministic Bug Observation & Issue Models (worker/src/issues/types.ts)
// ==============================================================================

export type BugType =
  | 'NAVIGATION_FAILURE'
  | 'PAGE_LOAD_FAILURE'
  | 'HTTP_ERROR'
  | 'CONSOLE_ERROR'
  | 'NETWORK_ERROR'
  | 'CLICK_TIMEOUT'
  | 'CLICK_NO_OP'
  | 'ELEMENT_NOT_INTERACTABLE'
  | 'UNEXPECTED_NAVIGATION'
  | 'FORM_VALIDATION_FAILURE'
  | 'FORM_SUBMISSION_FAILURE'
  | 'BROKEN_CONTROL'
  | 'RUNTIME_EXCEPTION'
  | 'LAYOUT_DEFECT'
  | 'VISUAL_REGRESSION'
  | 'UNKNOWN_FUNCTIONAL_FAILURE';

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type BugConfidence = 'high' | 'medium' | 'low';

export type IssueStatus = 'open' | 'resolved' | 'ignored';

export interface StructuredReproductionStep {
  stepNumber: number;
  action: string;
  target: string;
  url: string;
  expectedBehavior: string;
  observedBehavior: string;
  selector?: string;
}

export interface BugObservation {
  id: string;
  testRunId: string;
  journeyId?: string;
  stepId?: string;
  projectId: string;
  organizationId?: string;
  type: BugType;
  severity: BugSeverity;
  confidence: BugConfidence;
  status: IssueStatus;
  title: string;
  summary: string;
  description: string;
  url: string;
  finalUrl?: string;
  action?: string;
  selector?: string;
  errorSignature?: string;
  evidenceIds?: string[];
  reproductionSteps: StructuredReproductionStep[];
  fingerprint: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface IssuePersistenceResult {
  persistedCount: number;
  newIssuesCount: number;
  updatedIssuesCount: number;
  occurrencesCount: number;
  issueIds: string[];
}
