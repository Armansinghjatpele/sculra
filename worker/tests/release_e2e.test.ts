// ==============================================================================
// Sculra Release Orchestration & Environment QA — End-to-End Lifecycle Test
// (worker/tests/release_e2e.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  EnvironmentManager,
  DeploymentManager,
  ReleaseManager,
  ReleaseOrchestrator,
  EnvironmentValidator,
} from '../src/release';
import { PolicyManager } from '../src/authz/policy';

describe('Prompt 38: Release Orchestration End-to-End Flow', () => {
  it('Executes the full pipeline: Environment -> Deployment -> Gates -> Correlation -> Decision', async () => {
    // 1. Validate & Create Environment
    const urlValidation = await EnvironmentValidator.validateEnvironmentUrl('https://staging-app.sculra.com', { skipProbe: true });
    expect(urlValidation.valid).toBe(true);

    const env = EnvironmentManager.createEnvironment({
      organizationId: 'org-e2e',
      projectId: 'proj-e2e',
      name: 'Staging Environment',
      type: 'STAGING',
      baseUrl: 'https://staging-app.sculra.com',
      branch: 'develop',
      isProduction: false,
    });
    expect(env.slug).toBe('staging-environment');
    expect(env.isProduction).toBe(false);

    // 2. Register Confirmed Deployment
    const dep = DeploymentManager.createDeployment({
      organizationId: 'org-e2e',
      projectId: 'proj-e2e',
      environmentId: env.id,
      commitSha: '6d8b2a1e94fc07b5a12d',
      branch: 'develop',
      deploymentUrl: 'https://staging-app.sculra.com',
      status: 'SUCCEEDED',
      provider: 'GITHUB',
      trigger: 'GITHUB_PUSH',
    });
    expect(dep.status).toBe('SUCCEEDED');

    // 3. Register Release Candidate
    const rel = ReleaseManager.createRelease({
      organizationId: 'org-e2e',
      projectId: 'proj-e2e',
      environmentId: env.id,
      deploymentId: dep.id,
      version: 'v2.4.1-rc.1',
      commitSha: dep.commitSha,
      branch: dep.branch,
      status: 'CANDIDATE',
    });
    expect(rel.status).toBe('CANDIDATE');

    // 4. State transition: CANDIDATE -> TESTING
    const testingRel = ReleaseManager.transitionStatus(rel, 'TESTING');
    expect(testingRel.status).toBe('TESTING');

    // 5. Prioritize QA targets
    const prioritizedTargets = ReleaseOrchestrator.prioritizeTargetsForRelease({
      commitSha: dep.commitSha,
      changedFiles: ['src/billing/checkout.ts', 'src/api/routes.ts'],
      availableTargets: [
        { id: 't-1', route: '/blog', sourceFile: 'src/content/blog.ts' },
        { id: 't-2', route: '/checkout', sourceFile: 'src/billing/checkout.ts' },
      ],
    });
    expect(prioritizedTargets[0].route).toBe('/checkout');

    // 6. Evaluate Release Check with Authoritative Scorer
    const checkResult = ReleaseOrchestrator.evaluateReleaseCheck({
      release: testingRel,
      environment: env,
      policyLevel: 'STANDARD',
      testRuns: [
        { id: 'run-1', status: 'PASSED', overall_score: 95, duration_ms: 1000 },
        { id: 'run-2', status: 'PASSED', overall_score: 92, duration_ms: 1100 },
        { id: 'run-3', status: 'PASSED', overall_score: 94, duration_ms: 950 },
      ],
      openIssues: [],
    });

    expect(['RELEASE', 'RELEASE_WITH_CAUTION']).toContain(checkResult.checkRecord.releaseDecision);
    expect(checkResult.checkRecord.overallScore).toBeGreaterThanOrEqual(80);
    expect(checkResult.checkRecord.gates).toHaveLength(10);

    // 7. Transition to READY
    const readyRel = ReleaseManager.transitionStatus(testingRel, 'READY');
    expect(readyRel.status).toBe('READY');

    // 8. Role-based Governance Decision
    PolicyManager.evaluateReleaseDecision({
      callerRole: 'QA_LEAD',
      decision: 'APPROVE',
      releaseStatus: readyRel.status,
    });

    // 9. Transition to RELEASED
    const releasedRel = ReleaseManager.transitionStatus(readyRel, 'RELEASED');
    expect(releasedRel.status).toBe('RELEASED');
  });
});
