// ==============================================================================
// Sculra Centralized Authorization Unit & Security Tests (frontend/tests/authz.test.ts)
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasPermission,
  mapClerkRoleToSculra,
  requirePermission,
  requireRole,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  PolicyManager,
  PermissionDeniedError,
  OwnerSafetyError,
  RoleNotAllowedError,
  ResourceAccessDeniedError,
  AuthContext,
} from '../lib/authz';
import { requireProjectAccess } from '../lib/authz/project-access';

vi.mock('../services/db', () => ({
  getProject: vi.fn(),
}));

describe('Sculra Centralized Authorization Architecture (Frontend)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Role-to-Permission Mapping Matrix', () => {
    it('OWNER should hold all operational, lifecycle, and governance permissions', () => {
      expect(hasPermission('OWNER', PERMISSIONS.ORGANIZATION_DELETE)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.MEMBERS_TRANSFER_OWNERSHIP)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.CAMPAIGNS_START)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.FIX_AGENT_APPLY)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.FIX_AGENT_CREATE_PR)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.APPROVALS_APPROVE)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.SETTINGS_UPDATE)).toBe(true);
    });

    it('ADMIN should hold member & project management, but not organization delete or ownership transfer', () => {
      expect(hasPermission('ADMIN', PERMISSIONS.MEMBERS_INVITE)).toBe(true);
      expect(hasPermission('ADMIN', PERMISSIONS.MEMBERS_CHANGE_ROLE)).toBe(true);
      expect(hasPermission('ADMIN', PERMISSIONS.PROJECTS_CREATE)).toBe(true);
      expect(hasPermission('ADMIN', PERMISSIONS.CAMPAIGNS_START)).toBe(true);
      expect(hasPermission('ADMIN', PERMISSIONS.FIX_AGENT_CONFIGURE)).toBe(true);

      // Prohibited critical lifecycle actions
      expect(hasPermission('ADMIN', PERMISSIONS.ORGANIZATION_DELETE)).toBe(false);
      expect(hasPermission('ADMIN', PERMISSIONS.MEMBERS_TRANSFER_OWNERSHIP)).toBe(false);
    });

    it('QA_LEAD should control campaigns, tests, and strategy, but not member management', () => {
      expect(hasPermission('QA_LEAD', PERMISSIONS.CAMPAIGNS_START)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.CAMPAIGNS_CREATE)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.TESTS_RUN)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.RELEASE_EVALUATE)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.STRATEGY_CONFIGURE)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.APPROVALS_APPROVE)).toBe(true);

      // Prohibited member operations
      expect(hasPermission('QA_LEAD', PERMISSIONS.MEMBERS_INVITE)).toBe(false);
      expect(hasPermission('QA_LEAD', PERMISSIONS.MEMBERS_REMOVE)).toBe(false);
      expect(hasPermission('QA_LEAD', PERMISSIONS.MEMBERS_CHANGE_ROLE)).toBe(false);
      expect(hasPermission('QA_LEAD', PERMISSIONS.ORGANIZATION_UPDATE)).toBe(false);
    });

    it('DEVELOPER should inspect findings, triage issues, and plan fixes, but cannot start campaigns', () => {
      expect(hasPermission('DEVELOPER', PERMISSIONS.PROJECTS_READ)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.ISSUES_READ)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.ISSUES_UPDATE)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.ISSUES_RESOLVE)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.FIX_AGENT_PLAN)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.REMEDIATION_REQUEST)).toBe(true);

      // Mutations prohibited
      expect(hasPermission('DEVELOPER', PERMISSIONS.CAMPAIGNS_START)).toBe(false);
      expect(hasPermission('DEVELOPER', PERMISSIONS.TESTS_RUN)).toBe(false);
      expect(hasPermission('DEVELOPER', PERMISSIONS.FIX_AGENT_APPLY)).toBe(false);
      expect(hasPermission('DEVELOPER', PERMISSIONS.MEMBERS_INVITE)).toBe(false);
    });

    it('VIEWER should hold read-only permissions across all surfaces and zero mutations', () => {
      expect(hasPermission('VIEWER', PERMISSIONS.PROJECTS_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.SOURCES_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.CAMPAIGNS_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.TESTS_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.ISSUES_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.OBSERVABILITY_READ)).toBe(true);

      expect(hasPermission('VIEWER', PERMISSIONS.CAMPAIGNS_START)).toBe(false);
      expect(hasPermission('VIEWER', PERMISSIONS.ISSUES_UPDATE)).toBe(false);
      expect(hasPermission('VIEWER', PERMISSIONS.FIX_AGENT_PLAN)).toBe(false);
      expect(hasPermission('VIEWER', PERMISSIONS.SOURCES_CREATE)).toBe(false);
    });
  });

  describe('Clerk Role Mapping Layer', () => {
    it('should map Clerk org:admin and owner roles to canonical ADMIN and OWNER', () => {
      expect(mapClerkRoleToSculra('org:admin')).toBe('ADMIN');
      expect(mapClerkRoleToSculra('admin')).toBe('ADMIN');
      expect(mapClerkRoleToSculra('org:owner')).toBe('OWNER');
      expect(mapClerkRoleToSculra('owner')).toBe('OWNER');
    });

    it('should map Clerk member to DEVELOPER and custom QA roles to QA_LEAD', () => {
      expect(mapClerkRoleToSculra('org:member')).toBe('DEVELOPER');
      expect(mapClerkRoleToSculra('member')).toBe('DEVELOPER');
      expect(mapClerkRoleToSculra('developer')).toBe('DEVELOPER');
      expect(mapClerkRoleToSculra('qa_lead')).toBe('QA_LEAD');
      expect(mapClerkRoleToSculra('org:qa_lead')).toBe('QA_LEAD');
      expect(mapClerkRoleToSculra('qa')).toBe('QA_LEAD');
    });

    it('should default unrecognized or null roles to VIEWER (least privilege)', () => {
      expect(mapClerkRoleToSculra('org:viewer')).toBe('VIEWER');
      expect(mapClerkRoleToSculra('unknown_custom_role')).toBe('VIEWER');
      expect(mapClerkRoleToSculra(null)).toBe('VIEWER');
      expect(mapClerkRoleToSculra(undefined)).toBe('VIEWER');
    });
  });

  describe('requirePermission & requireRole Guards', () => {
    const mockContext: AuthContext = {
      actorType: 'HUMAN_ACTOR',
      userId: 'user_123',
      orgId: 'org_123',
      orgRole: 'org:member',
      role: 'DEVELOPER',
      membershipStatus: 'ACTIVE',
      permissions: ROLE_PERMISSIONS['DEVELOPER'],
      clerkToken: 'mock-token',
      isPersonalWorkspace: false,
    };

    it('should pass without error if permission is held', () => {
      expect(() => requirePermission(mockContext, PERMISSIONS.ISSUES_UPDATE)).not.toThrow();
    });

    it('should throw structured PermissionDeniedError (403) if permission is missing', () => {
      expect(() => requirePermission(mockContext, PERMISSIONS.CAMPAIGNS_START)).toThrow(PermissionDeniedError);
    });

    it('should assert required role successfully', () => {
      expect(() => requireRole(mockContext, ['DEVELOPER', 'ADMIN'])).not.toThrow();
      expect(() => requireRole(mockContext, ['OWNER', 'ADMIN'])).toThrow(PermissionDeniedError);
    });
  });

  describe('Owner Safety & Role Policy Governance', () => {
    it('should reject demoting the sole organization owner', () => {
      expect(() => {
        PolicyManager.evaluateRoleChange({
          callerRole: 'OWNER',
          targetCurrentRole: 'OWNER',
          targetNewRole: 'ADMIN',
          activeOwnerCount: 1,
          isSelfOperation: true,
        });
      }).toThrow(OwnerSafetyError);
    });

    it('should reject non-owners attempting to assign or manage the OWNER role', () => {
      expect(() => {
        PolicyManager.evaluateRoleChange({
          callerRole: 'ADMIN',
          targetCurrentRole: 'DEVELOPER',
          targetNewRole: 'OWNER',
          activeOwnerCount: 1,
          isSelfOperation: false,
        });
      }).toThrow(RoleNotAllowedError);
    });

    it('should reject assigning a role higher than caller rank', () => {
      expect(() => {
        PolicyManager.evaluateRoleChange({
          callerRole: 'QA_LEAD',
          targetCurrentRole: 'DEVELOPER',
          targetNewRole: 'ADMIN',
          activeOwnerCount: 1,
          isSelfOperation: false,
        });
      }).toThrow(RoleNotAllowedError);
    });

    it('should reject removing the sole owner', () => {
      expect(() => {
        PolicyManager.evaluateMemberRemoval({
          callerRole: 'OWNER',
          targetCurrentRole: 'OWNER',
          activeOwnerCount: 1,
          isSelfOperation: true,
        });
      }).toThrow(OwnerSafetyError);
    });

    it('should reject Admins removing other Admins', () => {
      expect(() => {
        PolicyManager.evaluateMemberRemoval({
          callerRole: 'ADMIN',
          targetCurrentRole: 'ADMIN',
          activeOwnerCount: 1,
          isSelfOperation: false,
        });
      }).toThrow(RoleNotAllowedError);
    });
  });

  describe('Sensitive Action Policies', () => {
    it('evaluateFixAgentApply should reject if Fix Agent is disabled', () => {
      const res = PolicyManager.evaluateFixAgentApply({
        fixAgentEnabled: false,
        allowedBranches: ['main'],
        targetBranch: 'main',
        sourceSha: 'abc1234',
        requiresApproval: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('disabled');
    });

    it('evaluateFixAgentApply should reject if branch is not allowed', () => {
      const res = PolicyManager.evaluateFixAgentApply({
        fixAgentEnabled: true,
        allowedBranches: ['main', 'master'],
        targetBranch: 'feature/unprotected',
        sourceSha: 'abc1234',
        requiresApproval: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('not in the project\'s allowed branches');
    });

    it('evaluateFixAgentApply should reject if approval is expired', () => {
      const res = PolicyManager.evaluateFixAgentApply({
        fixAgentEnabled: true,
        allowedBranches: ['main'],
        targetBranch: 'main',
        sourceSha: 'abc1234',
        requiresApproval: true,
        approvalStatus: 'APPROVED',
        approvalExpiresAt: new Date(Date.now() - 3600000).toISOString(), // expired 1h ago
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('expired');
    });

    it('evaluateCreatePr should reject if verification did not pass', () => {
      const res = PolicyManager.evaluateCreatePr({
        verificationStatus: 'FAILED',
        allowedBranches: ['main'],
        targetBranch: 'main',
        sourceSha: 'abc1234',
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Verification status is "FAILED"');
    });
  });

  describe('Multi-Tenant Project Access & IDOR Defense', () => {
    const orgContext: AuthContext = {
      actorType: 'HUMAN_ACTOR',
      userId: 'user_123',
      orgId: 'org_tenant_1',
      orgRole: 'org:admin',
      role: 'ADMIN',
      membershipStatus: 'ACTIVE',
      permissions: ROLE_PERMISSIONS['ADMIN'],
      clerkToken: 'token_123',
      isPersonalWorkspace: false,
    };

    it('should throw ResourceAccessDeniedError (404) if project is missing', async () => {
      const { getProject } = await import('../services/db');
      vi.mocked(getProject).mockResolvedValue(null as any);

      await expect(requireProjectAccess(orgContext, 'non_existent_proj')).rejects.toThrow(
        ResourceAccessDeniedError
      );
    });

    it('should return project if it belongs to current workspace', async () => {
      const { getProject } = await import('../services/db');
      vi.mocked(getProject).mockResolvedValue({
        id: 'proj-1',
        organization_id: 'internal_org_uuid',
        created_by: 'user_123',
      } as any);

      const res = await requireProjectAccess(orgContext, 'proj-1');
      expect(res.project.id).toBe('proj-1');
    });
  });
});
