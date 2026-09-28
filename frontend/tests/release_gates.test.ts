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

import { PERMISSIONS, PERMISSION_CATEGORIES } from '../lib/authz/permissions';
import { hasPermission } from '../lib/authz/role-permissions';
import { mapClerkRoleToSculra } from '../lib/authz/roles';
import { requirePermission } from '../lib/authz/permission-check';
import { AuthContext } from '../lib/authz';
import { PermissionDeniedError } from '../lib/authz/authorization-errors';

describe('Prompt 63: Frontend Release Gate RBAC & Permissions', () => {
  it('registers release_gates permission category with complete definitions', () => {
    const category = PERMISSION_CATEGORIES.find((g) => g.id === 'release_gates');
    expect(category).toBeDefined();
    expect(category?.name).toBe('Release Gates & CD Automation');

    const permKeys = category?.permissions.map((p) => p.key) || [];
    expect(permKeys).toContain(PERMISSIONS.RELEASE_GATES_READ);
    expect(permKeys).toContain(PERMISSIONS.RELEASE_GATES_EVALUATE);
    expect(permKeys).toContain(PERMISSIONS.RELEASE_GATES_APPROVE);
    expect(permKeys).toContain(PERMISSIONS.RELEASE_GATES_OVERRIDE);
    expect(permKeys).toContain(PERMISSIONS.RELEASE_GATES_CONFIGURE);
  });

  it('marks override and configure permissions as sensitive', () => {
    const category = PERMISSION_CATEGORIES.find((g) => g.id === 'release_gates');
    const overridePerm = category?.permissions.find((p) => p.key === PERMISSIONS.RELEASE_GATES_OVERRIDE);
    const configPerm = category?.permissions.find((p) => p.key === PERMISSIONS.RELEASE_GATES_CONFIGURE);
    const readPerm = category?.permissions.find((p) => p.key === PERMISSIONS.RELEASE_GATES_READ);

    expect(overridePerm?.isSensitive).toBe(true);
    expect(configPerm?.isSensitive).toBe(true);
    expect(readPerm?.isSensitive).toBeFalsy();
  });

  it('allows ADMIN and OWNER to evaluate, approve, and override release gates', () => {
    expect(hasPermission('ADMIN', PERMISSIONS.RELEASE_GATES_READ)).toBe(true);
    expect(hasPermission('ADMIN', PERMISSIONS.RELEASE_GATES_EVALUATE)).toBe(true);
    expect(hasPermission('ADMIN', PERMISSIONS.RELEASE_GATES_APPROVE)).toBe(true);
    expect(hasPermission('ADMIN', PERMISSIONS.RELEASE_GATES_OVERRIDE)).toBe(true);
    expect(hasPermission('ADMIN', PERMISSIONS.RELEASE_GATES_CONFIGURE)).toBe(true);

    expect(hasPermission('OWNER', PERMISSIONS.RELEASE_GATES_OVERRIDE)).toBe(true);
  });

  it('allows QA_LEAD to read, evaluate, and approve release gates, but NOT override or configure', () => {
    expect(hasPermission('QA_LEAD', PERMISSIONS.RELEASE_GATES_READ)).toBe(true);
    expect(hasPermission('QA_LEAD', PERMISSIONS.RELEASE_GATES_EVALUATE)).toBe(true);
    expect(hasPermission('QA_LEAD', PERMISSIONS.RELEASE_GATES_APPROVE)).toBe(true);
    expect(hasPermission('QA_LEAD', PERMISSIONS.RELEASE_GATES_OVERRIDE)).toBe(false);
    expect(hasPermission('QA_LEAD', PERMISSIONS.RELEASE_GATES_CONFIGURE)).toBe(false);
  });

  it('denies DEVELOPER from overriding or configuring release gates', () => {
    expect(hasPermission('DEVELOPER', PERMISSIONS.RELEASE_GATES_OVERRIDE)).toBe(false);
    expect(hasPermission('DEVELOPER', PERMISSIONS.RELEASE_GATES_CONFIGURE)).toBe(false);
  });

  it('maps Clerk roles to Sculra roles accurately for permission enforcement', () => {
    expect(mapClerkRoleToSculra('org:admin')).toBe('ADMIN');
    expect(mapClerkRoleToSculra('org:member')).toBe('DEVELOPER');
    expect(mapClerkRoleToSculra('org:viewer')).toBe('VIEWER');
  });

  it('requirePermission throws PermissionDeniedError for unauthorized developer attempting override', () => {
    const devContext: AuthContext = {
      actorType: 'HUMAN_ACTOR',
      userId: 'user_dev_1',
      orgId: 'org_123',
      orgRole: 'org:member',
      role: 'DEVELOPER',
      membershipStatus: 'ACTIVE',
      permissions: new Set([PERMISSIONS.RELEASE_GATES_READ]),
      clerkToken: 'mock-token',
      isPersonalWorkspace: false,
    };

    expect(() =>
      requirePermission(devContext, PERMISSIONS.RELEASE_GATES_OVERRIDE)
    ).toThrow(PermissionDeniedError);
  });
});
