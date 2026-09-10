// ==============================================================================
// Sculra Security & Authorization Autonomous QA Domain Types (worker/src/security/types.ts)
// ==============================================================================
// Strongly typed domain models for deterministic security target discovery,
// security policy enforcement, header/cookie/CORS/redirect/exposure assertions,
// role-based boundary validation, and zero-exposure telemetry.

import { BugSeverity } from '../issues/types';
import { ApiHttpMethod } from '../api-qa/types';

export type SecurityFindingType =
  // Authentication & Route Protection
  | 'AUTHENTICATION_MISSING'
  | 'AUTHENTICATION_BYPASS'
  | 'PUBLICLY_ACCESSIBLE_PROTECTED_ROUTE'
  | 'PUBLICLY_ACCESSIBLE_PROTECTED_API'
  // Authorization & Privilege
  | 'AUTHORIZATION_DENIED'
  | 'AUTHORIZATION_UNEXPECTED_ACCESS'
  | 'PRIVILEGE_ESCALATION'
  | 'HORIZONTAL_ACCESS_VIOLATION'
  | 'VERTICAL_ACCESS_VIOLATION'
  | 'API_AUTHORIZATION_FAILURE'
  | 'API_UNEXPECTED_AUTHORIZED_ACCESS'
  // Security Headers
  | 'SECURITY_HEADER_MISSING'
  | 'SECURITY_HEADER_WEAK'
  // Cookie Security
  | 'INSECURE_COOKIE'
  | 'COOKIE_MISSING_SECURITY_ATTRIBUTE'
  // CORS & Network
  | 'CORS_MISCONFIGURATION'
  | 'OPEN_REDIRECT'
  | 'INSECURE_HTTP_CONFIGURATION'
  | 'MIXED_CONTENT'
  // Sensitive Data & Exposure
  | 'SENSITIVE_DATA_EXPOSURE'
  | 'SECRET_EXPOSURE'
  | 'TOKEN_EXPOSURE'
  // System / Meta
  | 'SECURITY_CONFIGURATION_ERROR'
  | 'SECURITY_CHECK_INCONCLUSIVE';

export type SecurityConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type SecurityTargetType =
  | 'PROTECTED_ROUTE'
  | 'PROTECTED_API'
  | 'PUBLIC_ROUTE'
  | 'ADMIN_SURFACE'
  | 'SECURITY_HEADER'
  | 'SECURITY_COOKIE'
  | 'CORS_ENDPOINT'
  | 'REDIRECT_ENDPOINT'
  | 'SENSITIVE_DATA_ENDPOINT';

export interface SecurityTarget {
  id: string;
  type: SecurityTargetType;
  path: string;
  url: string;
  method: ApiHttpMethod;
  requiredAuthentication: boolean;
  requiredRole?: string; // e.g. 'ADMIN'
  source: 'DISCOVERY' | 'OPENAPI' | 'PROJECT_CONFIG' | 'AUTH_CONTEXT' | 'DOM_ANALYSIS';
  confidence: number; // 0.0 - 1.0
  safeToTest: boolean;
  description?: string;
  metadata?: Record<string, any>;
}

export interface SecurityHeaderRequirement {
  headerName: string;
  required: boolean;
  recommendedValues?: string[];
  validate?: (value: string | undefined, isHttps: boolean, isHtml: boolean) => { valid: boolean; issue?: string; severity?: BugSeverity };
}

export interface SecurityCookiePolicy {
  requireHttpOnlyForAuth: boolean;
  requireSecureForHttps: boolean;
  allowedSameSite: Array<'Strict' | 'Lax' | 'None'>;
}

export interface SecurityCorsPolicy {
  allowWildcardOriginWithCredentials: boolean;
  allowReflectedOrigin: boolean;
  trustedOrigins: string[];
}

export interface SecurityRedirectPolicy {
  allowExternalRedirects: boolean;
  trustedDomains: string[];
  safeSentinelUrl: string;
}

export interface SecurityPolicyConfig {
  allowedOrigins: string[];
  allowedMethods: ReadonlySet<ApiHttpMethod>;
  maxSecurityTargets: number;
  maxSecurityRequests: number;
  maxAuthorizationChecks: number;
  maxRoleContexts: number;
  maxConcurrentRequests: number;
  maxRedirects: number;
  maxResponseBytes: number;
  requestTimeoutMs: number;
  maxExecutionTimeMs: number;
  enableHeaderChecks: boolean;
  enableCookieChecks: boolean;
  enableCorsChecks: boolean;
  enableRedirectChecks: boolean;
  enableExposureChecks: boolean;
  enableAuthBoundaryChecks: boolean;
  cookiePolicy: SecurityCookiePolicy;
  corsPolicy: SecurityCorsPolicy;
  redirectPolicy: SecurityRedirectPolicy;
}

export interface SecurityHeaderCheckResult {
  headerName: string;
  url: string;
  observedValue?: string;
  recommendedValues?: string[];
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  findingType?: SecurityFindingType;
  severity?: BugSeverity;
  reason?: string;
}

export interface SecurityCookieCheckResult {
  cookieName: string;
  path?: string;
  domain?: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  isAuthCookie: boolean;
  status: 'PASSED' | 'FAILED';
  findingType?: SecurityFindingType;
  severity?: BugSeverity;
  reason?: string;
}

export interface SecurityCorsCheckResult {
  url: string;
  testOrigin: string;
  allowOriginHeader?: string;
  allowCredentialsHeader?: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  findingType?: SecurityFindingType;
  severity?: BugSeverity;
  reason?: string;
}

export interface SecurityRedirectCheckResult {
  url: string;
  parameterName: string;
  testedRedirectValue: string;
  finalUrl?: string;
  statusCode?: number;
  isExternalRedirect: boolean;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  findingType?: SecurityFindingType;
  severity?: BugSeverity;
  reason?: string;
}

export interface SensitiveExposureCheckResult {
  url: string;
  method: string;
  source: 'API_RESPONSE' | 'DOM_TEXT' | 'CONSOLE' | 'NETWORK_HEADER';
  patternName: string;
  redactedField: string;
  redactedSnippet: string;
  findingType: SecurityFindingType;
  severity: BugSeverity;
  reason: string;
}

export interface SecurityAuthCheckResult {
  targetPath: string;
  method: ApiHttpMethod;
  targetType: 'ROUTE' | 'API';
  testedRole: string; // e.g. 'ADMIN', 'MEMBER', 'UNAUTHENTICATED'
  restrictedToRole: string; // e.g. 'ADMIN'
  expectedAccess: 'ALLOWED' | 'DENIED';
  observedAccess: 'ALLOWED' | 'DENIED' | 'ERROR';
  statusCode?: number;
  finalUrl?: string;
  status: 'PASSED' | 'FAILED';
  findingType?: SecurityFindingType;
  severity?: BugSeverity;
  isUnauthorizedAccess: boolean;
  evidence: string[];
}

export interface SecurityFinding {
  id: string;
  type: SecurityFindingType;
  severity: BugSeverity;
  confidence: SecurityConfidence;
  targetUrl: string;
  targetPath: string;
  method?: string;
  role?: string;
  title: string;
  summary: string;
  description: string;
  whyItMatters: string;
  remediationRecommendation: string;
  remediation?: string;
  evidenceSummary: string;
  evidenceIds?: string[];
  evidence?: string[];
  fingerprint: string;
  detectedAt: string;
}

export interface SecurityCoverageSummary {
  targetsDiscovered: number;
  checksExecuted: number;
  findingsCount: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  coverageRatio: number;
  securityTargetsDiscovered?: number;
  securityTargetsTested?: number;
  protectedRoutesTested?: number;
  protectedApisTested?: number;
  rolesTested?: number;
  authorizationChecksCount?: number;
  headerChecksCount?: number;
  cookieChecksCount?: number;
  corsChecksCount?: number;
  redirectChecksCount?: number;
  exposureChecksCount?: number;
  securityFindingsCount?: number;
  findingsBySeverity?: Record<BugSeverity, number>;
  securityChecksInconclusive?: number;
  securityCoverageRatio?: number;
  securityScore?: number;
}

export interface SecurityScanResult {
  targets: SecurityTarget[];
  findings: SecurityFinding[];
  headerChecks: SecurityHeaderCheckResult[];
  cookieChecks: SecurityCookieCheckResult[];
  corsChecks: SecurityCorsCheckResult[];
  redirectChecks: SecurityRedirectCheckResult[];
  exposureChecks: SensitiveExposureCheckResult[];
  authChecks: SecurityAuthCheckResult[];
  coverage: SecurityCoverageSummary;
  securityScore: number;
  durationMs: number;
  bugObservations: import('../issues/types').BugObservation[];
}
