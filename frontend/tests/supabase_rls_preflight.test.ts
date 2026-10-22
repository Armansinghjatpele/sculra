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
          const sanitizedSetupMsg = sanitizeErrorMessage(setupErr?.message || String(setupErr));
          const rollback = await registry.cleanup(mockAdminClient);
          if (!rollback.success) {
            throw new Error(
              `Fixture setup failed: ${sanitizedSetupMsg}. Rollback cleanup also failed: ${rollback.errors.join('; ')}`
            );
          }
          throw new Error(`Fixture setup failed: ${sanitizedSetupMsg}`);
        }
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).toContain('Initial setup query failed: Table projects schema mismatch');
      expect(caughtError?.message).toContain('Foreign key constraint violated during rollback');
    });

    it('retains both setup and rollback failures while fully sanitizing secrets in both errors', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordProject('proj-leak-test');

      const rawSetupSecret = ['sk', 'test', 'super_secret_setup_key_12345'].join('_');
      const rawRollbackSecret = ['whsec', 'rollback_webhook_secret_99999'].join('_');

      const mockDelete = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          error: { message: `Rollback delete failed: Bearer ${rawRollbackSecret}` },
        }),
      });
      const mockAdminClient = {
        from: vi.fn().mockReturnValue({ delete: mockDelete }),
      } as any;

      let caughtError: Error | null = null;
      try {
        try {
          throw new Error(`Setup error (projects): connection rejected with apikey=${rawSetupSecret}`);
        } catch (setupErr: any) {
          const sanitizedSetupMsg = sanitizeErrorMessage(setupErr?.message || String(setupErr));
          const rollback = await registry.cleanup(mockAdminClient);
          if (!rollback.success) {
            throw new Error(
              `Fixture setup failed: ${sanitizedSetupMsg}. Rollback cleanup also failed: ${rollback.errors.join('; ')}`
            );
          }
          throw new Error(`Fixture setup failed: ${sanitizedSetupMsg}`);
        }
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      // Must retain diagnostic structure of both errors
      expect(caughtError?.message).toContain('Fixture setup failed: Setup error (projects): connection rejected');
      expect(caughtError?.message).toContain('Rollback cleanup also failed: Projects deletion failed');
      // Must NOT leak either secret!
      expect(caughtError?.message).not.toContain(rawSetupSecret);
      expect(caughtError?.message).not.toContain(rawRollbackSecret);
      expect(caughtError?.message).toContain('apikey=[REDACTED]');
      expect(caughtError?.message).toContain('Bearer [REDACTED]');
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

    it('redacts realistic key formats across Sculra (Clerk, Supabase, Stripe, Sentry, AI providers, Webhooks)', () => {
      const testSecrets = [
        ['sk', 'test', 'sample_clerk_secret_key_12345'].join('_'),
        ['sk', 'live', 'sample_stripe_secret_key_12345'].join('_'),
        ['pk', 'test', 'sample_clerk_pub_key_12345'].join('_'),
        ['pk', 'live', 'sample_stripe_pub_key_12345'].join('_'),
        ['whsec', 'abcdef1234567890abcdef1234567890'].join('_'),
        ['sbp', 'my_supabase_management_token_999'].join('_'),
        ['sntrys', 'sentry_auth_token_example_12345'].join('_'),
        ['sntryu', 'sentry_user_token_example_67890'].join('_'),
        ['phc', 'posthog_client_key_abcdef123'].join('_'),
        ['phs', 'posthog_secret_key_fedcba321'].join('_'),
        ['sk', 'proj', 'openai_api_secret_key_example_9999'].join('-'),
        ['sk', 'ant', 'anthropic_api_secret_key_example_8888'].join('-'),
        ['AIza', 'SyB12345678901234567890123456789012'].join(''),
      ];

      for (const secret of testSecrets) {
        const raw = `Encountered error with credential ${secret} during operation`;
        const sanitized = sanitizeErrorMessage(raw);
        expect(sanitized).not.toContain(secret);
        expect(sanitized).toContain('[REDACTED_KEY]');
      }
    });

    it('redacts connection strings and database URLs with credentials while preserving host and database', () => {
      const pgUrl = 'postgresql://postgres:SuperSecretP%40ssw0rd!@127.0.0.1:54321/sculra_test?sslmode=disable';
      const sanitizedPg = sanitizeErrorMessage(`Failed to connect to ${pgUrl}: connection refused`);
      expect(sanitizedPg).not.toContain('SuperSecretP%40ssw0rd!');
      expect(sanitizedPg).toContain('postgresql://postgres:[REDACTED]@127.0.0.1:54321/sculra_test?sslmode=disable');
      expect(sanitizedPg).toContain('connection refused');

      const redisUrl = 'redis://:SecretRedisAuthToken@cache.internal.sculra.com:6379/0';
      const sanitizedRedis = sanitizeErrorMessage(`Cache unreachable: ${redisUrl}`);
      expect(sanitizedRedis).not.toContain('SecretRedisAuthToken');
      expect(sanitizedRedis).toContain('redis://:[REDACTED]@cache.internal.sculra.com:6379/0');

      const sentryDsn = 'https://d41d8cd98f00b204e9800998ecf8427e@o123456.ingest.sentry.io/456789';
      const sanitizedSentry = sanitizeErrorMessage(`Sentry report failure: ${sentryDsn}`);
      expect(sanitizedSentry).not.toContain('d41d8cd98f00b204e9800998ecf8427e');
      expect(sanitizedSentry).toContain('https://[REDACTED]@o123456.ingest.sentry.io/456789');
    });

    it('redacts sensitive query parameters across various parameter names', () => {
      const rawUrl =
        'https://api.sculra.com/webhook?apikey=secret_apikey_val&token=secret_token_val&access_token=secret_access_token&password=secret_password&auth=secret_auth&safe_param=sculra_project';
      const sanitized = sanitizeErrorMessage(`Error dispatching webhook to ${rawUrl}`);

      expect(sanitized).not.toContain('secret_apikey_val');
      expect(sanitized).not.toContain('secret_token_val');
      expect(sanitized).not.toContain('secret_access_token');
      expect(sanitized).not.toContain('secret_password');
      expect(sanitized).not.toContain('secret_auth');
      expect(sanitized).toContain('apikey=[REDACTED]');
      expect(sanitized).toContain('token=[REDACTED]');
      expect(sanitized).toContain('access_token=[REDACTED]');
      expect(sanitized).toContain('password=[REDACTED]');
      expect(sanitized).toContain('authorization=[REDACTED]');
      expect(sanitized).toContain('safe_param=sculra_project');
    });

    it('handles multiline error output and varied header casing', () => {
      const multiline = `Server responded with error:\nAuthorization:\n  Bearer my_multiline_secret_token\nX-Api-Key:\n  my_secret_x_api_key\nStatus: 401 Unauthorized`;
      const sanitized = sanitizeErrorMessage(multiline);

      expect(sanitized).not.toContain('my_multiline_secret_token');
      expect(sanitized).not.toContain('my_secret_x_api_key');
      expect(sanitized).toContain('authorization=[REDACTED]');
      expect(sanitized).toContain('apikey=[REDACTED]');
      expect(sanitized).toContain('Status: 401 Unauthorized');

      // Standalone Bearer header without authorization prefix
      const standalone = 'Operation failed: Bearer secret_bearer_token_xyz has expired';
      expect(sanitizeErrorMessage(standalone)).toContain('Bearer [REDACTED]');
      expect(sanitizeErrorMessage(standalone)).not.toContain('secret_bearer_token_xyz');
    });

    it('redacts sensitive string values in JSON bodies while preserving diagnostic attributes', () => {
      const jsonBody = JSON.stringify({
        code: 'PGRST301',
        message: 'Authentication failed for requested resource',
        apiKey: 'sensitive_json_apikey_999',
        serviceRoleKey: 'sensitive_service_role_key_888',
        password: 'sensitive_db_password_777',
        token: 'sensitive_session_token_666',
        table: 'projects',
      });
      const sanitized = sanitizeErrorMessage(`Database error response: ${jsonBody}`);

      expect(sanitized).not.toContain('sensitive_json_apikey_999');
      expect(sanitized).not.toContain('sensitive_service_role_key_888');
      expect(sanitized).not.toContain('sensitive_db_password_777');
      expect(sanitized).not.toContain('sensitive_session_token_666');
      expect(sanitized).toContain('"apiKey":"[REDACTED]"');
      expect(sanitized).toContain('"serviceRoleKey":"[REDACTED]"');
      expect(sanitized).toContain('"code":"PGRST301"');
      expect(sanitized).toContain('"message":"Authentication failed for requested resource"');
      expect(sanitized).toContain('"table":"projects"');
    });

    it('strictly preserves non-sensitive PostgreSQL error messages, constraint names, and table names', () => {
      const nonSensitiveErrors = [
        'new row for relation "projects" violates check constraint "projects_name_check"',
        'insert or update on table "projects" violates foreign key constraint "projects_organization_id_fkey"',
        'duplicate key value violates unique constraint "organizations_slug_key"',
        'null value in column "name" of relation "projects" violates not-null constraint',
        'relation "notification_preferences" does not exist',
        'new row violates row-level security policy for table "notification_incidents"',
        'syntax error at or near "WHERE"',
        'canceling statement due to statement timeout (5000ms)',
      ];

      for (const err of nonSensitiveErrors) {
        expect(sanitizeErrorMessage(err)).toBe(err);
      }
    });

    it('safely handles null, undefined, Error instances, and non-string inputs', () => {
      expect(sanitizeErrorMessage(null)).toBe('Unknown error');
      expect(sanitizeErrorMessage(undefined)).toBe('Unknown error');
      expect(sanitizeErrorMessage('')).toBe('Unknown error');

      const errObj = new Error('Database error: Bearer secret_err_token_123');
      const sanitizedErr = sanitizeErrorMessage(errObj);
      expect(sanitizedErr).not.toContain('secret_err_token_123');
      expect(sanitizedErr).toContain('Bearer [REDACTED]');

      const customObj = { message: 'Failed query with apikey=secret_custom_token' };
      const sanitizedCustom = sanitizeErrorMessage(customObj);
      expect(sanitizedCustom).not.toContain('secret_custom_token');
      expect(sanitizedCustom).toContain('apikey=[REDACTED]');

      expect(sanitizeErrorMessage(404)).toBe('404');
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
