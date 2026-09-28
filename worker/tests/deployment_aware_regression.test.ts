// ==============================================================================
// Sculra Deployment-Aware Regression Intelligence & Release Impact Test Suite
// (worker/tests/deployment_aware_regression.test.ts)
// Covers Prompt 62 End-to-End Scenarios & Deterministic Guardrails
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  buildDeploymentSnapshot,
  DeploymentReleaseCorrelator,
  PreviousDeploymentResolver,
  DeploymentChangeAnalyzer,
  ReleaseImpactAnalyzer,
  VercelDeploymentProvider,
  RailwayDeploymentProvider,
  GenericDeploymentProvider,
  DeploymentSnapshot,
  ReleaseRecord,
  DeploymentRecord,
} from '../src/release';
import {
  ChangeDecisionEngine,
  RegressionComparator,
  RegressionTargetGenerator,
  ImpactMapper,
  buildChangeSnapshot,
  RegressionCandidate,
} from '../src/change-intelligence';

describe('Prompt 62: Deployment-Aware Regression Intelligence & Release Impact', () => {
  const mockProjectId = 'proj-9999-aaaa-bbbb-cccc';
  const mockOrgId = 'org-8888-1111-2222-3333';

  // ============================================================================
  // Group 1: Canonical DeploymentSnapshot Builder & Strict Guardrails
  // ============================================================================
  describe('DeploymentSnapshot Builder', () => {
    it('Scenario 1.1: builds valid snapshot with all explicit evidence fields', () => {
      const snapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-101',
        projectId: mockProjectId,
        organizationId: mockOrgId,
        environmentId: 'env-prod-1',
        environmentName: 'Production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        deploymentUrl: 'https://app.sculra.com',
        commitSha: '6d8b2a1e94fc07b5a12d34567890abcdef123456',
        branch: 'main',
        provider: 'VERCEL',
        startedAt: '2026-09-28T10:00:00Z',
        completedAt: '2026-09-28T10:03:00Z',
        source: 'VERCEL',
      });

      expect(snapshot.deploymentId).toBe('dep-101');
      expect(snapshot.environmentId).toBe('env-prod-1');
      expect(snapshot.environmentName).toBe('Production');
      expect(snapshot.environmentType).toBe('PRODUCTION');
      expect(snapshot.deploymentStatus).toBe('READY');
      expect(snapshot.commitSha).toBe('6d8b2a1e94fc07b5a12d34567890abcdef123456');
      expect(snapshot.branch).toBe('main');
      expect(snapshot.confidence).toBe(1.0);
      expect(snapshot.evidence.length).toBeGreaterThanOrEqual(3);
    });

    it('Scenario 1.2: strict guardrails - missing commit, branch, and environment remain null', () => {
      const snapshot = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-102',
        // Omitted environment, commit, branch, release
      });

      expect(snapshot.environmentId).toBeNull();
      expect(snapshot.environmentName).toBeNull();
      expect(snapshot.environmentType).toBeNull();
      expect(snapshot.commitSha).toBeNull();
      expect(snapshot.branch).toBeNull();
      expect(snapshot.releaseId).toBeNull();
      expect(snapshot.previousDeploymentId).toBeNull();
      expect(snapshot.previousCommitSha).toBeNull();
    });

    it('Scenario 1.3: normalizes whitespace-only strings to null', () => {
      const snapshot = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: '   ',
        commitSha: '   ',
        branch: '   ',
        environmentName: '   ',
      });

      expect(snapshot.deploymentId).toBeNull();
      expect(snapshot.commitSha).toBeNull();
      expect(snapshot.branch).toBeNull();
      expect(snapshot.environmentName).toBeNull();
    });

    it('Scenario 1.4: redacts sensitive keys from metadata', () => {
      const snapshot = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-103',
        metadata: {
          secret_key: 'sk_live_123456789',
          authorization_token: 'Bearer eyJhbGciOi...',
          safeField: 'deploy_v2',
        },
      });

      expect(snapshot.metadata?.safeField).toBe('deploy_v2');
      expect(snapshot.metadata?.secret_key).toBe('[REDACTED]');
      expect(snapshot.metadata?.authorization_token).toBe('[REDACTED]');
    });

    it('Scenario 1.5: throws error if projectId is missing', () => {
      expect(() => {
        buildDeploymentSnapshot({ projectId: '' as any });
      }).toThrow('DeploymentSnapshot requires a valid projectId.');
    });
  });

  // ============================================================================
  // Group 2: Deployment -> Release Correlator
  // ============================================================================
  describe('DeploymentReleaseCorrelator', () => {
    const mockRelease1: ReleaseRecord = {
      id: 'rel-001',
      projectId: mockProjectId,
      environmentId: 'env-prod-1',
      version: 'v1.5.0',
      commitSha: 'aaa1111222233334444555566667777888899990',
      branch: 'main',
      status: 'CANDIDATE',
      createdAt: '2026-09-28T09:00:00Z',
      updatedAt: '2026-09-28T09:00:00Z',
    };

    const mockRelease2: ReleaseRecord = {
      id: 'rel-002',
      projectId: mockProjectId,
      environmentId: 'env-prod-1',
      version: 'v1.6.0',
      commitSha: 'bbb1111222233334444555566667777888899990',
      branch: 'main',
      status: 'CANDIDATE',
      createdAt: '2026-09-28T11:00:00Z',
      updatedAt: '2026-09-28T11:00:00Z',
    };

    it('Scenario 2.1: correlates explicitly via releaseId with 1.0 confidence', () => {
      const deployment = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-201',
        releaseId: 'rel-001',
        commitSha: 'aaa1111222233334444555566667777888899990',
      });

      const result = DeploymentReleaseCorrelator.correlate({
        deployment,
        candidateReleases: [mockRelease1, mockRelease2],
      });

      expect(result.status).toBe('EXPLICIT');
      expect(result.releaseId).toBe('rel-001');
      expect(result.releaseVersion).toBe('v1.5.0');
      expect(result.confidence).toBe(1.0);
      expect(result.correlationMethod).toBe('explicit_deployment_release_link');
    });

    it('Scenario 2.2: correlates via single exact commitSha match with 0.85 confidence', () => {
      const deployment = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-202',
        environmentId: 'env-prod-1',
        commitSha: 'bbb1111222233334444555566667777888899990',
      });

      const result = DeploymentReleaseCorrelator.correlate({
        deployment,
        candidateReleases: [mockRelease1, mockRelease2],
      });

      expect(result.status).toBe('COMMIT_MATCH');
      expect(result.releaseId).toBe('rel-002');
      expect(result.releaseVersion).toBe('v1.6.0');
      expect(result.confidence).toBe(0.85);
      expect(result.correlationMethod).toBe('commit_match');
    });

    it('Scenario 2.3: detects ambiguous match when multiple releases share same commitSha (NO arbitrary inference)', () => {
      const duplicateCommitRelease: ReleaseRecord = {
        ...mockRelease1,
        id: 'rel-003',
        version: 'v1.5.1-hotfix',
      };

      const deployment = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-203',
        environmentId: 'env-prod-1',
        commitSha: 'aaa1111222233334444555566667777888899990',
      });

      const result = DeploymentReleaseCorrelator.correlate({
        deployment,
        candidateReleases: [mockRelease1, duplicateCommitRelease],
      });

      expect(result.status).toBe('AMBIGUOUS');
      expect(result.releaseId).toBeNull();
      expect(result.releaseVersion).toBeNull();
      expect(result.confidence).toBe(0.0);
    });

    it('Scenario 2.4: returns NOT_FOUND when no release matches', () => {
      const deployment = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-204',
        environmentId: 'env-prod-1',
        commitSha: 'zzz9999888877776666555544443333222211110',
      });

      const result = DeploymentReleaseCorrelator.correlate({
        deployment,
        candidateReleases: [mockRelease1, mockRelease2],
      });

      expect(result.status).toBe('NOT_FOUND');
      expect(result.releaseId).toBeNull();
      expect(result.confidence).toBe(0.0);
    });

    it('Scenario 2.5: ignores releases from another project', () => {
      const foreignRelease: ReleaseRecord = {
        ...mockRelease1,
        id: 'rel-foreign',
        projectId: 'proj-other-foreign-project',
      };

      const deployment = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-205',
        commitSha: foreignRelease.commitSha,
      });

      const result = DeploymentReleaseCorrelator.correlate({
        deployment,
        candidateReleases: [foreignRelease],
      });

      expect(result.status).toBe('NOT_FOUND');
      expect(result.releaseId).toBeNull();
    });
  });

  // ============================================================================
  // Group 3: Previous Deployment Resolver
  // ============================================================================
  describe('PreviousDeploymentResolver', () => {
    it('Scenario 3.1: missing environment on current deployment evaluates strictly to INCONCLUSIVE', () => {
      const deployment = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-301',
        // Omitted environment
      });

      const result = PreviousDeploymentResolver.resolve({
        currentDeployment: deployment,
        candidateDeployments: [],
      });

      expect(result.status).toBe('INCONCLUSIVE');
      expect(result.previousDeployment).toBeNull();
      expect(result.reason).toContain('lacks environment identity');
    });

    it('Scenario 3.2: returns NO_PREVIOUS for initial deployment in environment', () => {
      const deployment = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-302',
        environmentId: 'env-prod-1',
        environmentName: 'Production',
        startedAt: '2026-09-28T10:00:00Z',
      });

      const result = PreviousDeploymentResolver.resolve({
        currentDeployment: deployment,
        candidateDeployments: [], // No prior deployments
      });

      expect(result.status).toBe('NO_PREVIOUS');
      expect(result.previousDeployment).toBeNull();
      expect(result.reason).toContain('Initial deployment');
    });

    it('Scenario 3.3: resolves immediately preceding successful deployment chronologically', () => {
      const current = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-305',
        environmentId: 'env-prod-1',
        environmentName: 'Production',
        startedAt: '2026-09-28T15:00:00Z',
      });

      const older: DeploymentRecord = {
        id: 'dep-303',
        projectId: mockProjectId,
        environmentId: 'env-prod-1',
        commitSha: 'sha-older',
        provider: 'GENERIC',
        status: 'SUCCEEDED',
        trigger: 'MANUAL',
        startedAt: '2026-09-28T10:00:00Z',
        completedAt: '2026-09-28T10:05:00Z',
        createdAt: '2026-09-28T10:00:00Z',
      };

      const middle: DeploymentRecord = {
        id: 'dep-304',
        projectId: mockProjectId,
        environmentId: 'env-prod-1',
        commitSha: 'sha-middle',
        provider: 'GENERIC',
        status: 'SUCCEEDED',
        trigger: 'MANUAL',
        startedAt: '2026-09-28T12:00:00Z',
        completedAt: '2026-09-28T12:05:00Z',
        createdAt: '2026-09-28T12:00:00Z',
      };

      const result = PreviousDeploymentResolver.resolve({
        currentDeployment: current,
        candidateDeployments: [older, middle],
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.previousDeployment?.deploymentId).toBe('dep-304');
      expect(result.previousDeployment?.commitSha).toBe('sha-middle');
    });

    it('Scenario 3.4: ignores failed deployments when resolving previous successful baseline', () => {
      const current = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-307',
        environmentId: 'env-prod-1',
        startedAt: '2026-09-28T15:00:00Z',
      });

      const failedIntermediate: DeploymentRecord = {
        id: 'dep-306-failed',
        projectId: mockProjectId,
        environmentId: 'env-prod-1',
        commitSha: 'sha-broken',
        provider: 'GENERIC',
        status: 'FAILED',
        trigger: 'MANUAL',
        startedAt: '2026-09-28T14:00:00Z',
        completedAt: '2026-09-28T14:02:00Z',
        createdAt: '2026-09-28T14:00:00Z',
      };

      const successfulPrior: DeploymentRecord = {
        id: 'dep-305-good',
        projectId: mockProjectId,
        environmentId: 'env-prod-1',
        commitSha: 'sha-good',
        provider: 'GENERIC',
        status: 'SUCCEEDED',
        trigger: 'MANUAL',
        startedAt: '2026-09-28T11:00:00Z',
        completedAt: '2026-09-28T11:05:00Z',
        createdAt: '2026-09-28T11:00:00Z',
      };

      const result = PreviousDeploymentResolver.resolve({
        currentDeployment: current,
        candidateDeployments: [failedIntermediate, successfulPrior],
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.previousDeployment?.deploymentId).toBe('dep-305-good');
    });

    it('Scenario 3.5: scope isolation - never selects previous deployment from a different environment', () => {
      const current = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-308',
        environmentId: 'env-staging-1',
        startedAt: '2026-09-28T15:00:00Z',
      });

      const prodDeployment: DeploymentRecord = {
        id: 'dep-prod-only',
        projectId: mockProjectId,
        environmentId: 'env-prod-1', // Different env
        commitSha: 'sha-prod',
        provider: 'GENERIC',
        status: 'SUCCEEDED',
        trigger: 'MANUAL',
        startedAt: '2026-09-28T14:00:00Z',
        completedAt: '2026-09-28T14:05:00Z',
        createdAt: '2026-09-28T14:00:00Z',
      };

      const result = PreviousDeploymentResolver.resolve({
        currentDeployment: current,
        candidateDeployments: [prodDeployment],
      });

      expect(result.status).toBe('NO_PREVIOUS');
      expect(result.previousDeployment).toBeNull();
    });
  });

  // ============================================================================
  // Group 4: Deployment Change Analyzer
  // ============================================================================
  describe('DeploymentChangeAnalyzer', () => {
    it('Scenario 4.1: missing current commitSha evaluates to INCONCLUSIVE', async () => {
      const current = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-401',
        commitSha: null,
      });

      const result = await DeploymentChangeAnalyzer.analyze({
        currentDeployment: current,
      });

      expect(result.status).toBe('INCONCLUSIVE');
      expect(result.reason).toContain('lacks commit SHA evidence');
    });

    it('Scenario 4.2: missing previous commitSha evaluates to INCONCLUSIVE (initial deployment)', async () => {
      const current = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-402',
        commitSha: '6d8b2a1e94fc07b5a12d',
      });

      const result = await DeploymentChangeAnalyzer.analyze({
        currentDeployment: current,
        previousDeployment: null,
      });

      expect(result.status).toBe('INCONCLUSIVE');
      expect(result.reason).toContain('No prior deployed commit SHA available');
    });

    it('Scenario 4.3: detects IDENTICAL_COMMITS when redeploying identical commit', async () => {
      const current = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-403',
        commitSha: '6d8b2a1e94fc07b5a12d',
      });

      const previous = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-402',
        commitSha: '6d8b2a1e94fc07b5a12d', // Identical
      });

      const result = await DeploymentChangeAnalyzer.analyze({
        currentDeployment: current,
        previousDeployment: previous,
      });

      expect(result.status).toBe('IDENTICAL_COMMITS');
      expect(result.changedFilesCount).toBe(0);
      expect(result.confidence).toBe(1.0);
    });

    it('Scenario 4.4: analyzes valid changes and connects to ChangeSnapshot', async () => {
      const current = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-404',
        commitSha: 'commit-new-head',
      });

      const previous = buildDeploymentSnapshot({
        projectId: mockProjectId,
        deploymentId: 'dep-403',
        commitSha: 'commit-old-base',
      });

      const result = await DeploymentChangeAnalyzer.analyze({
        currentDeployment: current,
        previousDeployment: previous,
        gitDiffFiles: [
          {
            path: 'app/api/auth/route.ts',
            status: 'MODIFIED',
            additions: 10,
            deletions: 2,
            changes: 12,
            hunks: [],
            isBinary: false,
            isGeneratedOrMinified: false,
            isLockfile: false,
            isDocumentation: false,
            classifications: ['API', 'AUTHENTICATION'],
          },
        ],
      });

      expect(result.status).toBe('ANALYZED');
      expect(result.changedFilesCount).toBe(1);
      expect(result.affectedApis).toContain('/api/auth');
      expect(result.classifications).toContain('AUTHENTICATION');
    });
  });

  // ============================================================================
  // Group 5: Release Impact Analyzer & Unknown Fields Guardrail
  // ============================================================================
  describe('ReleaseImpactAnalyzer', () => {
    it('Scenario 5.1: evaluates to INCONCLUSIVE when neither diff nor test evidence exists', () => {
      const impact = ReleaseImpactAnalyzer.analyze({
        deployment: buildDeploymentSnapshot({ projectId: mockProjectId, deploymentId: 'dep-501' }),
      });

      expect(impact.status).toBe('INCONCLUSIVE');
      expect(impact.confidence).toBeLessThanOrEqual(0.3);
      expect(impact.unknownFields).toContain('securityImpact');
      expect(impact.unknownFields).toContain('authenticationImpact');
    });

    it('Scenario 5.2: classifies as HIGH_IMPACT when critical workflow has regressions or security impacted', () => {
      const impact = ReleaseImpactAnalyzer.analyze({
        deployment: buildDeploymentSnapshot({ projectId: mockProjectId, deploymentId: 'dep-502', commitSha: 'sha-new' }),
        changeComparison: {
          deploymentId: 'dep-502',
          previousDeploymentId: 'dep-501',
          currentCommitSha: 'sha-new',
          previousCommitSha: 'sha-old',
          status: 'ANALYZED',
          reason: 'Changes detected',
          changedFilesCount: 5,
          classifications: ['SECURITY', 'API'],
          affectedRoutes: ['/login'],
          affectedApis: ['/api/auth'],
          affectedWorkflows: ['Login Journey', 'Checkout'],
          criticalWorkflows: ['Checkout'],
          confidence: 0.9,
          evidence: [],
        },
        regressionComparison: {
          comparedAt: new Date().toISOString(),
          totalCompared: 10,
          regressionsCount: 2,
          recoveriesCount: 0,
          persistingFailuresCount: 0,
          newFailuresCount: 0,
          unchangedPassCount: 8,
          unchangedFailuresCount: 0,
          inconclusiveCount: 0,
          targets: [],
        },
      });

      expect(impact.status).toBe('HIGH_IMPACT');
      expect(impact.criticalWorkflowCount).toBe(1);
      expect(impact.newRegressionCount).toBe(2);
      expect(impact.securityImpact).toBe(true);
    });

    it('Scenario 5.3: classifies as LOW_IMPACT when zero regressions and non-critical surface', () => {
      const impact = ReleaseImpactAnalyzer.analyze({
        deployment: buildDeploymentSnapshot({ projectId: mockProjectId, deploymentId: 'dep-503', commitSha: 'sha-new' }),
        changeComparison: {
          deploymentId: 'dep-503',
          previousDeploymentId: 'dep-502',
          currentCommitSha: 'sha-new',
          previousCommitSha: 'sha-old',
          status: 'ANALYZED',
          reason: 'Documentation and minor style tweaks',
          changedFilesCount: 1,
          classifications: ['UI'],
          affectedRoutes: ['/docs'],
          affectedApis: [],
          affectedWorkflows: [],
          criticalWorkflows: [],
          confidence: 0.9,
          evidence: [],
        },
        regressionComparison: {
          comparedAt: new Date().toISOString(),
          totalCompared: 5,
          regressionsCount: 0,
          recoveriesCount: 0,
          persistingFailuresCount: 0,
          newFailuresCount: 0,
          unchangedPassCount: 5,
          unchangedFailuresCount: 0,
          inconclusiveCount: 0,
          targets: [],
        },
      });

      expect(impact.status).toBe('LOW_IMPACT');
      expect(impact.newRegressionCount).toBe(0);
      expect(impact.criticalWorkflowCount).toBe(0);
    });

    it('Scenario 5.4: strict guardrails - unmeasured dimensions remain null and recorded in unknownFields', () => {
      const impact = ReleaseImpactAnalyzer.analyze({
        deployment: buildDeploymentSnapshot({ projectId: mockProjectId, deploymentId: 'dep-504', commitSha: 'sha-new' }),
        changeComparison: {
          deploymentId: 'dep-504',
          previousDeploymentId: 'dep-503',
          currentCommitSha: 'sha-new',
          previousCommitSha: 'sha-old',
          status: 'ANALYZED',
          reason: 'UI changes',
          changedFilesCount: 1,
          classifications: ['UI'],
          affectedRoutes: ['/home'],
          affectedApis: [],
          affectedWorkflows: [],
          criticalWorkflows: [],
          confidence: 0.9,
          evidence: [],
        },
        taskResults: [], // No performance or accessibility tests run
      });

      expect(impact.performanceImpact).toBeNull();
      expect(impact.accessibilityImpact).toBeNull();
      expect(impact.visualImpact).toBeNull();
      expect(impact.unknownFields).toContain('performanceImpact');
      expect(impact.unknownFields).toContain('accessibilityImpact');
      expect(impact.unknownFields).toContain('visualImpact');
    });
  });

  // ============================================================================
  // Group 6: Deployment Providers (Vercel, Railway, Generic)
  // ============================================================================
  describe('DeploymentProvider Normalization', () => {
    it('Scenario 6.1: Vercel provider normalizes payload without inventing missing environment', () => {
      const provider = new VercelDeploymentProvider();
      const payload = {
        deployment: {
          id: 'dpl_vercel123',
          url: 'sculra-app.vercel.app',
          readyState: 'READY',
          meta: {
            githubCommitSha: 'sha12345',
            githubCommitRef: 'feat/deployment-intel',
          },
          target: 'production',
        },
      };

      const snapshot = provider.normalizeWebhook(payload);

      expect(snapshot.provider).toBe('VERCEL');
      expect(snapshot.deploymentId).toBe('dpl_vercel123');
      expect(snapshot.deploymentStatus).toBe('READY');
      expect(snapshot.commitSha).toBe('sha12345');
      expect(snapshot.branch).toBe('feat/deployment-intel');
      expect(snapshot.environmentName).toBe('production');
      expect(snapshot.environmentType).toBe('PRODUCTION');
    });

    it('Scenario 6.2: Railway provider normalizes payload and preserves missing environment as null', () => {
      const provider = new RailwayDeploymentProvider();
      const payload = {
        deployment: {
          id: 'rw_dep_456',
          status: 'SUCCESS',
          staticUrl: 'https://backend.railway.internal',
          meta: {
            commitHash: 'rw_commit_789',
            branch: 'main',
          },
        },
      };

      const snapshot = provider.normalizeWebhook(payload);

      expect(snapshot.provider).toBe('RAILWAY');
      expect(snapshot.deploymentId).toBe('rw_dep_456');
      expect(snapshot.deploymentStatus).toBe('READY');
      expect(snapshot.commitSha).toBe('rw_commit_789');
      expect(snapshot.environmentName).toBeNull(); // Missing environment stays null!
    });

    it('Scenario 6.3: Generic provider redacts credentials from webhook metadata', () => {
      const provider = new GenericDeploymentProvider();
      const payload = {
        deployment_id: 'ci-run-888',
        project_id: mockProjectId,
        commit_sha: 'commit-ci-abc',
        status: 'DEPLOYING',
        metadata: {
          api_token: 'secret_token_123',
          ci_runner: 'runner-01',
        },
      };

      const snapshot = provider.normalizeWebhook(payload);

      expect(snapshot.deploymentId).toBe('ci-run-888');
      expect(snapshot.deploymentStatus).toBe('DEPLOYING');
      expect(snapshot.metadata?.ci_runner).toBe('runner-01');
      expect(snapshot.metadata?.api_token).toBe('[REDACTED]');
    });
  });

  // ============================================================================
  // Group 7: Change Decision Engine Deployment Awareness & Override
  // ============================================================================
  describe('ChangeDecisionEngine Deployment-Aware Decisions', () => {
    const candidateNonCritical: RegressionCandidate = {
      id: 'cand-ui-1',
      source: 'DIRECT_WORKFLOW',
      targetId: 'wf-search',
      targetType: 'WORKFLOW',
      targetIdentifier: 'Search Workflow',
      domain: 'FUNCTIONAL',
      businessCriticality: 'MEDIUM',
      priority: 60,
      reason: 'Search route touched',
    };

    const candidateCritical: RegressionCandidate = {
      id: 'cand-crit-1',
      source: 'CRITICAL_WORKFLOW',
      targetId: 'wf-checkout',
      targetType: 'WORKFLOW',
      targetIdentifier: 'Checkout Payment Flow',
      domain: 'JOURNEY',
      businessCriticality: 'CRITICAL',
      priority: 100,
      reason: 'Checkout is core business transaction',
    };

    const snapshot = buildChangeSnapshot({
      commitSha: 'sha-test-decisions',
    });

    it('Scenario 7.1: defers non-critical candidate when deployment is DEPLOYING', () => {
      const decisions = ChangeDecisionEngine.evaluate({
        snapshot,
        candidates: [candidateNonCritical],
        deploymentId: 'dep-701',
        deploymentStatus: 'DEPLOYING',
      });

      expect(decisions.length).toBe(1);
      expect(decisions[0].decision).toBe('DEFER');
      expect(decisions[0].skipReason).toBe('DEPLOYMENT_IN_PROGRESS');
      expect(decisions[0].deploymentId).toBe('dep-701');
      expect(decisions[0].deploymentStatus).toBe('DEPLOYING');
    });

    it('Scenario 7.2: critical workflow override forces TEST even when deployment is DEPLOYING', () => {
      const decisions = ChangeDecisionEngine.evaluate({
        snapshot,
        candidates: [candidateCritical],
        deploymentId: 'dep-702',
        deploymentStatus: 'DEPLOYING',
      });

      expect(decisions.length).toBe(1);
      expect(decisions[0].decision).toBe('TEST');
      expect(decisions[0].criticalOverride).toBe(true);
      expect(decisions[0].deploymentId).toBe('dep-702');
      expect(decisions[0].reason).toContain('CRITICAL_WORKFLOW');
    });
  });

  // ============================================================================
  // Group 8: RegressionTargetGenerator Source 14 & RegressionComparator
  // ============================================================================
  describe('RegressionTargetGenerator Source 14 & Comparator', () => {
    it('Scenario 8.1: generates Source 14 DEPLOYMENT_REGRESSION_SURFACE candidate', () => {
      const snapshot = buildChangeSnapshot({ commitSha: 'sha-targets' });
      const candidates = RegressionTargetGenerator.generateCandidates({
        snapshot,
        affectedWorkflows: [],
        affectedApis: [],
        deploymentId: 'dep-target-999',
      });

      const depCandidate = candidates.find((c) => c.source === 'DEPLOYMENT_REGRESSION_SURFACE');
      expect(depCandidate).toBeDefined();
      expect(depCandidate?.targetIdentifier).toContain('dep-targ');
      expect(depCandidate?.deploymentId).toBe('dep-target-999');
      expect(depCandidate?.businessCriticality).toBe('HIGH');
    });

    it('Scenario 8.2: RegressionComparator retains deploymentId and previousDeploymentId', () => {
      const result = RegressionComparator.compare({
        deploymentId: 'dep-comp-current',
        previousDeploymentId: 'dep-comp-baseline',
        taskResults: [
          {
            taskId: 'task-1',
            status: 'COMPLETED',
            durationMs: 500,
            domain: 'FUNCTIONAL',
            target: { type: 'PAGE', identifier: '/dashboard' },
            observations: [],
          },
        ],
      });

      expect(result.deploymentId).toBe('dep-comp-current');
      expect(result.previousDeploymentId).toBe('dep-comp-baseline');
      expect(result.targets[0].deploymentId).toBe('dep-comp-current');
      expect(result.targets[0].previousDeploymentId).toBe('dep-comp-baseline');
    });
  });

  // ============================================================================
  // Group 9: ImpactMapper DEPLOYMENT Nodes and Edges
  // ============================================================================
  describe('ImpactMapper Deployment Nodes and Edges', () => {
    it('Scenario 9.1: adds DEPLOYMENT node, DEPLOYED_TO, and DEPLOYED_COMMIT edges', () => {
      const graph = ImpactMapper.buildImpactGraph({
        changedFiles: [],
        affectedRoutes: [],
        affectedApis: [],
        affectedWorkflows: [],
        headCommit: 'sha-mapped-commit-12345',
        environment: {
          environmentId: 'env-prod-mapped',
          environmentName: 'Production',
          environmentType: 'PRODUCTION',
          projectId: mockProjectId,
          targetUrl: 'https://prod.sculra.com',
          capturedAt: new Date().toISOString(),
          source: 'PROJECT_ENVIRONMENT',
          availability: 'ONLINE',
        },
        deployment: {
          deploymentId: 'dep-mapped-node',
          deploymentStatus: 'READY',
          environmentId: 'env-prod-mapped',
          commitSha: 'sha-mapped-commit-12345',
        },
      });

      expect(graph.nodes['deployment:dep-mapped-node']).toBeDefined();
      expect(graph.nodes['deployment:dep-mapped-node'].type).toBe('DEPLOYMENT');

      const deployedToEdge = graph.edges.find((e) => e.relationship === 'DEPLOYED_TO');
      expect(deployedToEdge).toBeDefined();
      expect(deployedToEdge?.sourceId).toBe('deployment:dep-mapped-node');
      expect(deployedToEdge?.targetId).toBe('env:env-prod-mapped');

      const deployedCommitEdge = graph.edges.find((e) => e.relationship === 'DEPLOYED_COMMIT');
      expect(deployedCommitEdge).toBeDefined();
      expect(deployedCommitEdge?.sourceId).toBe('deployment:dep-mapped-node');
      expect(deployedCommitEdge?.targetId).toBe('commit:sha-mapped-commit-12345');
    });
  });
});
