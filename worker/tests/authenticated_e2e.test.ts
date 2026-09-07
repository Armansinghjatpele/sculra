import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer, FixtureServer } from './fixtures/app';
import { BrowserRunner } from '../src/runner';
import { RunnerOptions } from '../src/types';

describe('Authenticated & Role-Based QA E2E Flow', () => {
  let server: FixtureServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = await createTestServer();
    baseUrl = server.url;
  }, 30000);

  afterAll(async () => {
    if (server) await server.close();
  });

  it('runs complete authenticated QA loop with discovery, role comparison, and security boundary evaluation', async () => {
    const options: RunnerOptions & { projectId: string; testRunId: string } = {
      projectId: 'proj_auth_test',
      testRunId: 'tr_auth_e2e_123',
      headless: true,
      allowLocalhost: true,
      enableDiscovery: true,
      enableJourneys: false,
      enableVisual: false,
      enableAiQa: false,
      testIdentities: [
        {
          id: 'ident_admin',
          name: 'Admin User',
          role: 'ADMIN',
          authMethod: 'FORM_LOGIN',
          status: 'ACTIVE',
          loginUrl: `${baseUrl}/login`,
          usernameSecretRef: 'raw:admin@example.com',
          passwordSecretRef: 'raw:admin123',
          successIndicator: {
            type: 'URL_CHANGE',
            expectedUrlPattern: '/dashboard',
          },
        },
        {
          id: 'ident_member',
          name: 'Member User',
          role: 'MEMBER',
          authMethod: 'FORM_LOGIN',
          status: 'ACTIVE',
          loginUrl: `${baseUrl}/login`,
          usernameSecretRef: 'raw:member@example.com',
          passwordSecretRef: 'raw:member123',
          successIndicator: {
            type: 'URL_CHANGE',
            expectedUrlPattern: '/dashboard',
          },
        },
      ],
      authorizationChecks: [
        {
          name: 'Admin Access Users',
          role: 'ADMIN',
          path: '/admin/users',
          expectedAccess: 'ALLOWED',
        },
        {
          name: 'Member Denied Admin Users',
          role: 'MEMBER',
          path: '/admin/users',
          expectedAccess: 'DENIED',
        },
        {
          name: 'Member Leaked Panel Access',
          role: 'MEMBER',
          path: '/admin/leak-panel',
          expectedAccess: 'DENIED',
        },
      ],
    };

    const runner = new BrowserRunner('tr_auth_e2e_123', 'proj_auth_test', options);
    const result = await runner.run(baseUrl);

    // 1. Verify Authenticated Sessions
    expect(result.authenticatedSessions).toBeDefined();
    expect(result.authenticatedSessions?.length).toBe(2);
    expect(result.authenticatedSessions?.[0].role).toBe('ADMIN');
    expect(result.authenticatedSessions?.[0].authenticated).toBe(true);
    expect(result.authenticatedSessions?.[1].role).toBe('MEMBER');
    expect(result.authenticatedSessions?.[1].authenticated).toBe(true);

    // 2. Verify Role Contexts
    expect(result.roleContexts).toBeDefined();
    expect(result.roleContexts?.length).toBe(2);
    const adminRole = result.roleContexts?.find((r) => r.identityId === 'ident_admin');
    const memberRole = result.roleContexts?.find((r) => r.identityId === 'ident_member');
    expect(adminRole).toBeDefined();
    expect(memberRole).toBeDefined();
    expect(adminRole?.discoveredPageUrls).toContain(`${baseUrl}/admin/users`);
    expect(memberRole?.discoveredPageUrls).not.toContain(`${baseUrl}/admin/users`);

    // 3. Verify Role Differences
    expect(result.roleComparisons).toBeDefined();
    expect(result.roleComparisons?.length).toBeGreaterThan(0);
    const comparison = result.roleComparisons?.[0];
    expect(comparison?.roleA).toBe('ADMIN');
    expect(comparison?.roleB).toBe('MEMBER');
    expect(comparison?.roleAOnlyPages).toContain(`${baseUrl}/admin/users`);

    // 4. Verify Authorization Checks
    expect(result.authorizationResults).toBeDefined();
    expect(result.authorizationResults?.length).toBe(3);

    const adminCheck = result.authorizationResults?.find((c) => c.name === 'Admin Access Users');
    expect(adminCheck?.status).toBe('PASSED');
    expect(adminCheck?.observedAccess).toBe('ALLOWED');

    const memberCheck = result.authorizationResults?.find((c) => c.name === 'Member Denied Admin Users');
    expect(memberCheck?.status).toBe('PASSED');
    expect(memberCheck?.observedAccess).toBe('DENIED');

    const leakCheck = result.authorizationResults?.find((c) => c.name === 'Member Leaked Panel Access');
    expect(leakCheck?.status).toBe('FAILED');
    expect(leakCheck?.observedAccess).toBe('ALLOWED');
    expect(leakCheck?.isUnauthorizedAccess).toBe(true);

    // 5. Verify Security Violations in bug observations
    expect(result.bugObservations).toBeDefined();
    const securityBug = result.bugObservations?.find((b) => b.title?.includes('Security Violation: Unauthorized Access'));
    expect(securityBug).toBeDefined();
    expect(securityBug?.severity).toBe('critical');

    // 6. Verify Product Model Role Integration
    expect(result.productModel).toBeDefined();
    const observedAdmin = result.productModel?.roles.find(
      (r) => r.id === 'role-admin' || r.name.toLowerCase().includes('admin')
    );
    const observedMember = result.productModel?.roles.find(
      (r) => r.id === 'role-member' || r.name.toLowerCase().includes('member')
    );
    expect(observedAdmin?.status).toBe('OBSERVED');
    expect(observedMember?.status).toBe('OBSERVED');

    // 7. Verify Zero Credential Exposure
    const serializedResult = JSON.stringify(result);
    expect(serializedResult).not.toContain('admin123');
    expect(serializedResult).not.toContain('member123');
  }, 45000);
});
