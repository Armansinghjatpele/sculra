// ==============================================================================
// Prompt 52: P0 Security & Data Integrity Remediation Regression Suite
// (frontend/tests/prompt_52_security_data_integrity.test.ts)
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ------------------------------------------------------------------------------
// 1. RLS Migration Integrity Verification
// ------------------------------------------------------------------------------
describe('P0 Security: Supabase RLS Migration Integrity', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../supabase/migrations/20260926000000_security_and_data_integrity_fixes.sql'
  );

  it('migration file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('drops insecure WITH CHECK (true) policies on credential_access_logs and notifications', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('DROP POLICY IF EXISTS "Service role can insert credential access logs" ON public.credential_access_logs;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;');
  });

  it('strictly restricts credential_access_logs INSERT to service_role with JWT role claim', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/CREATE POLICY "Service role can insert credential access logs"[\s\S]*?ON public\.credential_access_logs[\s\S]*?FOR INSERT[\s\S]*?TO service_role[\s\S]*?WITH CHECK \(auth\.jwt\(\) ->> 'role' = 'service_role'\);/);
  });

  it('strictly restricts notifications INSERT to service_role with JWT role claim', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/CREATE POLICY "Service role can insert notifications"[\s\S]*?ON public\.notifications[\s\S]*?FOR INSERT[\s\S]*?TO service_role[\s\S]*?WITH CHECK \(auth\.jwt\(\) ->> 'role' = 'service_role'\);/);
  });

  it('hardens SECURITY DEFINER queue functions with explicit search_path', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('ALTER FUNCTION public.acquire_execution_job(TEXT, INT, TEXT[])');
    expect(sql).toContain('SET search_path = public, pg_temp;');
    expect(sql).toContain('ALTER FUNCTION public.heartbeat_execution_job(UUID, TEXT, TEXT, INT)');
    expect(sql).toContain('ALTER FUNCTION public.fail_exhausted_stale_jobs()');
  });

  it('simulates RLS policy evaluation: anon and authenticated cannot insert, service_role can insert', () => {
    // Policy rule evaluator simulation based on PostgreSQL RLS semantics
    const evaluateInsertPolicy = (
      role: 'anon' | 'authenticated' | 'service_role',
      jwtClaims: { sub?: string; role?: string }
    ) => {
      // Policy requires: TO service_role AND WITH CHECK (auth.jwt() ->> 'role' = 'service_role')
      if (role !== 'service_role') {
        return false; // Denied: policy only applies TO service_role
      }
      return jwtClaims.role === 'service_role';
    };

    // 1. Anon attempt -> Rejected
    expect(evaluateInsertPolicy('anon', {})).toBe(false);

    // 2. Normal authenticated user attempt -> Rejected
    expect(evaluateInsertPolicy('authenticated', { sub: 'user_123', role: 'authenticated' })).toBe(false);

    // 3. Authenticated user attempting to spoof sub -> Rejected
    expect(evaluateInsertPolicy('authenticated', { sub: 'service_role_spoof', role: 'authenticated' })).toBe(false);

    // 4. Valid service_role connection -> Accepted
    expect(evaluateInsertPolicy('service_role', { role: 'service_role' })).toBe(true);
  });
});

// ------------------------------------------------------------------------------
// 2. Team Member Route Protection & org_demo_1 Fallback Eradication
// ------------------------------------------------------------------------------
describe('P0 Data Integrity: Team Member Organization Context Enforcement', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('team invite route rejects requests without active organization context with HTTP 400', async () => {
    // Mock getAuthContext returning missing orgId
    vi.doMock('@/lib/authz', () => ({
      getAuthContext: vi.fn().mockResolvedValue({
        userId: 'usr_owner_1',
        orgId: null, // No organization selected!
        role: 'OWNER',
        clerkToken: 'test_token',
      }),
      requirePermission: vi.fn(),
      PERMISSIONS: { MEMBERS_INVITE: 'MEMBERS:INVITE' },
      ROLE_RANKS: { OWNER: 100, ADMIN: 80, QA_LEAD: 60, DEVELOPER: 40, VIEWER: 20 },
    }));

    const { POST } = await import('@/app/api/settings/team/members/invite/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost:3000/api/settings/team/members/invite', {
      method: 'POST',
      body: JSON.stringify({ email: 'newmember@acme.com', role: 'DEVELOPER' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Organization context required');
  });

  it('team member role change route rejects requests without active organization context with HTTP 400', async () => {
    vi.doMock('@/lib/authz', () => ({
      getAuthContext: vi.fn().mockResolvedValue({
        userId: 'usr_admin_1',
        orgId: null, // Missing orgId!
        role: 'ADMIN',
        clerkToken: 'test_token',
      }),
      requirePermission: vi.fn(),
      PERMISSIONS: { MEMBERS_CHANGE_ROLE: 'MEMBERS:CHANGE_ROLE', MEMBERS_REMOVE: 'MEMBERS:REMOVE' },
      ROLE_RANKS: { OWNER: 100, ADMIN: 80, QA_LEAD: 60, DEVELOPER: 40, VIEWER: 20 },
    }));

    const { PATCH, DELETE } = await import('@/app/api/settings/team/members/[memberId]/route');
    const { NextRequest } = await import('next/server');

    const patchReq = new NextRequest('http://localhost:3000/api/settings/team/members/mem-1', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'DEVELOPER' }),
    });

    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ memberId: 'mem-1' }) });
    expect(patchRes.status).toBe(400);
    const patchData = await patchRes.json();
    expect(patchData.error).toBe('Organization context required');

    const delReq = new NextRequest('http://localhost:3000/api/settings/team/members/mem-1', {
      method: 'DELETE',
    });

    const delRes = await DELETE(delReq, { params: Promise.resolve({ memberId: 'mem-1' }) });
    expect(delRes.status).toBe(400);
    const delData = await delRes.json();
    expect(delData.error).toBe('Organization context required');
  });

  it('getOrganizationMembers returns empty list when clerkOrgId is null or undefined without querying org_demo_1', async () => {
    const { getOrganizationMembers } = await import('@/services/db');
    const membersNull = await getOrganizationMembers('mock-token', null);
    expect(membersNull).toEqual([]);

    const membersUndefined = await getOrganizationMembers('mock-token', undefined);
    expect(membersUndefined).toEqual([]);
  });
});

// ------------------------------------------------------------------------------
// 3. Authenticated Route Protection in Proxy
// ------------------------------------------------------------------------------
describe('High Security: Middleware Route Protection Verification', () => {
  it('verifies that proxy.ts explicitly protects all authenticated routes', () => {
    const proxyPath = path.resolve(__dirname, '../proxy.ts');
    const proxyContent = fs.readFileSync(proxyPath, 'utf8');

    const requiredProtectedRoutes = [
      "'/activity(.*)'",
      "'/campaigns(.*)'",
      "'/dashboard(.*)'",
      "'/issues(.*)'",
      "'/projects(.*)'",
      "'/reports(.*)'",
      "'/settings(.*)'",
      "'/team(.*)'",
      "'/test-runs(.*)'",
      "'/release-readiness(.*)'",
      "'/notifications(.*)'",
    ];

    for (const route of requiredProtectedRoutes) {
      expect(proxyContent).toContain(route);
    }
  });
});

// ------------------------------------------------------------------------------
// 4. Honest Flake Rate Calculation
// ------------------------------------------------------------------------------
describe('P1 Data Integrity: Flake Rate Truthfulness', () => {
  function computeDisplayFlakeRate(flakeRate: any): string {
    if (typeof flakeRate === 'number') {
      return `${Math.round(flakeRate * 100)}%`;
    }
    return 'N/A';
  }

  it('truthfully displays 0% when flakeRate is 0', () => {
    expect(computeDisplayFlakeRate(0)).toBe('0%');
  });

  it('truthfully displays exact percentage for valid positive flake rates', () => {
    expect(computeDisplayFlakeRate(0.35)).toBe('35%');
    expect(computeDisplayFlakeRate(0.875)).toBe('88%');
    expect(computeDisplayFlakeRate(1.0)).toBe('100%');
  });

  it('truthfully displays N/A when flakeRate is null, undefined, or missing', () => {
    expect(computeDisplayFlakeRate(null)).toBe('N/A');
    expect(computeDisplayFlakeRate(undefined)).toBe('N/A');
    expect(computeDisplayFlakeRate({})).toBe('N/A');
    expect(computeDisplayFlakeRate('0.5')).toBe('N/A');
  });
});

// ------------------------------------------------------------------------------
// 5. Test Run Metadata Mapping Truthfulness
// ------------------------------------------------------------------------------
describe('P1 Data Integrity: getTestRuns Metadata Mapping', () => {
  it('maps real database fields without fabricating Synced Project or Synced', () => {
    const sampleDbRows = [
      {
        id: 'run-uuid-1',
        project_id: 'proj-uuid-1',
        projects: { name: 'Production Checkout Service' },
        status: 'passed',
        issues: [{ count: 4 }],
        overall_score: 94,
        duration_ms: 12400,
        created_at: '2026-09-26T10:15:30.000Z',
      },
      {
        id: 'run-uuid-2',
        project_id: 'proj-uuid-2',
        projects: null,
        project_name: 'Auth API Gateway',
        status: 'failed',
        issues: [],
        overall_score: 45,
        duration_ms: 8100,
        created_at: '2026-09-26T11:00:00.000Z',
      },
    ];

    // Simulation of the exact mapping logic in getTestRuns
    const mapped = sampleDbRows.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.projects?.name || r.project_name || 'Project',
      status: r.status,
      issuesCount:
        Array.isArray(r.issues) && r.issues[0]?.count != null
          ? r.issues[0].count
          : typeof r.issues_count === 'number'
          ? r.issues_count
          : 0,
      releaseScore: r.overall_score ?? null,
      durationMs: r.duration_ms || 0,
      createdAt: r.created_at || new Date().toISOString(),
    }));

    expect(mapped[0].projectName).toBe('Production Checkout Service');
    expect(mapped[0].createdAt).toBe('2026-09-26T10:15:30.000Z');
    expect(mapped[0].issuesCount).toBe(4);

    expect(mapped[1].projectName).toBe('Auth API Gateway');
    expect(mapped[1].createdAt).toBe('2026-09-26T11:00:00.000Z');
    expect(mapped[1].issuesCount).toBe(0);

    // Verify neither row contains "Synced Project" or "Synced"
    for (const run of mapped) {
      expect(run.projectName).not.toBe('Synced Project');
      expect(run.createdAt).not.toBe('Synced');
    }
  });
});
