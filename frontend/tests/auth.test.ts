import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireUser, requireOrganization, requireRole, mapClerkRoleToSculra, hasPermission } from '../lib/auth';
import { AuthError, PermissionError } from '../../shared/utils/errors';

// Mock Clerk server functions
vi.mock('@clerk/nextjs/server', () => {
  return {
    auth: vi.fn(),
    currentUser: vi.fn(),
  };
});

describe('Sculra Clerk Authentication Layer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('requireUser()', () => {
    it('should throw AuthError if userId is missing', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      await expect(requireUser()).rejects.toThrow(AuthError);
    });

    it('should return userId and user object if session is authenticated', async () => {
      const { auth, currentUser } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
      vi.mocked(currentUser).mockResolvedValue({ id: 'user_123', emailAddresses: [{ emailAddress: 'test@sculra.com' }] } as any);

      const res = await requireUser();
      expect(res.userId).toBe('user_123');
      expect(res.user?.id).toBe('user_123');
    });
  });

  describe('requireOrganization()', () => {
    it('should throw PermissionError if user has no selected organization', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'user_123', orgId: null } as any);

      await expect(requireOrganization()).rejects.toThrow(PermissionError);
    });

    it('should return orgId if user has an active organization session', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'user_123', orgId: 'org_123', orgRole: 'org:member' } as any);

      const res = await requireOrganization();
      expect(res.orgId).toBe('org_123');
      expect(res.orgRole).toBe('org:member');
    });
  });

  describe('mapClerkRoleToSculra()', () => {
    it('should map Clerk admin role to ADMIN', () => {
      expect(mapClerkRoleToSculra('org:admin')).toBe('ADMIN');
      expect(mapClerkRoleToSculra('admin')).toBe('ADMIN');
      expect(mapClerkRoleToSculra('owner')).toBe('ADMIN');
    });

    it('should map Clerk member role to DEVELOPER', () => {
      expect(mapClerkRoleToSculra('org:member')).toBe('DEVELOPER');
      expect(mapClerkRoleToSculra('member')).toBe('DEVELOPER');
    });

    it('should map custom roles to QA and VIEWER', () => {
      expect(mapClerkRoleToSculra('qa_engineer')).toBe('QA');
      expect(mapClerkRoleToSculra('viewer')).toBe('VIEWER');
    });

    it('should return null for undefined roles', () => {
      expect(mapClerkRoleToSculra(undefined)).toBeNull();
    });
  });

  describe('hasPermission()', () => {
    it('should approve permissions if role is allowed', () => {
      expect(hasPermission('org:admin', ['ADMIN', 'DEVELOPER'])).toBe(true);
      expect(hasPermission('org:member', ['ADMIN'])).toBe(false);
      expect(hasPermission('org:member', ['DEVELOPER'])).toBe(true);
    });
  });
});
