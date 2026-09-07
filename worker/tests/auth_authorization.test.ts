import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser } from 'playwright';
import { createTestServer, FixtureServer } from './fixtures/app';
import { AuthorizationEvaluator } from '../src/auth/authorization';
import { RoleComparator } from '../src/auth/comparator';
import { AuthorizationCheckConfig } from '../src/auth/types';

describe('AuthorizationEvaluator & RoleComparator', () => {
  let server: FixtureServer;
  let baseUrl: string;
  let browser: Browser;

  beforeAll(async () => {
    server = await createTestServer();
    baseUrl = server.url;
    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) await server.close();
  });

  describe('AuthorizationEvaluator', () => {
    it('evaluates PASSED when authorized role accesses protected endpoint', async () => {
      const context = await browser.newContext();
      // Set admin auth cookie
      await context.addCookies([
        {
          name: 'sculra_auth',
          value: 'admin-token',
          url: baseUrl,
        },
      ]);

      const check: AuthorizationCheckConfig = {
        name: 'Admin Access Users',
        path: '/admin/users',
        expectedAccess: 'ALLOWED',
        role: 'ADMIN',
      };

      const result = await AuthorizationEvaluator.evaluateCheck(context, baseUrl, check);

      expect(result.status).toBe('PASSED');
      expect(result.observedAccess).toBe('ALLOWED');
      expect(result.statusCode).toBe(200);
      expect(result.isUnauthorizedAccess).toBe(false);

      await context.close();
    });

    it('evaluates PASSED when non-privileged role is correctly rejected with 403', async () => {
      const context = await browser.newContext();
      // Set member auth cookie
      await context.addCookies([
        {
          name: 'sculra_auth',
          value: 'member-token',
          url: baseUrl,
        },
      ]);

      const check: AuthorizationCheckConfig = {
        name: 'Member Denied Admin Users',
        path: '/admin/users',
        expectedAccess: 'DENIED',
        role: 'MEMBER',
      };

      const result = await AuthorizationEvaluator.evaluateCheck(context, baseUrl, check);

      expect(result.status).toBe('PASSED');
      expect(result.observedAccess).toBe('DENIED');
      expect(result.statusCode).toBe(403);
      expect(result.isUnauthorizedAccess).toBe(false);

      await context.close();
    });

    it('detects UNAUTHORIZED_ACCESS security violation when non-privileged role accesses leaked route', async () => {
      const context = await browser.newContext();
      // Set member auth cookie
      await context.addCookies([
        {
          name: 'sculra_auth',
          value: 'member-token',
          url: baseUrl,
        },
      ]);

      const check: AuthorizationCheckConfig = {
        name: 'Member Leaked Route Access',
        path: '/admin/leak-panel',
        expectedAccess: 'DENIED',
        role: 'MEMBER',
      };

      const result = await AuthorizationEvaluator.evaluateCheck(context, baseUrl, check);

      expect(result.status).toBe('FAILED');
      expect(result.observedAccess).toBe('ALLOWED');
      expect(result.isUnauthorizedAccess).toBe(true);
      expect(result.statusCode).toBe(200);

      await context.close();
    });
  });

  describe('RoleComparator', () => {
    it('accurately computes role differences, exclusive routes, and common routes', () => {
      const adminRoutes = [
        `${baseUrl}/dashboard`,
        `${baseUrl}/projects`,
        `${baseUrl}/admin/users`,
        `${baseUrl}/admin/audit`,
      ];

      const memberRoutes = [
        `${baseUrl}/dashboard`,
        `${baseUrl}/projects`,
        `${baseUrl}/help`,
      ];

      const comparison = RoleComparator.compareRoleSurfaces(
        'ADMIN',
        adminRoutes,
        'MEMBER',
        memberRoutes
      );

      expect(comparison.roleA).toBe('ADMIN');
      expect(comparison.roleB).toBe('MEMBER');
      expect(comparison.commonPages).toEqual([`${baseUrl}/dashboard`, `${baseUrl}/projects`]);
      expect(comparison.roleAOnlyPages).toEqual([`${baseUrl}/admin/audit`, `${baseUrl}/admin/users`]);
      expect(comparison.roleBOnlyPages).toEqual([`${baseUrl}/help`]);
      expect(comparison.totalUniquePages).toBe(5);
    });
  });
});
