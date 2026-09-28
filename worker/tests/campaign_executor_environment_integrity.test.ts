// ==============================================================================
// Sculra Campaign Executor Environment Evidence Integrity Tests (Prompt 61A)
// (worker/tests/campaign_executor_environment_integrity.test.ts)
// Verifies that Sculra NEVER invents environment identity when evidence is missing.
// ==============================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  buildEnvironmentSnapshot,
  inferEnvironmentType,
  EnvironmentComparator,
  BranchComparator,
  TargetEnvironmentObservation,
  EnvironmentSnapshot,
} from '../src/change-intelligence';
import { CampaignExecutor } from '../src/campaign/executor';

describe('Prompt 61A: Environment Evidence Integrity & No-Fabrication Guardrails', () => {
  const mockProjectId = 'proj-61a-0001-0002-0003-000000000001';
  const mockOrgId = 'org-61a-0001-0002-0003-000000000001';

  // ----------------------------------------------------------------------------
  // Test 1: Campaign config has no environment
  // ----------------------------------------------------------------------------
  it('Test 1: Campaign config has no environment -> id, name, and type remain null (No STAGING fallback)', () => {
    const env = buildEnvironmentSnapshot({
      projectId: mockProjectId,
      targetUrl: 'https://app.example.com',
    });

    expect(env.environmentId).toBeNull();
    expect(env.environmentName).toBeNull();
    expect(env.environmentType).toBeNull();
  });

  // ----------------------------------------------------------------------------
  // Test 2: Campaign config explicitly specifies STAGING
  // ----------------------------------------------------------------------------
  it('Test 2: Campaign config explicitly specifies STAGING -> STAGING preserved', () => {
    const env = buildEnvironmentSnapshot({
      environmentId: 'env-stg-explicit',
      environmentName: 'STAGING',
      environmentType: 'STAGING',
      projectId: mockProjectId,
      targetUrl: 'https://staging.example.com',
    });

    expect(env.environmentId).toBe('env-stg-explicit');
    expect(env.environmentName).toBe('STAGING');
    expect(env.environmentType).toBe('STAGING');
  });

  // ----------------------------------------------------------------------------
  // Test 3: Campaign config explicitly specifies PRODUCTION
  // ----------------------------------------------------------------------------
  it('Test 3: Campaign config explicitly specifies PRODUCTION -> PRODUCTION preserved', () => {
    const env = buildEnvironmentSnapshot({
      environmentId: 'env-prod-explicit',
      environmentName: 'PRODUCTION',
      environmentType: 'PRODUCTION',
      projectId: mockProjectId,
      targetUrl: 'https://production.example.com',
    });

    expect(env.environmentId).toBe('env-prod-explicit');
    expect(env.environmentName).toBe('PRODUCTION');
    expect(env.environmentType).toBe('PRODUCTION');
  });

  // ----------------------------------------------------------------------------
  // Test 4: Baseline run has no environment -> comparison becomes INCONCLUSIVE
  // ----------------------------------------------------------------------------
  it('Test 4: Baseline run has no environment -> No PRODUCTION or STAGING fallback, comparison INCONCLUSIVE', () => {
    const baseEnv = buildEnvironmentSnapshot({
      projectId: mockProjectId,
      targetUrl: 'https://base.example.com',
      // No environmentId, environmentName, or environmentType supplied
    });

    const targetEnv = buildEnvironmentSnapshot({
      environmentId: 'env-target-4',
      environmentName: 'STAGING',
      environmentType: 'STAGING',
      projectId: mockProjectId,
      targetUrl: 'https://staging.example.com',
    });

    expect(baseEnv.environmentId).toBeNull();
    expect(baseEnv.environmentName).toBeNull();
    expect(baseEnv.environmentType).toBeNull();

    const baseObs: TargetEnvironmentObservation = {
      targetIdentifier: '/login',
      targetType: 'ROUTE',
      domain: 'FUNCTIONAL',
      environmentId: baseEnv.environmentId,
      environmentName: baseEnv.environmentName,
      environmentType: baseEnv.environmentType,
      status: 'PASSED',
      findingsCount: 0,
      observationsCount: 0,
    };

    const targetObs: TargetEnvironmentObservation = {
      targetIdentifier: '/login',
      targetType: 'ROUTE',
      domain: 'FUNCTIONAL',
      environmentId: targetEnv.environmentId,
      environmentName: targetEnv.environmentName,
      environmentType: targetEnv.environmentType,
      status: 'PASSED',
      findingsCount: 0,
      observationsCount: 0,
    };

    const compResult = EnvironmentComparator.compare({
      baseEnvironment: baseEnv,
      targetEnvironment: targetEnv,
      baseObservations: [baseObs],
      targetObservations: [targetObs],
    });

    expect(compResult.totalTargetsCompared).toBe(1);
    expect(compResult.inconclusiveCount).toBe(1);
    expect(compResult.targets[0].classification).toBe('INCONCLUSIVE');
    expect(compResult.targets[0].reason).toContain('environment identity is missing or unavailable');
  });

  // ----------------------------------------------------------------------------
  // Test 5: Baseline environment explicitly PRODUCTION
  // ----------------------------------------------------------------------------
  it('Test 5: Baseline environment explicitly PRODUCTION -> PRODUCTION preserved', () => {
    const baseEnv = buildEnvironmentSnapshot({
      environmentId: 'env-prod-5',
      environmentName: 'PRODUCTION',
      environmentType: 'PRODUCTION',
      projectId: mockProjectId,
      targetUrl: 'https://example.com',
    });

    expect(baseEnv.environmentId).toBe('env-prod-5');
    expect(baseEnv.environmentName).toBe('PRODUCTION');
    expect(baseEnv.environmentType).toBe('PRODUCTION');
  });

  // ----------------------------------------------------------------------------
  // Test 6: No branch supplied -> branch remains unavailable (null)
  // ----------------------------------------------------------------------------
  it('Test 6: No branch supplied -> branch remains unavailable (null), no "main" or "HEAD" fallback', () => {
    const env = buildEnvironmentSnapshot({
      projectId: mockProjectId,
      targetUrl: 'https://example.com',
    });

    expect(env.branch).toBeNull();

    const branchComp = BranchComparator.compare({
      baseBranch: null,
      headBranch: null,
    });

    expect(branchComp.baseBranch).toBeNull();
    expect(branchComp.headBranch).toBeNull();
  });

  // ----------------------------------------------------------------------------
  // Test 7: No commit supplied -> commitSha remains unavailable (null)
  // ----------------------------------------------------------------------------
  it('Test 7: No commit supplied -> commitSha remains unavailable (null), no synthetic SHA', () => {
    const env = buildEnvironmentSnapshot({
      projectId: mockProjectId,
      targetUrl: 'https://example.com',
    });

    expect(env.commitSha).toBeNull();

    const branchComp = BranchComparator.compare({
      baseBranch: 'main',
      headBranch: 'feature/auth',
    });

    expect(branchComp.baseCommit).toBeUndefined();
    expect(branchComp.headCommit).toBeUndefined();
  });

  // ----------------------------------------------------------------------------
  // Test 8: Environment name exists but type is absent -> only infer if name is explicit
  // ----------------------------------------------------------------------------
  it('Test 8: Environment name exists but type is absent -> infer from explicit name only', () => {
    const envProd = buildEnvironmentSnapshot({
      environmentId: 'env-8a',
      environmentName: 'production-us-east',
      projectId: mockProjectId,
      targetUrl: 'https://prod.example.com',
    });
    expect(envProd.environmentType).toBe('PRODUCTION');

    const envStg = buildEnvironmentSnapshot({
      environmentId: 'env-8b',
      environmentName: 'staging-k8s',
      projectId: mockProjectId,
      targetUrl: 'https://stg.example.com',
    });
    expect(envStg.environmentType).toBe('STAGING');

    const envCustom = buildEnvironmentSnapshot({
      environmentId: 'env-8c',
      environmentName: 'internal-sandbox-alpha',
      projectId: mockProjectId,
      targetUrl: 'https://sandbox.example.com',
    });
    expect(envCustom.environmentType).toBe('CUSTOM');

    // Missing name produces null type
    expect(inferEnvironmentType(null)).toBeNull();
    expect(inferEnvironmentType('')).toBeNull();
    expect(inferEnvironmentType(undefined)).toBeNull();
  });

  // ----------------------------------------------------------------------------
  // Test 9: Target URL contains "staging" but metadata absent -> DO NOT infer STAGING
  // ----------------------------------------------------------------------------
  it('Test 9: Target URL contains "staging" but environment metadata is absent -> DO NOT infer STAGING', () => {
    const env = buildEnvironmentSnapshot({
      projectId: mockProjectId,
      targetUrl: 'https://staging.customer-domain.com/portal',
      // No environmentId, environmentName, or environmentType supplied
    });

    expect(env.environmentId).toBeNull();
    expect(env.environmentName).toBeNull();
    expect(env.environmentType).toBeNull();
  });

  // ----------------------------------------------------------------------------
  // Test 10: Campaign name contains "production" -> DO NOT infer PRODUCTION
  // ----------------------------------------------------------------------------
  it('Test 10: Campaign name contains "production" -> DO NOT infer PRODUCTION', () => {
    // buildEnvironmentSnapshot does not accept campaign name to infer environment
    const env = buildEnvironmentSnapshot({
      projectId: mockProjectId,
      targetUrl: 'https://example.com',
      metadata: { campaignName: 'Nightly Production Verification Campaign' },
    });

    expect(env.environmentId).toBeNull();
    expect(env.environmentName).toBeNull();
    expect(env.environmentType).toBeNull();
  });

  // ----------------------------------------------------------------------------
  // Section 6: Comparator Safety Cases (A, B, C, D)
  // ----------------------------------------------------------------------------
  describe('Prompt 61A Section 6: Comparator Safety Cases', () => {
    it('Case A: Environment A (staging, commit=abc) vs Environment B (production, commit=abc) -> comparison allowed', () => {
      const envA = buildEnvironmentSnapshot({
        environmentId: 'staging',
        environmentName: 'staging',
        projectId: mockProjectId,
        targetUrl: 'https://stg.example.com',
        commitSha: 'abc12345',
      });
      const envB = buildEnvironmentSnapshot({
        environmentId: 'production',
        environmentName: 'production',
        projectId: mockProjectId,
        targetUrl: 'https://example.com',
        commitSha: 'abc12345',
      });

      const res = EnvironmentComparator.compare({
        baseEnvironment: envA,
        targetEnvironment: envB,
        baseObservations: [
          {
            targetIdentifier: '/home',
            targetType: 'ROUTE',
            domain: 'FUNCTIONAL',
            environmentId: envA.environmentId,
            environmentName: envA.environmentName,
            environmentType: envA.environmentType,
            status: 'PASSED',
            findingsCount: 0,
            observationsCount: 0,
          },
        ],
        targetObservations: [
          {
            targetIdentifier: '/home',
            targetType: 'ROUTE',
            domain: 'FUNCTIONAL',
            environmentId: envB.environmentId,
            environmentName: envB.environmentName,
            environmentType: envB.environmentType,
            status: 'PASSED',
            findingsCount: 0,
            observationsCount: 0,
          },
        ],
      });

      expect(res.inconclusiveCount).toBe(0);
      expect(res.sameBehaviorCount).toBe(1);
      expect(res.targets[0].classification).toBe('SAME_BEHAVIOR');
    });

    it('Case B: Environment A (id=null, commit=abc) vs Environment B (production, commit=abc) -> do NOT infer A, classification INCONCLUSIVE', () => {
      const envA = buildEnvironmentSnapshot({
        environmentId: null,
        environmentName: null,
        projectId: mockProjectId,
        targetUrl: 'https://unknown.example.com',
        commitSha: 'abc12345',
      });
      const envB = buildEnvironmentSnapshot({
        environmentId: 'production',
        environmentName: 'production',
        projectId: mockProjectId,
        targetUrl: 'https://example.com',
        commitSha: 'abc12345',
      });

      const res = EnvironmentComparator.compare({
        baseEnvironment: envA,
        targetEnvironment: envB,
        baseObservations: [
          {
            targetIdentifier: '/home',
            targetType: 'ROUTE',
            domain: 'FUNCTIONAL',
            environmentId: envA.environmentId,
            environmentName: envA.environmentName,
            environmentType: envA.environmentType,
            status: 'PASSED',
            findingsCount: 0,
            observationsCount: 0,
          },
        ],
        targetObservations: [
          {
            targetIdentifier: '/home',
            targetType: 'ROUTE',
            domain: 'FUNCTIONAL',
            environmentId: envB.environmentId,
            environmentName: envB.environmentName,
            environmentType: envB.environmentType,
            status: 'PASSED',
            findingsCount: 0,
            observationsCount: 0,
          },
        ],
      });

      expect(res.inconclusiveCount).toBe(1);
      expect(res.targets[0].classification).toBe('INCONCLUSIVE');
      expect(res.targets[0].reason).toContain('environment identity is missing or unavailable');
    });

    it('Case C: Environment A (known, commit missing) vs Environment B (known, commit known) -> do not infer commit, no version drift', () => {
      const envA = buildEnvironmentSnapshot({
        environmentId: 'staging',
        environmentName: 'staging',
        projectId: mockProjectId,
        targetUrl: 'https://stg.example.com',
        commitSha: null, // missing commit
      });
      const envB = buildEnvironmentSnapshot({
        environmentId: 'production',
        environmentName: 'production',
        projectId: mockProjectId,
        targetUrl: 'https://example.com',
        commitSha: 'abc12345',
      });

      const res = EnvironmentComparator.compare({
        baseEnvironment: envA,
        targetEnvironment: envB,
        baseObservations: [
          {
            targetIdentifier: '/home',
            targetType: 'ROUTE',
            domain: 'FUNCTIONAL',
            environmentId: envA.environmentId,
            environmentName: envA.environmentName,
            environmentType: envA.environmentType,
            status: 'PASSED',
            findingsCount: 0,
            observationsCount: 0,
          },
        ],
        targetObservations: [
          {
            targetIdentifier: '/home',
            targetType: 'ROUTE',
            domain: 'FUNCTIONAL',
            environmentId: envB.environmentId,
            environmentName: envB.environmentName,
            environmentType: envB.environmentType,
            status: 'PASSED',
            findingsCount: 0,
            observationsCount: 0,
          },
        ],
      });

      // Because commit is missing on envA, version drift is NOT flagged (cannot infer commit)
      expect(res.versionDriftCount).toBe(0);
      expect(res.driftTypes).not.toContain('VERSION_DRIFT');
    });

    it('Case D: Both environments known and both commits known -> normal comparison with version drift if SHAs differ', () => {
      const envA = buildEnvironmentSnapshot({
        environmentId: 'staging',
        environmentName: 'staging',
        projectId: mockProjectId,
        targetUrl: 'https://stg.example.com',
        commitSha: 'commit-1111111',
      });
      const envB = buildEnvironmentSnapshot({
        environmentId: 'production',
        environmentName: 'production',
        projectId: mockProjectId,
        targetUrl: 'https://example.com',
        commitSha: 'commit-2222222',
      });

      const res = EnvironmentComparator.compare({
        baseEnvironment: envA,
        targetEnvironment: envB,
        baseObservations: [
          {
            targetIdentifier: '/home',
            targetType: 'ROUTE',
            domain: 'FUNCTIONAL',
            environmentId: envA.environmentId,
            environmentName: envA.environmentName,
            environmentType: envA.environmentType,
            status: 'PASSED',
            findingsCount: 0,
            observationsCount: 0,
          },
        ],
        targetObservations: [
          {
            targetIdentifier: '/home',
            targetType: 'ROUTE',
            domain: 'FUNCTIONAL',
            environmentId: envB.environmentId,
            environmentName: envB.environmentName,
            environmentType: envB.environmentType,
            status: 'PASSED',
            findingsCount: 0,
            observationsCount: 0,
          },
        ],
      });

      expect(res.versionDriftCount).toBe(1);
      expect(res.driftTypes).toContain('VERSION_DRIFT');
      expect(res.targets[0].classification).toBe('VERSION_DRIFT');
    });
  });
});
