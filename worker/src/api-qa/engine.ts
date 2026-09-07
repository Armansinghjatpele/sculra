// ==============================================================================
// Sculra API QA Autonomous Engine (worker/src/api-qa/engine.ts)
// ==============================================================================
// Master orchestrator for API endpoint discovery, safe HTTP test execution,
// contract validation, role-based authorization verification, and coverage reporting.

import {
  ApiEndpoint,
  ApiTestCase,
  ApiTestResult,
  ApiResponseObservation,
  ApiCoverageSummary,
  ApiProjectConfig,
  ApiExecutionLimits,
  DEFAULT_API_EXECUTION_LIMITS,
  SAFE_AUTO_EXECUTE_METHODS,
  ApiHttpMethod,
} from './types';
import { ApiEndpointDiscovery } from './discovery';
import { ApiExecutor } from './executor';
import { ApiRequestDataGenerator } from './generator';
import { DeterministicApiAssertions } from './assertions';
import { ApiAuthorizationEvaluator, ApiAuthorizationCheckConfig } from './authorization';
import { BugObservation } from '../issues/types';
import { calculateBugSeverity } from '../issues/severity';
import { computeBugFingerprint } from '../issues/fingerprint';
import { TestIdentity, AuthenticatedSession } from '../auth/types';
import { ApplicationMap, CancellationToken } from '../types';
import { WorkerLogger } from '../logger';

export interface ApiQAEngineParams {
  testRunId: string;
  projectId: string;
  targetUrl: string;
  applicationMap?: ApplicationMap;
  networkObservations?: Array<{ url: string; method?: string; status?: number; contentType?: string }>;
  projectConfig?: ApiProjectConfig;
  testIdentities?: TestIdentity[];
  authenticatedSessions?: AuthenticatedSession[];
  authorizationChecks?: ApiAuthorizationCheckConfig[];
  limits?: Partial<ApiExecutionLimits>;
  allowLocalhost?: boolean;
  logger?: WorkerLogger;
  cancellationToken?: CancellationToken;
}

export interface ApiQAExecutionResult {
  endpoints: ApiEndpoint[];
  testResults: ApiTestResult[];
  observations: ApiResponseObservation[];
  coverage: ApiCoverageSummary;
  bugObservations: BugObservation[];
  durationMs: number;
}

export class ApiQAEngine {
  private limits: ApiExecutionLimits;
  private logger?: WorkerLogger;

  constructor(limits: Partial<ApiExecutionLimits> = {}, logger?: WorkerLogger) {
    this.limits = { ...DEFAULT_API_EXECUTION_LIMITS, ...limits };
    this.logger = logger;
  }

  /**
   * Executes the autonomous API QA pipeline deterministically.
   */
  async execute(params: ApiQAEngineParams): Promise<ApiQAExecutionResult> {
    const startTime = Date.now();
    const {
      testRunId,
      projectId,
      targetUrl,
      applicationMap,
      networkObservations = [],
      projectConfig,
      testIdentities = [],
      authenticatedSessions = [],
      authorizationChecks = [],
      allowLocalhost = false,
      cancellationToken,
    } = params;

    this.logger?.log('api_qa_engine_started', { targetUrl, projectId });

    // 1. Discover Endpoints
    const discovery = new ApiEndpointDiscovery(this.limits, this.logger);
    const endpoints = await discovery.discover({
      targetUrl,
      applicationMap,
      networkObservations,
      projectConfig,
      limits: this.limits,
      allowLocalhost,
      logger: this.logger,
      cancellationToken,
    });

    const testResults: ApiTestResult[] = [];
    const observations: ApiResponseObservation[] = [];
    const bugObservations: BugObservation[] = [];

    const executor = new ApiExecutor({
      allowLocalhost,
      limits: this.limits,
      logger: this.logger,
      cancellationToken,
    });

    // 2. Execute Safe Automatic Tests (GET, HEAD, OPTIONS & Explicitly Configured Safe Tests)
    const testedEndpointIds = new Set<string>();
    const testedMethodsSet = new Set<ApiHttpMethod>();
    const statusDistribution: Record<number, number> = {};

    let requestsCount = 0;

    for (const endpoint of endpoints) {
      if (cancellationToken?.isCancelled || requestsCount >= this.limits.maxRequestsPerRun) {
        break;
      }

      const isSafeMethod = SAFE_AUTO_EXECUTE_METHODS.has(endpoint.method);
      const isExplicitlySafe = !endpoint.requiresExplicitSafeConfig;

      // Skip unsafe mutations unless explicitly configured
      if (!isSafeMethod && !isExplicitlySafe) {
        continue;
      }

      requestsCount++;
      const testCaseId = `tc_${endpoint.id}_${requestsCount}`;

      // Build safe query and path parameters
      const queryParams = ApiRequestDataGenerator.generateQueryParams(endpoint.parameters);
      const { resolvedPath } = ApiRequestDataGenerator.resolvePathParams(endpoint.path, endpoint.parameters);
      const resolvedUrl = new URL(resolvedPath, targetUrl);

      for (const [k, v] of Object.entries(queryParams)) {
        resolvedUrl.searchParams.set(k, v);
      }

      const requestBody = endpoint.requestBody
        ? ApiRequestDataGenerator.generateRequestBody(endpoint.requestBody)
        : undefined;

      const testCase: ApiTestCase = {
        id: testCaseId,
        endpoint,
        request: {
          endpointId: endpoint.id,
          method: endpoint.method,
          url: resolvedUrl.toString(),
          queryParams,
          body: requestBody,
          timeoutMs: this.limits.requestTimeoutMs,
        },
        expectation: {
          endpointId: endpoint.id,
          method: endpoint.method,
          expectedStatus: endpoint.responseStatus ? [endpoint.responseStatus] : [200, 201, 204, 301, 302, 304],
        },
      };

      const observation = await executor.execute(testCase.request, {
        allowLocalhost,
        explicitlySafe: isExplicitlySafe,
        logger: this.logger,
        cancellationToken,
      });

      observations.push(observation);
      testedEndpointIds.add(endpoint.id);
      testedMethodsSet.add(endpoint.method);

      if (observation.status > 0) {
        statusDistribution[observation.status] = (statusDistribution[observation.status] || 0) + 1;
      }

      // 3. Evaluate Assertions
      const result = DeterministicApiAssertions.evaluate(testCase, observation);
      testResults.push(result);

      // 4. If failed, generate deterministic BugObservation
      if (result.status === 'FAILED' && result.bugType) {
        const severity = calculateBugSeverity({
          bugType: result.bugType,
          url: observation.url,
          statusCode: observation.status,
          targetDescription: `${endpoint.method} ${endpoint.path}`,
        });

        const fingerprint = computeBugFingerprint({
          projectId,
          url: endpoint.path,
          bugType: result.bugType,
          action: endpoint.method,
          errorSignature: result.errorMessage,
        });

        bugObservations.push({
          id: `bug_${fingerprint.substring(0, 12)}_${Date.now()}`,
          testRunId,
          projectId,
          type: result.bugType,
          severity,
          confidence: 'high',
          status: 'open',
          title: `API Failure: [${result.bugType}] ${endpoint.method} ${endpoint.path}`,
          summary: result.errorMessage || `API endpoint ${endpoint.method} ${endpoint.path} failed assertion.`,
          description: `Observed status HTTP ${observation.status} with duration ${observation.durationMs}ms. Error: ${result.errorMessage}`,
          url: observation.url,
          action: endpoint.method,
          errorSignature: result.errorMessage,
          reproductionSteps: [
            {
              stepNumber: 1,
              action: `HTTP_${endpoint.method}`,
              target: endpoint.path,
              url: observation.url,
              expectedBehavior: 'Successful response (< 400)',
              observedBehavior: `HTTP ${observation.status} (${result.errorMessage || 'Failure'})`,
            },
          ],
          fingerprint,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 5. Evaluate Role Authorization Boundaries
    if (testIdentities.length > 0 && !cancellationToken?.isCancelled) {
      const authResults = await ApiAuthorizationEvaluator.evaluateBoundaries({
        executor,
        targetUrl,
        endpoints,
        identities: testIdentities,
        sessions: authenticatedSessions,
        configuredChecks: [
          ...(authorizationChecks || []),
          ...(projectConfig?.authorizationBoundaries || []).map((b) => ({
            path: b.path,
            method: b.method || 'GET',
            role: b.role,
            restrictedToRole: b.expectedBehavior === 'ALLOW' ? b.role : 'ADMIN',
            unauthorizedRole: b.expectedBehavior === 'ALLOW' ? (b.role.toUpperCase() === 'ADMIN' ? 'MEMBER' : 'ANONYMOUS') : b.role,
            expectedAccess: b.expectedBehavior === 'ALLOW' ? 'ALLOWED' : 'DENY_401_403',
          })),
        ],
        logger: this.logger,
        cancellationToken,
      });

      for (const aRes of authResults) {
        testResults.push(aRes);
        if (aRes.observation) {
          observations.push(aRes.observation);
          testedEndpointIds.add(aRes.endpointId);
          testedMethodsSet.add(aRes.method);
          if (aRes.observation.status > 0) {
            statusDistribution[aRes.observation.status] =
              (statusDistribution[aRes.observation.status] || 0) + 1;
          }
        }

        if (aRes.status === 'FAILED' && aRes.bugType) {
          const fingerprint = computeBugFingerprint({
            projectId,
            url: aRes.url,
            bugType: aRes.bugType,
            action: aRes.method,
            errorSignature: aRes.errorMessage,
          });

          bugObservations.push({
            id: `bug_auth_${fingerprint.substring(0, 12)}_${Date.now()}`,
            testRunId,
            projectId,
            type: aRes.bugType,
            severity: aRes.isUnauthorizedAccess ? 'critical' : 'high',
            confidence: 'high',
            status: 'open',
            title: `API Security Violation: ${aRes.isUnauthorizedAccess ? 'Unauthorized Access' : 'Authorization Failure'} (${aRes.role || 'ROLE'} -> ${aRes.method} ${aRes.url})`,
            summary: aRes.errorMessage || 'API authorization check failed.',
            description: aRes.errorMessage || 'Unauthorized role access detected on protected API route.',
            url: aRes.url,
            action: aRes.method,
            errorSignature: aRes.errorMessage,
            reproductionSteps: [
              {
                stepNumber: 1,
                action: 'AUTHENTICATE_ROLE',
                target: aRes.role || 'ROLE',
                url: targetUrl,
                expectedBehavior: `Authenticate as ${aRes.role}`,
                observedBehavior: 'Session established',
              },
              {
                stepNumber: 2,
                action: `HTTP_${aRes.method}`,
                target: aRes.url,
                url: aRes.url,
                expectedBehavior: 'Access Denied (401 / 403)',
                observedBehavior: `Access Granted (HTTP ${aRes.observation?.status || 200})`,
              },
            ],
            fingerprint,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // 6. Compute Deterministic Coverage Summary
    const endpointsDiscovered = endpoints.length;
    const endpointsTested = testedEndpointIds.size;
    const coverageRatio = endpointsDiscovered > 0 ? Math.min(1.0, endpointsTested / endpointsDiscovered) : 0;
    const failedEndpoints = testResults.filter((r) => r.status === 'FAILED').length;
    const safeMethodsTested = Array.from(testedMethodsSet).filter((m) => SAFE_AUTO_EXECUTE_METHODS.has(m)).length;
    const authChecksCount = testResults.filter((r) => r.role !== undefined).length;
    const contractCoveredEndpoints = endpoints.filter((e) => e.source === 'OPENAPI').length;

    const coverage: ApiCoverageSummary = {
      endpointsDiscovered,
      endpointsTested,
      methodsTested: Array.from(testedMethodsSet),
      safeMethodsTested,
      authenticatedEndpointsTested: testResults.filter((r) => r.role !== undefined).length,
      roleSpecificEndpoints: {},
      contractCoveredEndpoints,
      failedEndpoints,
      authorizationChecks: authChecksCount,
      untestedHighValueEndpoints: Math.max(0, endpointsDiscovered - endpointsTested),
      coverageRatio,
      statusDistribution,
    };

    const durationMs = Date.now() - startTime;

    this.logger?.log('api_qa_engine_completed', {
      endpointsDiscovered,
      endpointsTested,
      coverageRatio: (coverageRatio * 100).toFixed(1) + '%',
      failedEndpoints,
      durationMs,
    });

    return {
      endpoints,
      testResults,
      observations,
      coverage,
      bugObservations,
      durationMs,
    };
  }
}
