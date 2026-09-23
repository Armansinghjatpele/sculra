// ==============================================================================
// Sculra Release Orchestration & Environment QA — Deterministic Fixtures (A-Z)
// (worker/tests/release_fixtures.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  ReleaseGatesEvaluator,
  ReleaseCorrelator,
  ReleaseOrchestrator,
  EnvironmentValidator,
  EnvironmentManager,
  DeploymentDetector,
  DeploymentManager,
  ReleaseManager,
  ReleaseEvidenceCollector,
  DeterministicReleaseScorer,
  ProjectEnvironment,
  DeploymentRecord,
  ReleaseRecord,
  ReleaseGateKey,
} from '../src/release';
import { PolicyManager, RoleNotAllowedError } from '../src/authz/policy';

describe('Prompt 38: Release Orchestration & Environment Management — Fixtures (A through Z)', () => {
  const dummyEnv: ProjectEnvironment = {
    id: 'env-prod',
    organizationId: 'org-1',
    projectId: 'proj-1',
    name: 'Production',
    slug: 'production',
    type: 'PRODUCTION',
    baseUrl: 'https://app.sculra.com',
    status: 'ACTIVE',
    isProduction: true,
    healthStatus: 'HEALTHY',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const dummyRelease: ReleaseRecord = {
    id: 'rel-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    environmentId: 'env-prod',
    version: 'v1.0.0',
    commitSha: 'a1b2c3d4e5f6',
    status: 'READY',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // --------------------------------------------------------------------------
  // Fixture A: Clean release, all 10 gates pass
  // --------------------------------------------------------------------------
  it('Fixture A: Clean release — All 10 gates pass with clean evidence', () => {
    const evidence = {
      openIssues: [],
      testRuns: [
        { id: 'run-1', status: 'PASSED', overall_score: 95 },
        { id: 'run-2', status: 'PASSED', overall_score: 98 },
        { id: 'run-3', status: 'PASSED', overall_score: 92 },
      ],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    expect(evaluation.overallDecision).toBe('RELEASE');
    expect(evaluation.gates).toHaveLength(10);
    expect(evaluation.gates.every((g) => g.status === 'PASS')).toBe(true);
    expect(evaluation.summary.blockersCount).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Fixture B: Critical open issue triggers CRITICAL_ISSUES gate failure
  // --------------------------------------------------------------------------
  it('Fixture B: Critical open issue triggers CRITICAL_ISSUES gate failure', () => {
    const evidence = {
      openIssues: [
        { id: 'iss-crit-1', severity: 'CRITICAL', status: 'OPEN', title: 'Data corruption on save' },
      ],
      testRuns: [{ id: 'run-1', status: 'PASSED' }, { id: 'run-2', status: 'PASSED' }],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'CRITICAL_ISSUES');
    expect(gate).toBeDefined();
    expect(gate?.status).toBe('FAIL');
    expect(evaluation.overallDecision).toBe('BLOCK');
    expect(evaluation.summary.blockersCount).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // Fixture C: Regression detected triggers REGRESSIONS gate failure
  // --------------------------------------------------------------------------
  it('Fixture C: Regression detected triggers REGRESSIONS gate failure', () => {
    const baselineIssues = [
      { id: 'iss-old-1', title: 'Auth timeout', status: 'RESOLVED', category: 'SECURITY', locator: '/login', fingerprint: 'fp-login-1' },
    ];
    const candidateIssues = [
      { id: 'iss-reg-1', title: 'Checkout runtime error', status: 'OPEN', category: 'FUNCTIONAL', locator: '/checkout', fingerprint: 'fp-checkout-1' },
    ];

    const correlation = ReleaseCorrelator.correlateReleases(
      dummyRelease,
      { ...dummyRelease, id: 'rel-0', version: 'v0.9.0' },
      dummyEnv,
      dummyEnv,
      candidateIssues,
      baselineIssues
    );

    expect(correlation.compatible).toBe(true);
    expect(correlation.summary.newRegressions).toBe(1);

    const evidence = {
      openIssues: candidateIssues,
      regressions: correlation.correlations.filter((c) => c.classification === 'NEW_REGRESSION'),
      testRuns: [{ id: 'run-1', status: 'PASSED' }, { id: 'run-2', status: 'PASSED' }],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'REGRESSIONS');
    expect(gate?.status).toBe('FAIL');
    expect(evaluation.overallDecision).toBe('BLOCK');
  });

  // --------------------------------------------------------------------------
  // Fixture D: High severity security issue triggers SECURITY gate failure
  // --------------------------------------------------------------------------
  it('Fixture D: High severity security issue triggers SECURITY gate failure', () => {
    const evidence = {
      openIssues: [
        { id: 'iss-sec-1', severity: 'HIGH', category: 'SECURITY', status: 'OPEN', title: 'CORS wildcard on /api/user' },
      ],
      testRuns: [{ id: 'run-1', status: 'PASSED' }, { id: 'run-2', status: 'PASSED' }],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'SECURITY');
    expect(gate?.status).toBe('FAIL');
    expect(evaluation.overallDecision).toBe('BLOCK');
  });

  // --------------------------------------------------------------------------
  // Fixture E: Accessibility violation triggers ACCESSIBILITY gate warning
  // --------------------------------------------------------------------------
  it('Fixture E: Accessibility violation triggers ACCESSIBILITY gate warning', () => {
    const evidence = {
      openIssues: [
        { id: 'iss-a11y-1', severity: 'MEDIUM', category: 'ACCESSIBILITY', status: 'OPEN', title: 'Button missing aria-label' },
      ],
      testRuns: [{ id: 'run-1', status: 'PASSED' }, { id: 'run-2', status: 'PASSED' }],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'ACCESSIBILITY');
    expect(gate?.status).toBe('WARN');
    expect(evaluation.overallDecision).toBe('WARN');
  });

  // --------------------------------------------------------------------------
  // Fixture F: Performance degradation triggers PERFORMANCE gate warning
  // --------------------------------------------------------------------------
  it('Fixture F: Performance degradation triggers PERFORMANCE gate warning', () => {
    const evidence = {
      openIssues: [
        { id: 'iss-perf-1', severity: 'MEDIUM', category: 'PERFORMANCE', status: 'OPEN', title: 'LCP 4200ms exceeds budget' },
      ],
      testRuns: [{ id: 'run-1', status: 'PASSED' }, { id: 'run-2', status: 'PASSED' }],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'PERFORMANCE');
    expect(gate?.status).toBe('WARN');
  });

  // --------------------------------------------------------------------------
  // Fixture G: Visual difference triggers VISUAL gate warning
  // --------------------------------------------------------------------------
  it('Fixture G: Visual difference triggers VISUAL gate warning', () => {
    const evidence = {
      openIssues: [
        { id: 'iss-vis-1', severity: 'LOW', category: 'VISUAL', status: 'OPEN', title: 'Navbar padding shifted 4px' },
      ],
      testRuns: [{ id: 'run-1', status: 'PASSED' }, { id: 'run-2', status: 'PASSED' }],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'VISUAL');
    expect(gate?.status).toBe('WARN');
  });

  // --------------------------------------------------------------------------
  // Fixture H: Broken API contract triggers API gate failure
  // --------------------------------------------------------------------------
  it('Fixture H: Broken API contract triggers API gate failure', () => {
    const evidence = {
      openIssues: [
        { id: 'iss-api-1', severity: 'HIGH', category: 'API', status: 'OPEN', title: 'POST /checkout schema mismatch 422' },
      ],
      testRuns: [{ id: 'run-1', status: 'PASSED' }, { id: 'run-2', status: 'PASSED' }],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'API');
    expect(gate?.status).toBe('FAIL');
    expect(evaluation.overallDecision).toBe('BLOCK');
  });

  // --------------------------------------------------------------------------
  // Fixture I: Functional test failure triggers FUNCTIONAL gate warning/failure
  // --------------------------------------------------------------------------
  it('Fixture I: Functional test failure triggers FUNCTIONAL gate warning', () => {
    const evidence = {
      openIssues: [],
      testRuns: [
        { id: 'run-1', status: 'FAILED', overall_score: 40 },
        { id: 'run-2', status: 'PASSED', overall_score: 95 },
      ],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'FUNCTIONAL');
    expect(gate?.status).toBe('WARN');
  });

  // --------------------------------------------------------------------------
  // Fixture J: Flaky/unreliable tests trigger RELIABILITY gate warning
  // --------------------------------------------------------------------------
  it('Fixture J: Unreliable test runs trigger RELIABILITY gate warning', () => {
    const evidence = {
      openIssues: [],
      testRuns: [
        { id: 'run-1', status: 'FAILED' },
        { id: 'run-2', status: 'PASSED' },
      ],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'RELIABILITY');
    expect(gate?.status).toBe('WARN');
  });

  // --------------------------------------------------------------------------
  // Fixture K: Insufficient test evidence triggers EVIDENCE_COMPLETENESS gate failure
  // --------------------------------------------------------------------------
  it('Fixture K: Insufficient test evidence triggers EVIDENCE_COMPLETENESS gate failure', () => {
    const evidence = {
      openIssues: [],
      testRuns: [], // zero runs
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STANDARD');
    const gate = evaluation.gates.find((g) => g.gate === 'EVIDENCE_COMPLETENESS');
    expect(gate?.status).toBe('FAIL');
    expect(evaluation.overallDecision).toBe('INSUFFICIENT_EVIDENCE');
  });

  // --------------------------------------------------------------------------
  // Fixture L: Zero fake pass: missing metrics never default to PASS
  // --------------------------------------------------------------------------
  it('Fixture L: Zero fake pass — gates without evidence are NOT_MEASURED, never PASS', () => {
    const unmeasuredGate = ReleaseGatesEvaluator.evaluateUnmeasuredGate(
      'ACCESSIBILITY',
      'Accessibility audit has not been executed'
    );

    expect(unmeasuredGate.status).toBe('NOT_MEASURED');
    expect(unmeasuredGate.metricValue).toBeUndefined();
    expect(unmeasuredGate.status).not.toBe('PASS');
  });

  // --------------------------------------------------------------------------
  // Fixture M: Permissive policy level permits release with warnings
  // --------------------------------------------------------------------------
  it('Fixture M: Permissive policy level permits release with warnings', () => {
    const evidence = {
      openIssues: [
        { id: 'iss-a11y-1', severity: 'LOW', category: 'ACCESSIBILITY', status: 'OPEN' },
      ],
      testRuns: [{ id: 'run-1', status: 'PASSED' }],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'PERMISSIVE');
    expect(evaluation.overallDecision).toBe('WARN');
  });

  // --------------------------------------------------------------------------
  // Fixture N: Strict policy level blocks release with any warning
  // --------------------------------------------------------------------------
  it('Fixture N: Strict policy level blocks release when warnings exist', () => {
    const evidence = {
      openIssues: [
        { id: 'iss-perf-1', severity: 'MEDIUM', category: 'PERFORMANCE', status: 'OPEN' },
      ],
      testRuns: [
        { id: 'run-1', status: 'PASSED' },
        { id: 'run-2', status: 'PASSED' },
        { id: 'run-3', status: 'PASSED' },
        { id: 'run-4', status: 'PASSED' },
        { id: 'run-5', status: 'PASSED' },
      ],
      historicalRuns: [],
    };

    const evaluation = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidence, 'STRICT');
    expect(evaluation.overallDecision).toBe('BLOCK');
  });

  // --------------------------------------------------------------------------
  // Fixture O: Standard policy level allows warnings but blocks on critical issues
  // --------------------------------------------------------------------------
  it('Fixture O: Standard policy level allows warnings but blocks on critical issues', () => {
    const evidenceWithWarning = {
      openIssues: [{ id: 'iss-1', severity: 'LOW', category: 'VISUAL', status: 'OPEN' }],
      testRuns: [{ id: 'run-1', status: 'PASSED' }, { id: 'run-2', status: 'PASSED' }],
      historicalRuns: [],
    };
    const evalWarn = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidenceWithWarning, 'STANDARD');
    expect(evalWarn.overallDecision).toBe('WARN');

    const evidenceWithBlocker = {
      openIssues: [{ id: 'iss-2', severity: 'CRITICAL', status: 'OPEN' }],
      testRuns: [{ id: 'run-1', status: 'PASSED' }, { id: 'run-2', status: 'PASSED' }],
      historicalRuns: [],
    };
    const evalBlock = ReleaseGatesEvaluator.evaluateGates(dummyRelease, evidenceWithBlocker, 'STANDARD');
    expect(evalBlock.overallDecision).toBe('BLOCK');
  });

  // --------------------------------------------------------------------------
  // Fixture P: SSRF attempt: loopback/localhost blocked
  // --------------------------------------------------------------------------
  it('Fixture P: SSRF defense blocks loopback localhost addresses', async () => {
    const resLocalhost = await EnvironmentValidator.validateEnvironmentUrl('http://localhost:3000');
    expect(resLocalhost.valid).toBe(false);
    expect(resLocalhost.error).toContain('SSRF');

    const res127 = await EnvironmentValidator.validateEnvironmentUrl('http://127.0.0.1:8080');
    expect(res127.valid).toBe(false);
    expect(res127.error).toContain('SSRF');
  });

  // --------------------------------------------------------------------------
  // Fixture Q: SSRF attempt: private RFC 1918 IPv4 blocked
  // --------------------------------------------------------------------------
  it('Fixture Q: SSRF defense blocks private RFC 1918 subnets', async () => {
    const res10 = await EnvironmentValidator.validateEnvironmentUrl('http://10.0.1.5:8000');
    expect(res10.valid).toBe(false);

    const res192 = await EnvironmentValidator.validateEnvironmentUrl('https://192.168.1.1/api');
    expect(res192.valid).toBe(false);

    const res172 = await EnvironmentValidator.validateEnvironmentUrl('http://172.16.0.10:9000');
    expect(res172.valid).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Fixture R: SSRF attempt: cloud metadata 169.254.169.254 blocked
  // --------------------------------------------------------------------------
  it('Fixture R: SSRF defense blocks AWS/cloud metadata address 169.254.169.254', async () => {
    const resMeta = await EnvironmentValidator.validateEnvironmentUrl('http://169.254.169.254/latest/meta-data/');
    expect(resMeta.valid).toBe(false);
    expect(resMeta.error).toContain('SSRF');
  });

  // --------------------------------------------------------------------------
  // Fixture S: SSRF attempt: IPv6 loopback blocked
  // --------------------------------------------------------------------------
  it('Fixture S: SSRF defense blocks IPv6 loopback addresses', async () => {
    const resIpv6 = await EnvironmentValidator.validateEnvironmentUrl('http://[::1]:8080');
    expect(resIpv6.valid).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Fixture T: Production environment mutation blocked for DEVELOPER role
  // --------------------------------------------------------------------------
  it('Fixture T: Production environment mutation blocked for DEVELOPER role', () => {
    expect(() => {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: 'DEVELOPER',
        isProduction: true,
        action: 'UPDATE',
      });
    }).toThrow(RoleNotAllowedError);
  });

  // --------------------------------------------------------------------------
  // Fixture U: Production environment mutation allowed for OWNER/ADMIN role
  // --------------------------------------------------------------------------
  it('Fixture U: Production environment mutation permitted for OWNER and ADMIN roles', () => {
    expect(() => {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: 'OWNER',
        isProduction: true,
        action: 'UPDATE',
      });
    }).not.toThrow();

    expect(() => {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: 'ADMIN',
        isProduction: true,
        action: 'CREATE',
      });
    }).not.toThrow();
  });

  // --------------------------------------------------------------------------
  // Fixture V: Code change detected without deployment confirmation keeps status UNKNOWN
  // --------------------------------------------------------------------------
  it('Fixture V: Code change detected without deployment confirmation leaves status UNKNOWN', () => {
    const result = DeploymentDetector.detectDeploymentState({
      commitSha: 'c8d9e0f1',
      branch: 'main',
      deploymentRecord: undefined, // no confirmed deployment
    });

    expect(result.eventType).toBe('CODE_CHANGE_DETECTED');
    expect(result.deploymentConfirmed).toBe(false);
    expect(result.status).toBe('UNKNOWN');
    expect(result.summary).toContain('Deployment not confirmed');
  });

  // --------------------------------------------------------------------------
  // Fixture W: Confirmed deployment transitions status to SUCCEEDED
  // --------------------------------------------------------------------------
  it('Fixture W: Confirmed deployment transitions status to SUCCEEDED', () => {
    const deploymentRecord: DeploymentRecord = {
      id: 'dep-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      environmentId: 'env-prod',
      commitSha: 'c8d9e0f1',
      status: 'SUCCEEDED',
      provider: 'GITHUB',
      trigger: 'GITHUB_PUSH',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = DeploymentDetector.detectDeploymentState({
      commitSha: 'c8d9e0f1',
      branch: 'main',
      deploymentRecord,
    });

    expect(result.eventType).toBe('DEPLOYMENT_CONFIRMED');
    expect(result.deploymentConfirmed).toBe(true);
    expect(result.status).toBe('SUCCEEDED');
  });

  // --------------------------------------------------------------------------
  // Fixture X: Cross-environment correlation: compatible environments compared, incompatible isolated
  // --------------------------------------------------------------------------
  it('Fixture X: Cross-environment correlation checks compatibility', () => {
    const prodEnv: ProjectEnvironment = { ...dummyEnv, id: 'env-prod', type: 'PRODUCTION' };
    const stagingEnv: ProjectEnvironment = { ...dummyEnv, id: 'env-stg', type: 'STAGING' };
    const previewEnv: ProjectEnvironment = { ...dummyEnv, id: 'env-pr-1', type: 'PREVIEW' };

    // Staging to Prod: compatible staging pipeline
    const stgToProd = ReleaseCorrelator.correlateReleases(
      dummyRelease,
      { ...dummyRelease, environmentId: 'env-stg' },
      prodEnv,
      stagingEnv,
      [],
      []
    );
    expect(stgToProd.compatible).toBe(true);

    // Ephemeral PR preview compared directly against production: incompatible
    const previewToProd = ReleaseCorrelator.correlateReleases(
      dummyRelease,
      { ...dummyRelease, environmentId: 'env-pr-1' },
      prodEnv,
      previewEnv,
      [],
      []
    );
    expect(previewToProd.compatible).toBe(false);
    expect(previewToProd.summary.incompatibilityReason).toContain('Incompatible environments');
  });

  // --------------------------------------------------------------------------
  // Fixture Y: Anti-causation safeguard: cannot blame current commit for pre-existing issues
  // --------------------------------------------------------------------------
  it('Fixture Y: Anti-causation safeguard correctly classifies pre-existing issues as RECURRING', () => {
    const baselineIssues = [
      { id: 'iss-old-1', locator: '/billing', title: 'Slow query on billing index', status: 'OPEN' },
    ];
    const candidateIssues = [
      { id: 'iss-new-1', locator: '/billing', title: 'Slow query on billing index', status: 'OPEN' },
    ];

    const correlation = ReleaseCorrelator.correlateReleases(
      dummyRelease,
      { ...dummyRelease, id: 'rel-0' },
      dummyEnv,
      dummyEnv,
      candidateIssues,
      baselineIssues
    );

    const match = correlation.correlations.find((c) => c.issueId === 'iss-new-1');
    expect(match?.classification).toBe('RECURRING');
    expect(match?.causedByCommit).toBe(false);
    expect(match?.explanation).toContain('pre-existed');
  });

  // --------------------------------------------------------------------------
  // Fixture Z: Authoritative reuse of DeterministicReleaseScorer
  // --------------------------------------------------------------------------
  it('Fixture Z: Authoritative reuse of DeterministicReleaseScorer guarantees unified score', () => {
    // Compute via authoritative scorer directly
    const directAssessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-1',
      projectId: 'proj-1',
      targetUrl: 'https://demo.sculra.com',
      journeyResults: [
        {
          id: 'j-1',
          name: 'Critical Checkout Journey',
          status: 'passed',
          durationMs: 1200,
          steps: [],
        },
      ],
      bugObservations: [],
    });

    expect(directAssessment.overallScore).toBeGreaterThan(0);
    expect(directAssessment.recommendation).toBeDefined();
    expect(['RELEASE', 'RELEASE_WITH_CAUTION']).toContain(directAssessment.recommendation);
    expect(directAssessment.scores).toBeDefined();
    expect(directAssessment.riskLevel).toBe('LOW');
  });
});
