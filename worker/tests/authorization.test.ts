// ==============================================================================
// Sculra Worker Authorization & Policy Tests (worker/tests/authorization.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  WorkerPolicyManager,
  WorkerAuthorizationError,
  ServiceIdentityManager,
  WorkerServiceImpersonationError,
  WorkerServiceIdentity,
} from '../src/authz';

describe('Sculra Centralized Authorization Engine', () => {
  describe('Role-Permission Mapping Invariants', () => {
    it('OWNER should possess all permissions including critical lifecycle actions', () => {
      expect(hasPermission('OWNER', PERMISSIONS.ORGANIZATION_DELETE)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.MEMBERS_TRANSFER_OWNERSHIP)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.MEMBERS_INVITE)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.CAMPAIGNS_START)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.FIX_AGENT_APPLY)).toBe(true);
      expect(hasPermission('OWNER', PERMISSIONS.FIX_AGENT_CREATE_PR)).toBe(true);
    });

    it('ADMIN should possess operational permissions but not organization deletion or ownership transfer', () => {
      expect(hasPermission('ADMIN', PERMISSIONS.MEMBERS_INVITE)).toBe(true);
      expect(hasPermission('ADMIN', PERMISSIONS.CAMPAIGNS_START)).toBe(true);
      expect(hasPermission('ADMIN', PERMISSIONS.PROJECTS_CREATE)).toBe(true);
      expect(hasPermission('ADMIN', PERMISSIONS.FIX_AGENT_CONFIGURE)).toBe(true);

      // Explicit prohibitions
      expect(hasPermission('ADMIN', PERMISSIONS.ORGANIZATION_DELETE)).toBe(false);
      expect(hasPermission('ADMIN', PERMISSIONS.MEMBERS_TRANSFER_OWNERSHIP)).toBe(false);
    });

    it('QA_LEAD should control campaigns, test execution, and QA findings but not membership', () => {
      expect(hasPermission('QA_LEAD', PERMISSIONS.CAMPAIGNS_START)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.CAMPAIGNS_CREATE)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.TESTS_RUN)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.SECURITY_RUN)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.RELEASE_EVALUATE)).toBe(true);
      expect(hasPermission('QA_LEAD', PERMISSIONS.APPROVALS_APPROVE)).toBe(true);

      // Prohibited from member management and workspace deletion
      expect(hasPermission('QA_LEAD', PERMISSIONS.MEMBERS_INVITE)).toBe(false);
      expect(hasPermission('QA_LEAD', PERMISSIONS.MEMBERS_REMOVE)).toBe(false);
      expect(hasPermission('QA_LEAD', PERMISSIONS.MEMBERS_CHANGE_ROLE)).toBe(false);
      expect(hasPermission('QA_LEAD', PERMISSIONS.ORGANIZATION_UPDATE)).toBe(false);
      expect(hasPermission('QA_LEAD', PERMISSIONS.ORGANIZATION_DELETE)).toBe(false);
    });

    it('DEVELOPER should inspect QA, triage issues, and plan fixes, but not execute unapproved mutations', () => {
      expect(hasPermission('DEVELOPER', PERMISSIONS.PROJECTS_READ)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.ISSUES_READ)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.ISSUES_UPDATE)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.ISSUES_RESOLVE)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.FIX_AGENT_PLAN)).toBe(true);
      expect(hasPermission('DEVELOPER', PERMISSIONS.REMEDIATION_REQUEST)).toBe(true);

      // Prohibited from launching campaigns, executing fixes without approval, or changing membership
      expect(hasPermission('DEVELOPER', PERMISSIONS.CAMPAIGNS_START)).toBe(false);
      expect(hasPermission('DEVELOPER', PERMISSIONS.TESTS_RUN)).toBe(false);
      expect(hasPermission('DEVELOPER', PERMISSIONS.FIX_AGENT_APPLY)).toBe(false);
      expect(hasPermission('DEVELOPER', PERMISSIONS.FIX_AGENT_CREATE_PR)).toBe(false);
      expect(hasPermission('DEVELOPER', PERMISSIONS.MEMBERS_INVITE)).toBe(false);
    });

    it('VIEWER should possess strictly read-only permissions and zero mutation capabilities', () => {
      // Allowed reads
      expect(hasPermission('VIEWER', PERMISSIONS.PROJECTS_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.CAMPAIGNS_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.TESTS_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.ISSUES_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.REPORTS_READ)).toBe(true);
      expect(hasPermission('VIEWER', PERMISSIONS.OBSERVABILITY_READ)).toBe(true);

      // Prohibited mutations
      expect(hasPermission('VIEWER', PERMISSIONS.CAMPAIGNS_START)).toBe(false);
      expect(hasPermission('VIEWER', PERMISSIONS.CAMPAIGNS_CREATE)).toBe(false);
      expect(hasPermission('VIEWER', PERMISSIONS.TESTS_RUN)).toBe(false);
      expect(hasPermission('VIEWER', PERMISSIONS.ISSUES_UPDATE)).toBe(false);
      expect(hasPermission('VIEWER', PERMISSIONS.FIX_AGENT_PLAN)).toBe(false);
      expect(hasPermission('VIEWER', PERMISSIONS.MEMBERS_INVITE)).toBe(false);
    });

    it('Unknown or invalid roles should receive zero permissions', () => {
      expect(hasPermission('GUEST_ANON' as any, PERMISSIONS.PROJECTS_READ)).toBe(false);
      expect(hasPermission('UNKNOWN_ROLE' as any, PERMISSIONS.CAMPAIGNS_START)).toBe(false);
      expect(hasPermission('' as any, PERMISSIONS.ISSUES_READ)).toBe(false);
    });
  });

  describe('Owner Safety & Role Policy Evaluation', () => {
    it('should reject demoting the sole organization owner', () => {
      expect(() => {
        WorkerPolicyManager.evaluateRoleChange({
          callerRole: 'OWNER',
          targetCurrentRole: 'OWNER',
          targetNewRole: 'ADMIN',
          activeOwnerCount: 1,
          isSelf: true,
        });
      }).toThrow(WorkerAuthorizationError);
    });

    it('should permit owner demotion if another active owner exists', () => {
      expect(() => {
        WorkerPolicyManager.evaluateRoleChange({
          callerRole: 'OWNER',
          targetCurrentRole: 'OWNER',
          targetNewRole: 'ADMIN',
          activeOwnerCount: 2,
          isSelf: true,
        });
      }).not.toThrow();
    });

    it('should prohibit non-owners from assigning the OWNER role', () => {
      expect(() => {
        WorkerPolicyManager.evaluateRoleChange({
          callerRole: 'ADMIN',
          targetCurrentRole: 'DEVELOPER',
          targetNewRole: 'OWNER',
          activeOwnerCount: 1,
          isSelf: false,
        });
      }).toThrow('Only Owners can assign or manage Owner roles');
    });

    it('should prohibit users from assigning a role higher than their own', () => {
      expect(() => {
        WorkerPolicyManager.evaluateRoleChange({
          callerRole: 'QA_LEAD',
          targetCurrentRole: 'DEVELOPER',
          targetNewRole: 'ADMIN',
          activeOwnerCount: 1,
          isSelf: false,
        });
      }).toThrow(/cannot assign higher role/);
    });

    it('should reject removing the sole owner', () => {
      expect(() => {
        WorkerPolicyManager.evaluateMemberRemoval({
          callerRole: 'OWNER',
          targetRole: 'OWNER',
          activeOwnerCount: 1,
          isSelf: true,
        });
      }).toThrow('Cannot remove the sole organization owner');
    });

    it('should reject non-owners attempting to remove an owner', () => {
      expect(() => {
        WorkerPolicyManager.evaluateMemberRemoval({
          callerRole: 'ADMIN',
          targetRole: 'OWNER',
          activeOwnerCount: 2,
          isSelf: false,
        });
      }).toThrow('Non-owners cannot remove an organization owner');
    });

    it('should reject Admins attempting to remove other Admins', () => {
      expect(() => {
        WorkerPolicyManager.evaluateMemberRemoval({
          callerRole: 'ADMIN',
          targetRole: 'ADMIN',
          activeOwnerCount: 1,
          isSelf: false,
        });
      }).toThrow('Admins cannot remove other Admins');
    });

    it('should permit Owner removing an Admin or Member', () => {
      expect(() => {
        WorkerPolicyManager.evaluateMemberRemoval({
          callerRole: 'OWNER',
          targetRole: 'ADMIN',
          activeOwnerCount: 1,
          isSelf: false,
        });
      }).not.toThrow();

      expect(() => {
        WorkerPolicyManager.evaluateMemberRemoval({
          callerRole: 'OWNER',
          targetRole: 'DEVELOPER',
          activeOwnerCount: 1,
          isSelf: false,
        });
      }).not.toThrow();
    });
  });

  describe('Service Identity & Tenant Scoping', () => {
    const mockIdentity: WorkerServiceIdentity = {
      actorType: 'WORKER_ACTOR',
      organizationId: 'org-tenant-1',
      projectId: 'proj-100',
      campaignId: 'camp-500',
      jobId: 'job-999',
      tokenHash: 'sha256_mock_hash',
    };

    it('should approve worker execution within its scoped organization and project', () => {
      expect(() => {
        ServiceIdentityManager.validateWorkerJobScope(mockIdentity, 'org-tenant-1', 'proj-100');
      }).not.toThrow();
    });

    it('should reject worker attempting to access a different organization (cross-tenant violation)', () => {
      expect(() => {
        ServiceIdentityManager.validateWorkerJobScope(mockIdentity, 'org-tenant-2', 'proj-100');
      }).toThrow(/Cross-organization violation/);
    });

    it('should reject worker attempting to access a different project', () => {
      expect(() => {
        ServiceIdentityManager.validateWorkerJobScope(mockIdentity, 'org-tenant-1', 'proj-999');
      }).toThrow(/Cross-project violation/);
    });

    it('should reject background worker attempting to impersonate an arbitrary human user', () => {
      expect(() => {
        ServiceIdentityManager.assertNoUserImpersonation(mockIdentity, 'user_human_456');
      }).toThrow(WorkerServiceImpersonationError);
    });

    it('should permit background worker running under system service actor identity', () => {
      expect(() => {
        ServiceIdentityManager.assertNoUserImpersonation(mockIdentity, 'WORKER_DAEMON');
        ServiceIdentityManager.assertNoUserImpersonation(mockIdentity, 'SYSTEM_SERVICE_ACTOR');
      }).not.toThrow();
    });
  });
});
