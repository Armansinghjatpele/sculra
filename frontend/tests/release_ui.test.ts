import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.stubEnv('NODE_ENV', 'development');

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'dev-anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-123');
});

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => {
      const builder: any = {
        select: vi.fn().mockImplementation(() => builder),
        insert: vi.fn().mockImplementation(() => builder),
        update: vi.fn().mockImplementation(() => builder),
        delete: vi.fn().mockImplementation(() => builder),
        eq: vi.fn().mockImplementation(() => builder),
        order: vi.fn().mockImplementation(() => builder),
        limit: vi.fn().mockImplementation(() => builder),
        single: vi.fn().mockImplementation(async () => ({
          data: null,
          error: { message: 'Test database fallback' },
        })),
        maybeSingle: vi.fn().mockImplementation(async () => ({
          data: null,
          error: { message: 'Test database fallback' },
        })),
        then: vi.fn().mockImplementation((resolve) =>
          resolve({
            data: [],
            error: null,
          })
        ),
      };
      return {
        from: vi.fn().mockImplementation(() => builder),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
        },
      };
    }),
  };
});

import {
  validateEnvironmentUrl,
  getProjectEnvironments,
  createProjectEnvironment,
  getProjectDeployments,
  createProjectDeployment,
  getProjectReleases,
  createProjectRelease,
  createReleaseCheck,
  recordReleaseDecision,
} from '../services/db';
import { PolicyManager } from '../lib/authz/policy';
import { RoleNotAllowedError } from '../lib/authz/authorization-errors';

describe('Prompt 38: Frontend Release Orchestration & Environment Services', () => {
  const token = 'mock-jwt-token';

  // --------------------------------------------------------------------------
  // SSRF Validation Tests
  // --------------------------------------------------------------------------
  it('Enforces strict SSRF defense on environment URLs', () => {
    // Blocked
    expect(validateEnvironmentUrl('http://localhost:3000').valid).toBe(false);
    expect(validateEnvironmentUrl('http://127.0.0.1:8080').valid).toBe(false);
    expect(validateEnvironmentUrl('http://10.0.0.1/app').valid).toBe(false);
    expect(validateEnvironmentUrl('http://192.168.1.1/').valid).toBe(false);
    expect(validateEnvironmentUrl('http://172.16.0.1/').valid).toBe(false);
    expect(validateEnvironmentUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false);
    expect(validateEnvironmentUrl('http://service.internal').valid).toBe(false);
    expect(validateEnvironmentUrl('ftp://example.com').valid).toBe(false);

    // Permitted
    expect(validateEnvironmentUrl('https://staging.example.com').valid).toBe(true);
    expect(validateEnvironmentUrl('https://app.sculra.com/api').valid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Role Protection on Production Environments
  // --------------------------------------------------------------------------
  it('Restricts production environment mutation to Owner and Admin roles', () => {
    // Non-production is allowed for developer
    expect(() => {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: 'DEVELOPER',
        isProduction: false,
        action: 'UPDATE',
      });
    }).not.toThrow();

    // Production mutation blocked for developer and qa lead
    expect(() => {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: 'DEVELOPER',
        isProduction: true,
        action: 'UPDATE',
      });
    }).toThrow(RoleNotAllowedError);

    expect(() => {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: 'QA_LEAD',
        isProduction: true,
        action: 'DELETE',
      });
    }).toThrow(RoleNotAllowedError);

    // Production mutation allowed for OWNER and ADMIN
    expect(() => {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: 'ADMIN',
        isProduction: true,
        action: 'CREATE',
      });
    }).not.toThrow();

    expect(() => {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: 'OWNER',
        isProduction: true,
        action: 'DELETE',
      });
    }).not.toThrow();
  });

  // --------------------------------------------------------------------------
  // Human Release Decision Governance Policy
  // --------------------------------------------------------------------------
  it('Restricts human release decisions according to role and release state', () => {
    // Viewers cannot decide
    expect(() => {
      PolicyManager.evaluateReleaseDecision({
        callerRole: 'VIEWER',
        decision: 'APPROVE',
        releaseStatus: 'READY',
      });
    }).toThrow(RoleNotAllowedError);

    // Cannot alter released versions
    expect(() => {
      PolicyManager.evaluateReleaseDecision({
        callerRole: 'OWNER',
        decision: 'BLOCK',
        releaseStatus: 'RELEASED',
      });
    }).toThrow(RoleNotAllowedError);

    // Authorized roles can record decisions on ready candidates
    expect(() => {
      PolicyManager.evaluateReleaseDecision({
        callerRole: 'QA_LEAD',
        decision: 'APPROVE',
        releaseStatus: 'READY',
      });
    }).not.toThrow();
  });

  // --------------------------------------------------------------------------
  // Database Service Layer Operations
  // --------------------------------------------------------------------------
  it('Performs environment, deployment, release, and check operations in service layer', async () => {
    // 1. Environments
    const envs = await getProjectEnvironments(token, 'proj-1');
    expect(Array.isArray(envs)).toBe(true);

    const createdEnv = await createProjectEnvironment(token, {
      projectId: 'proj-1',
      organizationId: 'org_demo_1',
      name: 'Integration Test Env',
      type: 'PREVIEW',
      baseUrl: 'https://preview-integration.sculra.com',
      isProduction: false,
    });
    expect(createdEnv.name).toBe('Integration Test Env');

    // 2. Deployments
    const deps = await getProjectDeployments(token, 'proj-1');
    expect(Array.isArray(deps)).toBe(true);

    const createdDep = await createProjectDeployment(token, {
      projectId: 'proj-1',
      organizationId: 'org_demo_1',
      environmentId: createdEnv.id,
      commitSha: 'c8d9e0f1',
      status: 'SUCCEEDED',
      provider: 'GITHUB',
      trigger: 'GITHUB_PUSH',
    });
    expect(createdDep.commitSha).toBe('c8d9e0f1');

    // 3. Releases
    const rels = await getProjectReleases(token, 'proj-1');
    expect(Array.isArray(rels)).toBe(true);

    const createdRel = await createProjectRelease(token, {
      projectId: 'proj-1',
      organizationId: 'org_demo_1',
      environmentId: createdEnv.id,
      deploymentId: createdDep.id,
      version: 'v3.0.0-rc.1',
      commitSha: 'c8d9e0f1',
      status: 'CANDIDATE',
    });
    expect(createdRel.version).toBe('v3.0.0-rc.1');

    // 4. Release Checks
    const createdCheck = await createReleaseCheck(token, {
      projectId: 'proj-1',
      organizationId: 'org_demo_1',
      releaseId: createdRel.id,
      policyLevel: 'STANDARD',
      status: 'COMPLETED',
      overallScore: 94.5,
      releaseDecision: 'RELEASE',
      gates: [
        { gate: 'CRITICAL_ISSUES', status: 'PASS', reason: 'Zero critical issues', evidenceRefs: [] },
        { gate: 'REGRESSIONS', status: 'PASS', reason: 'Zero regressions', evidenceRefs: [] },
      ],
      evidenceSummary: { scoringVersion: '1.0' },
    });
    expect(createdCheck.overallScore).toBe(94.5);

    // 5. Release Decisions
    const createdDecision = await recordReleaseDecision(token, {
      projectId: 'proj-1',
      organizationId: 'org_demo_1',
      releaseId: createdRel.id,
      decision: 'APPROVE',
      decidedBy: 'qa-lead-user',
      decidedByRole: 'QA_LEAD',
      notes: 'Sign-off complete',
    });
    expect(createdDecision.decision).toBe('APPROVE');
  });
});
