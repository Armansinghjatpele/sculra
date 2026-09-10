// ==============================================================================
// Sculra API & Backend Autonomous QA Domain Types (worker/src/api-qa/types.ts)
// ==============================================================================
// Strongly typed domain models for API endpoint discovery, safe HTTP execution,
// contract validation, deterministic assertions, role-based authorization, and coverage.

import { BugType } from '../issues/types';
import { TestIdentity, RoleContext, AuthenticatedSession } from '../auth/types';

export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export const SAFE_AUTO_EXECUTE_METHODS: ReadonlySet<ApiHttpMethod> = new Set(['GET', 'HEAD', 'OPTIONS']);

export type ApiEndpointSource =
  | 'NETWORK_OBSERVATION'
  | 'PROJECT_CONFIG'
  | 'OPENAPI'
  | 'DOM_LINK'
  | 'DOM_FORM'
  | 'API_SOURCE';

export interface ApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  type?: string;
  schema?: any;
  example?: any;
  defaultValue?: any;
  description?: string;
}

export interface ApiRequestBodySchema {
  contentType: string;
  schema?: any;
  example?: any;
  required?: boolean;
}

export interface ApiEndpoint {
  id: string;
  method: ApiHttpMethod;
  path: string; // e.g. /api/projects or /api/projects/{id}
  url: string; // Absolute or resolved URL
  source: ApiEndpointSource;
  firstSeen: string;
  lastSeen: string;
  authenticatedObserved?: boolean;
  roleObserved?: string;
  contentType?: string;
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBodySchema;
  responseStatus?: number;
  confidence: number; // 0.0 - 1.0
  requiresExplicitSafeConfig?: boolean; // true for POST, PUT, PATCH, DELETE
  operationId?: string;
  summary?: string;
  description?: string;
  isAuthorizationBoundary?: boolean;
  expectedRole?: string;
  tags?: string[];
}

export interface ApiRequestDefinition {
  endpointId: string;
  method: ApiHttpMethod;
  url: string;
  headers?: Record<string, string>; // In-memory only; sensitive headers stripped in output
  queryParams?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  role?: string;
  identityId?: string;
}

export interface ApiResponseObservation {
  id: string;
  endpointId: string;
  method: ApiHttpMethod;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  contentType?: string;
  responseSize: number;
  redirectCount: number;
  jsonParsed?: boolean;
  schemaValid?: boolean;
  requiredFieldsPresent?: boolean;
  safeHeaders: Record<string, string>; // Strictly devoid of cookies/authorization
  bodyExcerpt?: string; // Bounded, sanitized excerpt
  rawBody?: string; // In-memory for security scanning only
  rawSetCookies?: string[]; // In-memory for security cookie scanning only
  errorClassification?: string;
  role?: string;
  authenticated?: boolean;
  timestamp: string;
}

export interface ApiContractExpectation {
  endpointId: string;
  method: ApiHttpMethod;
  expectedStatus: number[];
  requiredFields?: string[];
  responseSchema?: any;
  contentType?: string;
}

export interface ApiTestCase {
  id: string;
  endpoint: ApiEndpoint;
  request: ApiRequestDefinition;
  expectation?: ApiContractExpectation;
  isAuthCheck?: boolean;
  expectedDenial?: boolean;
  expectedRole?: string;
}

export interface ApiAssertionResult {
  name: string;
  category: 'TRANSPORT' | 'HTTP' | 'CONTENT' | 'CONTRACT' | 'AUTHORIZATION' | 'RELIABILITY';
  passed: boolean;
  message?: string;
  expected?: any;
  actual?: any;
}

export interface ApiTestResult {
  testCaseId: string;
  endpointId: string;
  method: ApiHttpMethod;
  url: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  observation?: ApiResponseObservation;
  assertions: ApiAssertionResult[];
  bugType?: BugType;
  errorMessage?: string;
  durationMs: number;
  isUnauthorizedAccess?: boolean;
  role?: string;
  timestamp: string;
}

export interface ApiCoverageSummary {
  endpointsDiscovered: number;
  endpointsTested: number;
  methodsTested: ApiHttpMethod[];
  safeMethodsTested: number;
  authenticatedEndpointsTested: number;
  roleSpecificEndpoints: Record<string, number>;
  contractCoveredEndpoints: number;
  failedEndpoints: number;
  authorizationChecks: number;
  untestedHighValueEndpoints: number;
  coverageRatio: number; // 0.0 - 1.0 (tested / discovered)
  statusDistribution: Record<number, number>;
}

export interface ApiExecutionLimits {
  maxEndpoints: number;
  maxRequestsPerRun: number;
  maxConcurrentRequests: number;
  maxRedirects: number;
  maxResponseBytes: number;
  maxRequestBodyBytes: number;
  requestTimeoutMs: number;
  maxOpenApiBytes: number;
  maxOpenApiEndpoints: number;
  maxSchemaDepth: number;
}

export const DEFAULT_API_EXECUTION_LIMITS: ApiExecutionLimits = {
  maxEndpoints: 100,
  maxRequestsPerRun: 50,
  maxConcurrentRequests: 4,
  maxRedirects: 3,
  maxResponseBytes: 1024 * 1024, // 1 MB
  maxRequestBodyBytes: 256 * 1024, // 256 KB
  requestTimeoutMs: 10000, // 10 seconds
  maxOpenApiBytes: 2 * 1024 * 1024, // 2 MB
  maxOpenApiEndpoints: 200,
  maxSchemaDepth: 8,
};

export interface OpenApiDocumentSummary {
  title?: string;
  version?: string;
  endpointsCount: number;
  endpoints: ApiEndpoint[];
  parseErrors?: string[];
}

export interface ApiProjectConfig {
  baseUrl?: string;
  openApiUrl?: string;
  explicitEndpoints?: Array<{
    method: ApiHttpMethod;
    path: string;
    description?: string;
    safeToExecute?: boolean;
    requiredRole?: string;
    expectedStatus?: number;
    requestBody?: any;
    queryParams?: Record<string, string>;
  }>;
  authorizationBoundaries?: Array<{
    path: string;
    method?: ApiHttpMethod;
    role: string;
    expectedBehavior: 'ALLOW' | 'DENY';
    expectedStatus?: number[];
  }>;
}
