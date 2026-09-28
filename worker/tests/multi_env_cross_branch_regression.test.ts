// ==============================================================================
// Sculra Multi-Environment & Cross-Branch Regression Intelligence Test Suite
// (worker/tests/multi_env_cross_branch_regression.test.ts)
// Covers Prompt 61 Section 19 Deterministic Scenarios
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  buildEnvironmentSnapshot,
  EnvironmentComparator,
  BranchComparator,
  RegressionComparator,
  ChangeDecisionEngine,
  RegressionTargetGenerator,
  buildChangeSnapshot,
  TargetEnvironmentObservation,
  EnvironmentSnapshot,
  CampaignTaskResult,
  MAX_ENVIRONMENTS,
  MAX_BRANCH_COMPARISONS,
  MAX_REGRESSION_TARGETS,
} from '../src/change-intelligence';

describe('Multi-Environment & Cross-Branch Regression Intelligence', () => {
  const mockProjectId = 'proj-123e4567-e89b-12d3-a456-426614174000';
  const mockOrgId = 'org-123e4567-e89b-12d3-a456-426614174000';

  // ============================================================================
  // Scenario 1: Same Behavior Across Environments (SAME_BEHAVIOR)
  // ============================================================================
  it('Scenario 1: identifies SAME_BEHAVIOR when target passes identically in Staging and Production', () => {
    const stagingEnv = buildEnvironmentSnapshot({
      environmentId: 'env-staging-1',
      environmentName: 'STAGING',
      projectId: mockProjectId,
      organizationId: mockOrgId,
      targetUrl: 'https://staging.sculra.app',
      commitSha: 'a1b2c3d',
      branch: 'main',
    });

    const prodEnv = buildEnvironmentSnapshot({
      environmentId: 'env-prod-1',
      environmentName: 'PRODUCTION',
      projectId: mockProjectId,
      organizationId: mockOrgId,
      targetUrl: 'https://sculra.app',
      commitSha: 'a1b2c3d',
      branch: 'main',
    });

    const stagingObs: TargetEnvironmentObservation[] = [
      {
        targetIdentifier: '/dashboard',
        targetType: 'ROUTE',
        domain: 'FUNCTIONAL',
        environmentId: stagingEnv.environmentId,
        environmentName: stagingEnv.environmentName,
        environmentType: stagingEnv.environmentType,
        status: 'PASSED',
        findingsCount: 0,
        observationsCount: 0,
        durationMs: 450,
      },
    ];

    const prodObs: TargetEnvironmentObservation[] = [
      {
        targetIdentifier: '/dashboard',
        targetType: 'ROUTE',
        domain: 'FUNCTIONAL',
        environmentId: prodEnv.environmentId,
        environmentName: prodEnv.environmentName,
        environmentType: prodEnv.environmentType,
        status: 'PASSED',
        findingsCount: 0,
        observationsCount: 0,
        durationMs: 430,
      },
    ];

    const result = EnvironmentComparator.compare({
      baseEnvironment: stagingEnv,
      targetEnvironment: prodEnv,
      baseObservations: stagingObs,
      targetObservations: prodObs,
    });

    expect(result.totalTargetsCompared).toBe(1);
    expect(result.sameBehaviorCount).toBe(1);
    expect(result.environmentSpecificFailuresCount).toBe(0);
    expect(result.targets[0].classification).toBe('SAME_BEHAVIOR');
  });

  // ============================================================================
  // Scenario 2: Staging Pass / Production Failure (ENVIRONMENT_SPECIFIC_FAILURE)
  // ============================================================================
  it('Scenario 2: flags ENVIRONMENT_SPECIFIC_FAILURE when staging passed but production fails', () => {
    const stagingEnv = buildEnvironmentSnapshot({
      environmentId: 'env-staging-2',
      environmentName: 'STAGING',
      projectId: mockProjectId,
      organizationId: mockOrgId,
      targetUrl: 'https://staging.sculra.app',
      commitSha: 'commit123',
    });

    const prodEnv = buildEnvironmentSnapshot({
      environmentId: 'env-prod-2',
      environmentName: 'PRODUCTION',
      projectId: mockProjectId,
      organizationId: mockOrgId,
      targetUrl: 'https://sculra.app',
      commitSha: 'commit123',
    });

    const stagingObs: TargetEnvironmentObservation[] = [
      {
        targetIdentifier: '/api/v1/billing',
        targetType: 'API',
        domain: 'API',
        environmentId: stagingEnv.environmentId,
        environmentName: stagingEnv.environmentName,
        environmentType: stagingEnv.environmentType,
        status: 'PASSED',
        findingsCount: 0,
        observationsCount: 0,
      },
    ];

    const prodObs: TargetEnvironmentObservation[] = [
      {
        targetIdentifier: '/api/v1/billing',
        targetType: 'API',
        domain: 'API',
        environmentId: prodEnv.environmentId,
        environmentName: prodEnv.environmentName,
        environmentType: prodEnv.environmentType,
        status: 'FAILED',
        findingsCount: 1,
        observationsCount: 1,
        error: 'HTTP 500: Database connection timeout in production cluster',
      },
    ];

    const result = EnvironmentComparator.compare({
      baseEnvironment: stagingEnv,
      targetEnvironment: prodEnv,
      baseObservations: stagingObs,
      targetObservations: prodObs,
    });

    expect(result.totalTargetsCompared).toBe(1);
    expect(result.environmentSpecificFailuresCount).toBe(1);
    expect(result.targets[0].classification).toBe('ENVIRONMENT_SPECIFIC_FAILURE');
    expect(result.targets[0].reason).toContain('failed in PRODUCTION');
  });

  // ============================================================================
  // Scenario 3: Feature Branch Introduces Regression (REGRESSION)
  // ============================================================================
  it('Scenario 3: detects REGRESSION introduced on a feature branch compared to baseline', () => {
    const taskResults: CampaignTaskResult[] = [
      {
        taskId: 't-1',
        target: { identifier: '/checkout', type: 'ROUTE' } as any,
        domain: 'FUNCTIONAL',
        status: 'FAILED',
        findings: [{ id: 'f-1', severity: 'high', title: 'Payment button unresponsive' }],
        evidence: [],
        observations: [],
        durationMs: 600,
      },
    ];

    const baselineRun = {
      id: 'run-main-baseline',
      status: 'passed',
      testResults: [
        {
          id: 'prev-t-1',
          targetIdentifier: '/checkout',
          targetType: 'ROUTE',
          domain: 'FUNCTIONAL',
          status: 'passed',
        },
      ],
    };

    const snapshot = buildChangeSnapshot({
      commitSha: 'feat456',
      baseSha: 'main123',
      branch: 'feature/checkout-revamp',
      files: [
        {
          filename: 'src/checkout/index.tsx',
          status: 'modified',
          additions: 45,
          deletions: 12,
          patch: '+ const handlePay = () => throw new Error();',
        },
      ],
      diffText: 'diff --git a/src/checkout/index.tsx b/src/checkout/index.tsx',
    });

    const regComp = RegressionComparator.compare({
      currentRunId: 'run-feat',
      baselineRun: baselineRun as any,
      taskResults,
      snapshot,
      baseBranch: 'main',
      headBranch: 'feature/checkout-revamp',
      baseCommit: 'main123',
      headCommit: 'feat456',
    });

    expect(regComp.regressionsCount).toBe(1);
    expect(regComp.targets[0].classification).toBe('REGRESSION');
    expect(regComp.targets[0].isAffectedByChange).toBe(true);

    // Cross-Branch summary verification
    const branchComp = BranchComparator.compare({
      baseBranch: 'main',
      headBranch: 'feature/checkout-revamp',
      snapshot,
      regressionComparison: regComp,
    });

    expect(branchComp.regressionsCount).toBe(1);
    expect(branchComp.changedFilesCount).toBe(1);
    expect(branchComp.baseBranch).toBe('main');
    expect(branchComp.headBranch).toBe('feature/checkout-revamp');
  });

  // ============================================================================
  // Scenario 4: Feature Branch Fixes Previous Failure (RECOVERED)
  // ============================================================================
  it('Scenario 4: detects RECOVERED when feature branch fixes a previous failure', () => {
    const taskResults: CampaignTaskResult[] = [
      {
        taskId: 't-2',
        target: { identifier: '/login', type: 'ROUTE' } as any,
        domain: 'FUNCTIONAL',
        status: 'PASSED',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: 320,
      },
    ];

    const baselineRun = {
      id: 'run-main-old',
      status: 'failed',
      testResults: [
        {
          id: 'prev-t-2',
          targetIdentifier: '/login',
          targetType: 'ROUTE',
          domain: 'FUNCTIONAL',
          status: 'failed',
        },
      ],
    };

    const regComp = RegressionComparator.compare({
      currentRunId: 'run-fix',
      baselineRun: baselineRun as any,
      taskResults,
      baseBranch: 'main',
      headBranch: 'fix/login-csrf',
    });

    expect(regComp.recoveriesCount).toBe(1);
    expect(regComp.regressionsCount).toBe(0);
    expect(regComp.targets[0].classification).toBe('RECOVERED');
  });

  // ============================================================================
  // Scenario 5: Configuration Drift (CONFIGURATION_DRIFT)
  // ============================================================================
  it('Scenario 5: detects CONFIGURATION_DRIFT when non-secret environment configs diverge', () => {
    const stagingEnv = buildEnvironmentSnapshot({
      environmentId: 'env-staging-5',
      environmentName: 'STAGING',
      projectId: mockProjectId,
      organizationId: mockOrgId,
      targetUrl: 'https://staging.sculra.app',
      metadata: {
        FEATURE_NEW_PRICING: true,
        MAX_PAYLOAD_MB: 10,
      },
    });

    const prodEnv = buildEnvironmentSnapshot({
      environmentId: 'env-prod-5',
      environmentName: 'PRODUCTION',
      projectId: mockProjectId,
      organizationId: mockOrgId,
      targetUrl: 'https://sculra.app',
      metadata: {
        FEATURE_NEW_PRICING: false,
        MAX_PAYLOAD_MB: 10,
      },
    });

    const result = EnvironmentComparator.compare({
      baseEnvironment: stagingEnv,
      targetEnvironment: prodEnv,
      baseObservations: [],
      targetObservations: [],
    });

    expect(result.driftDetected).toBe(true);
    expect(result.driftTypes).toContain('CONFIGURATION_DRIFT');
    expect(result.configurationDriftCount).toBe(1);
  });

  // ============================================================================
  // Scenario 6: Version & Deployment Drift (VERSION_DRIFT & DEPLOYMENT_DRIFT)
  // ============================================================================
  it('Scenario 6: detects VERSION_DRIFT and DEPLOYMENT_DRIFT when commit and deployment IDs differ', () => {
    const stagingEnv = buildEnvironmentSnapshot({
      environmentId: 'env-staging-6',
      environmentName: 'STAGING',
      projectId: mockProjectId,
      organizationId: mockOrgId,
      targetUrl: 'https://staging.sculra.app',
      commitSha: 'commit-staging-aaa111',
      deploymentId: 'deploy-staging-101',
    });

    const prodEnv = buildEnvironmentSnapshot({
      environmentId: 'env-prod-6',
      environmentName: 'PRODUCTION',
      projectId: mockProjectId,
      organizationId: mockOrgId,
      targetUrl: 'https://sculra.app',
      commitSha: 'commit-prod-bbb222',
      deploymentId: 'deploy-prod-202',
    });

    const result = EnvironmentComparator.compare({
      baseEnvironment: stagingEnv,
      targetEnvironment: prodEnv,
      baseObservations: [],
      targetObservations: [],
    });

    expect(result.driftDetected).toBe(true);
    expect(result.driftTypes).toContain('VERSION_DRIFT');
    expect(result.driftTypes).toContain('DEPLOYMENT_DRIFT');
    expect(result.versionDriftCount).toBe(1);
    expect(result.deploymentDriftCount).toBe(1);
  });

  // ============================================================================
  // Scenario 7: Critical Workflow Cannot Be Skipped (CRITICAL_WORKFLOW_OVERRIDE)
  // ============================================================================
  it('Scenario 7: enforces CRITICAL_WORKFLOW_OVERRIDE on critical workflows even in docs changes', () => {
    const candidates = RegressionTargetGenerator.generateTargets({
      snapshot: buildChangeSnapshot({
        commitSha: 'docs-123',
        files: [{ filename: 'docs/README.md', status: 'modified', additions: 1, deletions: 1 }],
      }),
      criticalWorkflows: [
        {
          workflowId: 'checkout-flow',
          workflowName: 'Checkout & Payment Flow',
          criticality: 'CRITICAL',
          entryRoute: '/checkout',
        },
      ],
      environment: buildEnvironmentSnapshot({
        environmentId: 'env-staging-7',
        environmentName: 'STAGING',
        projectId: mockProjectId,
        targetUrl: 'https://staging.sculra.app',
      }),
    });

    const criticalCandidate = candidates.find((c) => c.targetIdentifier === '/checkout');
    expect(criticalCandidate).toBeDefined();

    const decisions = ChangeDecisionEngine.evaluate({
      candidates,
      isDocsOnly: true,
      hasHistoricalRegressions: false,
    });

    const checkoutDecision = decisions.find((d) => d.targetIdentifier === '/checkout');
    expect(checkoutDecision).toBeDefined();
    expect(checkoutDecision?.decision).toBe('TEST');
    expect(checkoutDecision?.criticalOverride).toBe(true);
    expect(checkoutDecision?.reason).toContain('CRITICAL_WORKFLOW_OVERRIDE');
  });

  // ============================================================================
  // Scenario 8: Safe Test Reuse Contract (REUSE vs RERUN)
  // ============================================================================
  it('Scenario 8: permits REUSE only for untouched passed targets in identical environment, else RERUN', () => {
    const envStaging = buildEnvironmentSnapshot({
      environmentId: 'env-staging-8',
      environmentName: 'STAGING',
      projectId: mockProjectId,
      targetUrl: 'https://staging.sculra.app',
    });

    const previousRun = {
      id: 'prev-run-8',
      status: 'passed',
      environment: 'STAGING',
      testResults: [
        {
          targetIdentifier: '/about-us',
          targetType: 'ROUTE',
          domain: 'FUNCTIONAL',
          status: 'passed',
        },
        {
          targetIdentifier: '/cart',
          targetType: 'ROUTE',
          domain: 'FUNCTIONAL',
          status: 'failed',
        },
      ],
    };

    const candidates = [
      {
        id: 'cand-1',
        source: 'RECOVERED_REGRESSION' as const,
        targetId: 't-about',
        targetType: 'ROUTE' as const,
        targetIdentifier: '/about-us',
        domain: 'FUNCTIONAL',
        businessCriticality: 'LOW' as const,
        priority: 20,
        reason: 'Untouched about page',
      },
      {
        id: 'cand-2',
        source: 'DIRECT_WORKFLOW' as const,
        targetId: 't-cart',
        targetType: 'ROUTE' as const,
        targetIdentifier: '/cart',
        domain: 'FUNCTIONAL',
        businessCriticality: 'HIGH' as const,
        priority: 80,
        reason: 'Directly touched cart component',
      },
    ];

    const decisions = ChangeDecisionEngine.evaluate({
      candidates: candidates as any,
      environment: envStaging,
      previousRun: previousRun as any,
    });

    const aboutDecision = decisions.find((d) => d.targetIdentifier === '/about-us');
    expect(aboutDecision?.reuseClassification).toBe('REUSE');
    expect(aboutDecision?.reuseJustification).toContain('prev-run-8');

    const cartDecision = decisions.find((d) => d.targetIdentifier === '/cart');
    expect(cartDecision?.reuseClassification).toBe('RERUN');
  });

  // ============================================================================
  // Scenario 9: Insufficient Evidence Handling (Zero Inference of Commits)
  // ============================================================================
  it('Scenario 9: records missing commit/branch as null/undefined and never infers from name', () => {
    const env = buildEnvironmentSnapshot({
      environmentId: 'env-prod-9',
      environmentName: 'prod-release-v2.1', // Name looks like a version, but must NOT infer commit
      projectId: mockProjectId,
      targetUrl: 'https://sculra.app',
    });

    expect(env.commitSha).toBeNull();
    expect(env.branch).toBeNull();
    expect(env.environmentType).toBe('PRODUCTION');
  });

  // ============================================================================
  // Scenario 10: Multi-Tenant Isolation & Secret Redaction
  // ============================================================================
  it('Scenario 10: automatically redacts secrets and credentials from environment metadata', () => {
    const env = buildEnvironmentSnapshot({
      environmentId: 'env-staging-10',
      environmentName: 'STAGING',
      projectId: mockProjectId,
      organizationId: mockOrgId,
      targetUrl: 'https://staging.sculra.app',
      metadata: {
        DB_HOST: 'postgres.internal',
        API_TOKEN: 'sec_1234567890abcdef',
        STRIPE_SECRET_KEY: 'sk_live_abcdef123456',
        BEARER_AUTH: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDNxdgqWBM6qQO6Mg8V0oKGd8kBCTWSTft0vWpktg',
        CLIENT_ID: 'client_sculra_public',
      },
    });

    expect(env.metadata.DB_HOST).toBe('postgres.internal');
    expect(env.metadata.CLIENT_ID).toBe('client_sculra_public');
    expect(env.metadata.API_TOKEN).toBe('[REDACTED]');
    expect(env.metadata.STRIPE_SECRET_KEY).toBe('[REDACTED]');
    expect(env.metadata.BEARER_AUTH).toBe('[REDACTED]');
  });

  // ============================================================================
  // Scenario 11: Performance Bounds & Safe Limits
  // ============================================================================
  it('Scenario 11: honors Prompt 61 performance bounds and policies', () => {
    expect(MAX_ENVIRONMENTS).toBe(20);
    expect(MAX_BRANCH_COMPARISONS).toBe(10);
    expect(MAX_REGRESSION_TARGETS).toBe(200);
  });
});
