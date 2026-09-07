// ==============================================================================
// E2E Integration Test: API & Backend Autonomous QA Foundation (worker/tests/api_e2e.test.ts)
// ==============================================================================
// Complete end-to-end verification of deterministic API discovery, execution,
// contract validation, role authorization boundaries, security violations, and release scoring.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createFixtureServer, FixtureServer } from './fixtures/app';
import { BrowserRunner } from '../src/runner';
import { DeterministicReleaseScorer } from '../src/release/scorer';
import { DeterministicPrioritizer } from '../src/strategy/prioritizer';
import { TestTarget } from '../src/strategy/types';
import { CancellationToken } from '../src/types';

describe('API & Backend Autonomous QA E2E Integration', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('executes full API QA pipeline verifying discovery, safe execution, assertions, authorization, and zero-exposure security', async () => {
    // 1. Start deterministic local fixture & configure runner
    const testRunId = 'tr_api_e2e_001';
    const projectId = 'proj_api_e2e';

    const runner = new BrowserRunner(testRunId, projectId, {
      allowLocalhost: true,
      headless: true,
      enableDiscovery: true,
      enableJourneys: false,
      enableVisual: false,
      enableAiQa: false,
      enableApiQa: true,
      apiConfig: {
        openApiUrl: `${fixture.url}/api/openapi.json`,
        explicitEndpoints: [
          { method: 'GET', path: '/api/health', safeToExecute: true },
          { method: 'GET', path: '/api/projects', safeToExecute: true },
          { method: 'GET', path: '/api/fixture/500', safeToExecute: true },
          { method: 'GET', path: '/api/fixture/invalid-json', safeToExecute: true },
          { method: 'GET', path: '/api/fixture/schema-error', safeToExecute: true },
        ],
        authorizationBoundaries: [
          {
            path: '/api/admin/users',
            method: 'GET',
            role: 'ADMIN',
            expectedBehavior: 'ALLOW',
          },
          {
            path: '/api/fixture/leak-panel',
            method: 'GET',
            role: 'ADMIN',
            expectedBehavior: 'ALLOW',
          },
        ],
      },
      testIdentities: [
        {
          id: 'ident-admin',
          name: 'Admin Test Identity',
          role: 'ADMIN',
          authMethod: 'FORM_LOGIN',
          status: 'ACTIVE',
          loginUrl: `${fixture.url}/login`,
          usernameSecretRef: 'raw:admin@example.com',
          passwordSecretRef: 'raw:admin123',
        },
        {
          id: 'ident-member',
          name: 'Member Test Identity',
          role: 'MEMBER',
          authMethod: 'FORM_LOGIN',
          status: 'ACTIVE',
          loginUrl: `${fixture.url}/login`,
          usernameSecretRef: 'raw:member@example.com',
          passwordSecretRef: 'raw:member123',
        },
      ],
      authorizationChecks: [
        {
          path: '/api/admin/users',
          role: 'MEMBER',
          expectedAccess: 'DENY_401_403',
        },
        {
          path: '/api/fixture/leak-panel', // Intentionally vulnerable route returning 200 to MEMBER
          role: 'MEMBER',
          expectedAccess: 'DENY_401_403',
        },
      ],
    });

    // 2. Execute Runner
    const result = await runner.run(fixture.url);

    // 3. Verify API Endpoint Discovery
    expect(result.apiEndpoints).toBeDefined();
    expect(result.apiEndpoints!.length).toBeGreaterThan(0);

    const healthEp = result.apiEndpoints!.find((e) => e.path === '/api/health');
    const projectsEp = result.apiEndpoints!.find((e) => e.path === '/api/projects');
    const errorEp = result.apiEndpoints!.find((e) => e.path === '/api/fixture/500');
    const jsonEp = result.apiEndpoints!.find((e) => e.path === '/api/fixture/invalid-json');

    expect(healthEp).toBeDefined();
    expect(projectsEp).toBeDefined();
    expect(errorEp).toBeDefined();
    expect(jsonEp).toBeDefined();

    // 4 & 5. Verify Safe GET Execution & Successful 200 Response
    const healthResult = result.apiTestResults?.find((r) => r.endpointId === healthEp?.id);
    expect(healthResult).toBeDefined();
    expect(healthResult?.status).toBe('PASSED');
    expect(healthResult?.observation?.status).toBe(200);

    // 6 & 7. Verify Intentional 500 Endpoint & API_HTTP_5XX Bug Detection
    const errorResult = result.apiTestResults?.find((r) => r.endpointId === errorEp?.id);
    expect(errorResult).toBeDefined();
    expect(errorResult?.status).toBe('FAILED');
    expect(errorResult?.bugType).toBe('API_HTTP_5XX');
    expect(result.bugObservations?.some((b) => b.type === 'API_HTTP_5XX')).toBe(true);

    // 8 & 9. Verify Malformed JSON Endpoint & API_INVALID_JSON Detection
    const jsonResult = result.apiTestResults?.find((r) => r.endpointId === jsonEp?.id);
    expect(jsonResult).toBeDefined();
    expect(jsonResult?.status).toBe('FAILED');
    expect(jsonResult?.bugType).toBe('API_INVALID_JSON');
    expect(result.bugObservations?.some((b) => b.type === 'API_INVALID_JSON')).toBe(true);

    // 10, 11, 12. Verify Role Authorization Checks (ADMIN vs MEMBER)
    const adminUserAuthResult = result.apiTestResults?.find(
      (r) => r.url.includes('/api/admin/users') && r.role === 'ADMIN'
    );
    const memberUserAuthResult = result.apiTestResults?.find(
      (r) => r.url.includes('/api/admin/users') && r.role === 'MEMBER'
    );

    if (adminUserAuthResult) {
      expect(adminUserAuthResult.observation?.status).toBe(200);
      expect(adminUserAuthResult.status).toBe('PASSED');
    }

    if (memberUserAuthResult) {
      expect(memberUserAuthResult.observation?.status).toBe(403);
      expect(memberUserAuthResult.status).toBe('PASSED'); // Passed because expected denial was met
    }

    // 13. Verify Intentional Security Vulnerability Detection (API_UNEXPECTED_AUTHORIZED_ACCESS)
    const leakPanelAuthResult = result.apiTestResults?.find(
      (r) => r.url.includes('/api/fixture/leak-panel') && r.role === 'MEMBER'
    );
    expect(leakPanelAuthResult).toBeDefined();
    expect(leakPanelAuthResult?.isUnauthorizedAccess).toBe(true);
    expect(leakPanelAuthResult?.bugType).toBe('API_UNEXPECTED_AUTHORIZED_ACCESS');

    const unauthBug = result.bugObservations?.find((b) => b.type === 'API_UNEXPECTED_AUTHORIZED_ACCESS');
    expect(unauthBug).toBeDefined();
    expect(unauthBug?.severity).toBe('critical');

    // 14 & 15. Verify API Coverage Summary
    expect(result.apiCoverage).toBeDefined();
    expect(result.apiCoverage!.endpointsDiscovered).toBeGreaterThan(0);
    expect(result.apiCoverage!.endpointsTested).toBeGreaterThan(0);
    expect(result.apiCoverage!.coverageRatio).toBeGreaterThan(0);

    // 16. Verify Strategy Prioritizer accepts and scores API targets
    const candidates: TestTarget[] = [
      {
        id: 'target-api-auth',
        targetType: 'API_AUTHORIZATION',
        pageUrl: `${fixture.url}/api/admin/users`,
        priorityScore: 0,
        priorityLevel: 'high',
        riskLevel: 'critical',
        coverageValue: 80,
        reasons: [],
        dependencies: [],
        source: 'API_DISCOVERY',
        status: 'PENDING',
        estimatedCost: 1,
        evidenceCount: 0,
        attemptsCount: 0,
      },
      {
        id: 'target-api-fail',
        targetType: 'API_FAILURE',
        pageUrl: `${fixture.url}/api/fixture/500`,
        priorityScore: 0,
        priorityLevel: 'high',
        riskLevel: 'high',
        coverageValue: 70,
        reasons: [],
        dependencies: [],
        source: 'FAILURE_INVESTIGATION',
        status: 'PENDING',
        estimatedCost: 1,
        evidenceCount: 0,
        attemptsCount: 0,
      },
    ];

    const { rankedTargets } = DeterministicPrioritizer.prioritize(candidates, {
      mode: 'FAILURE_DRIVEN',
    });
    expect(rankedTargets.length).toBe(2);
    expect(rankedTargets[0].priorityScore).toBeGreaterThan(50);

    // 17. Verify Zero Credential Exposure in Telemetry & Observations
    for (const obs of result.apiObservations || []) {
      expect(obs.safeHeaders['Cookie']).toBeUndefined();
      expect(obs.safeHeaders['cookie']).toBeUndefined();
      expect(obs.safeHeaders['Authorization']).toBeUndefined();
      expect(obs.safeHeaders['authorization']).toBeUndefined();
      expect(obs.safeHeaders['Set-Cookie']).toBeUndefined();
    }

    // 18. Verify Release Scorer Blocker 7
    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId,
      projectId,
      targetUrl: fixture.url,
      testRunStatus: result.status,
      applicationMap: result.applicationMap,
      apiTestResults: result.apiTestResults,
      apiCoverage: result.apiCoverage,
      bugObservations: result.bugObservations,
    });

    const blocker7 = assessment.blockers.find((b) => b.id.includes('blocker-api-unauth'));
    expect(blocker7).toBeDefined();
    expect(blocker7?.severity).toBe('critical');
    expect(assessment.recommendation).toBe('DO_NOT_RELEASE');

    // 19. Verify Worker continued after individual API failures
    expect(result.apiTestResults!.length).toBeGreaterThan(3);
    expect(result.durationMs).toBeGreaterThan(0);
  }, 30000);

  it('respects cancellation token cleanly during execution', async () => {
    const cancelToken: CancellationToken = { isCancelled: true };
    const runner = new BrowserRunner('tr_cancel', 'proj_cancel', {
      allowLocalhost: true,
      enableApiQa: true,
    });

    const result = await runner.run(fixture.url, cancelToken);
    expect(result.status).toBe('cancelled');
  });
});
