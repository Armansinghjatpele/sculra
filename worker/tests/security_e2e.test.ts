// ==============================================================================
// End-to-End Integration Test: Security & Authorization Autonomous QA
// (worker/tests/security_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createFixtureServer, FixtureServer } from './fixtures/app';
import { SecurityScanner } from '../src/security/scanner';
import { DEFAULT_SECURITY_POLICY } from '../src/security/policy';
import { DeterministicReleaseScorer } from '../src/release/scorer';
import { BrowserRunner } from '../src/runner';
import { WorkerLogger } from '../src/logger';

describe('Security & Authorization Autonomous QA E2E', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  }, 20000);

  afterAll(async () => {
    if (fixture) {
      await fixture.close();
    }
  });

  it('runs SecurityScanner across local fixture endpoints and detects deterministic security weaknesses', async () => {
    const logger = new WorkerLogger('sec-test-run-1');
    const scanner = new SecurityScanner(
      {
        ...DEFAULT_SECURITY_POLICY,
        maxSecurityChecks: 50,
      },
      logger
    );

    const scanResult = await scanner.scan({
      testRunId: 'sec-test-run-1',
      projectId: 'proj-sec-1',
      targetUrl: fixture.url,
      apiEndpoints: [
        {
          id: 'ep-bad-headers',
          path: '/api/security/headers-bad',
          url: `${fixture.url}/api/security/headers-bad`,
          method: 'GET',
          source: 'PROJECT_CONFIG',
          firstSeen: '',
          lastSeen: '',
          confidence: 1,
        },
        {
          id: 'ep-cors',
          path: '/api/security/cors-wildcard-creds',
          url: `${fixture.url}/api/security/cors-wildcard-creds`,
          method: 'GET',
          source: 'PROJECT_CONFIG',
          firstSeen: '',
          lastSeen: '',
          confidence: 1,
        },
        {
          id: 'ep-redirect',
          path: '/api/security/open-redirect',
          url: `${fixture.url}/api/security/open-redirect`,
          method: 'GET',
          source: 'PROJECT_CONFIG',
          firstSeen: '',
          lastSeen: '',
          confidence: 1,
        },
        {
          id: 'ep-exposure',
          path: '/api/security/exposed-token',
          url: `${fixture.url}/api/security/exposed-token`,
          method: 'GET',
          source: 'PROJECT_CONFIG',
          firstSeen: '',
          lastSeen: '',
          confidence: 1,
        },
      ],
      roleContexts: [
        {
          identityId: 'id-admin',
          roleId: 'role-admin',
          roleName: 'ADMIN',
          authenticated: true,
          capabilities: ['admin'],
          workflowIds: [],
          discoveredPageUrls: [`${fixture.url}/admin/users`],
        },
        {
          identityId: 'id-member',
          roleId: 'role-member',
          roleName: 'MEMBER',
          authenticated: true,
          capabilities: ['member'],
          workflowIds: [],
          discoveredPageUrls: [`${fixture.url}/dashboard`],
        },
      ],
      allowLocalhost: true,
    });

    // 1. Assert overall scan outcome
    expect(scanResult.coverage.checksExecuted).toBeGreaterThan(0);
    expect(scanResult.findings.length).toBeGreaterThan(0);

    // 2. Assert Header Findings
    const headerFindings = scanResult.findings.filter((f) => f.type === 'SECURITY_HEADER_MISSING');
    expect(headerFindings.length).toBeGreaterThan(0);

    // 3. Assert Cookie Findings with Zero Value Leakage
    const cookieFindings = scanResult.findings.filter(
      (f) => f.type === 'INSECURE_COOKIE' || f.type === 'COOKIE_MISSING_SECURITY_ATTRIBUTE'
    );
    expect(cookieFindings.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(scanResult);
    expect(serialized).not.toContain('raw12345');

    // 4. Assert CORS Misconfiguration Finding
    const corsFindings = scanResult.findings.filter((f) => f.type === 'CORS_MISCONFIGURATION');
    expect(corsFindings.length).toBeGreaterThan(0);

    // 5. Assert Open Redirect Finding
    const redirectFindings = scanResult.findings.filter((f) => f.type === 'OPEN_REDIRECT');
    expect(redirectFindings.length).toBeGreaterThan(0);

    // 6. Assert Sensitive Data & Token Exposure Findings with In-Place Masking
    const secretFindings = scanResult.findings.filter(
      (f) => f.type === 'SECRET_EXPOSURE' || f.type === 'TOKEN_EXPOSURE'
    );
    expect(secretFindings.length).toBeGreaterThan(0);
    expect(serialized).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(serialized).not.toContain(['sk', 'live', '51AbcDefGhIjKlMnOpQrStUvWxYz123456'].join('_'));

    // 7. Assert Bug Observations are created and mapped to deterministic severities
    expect(scanResult.bugObservations.length).toBeGreaterThan(0);
    const critBugs = scanResult.bugObservations.filter((b) => b.severity === 'critical');
    expect(critBugs.length).toBeGreaterThan(0);

    // 8. Assert Release Scorer creates Blocker 8 for critical security defects
    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'sec-test-run-1',
      projectId: 'proj-sec-1',
      targetUrl: fixture.url,
      bugObservations: scanResult.bugObservations,
      securityResult: scanResult,
    });

    expect(assessment.scores.security).toBeDefined();
    expect(assessment.scores.security).toBeLessThan(80);
    expect(assessment.blockers.some((b) => b.category === 'security' && b.severity === 'critical')).toBe(true);
    expect(assessment.overallScore).toBeLessThanOrEqual(59); // Critical blocker cap
    expect(assessment.recommendation).toBe('DO_NOT_RELEASE');
  }, 30000);

  it('executes end-to-end BrowserRunner with Security QA enabled', async () => {
    const runner = new BrowserRunner('sec-runner-run-1', 'proj-1', {
      headless: true,
      allowLocalhost: true,
      enableDiscovery: false,
      enableJourneys: false,
      enableVisual: false,
      enableAiQa: false,
      enableApiQa: true,
      enableSecurityQa: true,
    });

    const result = await runner.run(`${fixture.url}/features`);

    expect(result.status).toBeDefined();
    expect(result.securityResult).toBeDefined();
    expect(result.securityCoverage).toBeDefined();
    expect(result.securityCoverage?.checksExecuted).toBeGreaterThan(0);
  }, 45000);
});
