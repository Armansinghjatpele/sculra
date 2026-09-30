// ==============================================================================
// Sculra Post-Release UI & Permissions Test Suite
// (frontend/tests/post_release_ui.test.ts)
// ==============================================================================

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
        maybeSingle: vi.fn().mockImplementation(async () => ({
          data: null,
          error: null,
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
import { getPostReleaseIntelligence } from '../services/db';

describe('Prompt 64: Frontend Post-Release Intelligence Permissions & Service', () => {
  it('registers signals permission category with SIGNALS_READ and SIGNALS_INGEST', () => {
    const category = PERMISSION_CATEGORIES.find((g) => g.id === 'signals');
    expect(category).toBeDefined();
    expect(category?.name).toBe('Production Signals & Feedback');

    const permKeys = category?.permissions.map((p) => p.key) || [];
    expect(permKeys).toContain(PERMISSIONS.SIGNALS_READ);
    expect(permKeys).toContain(PERMISSIONS.SIGNALS_INGEST);
  });

  it('enforces RBAC for SIGNALS_READ and SIGNALS_INGEST across roles', () => {
    // VIEWER can read signals, but cannot ingest
    expect(hasPermission('VIEWER', PERMISSIONS.SIGNALS_READ)).toBe(true);
    expect(hasPermission('VIEWER', PERMISSIONS.SIGNALS_INGEST)).toBe(false);

    // DEVELOPER can read and ingest
    expect(hasPermission('DEVELOPER', PERMISSIONS.SIGNALS_READ)).toBe(true);
    expect(hasPermission('DEVELOPER', PERMISSIONS.SIGNALS_INGEST)).toBe(true);

    // QA_LEAD can read and ingest
    expect(hasPermission('QA_LEAD', PERMISSIONS.SIGNALS_READ)).toBe(true);
    expect(hasPermission('QA_LEAD', PERMISSIONS.SIGNALS_INGEST)).toBe(true);

    // ADMIN can read and ingest
    expect(hasPermission('ADMIN', PERMISSIONS.SIGNALS_READ)).toBe(true);
    expect(hasPermission('ADMIN', PERMISSIONS.SIGNALS_INGEST)).toBe(true);

    // OWNER can read and ingest
    expect(hasPermission('OWNER', PERMISSIONS.SIGNALS_READ)).toBe(true);
    expect(hasPermission('OWNER', PERMISSIONS.SIGNALS_INGEST)).toBe(true);
  });

  it('fetches post release intelligence and returns zero signals gracefully when unmeasured', async () => {
    const data = await getPostReleaseIntelligence('mock-token', 'proj-123', 'dep-456');
    expect(data.deploymentId).toBe('dep-456');
    expect(data.projectId).toBe('proj-123');
    expect(data.signals).toEqual([]);
    expect(data.signalsCount).toBe(0);
  });
});
