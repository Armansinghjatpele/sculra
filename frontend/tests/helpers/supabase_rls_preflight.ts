// ==============================================================================
// Sculra Supabase RLS Preflight & Safety Engine
// (frontend/tests/helpers/supabase_rls_preflight.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';

export interface PreflightConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  isLocal: boolean;
  tenantA: { jwt: string; sub: string; orgId?: string };
  tenantB: { jwt: string; sub: string; orgId?: string };
  userC: { jwt: string; sub: string };
  userD?: { jwt: string; sub: string };
}

export interface PreflightResult {
  isReady: boolean;
  isBlocked: boolean;
  isProductionAttempt: boolean;
  blockedReasons: string[];
  config?: PreflightConfig;
}

export interface VerificationResult {
  clean: boolean;
  lingering: string[];
  verificationErrors: string[];
}

export const KNOWN_PRODUCTION_HOSTS = [
  'vycrimzpywqyjhtvvuax.supabase.co',
  'sculra.com',
  'api.sculra.com',
];

const PLACEHOLDER_TOKENS = new Set([
  'mock_jwt_a',
  'mock_jwt_b',
  'mock_jwt_c',
  'mock_jwt_d',
  'mock_jwt',
  'dummy',
  'test',
  'token',
  'placeholder',
  'undefined',
  'null',
]);

/**
 * Sanitizes error messages by scrubbing potential JWTs, authorization headers,
 * and API keys before logging or reporting.
 */
export function sanitizeErrorMessage(message?: string): string {
  if (!message) return 'Unknown error';
  let sanitized = String(message);
  // Redact any JWT-like strings (three base64url segments separated by dots)
  sanitized = sanitized.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]');
  // Redact Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[^\s"',]+/gi, 'Bearer [REDACTED]');
  // Redact apiKey / apikey query params or header values
  sanitized = sanitized.replace(/apikey[=:]\s*[^\s"',&]+/gi, 'apikey=[REDACTED]');
  // Redact authorization headers
  sanitized = sanitized.replace(/authorization[=:]\s*[^\s"',&]+/gi, 'authorization=[REDACTED]');
  // Redact Supabase secret / service role keys (long base64 or sbp_ patterns)
  sanitized = sanitized.replace(/sbp_[a-zA-Z0-9]+/g, '[REDACTED_KEY]');
  sanitized = sanitized.replace(/ey[a-zA-Z0-9_-]{30,}/g, '[REDACTED_KEY]');
  return sanitized;
}

/**
 * Safely decodes a JWT payload without verifying cryptographic signature.
 * Returns null if token is not a valid 3-part base64url string.
 */
export function decodeJwtPayload(token: string): Record<string, any> | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Determines if a token is a known placeholder/mock string.
 */
export function isPlaceholderToken(token?: string): boolean {
  if (!token) return true;
  const trimmed = token.trim();
  if (PLACEHOLDER_TOKENS.has(trimmed.toLowerCase())) return true;
  if (
    trimmed.startsWith('mock_') ||
    trimmed.startsWith('test_jwt_') ||
    trimmed.startsWith('placeholder_')
  ) {
    return true;
  }
  return false;
}

/**
 * Validates a JWT string for preflight requirements without logging secrets.
 */
export function validateTenantJwt(
  token?: string,
  identifierName: string = 'JWT'
): { valid: boolean; error?: string; sub?: string; orgId?: string } {
  if (!token || !token.trim()) {
    return { valid: false, error: `${identifierName} is missing or empty` };
  }
  if (isPlaceholderToken(token)) {
    return {
      valid: false,
      error: `${identifierName} is a placeholder/mock value. Real authenticated tokens are required.`,
    };
  }
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { valid: false, error: `${identifierName} is not a valid 3-part base64url encoded JWT` };
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    return { valid: false, error: `${identifierName} payload is missing required 'sub' claim` };
  }
  return {
    valid: true,
    sub: payload.sub,
    orgId: payload.org_id || payload.orgId,
  };
}

/**
 * Normalizes a URL hostname: lowers case, strips trailing dot (FQDN root),
 * and unwraps IPv6 brackets.
 */
export function normalizeHostname(url: URL): string {
  let host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  return host;
}

/**
 * Detects whether a database target URL points to a known production database.
 * Uses exact and subdomain matching on parsed hostnames to prevent substring false-positives.
 */
export function isProductionDatabaseUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = normalizeHostname(parsed);

    // Exact match or subdomain of known production hosts
    for (const prodHost of KNOWN_PRODUCTION_HOSTS) {
      if (host === prodHost || host.endsWith('.' + prodHost)) {
        return true;
      }
    }

    // Match production project ref on supabase.co
    if (host === 'vycrimzpywqyjhtvvuax' || host.endsWith('.vycrimzpywqyjhtvvuax') || host === 'vycrimzpywqyjhtvvuax.supabase.co') {
      return true;
    }

    // Check against configured production environment URL if present
    const prodEnvUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (prodEnvUrl) {
      try {
        const parsedEnv = new URL(prodEnvUrl);
        const envHost = normalizeHostname(parsedEnv);
        if (host === envHost || host.endsWith('.' + envHost)) {
          return true;
        }
      } catch {
        // ignore malformed env URL
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Identifies if a target URL points to a genuine local test database.
 * Strict hostname check: exactly 'localhost', '127.0.0.1', or IPv6 '::1'.
 * Port 54321 alone NEVER makes a remote host local.
 * Malformed URLs and unsupported protocols return false.
 */
export function isLocalDatabaseUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = normalizeHostname(parsed);
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

/**
 * Validates the full preflight configuration for the RLS integration test suite.
 * Enforces fail-closed safety, production URL blocks, and authentic JWT requirements.
 */
export function validateRlsPreflight(env: Record<string, string | undefined>): PreflightResult {
  const blockedReasons: string[] = [];
  let isProductionAttempt = false;

  const url = env.TEST_SUPABASE_URL?.trim();
  const anonKey = env.TEST_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = env.TEST_SUPABASE_SERVICE_ROLE_KEY?.trim();
  const jwtTenantA = env.TEST_JWT_TENANT_A?.trim();
  const jwtTenantB = env.TEST_JWT_TENANT_B?.trim();
  const jwtUserC = env.TEST_JWT_USER_C?.trim();
  const jwtUserD = env.TEST_JWT_USER_D?.trim();

  // 1. Validate Target Database URL
  if (!url) {
    blockedReasons.push('TEST_SUPABASE_URL is missing. A dedicated Supabase test instance is required.');
  } else {
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        blockedReasons.push(
          `TEST_SUPABASE_URL protocol '${parsedUrl.protocol}' is unsupported. Only HTTP and HTTPS are permitted.`
        );
      }
    } catch {
      blockedReasons.push('TEST_SUPABASE_URL is malformed. A valid HTTP or HTTPS URL is required.');
    }

    if (isProductionDatabaseUrl(url)) {
      isProductionAttempt = true;
      blockedReasons.push(
        'Target URL matches protected production database (vycrimzpywqyjhtvvuax.supabase.co). Refusing execution.'
      );
    } else if (parsedUrl && (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:')) {
      const isLocal = isLocalDatabaseUrl(url);
      const isConfirmedRemote =
        env.CONFIRM_ISOLATED_TEST_DB === 'true' || env.ALLOW_REMOTE_TEST_DB === 'true';

      if (!isLocal && !isConfirmedRemote) {
        blockedReasons.push(
          'Remote Supabase test target specified without explicit acknowledgement. Set CONFIRM_ISOLATED_TEST_DB=true to verify this is a dedicated non-production instance.'
        );
      }
    }
  }

  // 2. Validate API Keys
  if (!anonKey) {
    blockedReasons.push('TEST_SUPABASE_ANON_KEY is missing.');
  }
  if (!serviceRoleKey) {
    blockedReasons.push('TEST_SUPABASE_SERVICE_ROLE_KEY is missing. Cleanup and fixture provisioning require service role.');
  }

  // 3. Validate Authentic Tenant JWTs (Reject all placeholders)
  let tenantAData: { sub: string; orgId?: string } | undefined;
  let tenantBData: { sub: string; orgId?: string } | undefined;
  let userCData: { sub: string } | undefined;
  let userDData: { sub: string } | undefined;

  const valA = validateTenantJwt(jwtTenantA, 'TEST_JWT_TENANT_A');
  if (!valA.valid) {
    blockedReasons.push(valA.error!);
  } else {
    tenantAData = { sub: valA.sub!, orgId: valA.orgId };
  }

  const valB = validateTenantJwt(jwtTenantB, 'TEST_JWT_TENANT_B');
  if (!valB.valid) {
    blockedReasons.push(valB.error!);
  } else {
    tenantBData = { sub: valB.sub!, orgId: valB.orgId };
  }

  const valC = validateTenantJwt(jwtUserC, 'TEST_JWT_USER_C');
  if (!valC.valid) {
    blockedReasons.push(valC.error!);
  } else {
    userCData = { sub: valC.sub! };
  }

  if (jwtUserD) {
    const valD = validateTenantJwt(jwtUserD, 'TEST_JWT_USER_D');
    if (!valD.valid) {
      blockedReasons.push(valD.error!);
    } else {
      userDData = { sub: valD.sub! };
    }
  }

  if (blockedReasons.length > 0) {
    return {
      isReady: false,
      isBlocked: true,
      isProductionAttempt,
      blockedReasons,
    };
  }

  return {
    isReady: true,
    isBlocked: false,
    isProductionAttempt: false,
    blockedReasons: [],
    config: {
      url: url!,
      anonKey: anonKey!,
      serviceRoleKey: serviceRoleKey!,
      isLocal: isLocalDatabaseUrl(url!),
      tenantA: { jwt: jwtTenantA!, sub: tenantAData!.sub, orgId: tenantAData!.orgId },
      tenantB: { jwt: jwtTenantB!, sub: tenantBData!.sub, orgId: tenantBData!.orgId },
      userC: { jwt: jwtUserC!, sub: userCData!.sub },
      userD: userDData ? { jwt: jwtUserD!, sub: userDData.sub } : undefined,
    },
  };
}

/**
 * Generates an informative, safe console report without leaking sensitive credentials.
 */
export function formatPreflightReport(result: PreflightResult): string {
  const lines: string[] = [
    '==============================================================================',
    '[REAL SUPABASE TENANT-ISOLATION INTEGRATION TESTS: BLOCKED]',
    'Reason: Integration test infrastructure requirements are not satisfied.',
    'Safety & Configuration Audit:',
  ];

  if (result.isProductionAttempt) {
    lines.push('  ✖ CRITICAL: Production database protection triggered.');
  } else {
    lines.push('  ✔ Production Protection: Safe (No production URLs targeted).');
  }

  for (const reason of result.blockedReasons) {
    lines.push(`  - ${reason}`);
  }

  lines.push('');
  lines.push('Notice:');
  lines.push('  Never attempting authenticated database queries with mock/placeholder JWT tokens.');
  lines.push('  To run real Supabase RLS integration tests, configure:');
  lines.push('    TEST_SUPABASE_URL=http://127.0.0.1:54321');
  lines.push('    TEST_SUPABASE_ANON_KEY=<test-anon-key>');
  lines.push('    TEST_SUPABASE_SERVICE_ROLE_KEY=<test-service-key>');
  lines.push('    TEST_JWT_TENANT_A=<clerk-jwt-for-tenant-a>');
  lines.push('    TEST_JWT_TENANT_B=<clerk-jwt-for-tenant-b>');
  lines.push('    TEST_JWT_USER_C=<clerk-jwt-for-user-c>');
  lines.push('    (Optional) CONFIRM_ISOLATED_TEST_DB=true (if remote test project)');
  lines.push('==============================================================================');

  return lines.join('\n');
}

/**
 * Validates service role client connectivity before any fixture setup is attempted.
 * Sanitizes errors before returning to ensure credentials/headers are never leaked.
 */
export async function verifyServiceRoleConnection(
  adminClient: SupabaseClient
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await adminClient.from('projects').select('id').limit(1);
    if (error) {
      return { ok: false, error: sanitizeErrorMessage(error.message) };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: sanitizeErrorMessage(err?.message || 'Unknown network/connection failure') };
  }
}

/**
 * Fixture lifecycle registry ensuring complete rollback, dependency-safe deletion,
 * and fail-closed post-cleanup verification across all recorded categories.
 */
export class TestFixtureRegistry {
  private organizations: string[] = [];
  private memberships: { organization_id: string; clerk_user_id: string }[] = [];
  private projects: string[] = [];
  private testRuns: string[] = [];
  private issues: string[] = [];
  private incidents: string[] = [];
  private preferences: string[] = [];

  recordOrg(id: string) {
    this.organizations.push(id);
  }

  recordMembership(organizationId: string, clerkUserId: string) {
    this.memberships.push({ organization_id: organizationId, clerk_user_id: clerkUserId });
  }

  recordProject(id: string) {
    this.projects.push(id);
  }

  recordTestRun(id: string) {
    this.testRuns.push(id);
  }

  recordIssue(id: string) {
    this.issues.push(id);
  }

  recordIncident(id: string) {
    this.incidents.push(id);
  }

  recordPreference(projectId: string) {
    this.preferences.push(projectId);
  }

  /**
   * Cleans up all recorded fixtures in reverse dependency order.
   * Reports errors for any failed delete query.
   */
  async cleanup(adminClient: SupabaseClient): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 1. Delete notification preferences
    if (this.preferences.length > 0) {
      try {
        const { error } = await adminClient
          .from('notification_preferences')
          .delete()
          .in('project_id', this.preferences);
        if (error) errors.push(`Notification preferences deletion failed: ${sanitizeErrorMessage(error.message)}`);
      } catch (e: any) {
        errors.push(`Notification preferences deletion exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 2. Delete notification incidents
    if (this.incidents.length > 0) {
      try {
        const { error } = await adminClient
          .from('notification_incidents')
          .delete()
          .in('id', this.incidents);
        if (error) errors.push(`Notification incidents deletion failed: ${sanitizeErrorMessage(error.message)}`);
      } catch (e: any) {
        errors.push(`Notification incidents deletion exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 3. Delete issues
    if (this.issues.length > 0) {
      try {
        const { error } = await adminClient
          .from('issues')
          .delete()
          .in('id', this.issues);
        if (error) errors.push(`Issues deletion failed: ${sanitizeErrorMessage(error.message)}`);
      } catch (e: any) {
        errors.push(`Issues deletion exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 4. Delete test runs
    if (this.testRuns.length > 0) {
      try {
        const { error } = await adminClient
          .from('test_runs')
          .delete()
          .in('id', this.testRuns);
        if (error) errors.push(`Test runs deletion failed: ${sanitizeErrorMessage(error.message)}`);
      } catch (e: any) {
        errors.push(`Test runs deletion exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 5. Delete projects
    if (this.projects.length > 0) {
      try {
        const { error } = await adminClient
          .from('projects')
          .delete()
          .in('id', this.projects);
        if (error) errors.push(`Projects deletion failed: ${sanitizeErrorMessage(error.message)}`);
      } catch (e: any) {
        errors.push(`Projects deletion exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 6. Delete organization memberships
    if (this.organizations.length > 0) {
      try {
        const { error } = await adminClient
          .from('organization_memberships')
          .delete()
          .in('organization_id', this.organizations);
        if (error) errors.push(`Organization memberships deletion failed: ${sanitizeErrorMessage(error.message)}`);
      } catch (e: any) {
        errors.push(`Organization memberships deletion exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 7. Delete organizations
    if (this.organizations.length > 0) {
      try {
        const { error } = await adminClient
          .from('organizations')
          .delete()
          .in('id', this.organizations);
        if (error) errors.push(`Organizations deletion failed: ${sanitizeErrorMessage(error.message)}`);
      } catch (e: any) {
        errors.push(`Organizations deletion exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    return { success: errors.length === 0, errors };
  }

  /**
   * Verifies that all recorded fixture categories are completely removed.
   * Fails closed: if any query fails or records linger, clean is false.
   */
  async verifyCleanedUp(
    adminClient: SupabaseClient
  ): Promise<VerificationResult> {
    const lingering: string[] = [];
    const verificationErrors: string[] = [];

    // 1. Verify notification preferences
    if (this.preferences.length > 0) {
      try {
        const { data, error } = await adminClient
          .from('notification_preferences')
          .select('project_id')
          .in('project_id', this.preferences);
        if (error) {
          verificationErrors.push(`Notification preferences verification query failed: ${sanitizeErrorMessage(error.message)}`);
        } else if (data && data.length > 0) {
          lingering.push(`Notification preferences lingering (${data.length} records): ${data.map((d: any) => d.project_id).join(', ')}`);
        }
      } catch (e: any) {
        verificationErrors.push(`Notification preferences verification query exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 2. Verify notification incidents
    if (this.incidents.length > 0) {
      try {
        const { data, error } = await adminClient
          .from('notification_incidents')
          .select('id')
          .in('id', this.incidents);
        if (error) {
          verificationErrors.push(`Notification incidents verification query failed: ${sanitizeErrorMessage(error.message)}`);
        } else if (data && data.length > 0) {
          lingering.push(`Notification incidents lingering (${data.length} records): ${data.map((d: any) => d.id).join(', ')}`);
        }
      } catch (e: any) {
        verificationErrors.push(`Notification incidents verification query exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 3. Verify issues
    if (this.issues.length > 0) {
      try {
        const { data, error } = await adminClient
          .from('issues')
          .select('id')
          .in('id', this.issues);
        if (error) {
          verificationErrors.push(`Issues verification query failed: ${sanitizeErrorMessage(error.message)}`);
        } else if (data && data.length > 0) {
          lingering.push(`Issues lingering (${data.length} records): ${data.map((d: any) => d.id).join(', ')}`);
        }
      } catch (e: any) {
        verificationErrors.push(`Issues verification query exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 4. Verify test runs
    if (this.testRuns.length > 0) {
      try {
        const { data, error } = await adminClient
          .from('test_runs')
          .select('id')
          .in('id', this.testRuns);
        if (error) {
          verificationErrors.push(`Test runs verification query failed: ${sanitizeErrorMessage(error.message)}`);
        } else if (data && data.length > 0) {
          lingering.push(`Test runs lingering (${data.length} records): ${data.map((d: any) => d.id).join(', ')}`);
        }
      } catch (e: any) {
        verificationErrors.push(`Test runs verification query exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 5. Verify projects
    if (this.projects.length > 0) {
      try {
        const { data, error } = await adminClient
          .from('projects')
          .select('id')
          .in('id', this.projects);
        if (error) {
          verificationErrors.push(`Projects verification query failed: ${sanitizeErrorMessage(error.message)}`);
        } else if (data && data.length > 0) {
          lingering.push(`Projects lingering (${data.length} records): ${data.map((d: any) => d.id).join(', ')}`);
        }
      } catch (e: any) {
        verificationErrors.push(`Projects verification query exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 6. Verify organization memberships
    if (this.organizations.length > 0) {
      try {
        const { data, error } = await adminClient
          .from('organization_memberships')
          .select('id, organization_id')
          .in('organization_id', this.organizations);
        if (error) {
          verificationErrors.push(`Organization memberships verification query failed: ${sanitizeErrorMessage(error.message)}`);
        } else if (data && data.length > 0) {
          lingering.push(`Organization memberships lingering (${data.length} records): ${data.map((d: any) => d.organization_id || d.id).join(', ')}`);
        }
      } catch (e: any) {
        verificationErrors.push(`Organization memberships verification query exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    // 7. Verify organizations
    if (this.organizations.length > 0) {
      try {
        const { data, error } = await adminClient
          .from('organizations')
          .select('id')
          .in('id', this.organizations);
        if (error) {
          verificationErrors.push(`Organizations verification query failed: ${sanitizeErrorMessage(error.message)}`);
        } else if (data && data.length > 0) {
          lingering.push(`Organizations lingering (${data.length} records): ${data.map((d: any) => d.id).join(', ')}`);
        }
      } catch (e: any) {
        verificationErrors.push(`Organizations verification query exception: ${sanitizeErrorMessage(e?.message)}`);
      }
    }

    const clean = verificationErrors.length === 0 && lingering.length === 0;
    return { clean, lingering, verificationErrors };
  }
}
