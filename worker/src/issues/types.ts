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
  | 'UNKNOWN_FUNCTIONAL_FAILURE'
  // Prompt 24: API QA Bug Types
  | 'API_NETWORK_FAILURE'
  | 'API_TIMEOUT'
  | 'API_HTTP_4XX'
  | 'API_HTTP_5XX'
  | 'API_UNEXPECTED_STATUS'
  | 'API_UNEXPECTED_REDIRECT'
  | 'API_INVALID_JSON'
  | 'API_CONTENT_TYPE_MISMATCH'
  | 'API_SCHEMA_VIOLATION'
  | 'API_REQUIRED_FIELD_MISSING'
  | 'API_RESPONSE_MALFORMED'
  | 'API_AUTHENTICATION_FAILURE'
  | 'API_AUTHORIZATION_FAILURE'
  | 'API_UNEXPECTED_AUTHORIZED_ACCESS'
  | 'API_CONFIGURATION_ERROR'
  // Prompt 25: Security & Authorization QA Bug Types
  | 'AUTHENTICATION_MISSING'
  | 'AUTHENTICATION_BYPASS'
  | 'PUBLICLY_ACCESSIBLE_PROTECTED_ROUTE'
  | 'PUBLICLY_ACCESSIBLE_PROTECTED_API'
  | 'AUTHORIZATION_DENIED'
  | 'AUTHORIZATION_UNEXPECTED_ACCESS'
  | 'PRIVILEGE_ESCALATION'
  | 'HORIZONTAL_ACCESS_VIOLATION'
  | 'VERTICAL_ACCESS_VIOLATION'
  | 'SECURITY_HEADER_MISSING'
  | 'SECURITY_HEADER_WEAK'
  | 'INSECURE_COOKIE'
  | 'COOKIE_MISSING_SECURITY_ATTRIBUTE'
  | 'CORS_MISCONFIGURATION'
  | 'OPEN_REDIRECT'
  | 'INSECURE_HTTP_CONFIGURATION'
  | 'MIXED_CONTENT'
  | 'SENSITIVE_DATA_EXPOSURE'
  | 'SECRET_EXPOSURE'
  | 'TOKEN_EXPOSURE'
  | 'SECURITY_CONFIGURATION_ERROR'
  | 'SECURITY_CHECK_INCONCLUSIVE';

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
