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
  | 'SECURITY_CHECK_INCONCLUSIVE'
  // Prompt 26: Performance & Reliability QA Bug Types
  | 'PERFORMANCE_NAVIGATION_SLOW'
  | 'PERFORMANCE_TTFB_SLOW'
  | 'PERFORMANCE_FCP_SLOW'
  | 'PERFORMANCE_LCP_SLOW'
  | 'PERFORMANCE_INP_SLOW'
  | 'PERFORMANCE_CLS_HIGH'
  | 'PERFORMANCE_RESOURCE_SLOW'
  | 'PERFORMANCE_RESOURCE_LARGE'
  | 'PERFORMANCE_TOO_MANY_REQUESTS'
  | 'PERFORMANCE_NETWORK_FAILURE'
  | 'PERFORMANCE_TIMEOUT'
  | 'PERFORMANCE_API_SLOW'
  | 'PERFORMANCE_API_TIMEOUT'
  | 'PERFORMANCE_RUNTIME_UNSTABLE'
  | 'PERFORMANCE_PAGE_UNRELIABLE'
  | 'PERFORMANCE_JOURNEY_UNRELIABLE'
  | 'PERFORMANCE_REGRESSION'
  | 'PERFORMANCE_BASELINE_MISSING'
  | 'PERFORMANCE_CONFIGURATION_ERROR'
  | 'PERFORMANCE_INCONCLUSIVE'
  // Prompt 27: Accessibility & Inclusive UX QA Bug Types
  | 'MISSING_ACCESSIBLE_NAME'
  | 'EMPTY_BUTTON_NAME'
  | 'EMPTY_LINK_NAME'
  | 'INPUT_MISSING_LABEL'
  | 'LABEL_NOT_ASSOCIATED'
  | 'INVALID_FORM_LABEL'
  | 'INVALID_ARIA_USAGE'
  | 'ARIA_ATTRIBUTE_INVALID'
  | 'ARIA_ROLE_INVALID'
  | 'ARIA_HIDDEN_FOCUSABLE'
  | 'HEADING_HIERARCHY_ERROR'
  | 'MISSING_MAIN_LANDMARK'
  | 'DUPLICATE_MAIN_LANDMARK'
  | 'LANDMARK_STRUCTURE_ERROR'
  | 'DIALOG_ACCESSIBILITY_ERROR'
  | 'DIALOG_MISSING_NAME'
  | 'DIALOG_FOCUS_ERROR'
  | 'FOCUS_NOT_VISIBLE'
  | 'FOCUS_ORDER_ERROR'
  | 'KEYBOARD_INACCESSIBLE'
  | 'KEYBOARD_TRAP'
  | 'SKIP_NAVIGATION_FAILURE'
  | 'TAB_ORDER_ERROR'
  | 'IMAGE_MISSING_ALT'
  | 'IMAGE_INVALID_ALT'
  | 'FORM_ERROR_NOT_ACCESSIBLE'
  | 'ERROR_MESSAGE_NOT_ASSOCIATED'
  | 'REQUIRED_FIELD_NOT_EXPOSED'
  | 'STATUS_MESSAGE_NOT_ACCESSIBLE'
  | 'CONTRAST_FAILURE'
  | 'TEXT_SCALING_FAILURE'
  | 'CONTENT_CLIPPED_ON_TEXT_SCALE'
  | 'REDUCED_MOTION_FAILURE'
  | 'TOUCH_TARGET_TOO_SMALL'
  | 'DISABLED_STATE_INACCESSIBLE'
  | 'LOADING_STATE_INACCESSIBLE'
  | 'HIDDEN_CONTENT_FOCUSABLE'
  | 'CONTENT_NOT_REACHABLE_BY_KEYBOARD'
  | 'ACCESSIBILITY_REGRESSION'
  | 'ACCESSIBILITY_CHECK_INCONCLUSIVE'
  | 'ACCESSIBILITY_CONFIGURATION_ERROR';

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
