// ==============================================================================
// Sculra Authenticated & Role-Based QA Types (worker/src/auth/types.ts)
// ==============================================================================
// Strongly typed domain models for MVP authentication, test identities,
// isolated browser contexts, role contexts, and deterministic authorization checks.
//
// CRITICAL: Must NEVER store or transmit raw credentials, passwords, or tokens.

export type AuthMethod = 'FORM_LOGIN';

export type AuthOutcome =
  | 'AUTHENTICATED'
  | 'AUTHENTICATION_FAILED'
  | 'AUTHENTICATION_TIMEOUT'
  | 'LOGIN_FORM_NOT_FOUND'
  | 'TEST_CONFIGURATION_ERROR'
  | 'AUTHENTICATED_STATE_UNVERIFIED';

export interface AuthSuccessIndicator {
  type: 'URL_CHANGE' | 'ELEMENT_VISIBLE' | 'FORM_DISAPPEARED' | 'COOKIE_PRESENT';
  expectedUrlPattern?: string;
  expectedSelector?: string;
  cookieName?: string;
}

export interface AuthenticationConfig {
  enabled: boolean;
  method: AuthMethod;
  loginUrl: string;
  usernameSecretRef?: string;
  passwordSecretRef?: string;
  role: 'ADMIN' | 'MEMBER' | string;
  timeoutMs?: number;
  successIndicator?: AuthSuccessIndicator;
  usernameFieldSelector?: string;
  passwordFieldSelector?: string;
  submitButtonSelector?: string;
}

export interface TestIdentity {
  id: string;
  name: string;
  role: 'ADMIN' | 'MEMBER' | string;
  authMethod: AuthMethod;
  status: 'ACTIVE' | 'DISABLED';
  loginUrl: string;
  usernameSecretRef?: string;
  passwordSecretRef?: string;
  successIndicator?: AuthSuccessIndicator;
  usernameFieldSelector?: string;
  passwordFieldSelector?: string;
  submitButtonSelector?: string;
}

export interface AuthenticatedSession {
  identityId: string;
  role: string;
  authenticated: boolean;
  outcome: AuthOutcome;
  authenticatedAt?: string;
  browserContextId?: string;
  finalUrl?: string;
  discoveredPagesCount?: number;
  error?: string;
  telemetryEvidence: string[];
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
}

export interface RoleContext {
  identityId: string;
  roleId: string;
  roleName: string;
  authenticated: boolean;
  capabilities: string[];
  workflowIds: string[];
  discoveredPageUrls: string[];
}

export interface AuthorizationCheckConfig {
  name?: string;
  path: string;
  expectedAccess?: 'ALLOWED' | 'DENIED' | 'ALLOW' | 'DENY' | 'DENY_401_403' | string;
  role: string;
  expectedRedirectUrl?: string;
}

export interface AuthorizationCheckResult {
  name: string;
  path: string;
  role: string;
  expectedAccess: 'ALLOWED' | 'DENIED';
  observedAccess: 'ALLOWED' | 'DENIED' | 'ERROR';
  status: 'PASSED' | 'FAILED';
  statusCode?: number;
  finalUrl?: string;
  denialReason?: string;
  isUnauthorizedAccess: boolean;
  evidence: string[];
  checkedAt: string;
}

export interface RoleComparisonResult {
  roleA: string;
  roleB: string;
  roleAOnlyPages: string[];
  roleBOnlyPages: string[];
  commonPages: string[];
  comparisonSummary: string;
  totalUniquePages: number;
}
