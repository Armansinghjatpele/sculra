import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RoleBadge } from '../components/authz/RoleBadge';
import { PermissionGate } from '../components/authz/PermissionGate';
import { PermissionButton } from '../components/authz/PermissionButton';
import { AccessDenied } from '../components/authz/AccessDenied';
import { PERMISSIONS, ALL_ROLES } from '../lib/authz';
import {
  getOrganizationMembers,
  inviteOrganizationMember,
  updateOrganizationMemberRole,
  removeOrganizationMember,
} from '../services/db';

vi.stubEnv('NODE_ENV', 'development');

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-valid-anon-key');
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
        maybeSingle: vi.fn().mockImplementation(async () => ({ data: { id: 'org_demo_1' }, error: null })),
        single: vi.fn().mockImplementation(async () => ({ data: null, error: { message: 'fallback' } })),
        then: vi.fn().mockImplementation((resolve) =>
          resolve({ data: null, error: { message: 'network fallback' } })
        ),
      };
      return {
        from: vi.fn().mockReturnValue(builder),
      };
    }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    back: vi.fn(),
    push: vi.fn(),
  })),
}));

vi.mock('@clerk/nextjs', () => ({
  useOrganization: vi.fn(() => ({
    organization: { id: 'org_demo_1', name: 'Acme QA Labs' },
    membership: { role: 'org:member' },
    isLoaded: true,
  })),
  useUser: vi.fn(() => ({
    user: { id: 'user_dev_1', fullName: 'Developer User' },
  })),
}));

describe('Team & Role Governance UI Components', () => {
  describe('RoleBadge Component', () => {
    it('should render distinct badges for all canonical roles', () => {
      for (const role of ALL_ROLES) {
        const html = renderToString(React.createElement(RoleBadge, { role }));
        expect(html).toContain(role === 'QA_LEAD' ? 'QA Lead' : role.charAt(0) + role.slice(1).toLowerCase());
      }
    });

    it('should default unrecognized roles to Viewer', () => {
      const html = renderToString(React.createElement(RoleBadge, { role: 'UNKNOWN_ROLE' as any }));
      expect(html).toContain('Viewer');
    });
  });

  describe('PermissionGate Component', () => {
    it('should render children when userRole has permission', () => {
      const html = renderToString(
        React.createElement(
          PermissionGate,
          {
            permission: PERMISSIONS.CAMPAIGNS_START,
            userRole: 'QA_LEAD',
            fallback: React.createElement('div', null, 'Fallback Forbidden'),
          },
          React.createElement('div', null, 'Protected Content Rendered')
        )
      );
      expect(html).toContain('Protected Content Rendered');
      expect(html).not.toContain('Fallback Forbidden');
    });

    it('should render fallback when userRole lacks permission', () => {
      const html = renderToString(
        React.createElement(
          PermissionGate,
          {
            permission: PERMISSIONS.CAMPAIGNS_START,
            userRole: 'DEVELOPER',
            fallback: React.createElement('div', null, 'Fallback Forbidden'),
          },
          React.createElement('div', null, 'Protected Content Rendered')
        )
      );
      expect(html).toContain('Fallback Forbidden');
      expect(html).not.toContain('Protected Content Rendered');
    });
  });

  describe('PermissionButton Component', () => {
    it('should render disabled button with lock icon when permission is missing', () => {
      const html = renderToString(
        React.createElement(
          PermissionButton,
          {
            permission: PERMISSIONS.CAMPAIGNS_START,
            userRole: 'DEVELOPER',
            mode: 'disabled',
          },
          'Launch Campaign'
        )
      );
      expect(html).toContain('disabled');
      expect(html).toContain('Launch Campaign');
    });

    it('should hide button when permission is missing and mode is hidden', () => {
      const html = renderToString(
        React.createElement(
          PermissionButton,
          {
            permission: PERMISSIONS.ORGANIZATION_DELETE,
            userRole: 'DEVELOPER',
            mode: 'hidden',
          },
          'Delete Workspace'
        )
      );
      expect(html).toBe('');
    });
  });

  describe('AccessDenied Component', () => {
    it('should render accessible access denied message', () => {
      const html = renderToString(
        React.createElement(AccessDenied, {
          title: 'Restricted Action',
          userRole: 'DEVELOPER',
          requiredPermission: PERMISSIONS.CAMPAIGNS_START,
        })
      );
      expect(html).toContain('Restricted Action');
      expect(html).toContain('DEVELOPER');
      expect(html).toContain(PERMISSIONS.CAMPAIGNS_START);
    });
  });

  describe('Organization Member Database Services', () => {
    it('should list organization members without fake metrics', async () => {
      const members = await getOrganizationMembers('mock-token', 'org_demo_1');
      expect(members.length).toBeGreaterThanOrEqual(4);

      // Verify at least one owner, admin, qa_lead, developer
      const roles = members.map((m) => m.role);
      expect(roles).toContain('OWNER');
      expect(roles).toContain('ADMIN');
      expect(roles).toContain('QA_LEAD');
      expect(roles).toContain('DEVELOPER');
    });

    it('should invite a new member with requested role', async () => {
      const newMember = await inviteOrganizationMember(
        'mock-token',
        'org_demo_1',
        'new.engineer@test.com',
        'DEVELOPER',
        'user_admin_1'
      );
      expect(newMember.email).toBe('new.engineer@test.com');
      expect(newMember.role).toBe('DEVELOPER');
      expect(newMember.status).toBe('INVITED');
    });

    it('should update member role under valid authorization', async () => {
      const members = await getOrganizationMembers('mock-token', 'org_demo_1');
      const dev = members.find((m) => m.role === 'DEVELOPER');
      expect(dev).toBeDefined();

      const updated = await updateOrganizationMemberRole(
        'mock-token',
        'org_demo_1',
        dev!.id,
        'QA_LEAD',
        'OWNER',
        'user_owner_1'
      );
      expect(updated.role).toBe('QA_LEAD');
    });

    it('should enforce owner safety: sole owner cannot be demoted or removed', async () => {
      const members = await getOrganizationMembers('mock-token', 'org_demo_1');
      const owner = members.find((m) => m.role === 'OWNER');
      expect(owner).toBeDefined();

      // Attempt to demote sole owner
      await expect(
        updateOrganizationMemberRole(
          'mock-token',
          'org_demo_1',
          owner!.id,
          'DEVELOPER',
          'OWNER',
          owner!.userId
        )
      ).rejects.toThrow();

      // Attempt to remove sole owner
      await expect(
        removeOrganizationMember(
          'mock-token',
          'org_demo_1',
          owner!.id,
          'OWNER',
          owner!.userId
        )
      ).rejects.toThrow();
    });
  });
});
