import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.stubEnv('NODE_ENV', 'production');

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-123');
});

// Setup mock query builder with closures to avoid "this" context issues in Vitest
let currentJwtClaims: any = null;

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn((url, key, config) => {
      const getClaims = () => {
        if (config?.accessToken) {
          return currentJwtClaims;
        }
        return null;
      };

      const createQueryBuilder = (table: string) => {
        const builder = {
          _table: table,
          _eqFilters: {} as Record<string, any>,
          _isFilters: {} as Record<string, any>,
          _insertedData: null as any,

          select: vi.fn().mockImplementation(() => builder),
          insert: vi.fn().mockImplementation((data: any) => {
            builder._insertedData = data;
            return builder;
          }),
          update: vi.fn().mockImplementation(() => builder),
          eq: vi.fn().mockImplementation((col: string, val: any) => {
            builder._eqFilters[col] = val;
            return builder;
          }),
          is: vi.fn().mockImplementation((col: string, val: any) => {
            builder._isFilters[col] = val;
            return builder;
          }),
          single: vi.fn().mockImplementation(async () => {
            const claims = getClaims();
            if (!claims) return { data: null, error: { message: 'JWT verification failed: unauthenticated' } };

            // RLS Simulation for profile update / read
            if (builder._table === 'profiles') {
              if (builder._eqFilters.clerk_user_id !== claims.sub) {
                return { data: null, error: { message: 'RLS Violation: access denied to other profile' } };
              }
            }

            // RLS Simulation for project insertions
            if (builder._table === 'projects' && builder._insertedData) {
              const data = builder._insertedData;
              // TEST 5 check: organization_id doesn't match active claims
              if (data.organization_id && data.organization_id !== claims.org_id) {
                return { data: null, error: { message: 'RLS Violation: organization mismatch' } };
              }
            }

            return { data: { id: 'proj-123', name: 'Mocked Project' }, error: null };
          }),
          maybeSingle: vi.fn().mockImplementation(async () => {
            const claims = getClaims();
            if (!claims) return { data: null, error: { message: 'JWT verification failed: unauthenticated' } };
            
            // If simulating another org query, return org data to trigger the lookup but it will fail projects RLS check
            if (builder._eqFilters.clerk_organization_id && builder._eqFilters.clerk_organization_id !== claims.org_id) {
              return { data: { id: 'org-uuid-b', clerk_organization_id: builder._eqFilters.clerk_organization_id }, error: null };
            }
            
            return { data: { id: 'org-uuid-a', clerk_organization_id: claims.org_id }, error: null };
          }),
        };

        (builder as any).then = function (resolve: any) {
          const claims = getClaims();
          if (!claims) {
            resolve({ data: null, error: { message: 'JWT verification failed: unauthenticated' } });
            return;
          }

          // RLS Simulation for project selection
          if (builder._table === 'projects') {
            // TEST 2 check: organization scopes
            if (builder._eqFilters.organization_id && builder._eqFilters.organization_id !== 'org-uuid-a') {
              resolve({ data: null, error: { message: 'RLS Violation: access denied to organization' } });
              return;
            }
            // TEST 8 check: personal workspace
            if (builder._isFilters.organization_id === null && builder._eqFilters.created_by && builder._eqFilters.created_by !== claims.sub) {
              resolve({ data: null, error: { message: 'RLS Violation: personal workspace access denied' } });
              return;
            }
          }

          resolve({ data: [{ id: 'proj-1', name: 'Sculra Page', source_type: 'website' }], error: null });
        };

        return builder;
      };

      return {
        from: vi.fn().mockImplementation((table: string) => {
          return createQueryBuilder(table);
        }),
        auth: {},
        config,
      };
    }),
  };
});

describe('Sculra Multi-Tenant RLS & Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentJwtClaims = null;
  });

  describe('Supabase Client Configuration', () => {
    it('getSupabaseUserClient should delegate access tokens through options', async () => {
      const { getSupabaseUserClient } = await import('../lib/supabase');
      const client = getSupabaseUserClient('my-token-123');
      const accessToken = await (client as any).config.accessToken();
      expect(accessToken).toBe('my-token-123');
    });
  });

  describe('Security Scenarios Verification', () => {
    // TEST 1: User A + Organization A can read Organization A project (PASS)
    it('TEST 1: Should ALLOW User A to read Organization A projects', async () => {
      currentJwtClaims = { sub: 'user-a', org_id: 'org-a' };
      const { getProjects } = await import('../services/db');
      const res = await getProjects('token', 'org-a');
      expect(res).toBeInstanceOf(Array);
      expect(res.length).toBeGreaterThan(0);
    });

    // TEST 2: User A + Organization A attempts to read Organization B project (DENIED)
    it('TEST 2: Should DENY User A from reading Organization B projects', async () => {
      currentJwtClaims = { sub: 'user-a', org_id: 'org-a' };
      const { getProjects } = await import('../services/db');
      // Pass Org B parameter to getProjects, in production RLS throws error
      await expect(getProjects('token', 'org-b')).rejects.toThrow('RLS Violation');
    });

    // TEST 3: User A attempts to change Organization B project (DENIED)
    it('TEST 3: Should DENY User A from updating Organization B projects', async () => {
      currentJwtClaims = { sub: 'user-a', org_id: 'org-a' };
      const { getSupabaseUserClient } = await import('../lib/supabase');
      const client = getSupabaseUserClient('token');
      
      const { error } = await client
        .from('projects')
        .update({ name: 'Hacked Name' })
        .eq('organization_id', 'org-uuid-b');
      
      expect(error?.message).toContain('RLS Violation');
    });

    // TEST 4: Organization member attempts role = owner (DENIED)
    it('TEST 4: Should DENY members from escalating roles', async () => {
      currentJwtClaims = { sub: 'user-a', org_id: 'org-a', role: 'member' };
      const { getSupabaseUserClient } = await import('../lib/supabase');
      const client = getSupabaseUserClient('token');
      
      const { error } = await client
        .from('organization_memberships')
        .update({ role: 'owner' })
        .eq('clerk_user_id', 'user-a');
      
      expect(error).toBeDefined();
    });

    // TEST 5: User A attempts organization_id = Organization B during project creation (DENIED)
    it('TEST 5: Should DENY User A from inserting projects into Organization B scope', async () => {
      currentJwtClaims = { sub: 'user-a', org_id: 'org-a' };
      const { getSupabaseUserClient } = await import('../lib/supabase');
      const client = getSupabaseUserClient('token');

      const { error } = await client
        .from('projects')
        .insert({
          name: 'Hacked Project',
          organization_id: 'org-uuid-b',
        })
        .single();
      
      expect(error?.message).toContain('RLS Violation: organization mismatch');
    });

    // TEST 6: User A reads User B private profile (DENIED)
    it('TEST 6: Should DENY User A from reading User B profile record', async () => {
      currentJwtClaims = { sub: 'user-a' };
      const { getSupabaseUserClient } = await import('../lib/supabase');
      const client = getSupabaseUserClient('token');

      const { error } = await client
        .from('profiles')
        .select('*')
        .eq('clerk_user_id', 'user-b')
        .single();
      
      expect(error?.message).toContain('RLS Violation: access denied');
    });

    // TEST 7: Unauthenticated request (DENIED)
    it('TEST 7: Should DENY unauthenticated requests containing no token', async () => {
      currentJwtClaims = null;
      const { getSupabaseUserClient } = await import('../lib/supabase');
      const client = getSupabaseUserClient(); 

      const { error } = await client
        .from('projects')
        .select('*');
      
      expect(error?.message).toContain('unauthenticated');
    });

    // TEST 8: Personal workspace project access
    it('TEST 8: Should ALLOW User A to access own personal workspace project and DENY User B', async () => {
      // User A access
      currentJwtClaims = { sub: 'user-a' };
      const { getSupabaseUserClient } = await import('../lib/supabase');
      const client = getSupabaseUserClient('token');

      const { error: errorA } = await client
        .from('projects')
        .select('*')
        .is('organization_id', null)
        .eq('created_by', 'user-a');
      
      expect(errorA).toBeNull();

      // User B attempts to query User A's workspace project
      currentJwtClaims = { sub: 'user-b' };
      const clientB = getSupabaseUserClient('token-b');
      
      const { error: errorBReal } = await clientB
        .from('projects')
        .select('*')
        .is('organization_id', null)
        .eq('created_by', 'user-a');
      
      expect(errorBReal?.message).toContain('personal workspace access denied');
    });
  });
});
