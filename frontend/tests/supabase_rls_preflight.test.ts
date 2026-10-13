// ==============================================================================
// Unit Tests: Supabase RLS Preflight & Safety Engine
// (frontend/tests/supabase_rls_preflight.test.ts)
// ==============================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  validateRlsPreflight,
  validateTenantJwt,
  isProductionDatabaseUrl,
  isLocalDatabaseUrl,
  decodeJwtPayload,
  formatPreflightReport,
  sanitizeErrorMessage,
  verifyServiceRoleConnection,
  TestFixtureRegistry,
} from './helpers/supabase_rls_preflight';

// Helper to create valid mock JWTs for unit testing the preflight parser
function createTestJwt(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'test_signature_bytes';
  return `${header}.${body}.${signature}`;
}

describe('Supabase RLS Preflight & Safety Engine', () => {
  const validJwtA = createTestJwt({ sub: 'user_clerk_101', org_id: 'org_test_a', org_role: 'admin' });
  const validJwtB = createTestJwt({ sub: 'user_clerk_202', org_id: 'org_test_b', org_role: 'admin' });
  const validJwtC = createTestJwt({ sub: 'user_clerk_303' });

  // ----------------------------------------------------------------------------
  // Regression 1: Remote hostname on port 54321 is not considered local
  // ----------------------------------------------------------------------------
  describe('Regression 1: Remote hostname on port 54321 is not considered local', () => {
    it('rejects remote hostname using port 54321 as local', () => {
      expect(isLocalDatabaseUrl('http://remote-db.example.com:54321')).toBe(false);
      expect(isLocalDatabaseUrl('https://staging-project.supabase.co:54321')).toBe(false);
      expect(isLocalDatabaseUrl('http://localhost.attacker.com:54321')).toBe(false);
      expect(isLocalDatabaseUrl('http://127.0.0.1.nip.io:54321')).toBe(false);
    });

    it('blocks execution when remote host on port 54321 is provided without remote acknowledgement', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'http://remote-db.example.com:54321',
        TEST_SUPABASE_ANON_KEY: 'test-anon-key',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TEST_JWT_TENANT_A: validJwtA,
        TEST_JWT_TENANT_B: validJwtB,
        TEST_JWT_USER_C: validJwtC,
      });

      expect(result.isReady).toBe(false);
      expect(result.isBlocked).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('CONFIRM_ISOLATED_TEST_DB=true'))).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // Regression 2: Localhost, IPv4 loopback, and IPv6 loopback classified correctly
  // ----------------------------------------------------------------------------
  describe('Regression 2: Localhost, IPv4 loopback, and IPv6 loopback classified correctly', () => {
    it('classifies localhost variants with and without ports correctly', () => {
      expect(isLocalDatabaseUrl('http://localhost:54321')).toBe(true);
      expect(isLocalDatabaseUrl('http://localhost:3000')).toBe(true);
      expect(isLocalDatabaseUrl('http://localhost')).toBe(true);
      expect(isLocalDatabaseUrl('http://localhost./')).toBe(true);
    });

    it('classifies IPv4 loopback (127.0.0.1) correctly', () => {
      expect(isLocalDatabaseUrl('http://127.0.0.1:54321')).toBe(true);
      expect(isLocalDatabaseUrl('http://127.0.0.1:8000')).toBe(true);
      expect(isLocalDatabaseUrl('http://127.0.0.1')).toBe(true);
    });

    it('classifies IPv6 loopback (::1) correctly with and without brackets', () => {
      expect(isLocalDatabaseUrl('http://[::1]:54321')).toBe(true);
      expect(isLocalDatabaseUrl('http://[::1]:8000')).toBe(true);
      expect(isLocalDatabaseUrl('http://[::1]')).toBe(true);
      // Non-loopback IPv6 is not local
      expect(isLocalDatabaseUrl('http://[::2]:54321')).toBe(false);
    });
  });

  // ----------------------------------------------------------------------------
  // Regression 3: Malformed URLs and unsupported protocols fail closed
  // ----------------------------------------------------------------------------
  describe('Regression 3: Malformed URLs and unsupported protocols fail closed', () => {
    it('isLocalDatabaseUrl returns false for malformed URLs and unsupported protocols', () => {
      expect(isLocalDatabaseUrl('not_a_valid_url')).toBe(false);
      expect(isLocalDatabaseUrl('')).toBe(false);
      expect(isLocalDatabaseUrl('ftp://127.0.0.1:54321')).toBe(false);
      expect(isLocalDatabaseUrl('javascript:alert(1)')).toBe(false);
      expect(isLocalDatabaseUrl('file:///etc/passwd')).toBe(false);
    });

    it('validateRlsPreflight rejects malformed URLs with clear explanation', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'invalid_malformed_url_format',
        TEST_SUPABASE_ANON_KEY: 'test-anon-key',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TEST_JWT_TENANT_A: validJwtA,
        TEST_JWT_TENANT_B: validJwtB,
        TEST_JWT_USER_C: validJwtC,
      });

      expect(result.isReady).toBe(false);
      expect(result.isBlocked).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('TEST_SUPABASE_URL is malformed'))).toBe(true);
    });

    it('validateRlsPreflight rejects unsupported protocols fail-closed', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'ftp://127.0.0.1:54321',
        TEST_SUPABASE_ANON_KEY: 'test-anon-key',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TEST_JWT_TENANT_A: validJwtA,
        TEST_JWT_TENANT_B: validJwtB,
        TEST_JWT_USER_C: validJwtC,
      });

      expect(result.isReady).toBe(false);
      expect(result.isBlocked).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes("protocol 'ftp:' is unsupported"))).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // Regression 4: Production hostname lookalikes cannot bypass the production guard
  // ----------------------------------------------------------------------------
  describe('Regression 4: Production hostname lookalikes cannot bypass the production guard', () => {
    it('detects production database across casing, ports, paths, and trailing dots', () => {
      expect(isProductionDatabaseUrl('https://vycrimzpywqyjhtvvuax.supabase.co')).toBe(true);
      expect(isProductionDatabaseUrl('https://VYCRIMZPYWQYJHTVVUAX.SUPABASE.CO:443')).toBe(true);
      expect(isProductionDatabaseUrl('http://vycrimzpywqyjhtvvuax.supabase.co:54321')).toBe(true);
      expect(isProductionDatabaseUrl('https://vycrimzpywqyjhtvvuax.supabase.co.')).toBe(true);
      expect(isProductionDatabaseUrl('https://vycrimzpywqyjhtvvuax.supabase.co/rest/v1?test=1')).toBe(true);
      expect(isProductionDatabaseUrl('https://sculra.com')).toBe(true);
      expect(isProductionDatabaseUrl('https://api.sculra.com')).toBe(true);
    });

    it('never allows production database even if CONFIRM_ISOLATED_TEST_DB is true', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'https://vycrimzpywqyjhtvvuax.supabase.co',
        CONFIRM_ISOLATED_TEST_DB: 'true',
        ALLOW_REMOTE_TEST_DB: 'true',
        TEST_SUPABASE_ANON_KEY: 'test-anon-key',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TEST_JWT_TENANT_A: validJwtA,
        TEST_JWT_TENANT_B: validJwtB,
        TEST_JWT_USER_C: validJwtC,
      });

      expect(result.isReady).toBe(false);
      expect(result.isBlocked).toBe(true);
      expect(result.isProductionAttempt).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('matches protected production database'))).toBe(true);
    });

    it('deceptive hostnames containing production domain text cannot claim local status', () => {
      expect(isLocalDatabaseUrl('http://vycrimzpywqyjhtvvuax.supabase.co.attacker.com:54321')).toBe(false);
      expect(isLocalDatabaseUrl('http://sculra.com.attacker.com')).toBe(false);
    });
  });

  // ----------------------------------------------------------------------------
  // Regression 5: Database errors during cleanup produce a failure
  // ----------------------------------------------------------------------------
  describe('Regression 5: Database errors during cleanup produce a failure', () => {
    it('reports failure when cleanup delete query returns an error', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordProject('proj-101');
      registry.recordIncident('inc-101');

      const mockDelete = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: { message: 'Database connection timeout on delete' } }),
      });
      const mockAdminClient = {
        from: vi.fn().mockReturnValue({ delete: mockDelete }),
      } as any;

      const cleanupRes = await registry.cleanup(mockAdminClient);
      expect(cleanupRes.success).toBe(false);
      expect(cleanupRes.errors.length).toBeGreaterThan(0);
      expect(cleanupRes.errors.some((e) => e.includes('Database connection timeout'))).toBe(true);
    });

    it('handles unexpected throw in delete query safely and reports error', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordProject('proj-102');

      const mockAdminClient = {
        from: vi.fn().mockImplementation(() => {
          throw new Error('Socket closed unexpectedly');
        }),
      } as any;

      const cleanupRes = await registry.cleanup(mockAdminClient);
      expect(cleanupRes.success).toBe(false);
      expect(cleanupRes.errors.some((e) => e.includes('Socket closed unexpectedly'))).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // Regression 6: Database errors during post-cleanup verification produce a failure
  // ----------------------------------------------------------------------------
  describe('Regression 6: Database errors during post-cleanup verification produce a failure', () => {
    it('fails closed when verification query encounters a database error (never assumes fixtures absent)', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordProject('proj-201');

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: null, error: { message: 'PostgREST 500 internal server error' } }),
      });
      const mockAdminClient = {
        from: vi.fn().mockReturnValue({ select: mockSelect }),
      } as any;

      const verifyRes = await registry.verifyCleanedUp(mockAdminClient);
      // Must NOT be clean because query failed!
      expect(verifyRes.clean).toBe(false);
      expect(verifyRes.verificationErrors.length).toBeGreaterThan(0);
      expect(verifyRes.verificationErrors[0]).toContain('Projects verification query failed');
    });

    it('fails when fixtures linger in the database after cleanup', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordProject('proj-202');

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [{ id: 'proj-202' }], error: null }),
      });
      const mockAdminClient = {
        from: vi.fn().mockReturnValue({ select: mockSelect }),
      } as any;

      const verifyRes = await registry.verifyCleanedUp(mockAdminClient);
      expect(verifyRes.clean).toBe(false);
      expect(verifyRes.lingering.length).toBeGreaterThan(0);
      expect(verifyRes.lingering[0]).toContain('Projects lingering (1 records): proj-202');
    });
  });

  // ----------------------------------------------------------------------------
  // Regression 7: Every tracked fixture category is included in cleanup and verification
  // ----------------------------------------------------------------------------
  describe('Regression 7: Every tracked fixture category is included in cleanup and verification', () => {
    it('invokes cleanup and verification across all 7 tracked categories', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordOrg('org-1');
      registry.recordMembership('org-1', 'user-1');
      registry.recordProject('proj-1');
      registry.recordTestRun('run-1');
      registry.recordIssue('issue-1');
      registry.recordIncident('inc-1');
      registry.recordPreference('proj-1');

      const cleanedTables: string[] = [];
      const verifiedTables: string[] = [];

      const mockDelete = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
      const mockSelect = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) });

      const mockAdminClient = {
        from: vi.fn().mockImplementation((table: string) => {
          return {
            delete: () => {
              cleanedTables.push(table);
              return mockDelete();
            },
            select: () => {
              verifiedTables.push(table);
              return mockSelect();
            },
          };
        }),
      } as any;

      // 1. Run cleanup
      const cleanRes = await registry.cleanup(mockAdminClient);
      expect(cleanRes.success).toBe(true);

      const expectedCategories = [
        'notification_preferences',
        'notification_incidents',
        'issues',
        'test_runs',
        'projects',
        'organization_memberships',
        'organizations',
      ];

      for (const table of expectedCategories) {
        expect(cleanedTables).toContain(table);
      }

      // Verify dependency-safe reverse order
      expect(cleanedTables.indexOf('notification_preferences')).toBeLessThan(cleanedTables.indexOf('projects'));
      expect(cleanedTables.indexOf('notification_incidents')).toBeLessThan(cleanedTables.indexOf('projects'));
      expect(cleanedTables.indexOf('issues')).toBeLessThan(cleanedTables.indexOf('projects'));
      expect(cleanedTables.indexOf('test_runs')).toBeLessThan(cleanedTables.indexOf('projects'));
      expect(cleanedTables.indexOf('projects')).toBeLessThan(cleanedTables.indexOf('organizations'));
      expect(cleanedTables.indexOf('organization_memberships')).toBeLessThan(cleanedTables.indexOf('organizations'));

      // 2. Run verification
      const verifyRes = await registry.verifyCleanedUp(mockAdminClient);
      expect(verifyRes.clean).toBe(true);

      for (const table of expectedCategories) {
        expect(verifiedTables).toContain(table);
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Regression 8: Partial setup failure retains original error and reports rollback failures
  // ----------------------------------------------------------------------------
  describe('Regression 8: Partial setup failure retains original error and reports rollback failures', () => {
    it('captures both the original setup error and rollback cleanup failure', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordOrg('org-partial-1');

      const mockDelete = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: { message: 'Foreign key constraint violated during rollback' } }),
      });
      const mockAdminClient = {
        from: vi.fn().mockReturnValue({ delete: mockDelete }),
      } as any;

      // Simulate the integration test setup catch block
      let caughtError: Error | null = null;
      try {
        try {
          throw new Error('Initial setup query failed: Table projects schema mismatch');
        } catch (setupErr: any) {
          const rollback = await registry.cleanup(mockAdminClient);
          if (!rollback.success) {
            throw new Error(
              `Fixture setup failed: ${setupErr.message}. Rollback cleanup also failed: ${rollback.errors.join('; ')}`
            );
          }
          throw setupErr;
        }
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).toContain('Initial setup query failed: Table projects schema mismatch');
      expect(caughtError?.message).toContain('Foreign key constraint violated during rollback');
    });
  });

  // ----------------------------------------------------------------------------
  // Regression 9: Error output does not leak credentials or JWT contents
  // ----------------------------------------------------------------------------
  describe('Regression 9: Error output does not leak credentials or JWT contents', () => {
    it('sanitizeErrorMessage redacts JWT tokens, Bearer headers, and API keys', () => {
      const rawError = `Failed request: Bearer ${validJwtA} with apikey=sbp_secret_key_999 and authorization=Bearer secret_token`;
      const sanitized = sanitizeErrorMessage(rawError);

      expect(sanitized).not.toContain(validJwtA);
      expect(sanitized).not.toContain('sbp_secret_key_999');
      expect(sanitized).toContain('Bearer [REDACTED]');
      expect(sanitized).toContain('apikey=[REDACTED]');
      expect(sanitized).toContain('authorization=[REDACTED]');
    });

    it('verifyServiceRoleConnection sanitizes connection error messages', async () => {
      const mockAdminClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              error: {
                message: `Connection failed: Authorization: Bearer ${validJwtB} with apikey=sbp_service_role_secret`,
              },
            }),
          }),
        }),
      } as any;

      const connRes = await verifyServiceRoleConnection(mockAdminClient);
      expect(connRes.ok).toBe(false);
      expect(connRes.error).toBeDefined();
      expect(connRes.error).not.toContain(validJwtB);
      expect(connRes.error).not.toContain('sbp_service_role_secret');
      expect(connRes.error).toContain('[REDACTED');
    });
  });

  // ----------------------------------------------------------------------------
  // General Preflight Guardrail Tests
  // ----------------------------------------------------------------------------
  describe('General Preflight Guardrail Tests', () => {
    it('strictly rejects placeholder tokens (mock_jwt_a, mock_jwt_b, mock_jwt_c)', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
        TEST_SUPABASE_ANON_KEY: 'test-anon-key',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TEST_JWT_TENANT_A: 'mock_jwt_a',
        TEST_JWT_TENANT_B: 'mock_jwt_b',
        TEST_JWT_USER_C: 'mock_jwt_c',
      });

      expect(result.isReady).toBe(false);
      expect(result.isBlocked).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('TEST_JWT_TENANT_A is a placeholder'))).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('TEST_JWT_TENANT_B is a placeholder'))).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('TEST_JWT_USER_C is a placeholder'))).toBe(true);
    });

    it('rejects tokens missing the sub claim', () => {
      const badJwt = createTestJwt({ role: 'admin' });
      const val = validateTenantJwt(badJwt, 'TEST_JWT');
      expect(val.valid).toBe(false);
      expect(val.error).toContain("missing required 'sub' claim");
    });

    it('correctly extracts sub and org_id claims from valid JWTs', () => {
      const val = validateTenantJwt(validJwtA, 'TEST_JWT_TENANT_A');
      expect(val.valid).toBe(true);
      expect(val.sub).toBe('user_clerk_101');
      expect(val.orgId).toBe('org_test_a');
    });

    it('formatPreflightReport outputs clean report without secrets', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
        TEST_SUPABASE_ANON_KEY: 'super-secret-anon-key-12345',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-key-98765',
        TEST_JWT_TENANT_A: 'mock_jwt_a',
      });

      const report = formatPreflightReport(result);
      expect(report).toContain('[REAL SUPABASE TENANT-ISOLATION INTEGRATION TESTS: BLOCKED]');
      expect(report).not.toContain('super-secret-anon-key');
      expect(report).not.toContain('super-secret-service-key');
    });
  });
});
