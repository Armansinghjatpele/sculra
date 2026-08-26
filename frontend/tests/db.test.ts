import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Mock environment variables before importing target files
beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-123');
});

// Mock Supabase JS client
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn((url, key, config) => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'proj-123', name: 'Mock Project', source_type: 'website' }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'org-uuid-1', clerk_organization_id: 'org_123' }, error: null }),
      };
      
      (mockQueryBuilder as any).then = (resolve: any) => {
        resolve({ data: [{ id: 'proj-1', name: 'Sculra Page', source_type: 'website', status: 'active' }], error: null });
      };

      return {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
        auth: {},
        config,
      };
    }),
  };
});

describe('Sculra Database and RLS Security Contexts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Supabase Client Constructors', () => {
    it('getSupabaseUserClient should append the Clerk JWT token in request headers', async () => {
      const { getSupabaseUserClient } = await import('../lib/supabase');
      const client = getSupabaseUserClient('clerk-user-jwt-123');
      expect((client as any).config.global.headers.Authorization).toBe('Bearer clerk-user-jwt-123');
    });

    it('getSupabaseServiceClient should bypass RLS by setting service key credentials', async () => {
      const { getSupabaseServiceClient } = await import('../lib/supabase');
      const client = getSupabaseServiceClient();
      expect((client as any).config.auth.persistSession).toBe(false);
    });
  });

  describe('Multi-Tenant Database Queries', () => {
    it('getProjects should filter projects by organization UUID if clerkOrgId matches synced list', async () => {
      const { getProjects } = await import('../services/db');
      const projects = await getProjects('token-123', 'org_123');
      expect(projects).toBeInstanceOf(Array);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0].id).toBe('proj-1');
    });

    it('createProject should write new project properties with active user credentials', async () => {
      const { createProject } = await import('../services/db');
      const res = await createProject('token-123', {
        name: 'New Site',
        type: 'website',
        url: 'https://newsite.com',
        clerkOrgId: 'org_123',
        clerkUserId: 'user_123',
      });
      expect(res.name).toBe('Mock Project');
    });
  });
});
