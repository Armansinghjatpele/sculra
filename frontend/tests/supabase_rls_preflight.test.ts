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

  describe('1. Production Database Target Protection', () => {
    it('detects and strictly rejects the production Supabase URL', () => {
      expect(isProductionDatabaseUrl('https://vycrimzpywqyjhtvvuax.supabase.co')).toBe(true);
      expect(isProductionDatabaseUrl('http://vycrimzpywqyjhtvvuax.supabase.co:54321')).toBe(true);
      expect(isProductionDatabaseUrl('https://api.sculra.com')).toBe(true);
      expect(isProductionDatabaseUrl('https://sculra.com')).toBe(true);
    });

    it('blocks execution when TEST_SUPABASE_URL is production even if all other keys/JWTs are valid', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'https://vycrimzpywqyjhtvvuax.supabase.co',
        TEST_SUPABASE_ANON_KEY: 'test-anon-key',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TEST_JWT_TENANT_A: validJwtA,
        TEST_JWT_TENANT_B: validJwtB,
        TEST_JWT_USER_C: validJwtC,
      });

      expect(result.isReady).toBe(false);
      expect(result.isBlocked).toBe(true);
      expect(result.isProductionAttempt).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('production database'))).toBe(true);
    });
  });

  describe('2. Missing Infrastructure Preflight Blocks', () => {
    it('reports BLOCKED when TEST_SUPABASE_URL is missing', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_ANON_KEY: 'anon-key',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        TEST_JWT_TENANT_A: validJwtA,
        TEST_JWT_TENANT_B: validJwtB,
        TEST_JWT_USER_C: validJwtC,
      });

      expect(result.isReady).toBe(false);
      expect(result.isBlocked).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('TEST_SUPABASE_URL is missing'))).toBe(true);
    });

    it('reports BLOCKED when service role key or anon key is missing', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
        TEST_JWT_TENANT_A: validJwtA,
        TEST_JWT_TENANT_B: validJwtB,
        TEST_JWT_USER_C: validJwtC,
      });

      expect(result.isReady).toBe(false);
      expect(result.isBlocked).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('TEST_SUPABASE_ANON_KEY'))).toBe(true);
      expect(result.blockedReasons.some((r) => r.includes('TEST_SUPABASE_SERVICE_ROLE_KEY'))).toBe(true);
    });
  });

  describe('3. Placeholder Token Rejection & Real JWT Enforcement', () => {
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
      const badJwt = createTestJwt({ role: 'admin' }); // no sub
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
  });

  describe('4. Remote Test Target Acknowledgement Guard', () => {
    it('blocks remote non-production Supabase URLs if unacknowledged', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'https://staging-project-isolated.supabase.co',
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

    it('accepts remote non-production Supabase URL when explicitly confirmed', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'https://staging-project-isolated.supabase.co',
        CONFIRM_ISOLATED_TEST_DB: 'true',
        TEST_SUPABASE_ANON_KEY: 'test-anon-key',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TEST_JWT_TENANT_A: validJwtA,
        TEST_JWT_TENANT_B: validJwtB,
        TEST_JWT_USER_C: validJwtC,
      });

      expect(result.isReady).toBe(true);
      expect(result.isBlocked).toBe(false);
      expect(result.config?.url).toBe('https://staging-project-isolated.supabase.co');
    });

    it('accepts local database URL (127.0.0.1:54321) without remote confirmation', () => {
      const result = validateRlsPreflight({
        TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
        TEST_SUPABASE_ANON_KEY: 'test-anon-key',
        TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        TEST_JWT_TENANT_A: validJwtA,
        TEST_JWT_TENANT_B: validJwtB,
        TEST_JWT_USER_C: validJwtC,
      });

      expect(result.isReady).toBe(true);
      expect(result.isBlocked).toBe(false);
      expect(result.config?.isLocal).toBe(true);
      expect(result.config?.tenantA.sub).toBe('user_clerk_101');
    });
  });

  describe('5. Credential Security in Reporting', () => {
    it('formatPreflightReport masks and never outputs raw JWTs or keys', () => {
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

  describe('6. Test Fixture Registry & Cleanup Lifecycle', () => {
    it('records resources and generates accurate cleanup calls', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordOrg('org-1');
      registry.recordMembership('org-1', 'user-1');
      registry.recordProject('proj-1');
      registry.recordIncident('inc-1');
      registry.recordPreference('proj-1');

      const mockDelete = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
      const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });
      const mockAdminClient = { from: mockFrom } as any;

      const cleanupRes = await registry.cleanup(mockAdminClient);
      expect(cleanupRes.success).toBe(true);
      expect(cleanupRes.errors).toHaveLength(0);
      expect(mockFrom).toHaveBeenCalledWith('notification_preferences');
      expect(mockFrom).toHaveBeenCalledWith('notification_incidents');
      expect(mockFrom).toHaveBeenCalledWith('projects');
      expect(mockFrom).toHaveBeenCalledWith('organization_memberships');
      expect(mockFrom).toHaveBeenCalledWith('organizations');
    });

    it('verifies that no fixtures linger after cleanup', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordProject('proj-1');

      const mockSelect = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [] }) });
      const mockAdminClient = { from: vi.fn().mockReturnValue({ select: mockSelect }) } as any;

      const verifyRes = await registry.verifyCleanedUp(mockAdminClient);
      expect(verifyRes.clean).toBe(true);
      expect(verifyRes.lingering).toHaveLength(0);
    });

    it('flags error if fixtures still linger after cleanup', async () => {
      const registry = new TestFixtureRegistry();
      registry.recordProject('proj-1');

      const mockSelect = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: 'proj-1' }] }) });
      const mockAdminClient = { from: vi.fn().mockReturnValue({ select: mockSelect }) } as any;

      const verifyRes = await registry.verifyCleanedUp(mockAdminClient);
      expect(verifyRes.clean).toBe(false);
      expect(verifyRes.lingering[0]).toContain('Projects lingering: proj-1');
    });
  });
});
