// ==============================================================================
// Sculra Isolated Supabase RLS Test Runner
// (scripts/run-isolated-supabase-rls.ts)
// ==============================================================================
// Safe-by-default execution orchestrator for database-level Row-Level Security
// (RLS) integration tests. Enforces strict fail-closed production protection,
// target isolation verification, and authentic JWT token requirements.
//
// ENVIRONMENT CONFIGURATION:
// ------------------------------------------------------------------------------
// Local Docker Stack (Recommended):
//   TEST_SUPABASE_URL=http://127.0.0.1:54321
//   TEST_SUPABASE_ANON_KEY=<local-anon-key>
//   TEST_SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
//   TEST_JWT_TENANT_A=<clerk-jwt-for-tenant-a>
//   TEST_JWT_TENANT_B=<clerk-jwt-for-tenant-b>
//   TEST_JWT_USER_C=<clerk-jwt-for-user-c>
//
// Remote Dedicated Non-Production Instance:
//   TEST_SUPABASE_URL=https://<isolated-test-project>.supabase.co
//   CONFIRM_ISOLATED_TEST_DB=true
//   ... (keys and tokens as above)
//
// Dynamic Clerk Token Acquisition (Optional):
//   CLERK_SECRET_KEY=sk_test_...
//   TEST_USER_A_ID=user_test_a_...
//   TEST_USER_B_ID=user_test_b_...
//   TEST_USER_C_ID=user_test_c_...
//
// PRODUCTION SAFEGUARDS:
// ------------------------------------------------------------------------------
// - Strictly refuses execution against production (vycrimzpywqyjhtvvuax.supabase.co,
//   sculra.com, api.sculra.com).
// - Remote databases fail closed unless CONFIRM_ISOLATED_TEST_DB=true is provided.
// - Placeholder tokens (mock_jwt_*) are rejected; only authentic 3-part base64url
//   JWTs with a valid 'sub' claim are permitted.
// ==============================================================================

import { spawn } from 'child_process';
import * as path from 'path';
import {
  validateRlsPreflight,
  formatPreflightReport,
  isProductionDatabaseUrl,
  isLocalDatabaseUrl,
  verifyServiceRoleConnection,
  sanitizeErrorMessage,
  PreflightResult,
} from '../frontend/tests/helpers/supabase_rls_preflight';

export interface RlsRunnerConfig {
  env: Record<string, string | undefined>;
  checkOnly: boolean;
  verbose: boolean;
}

export interface RunnerExecutionResult {
  exitCode: number;
  isReady: boolean;
  isBlocked: boolean;
  isProductionAttempt: boolean;
  message: string;
}

/**
 * Resolves CLI arguments and environment variables into runner configuration.
 */
export function resolveRunnerConfig(
  env: Record<string, string | undefined> = process.env,
  argv: string[] = process.argv.slice(2)
): RlsRunnerConfig {
  const checkOnly = argv.includes('--check-only') || argv.includes('--dry-run');
  const verbose = argv.includes('--verbose') || argv.includes('-v');

  return {
    env: { ...env },
    checkOnly,
    verbose,
  };
}

/**
 * Optionally acquires authentic Clerk session tokens via Backend API
 * if credentials and user IDs are supplied.
 */
export async function acquireClerkTokensIfConfigured(
  env: Record<string, string | undefined>
): Promise<{
  jwtA?: string;
  jwtB?: string;
  jwtC?: string;
  errors: string[];
}> {
  const errors: string[] = [];
  const clerkKey = env.CLERK_SECRET_KEY?.trim();

  const userA = env.TEST_USER_A_ID?.trim();
  const userB = env.TEST_USER_B_ID?.trim();
  const userC = env.TEST_USER_C_ID?.trim();

  let jwtA = env.TEST_JWT_TENANT_A?.trim();
  let jwtB = env.TEST_JWT_TENANT_B?.trim();
  let jwtC = env.TEST_JWT_USER_C?.trim();

  if (!clerkKey || (!userA && !userB && !userC)) {
    return { jwtA, jwtB, jwtC, errors };
  }

  async function fetchTokenForUser(userId: string): Promise<string | undefined> {
    try {
      const sessRes = await fetch('https://api.clerk.com/v1/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clerkKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!sessRes.ok) {
        errors.push(`Clerk session creation failed for user ${userId} (HTTP ${sessRes.status})`);
        return undefined;
      }
      const sess = await sessRes.json();
      if (!sess?.id) {
        errors.push(`Clerk session response missing ID for user ${userId}`);
        return undefined;
      }

      const tokRes = await fetch(`https://api.clerk.com/v1/sessions/${sess.id}/tokens`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clerkKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!tokRes.ok) {
        errors.push(`Clerk session token fetch failed for user ${userId} (HTTP ${tokRes.status})`);
        return undefined;
      }
      const tok = await tokRes.json();
      return tok?.jwt;
    } catch (e: any) {
      errors.push(`Clerk token request exception: ${sanitizeErrorMessage(e?.message)}`);
      return undefined;
    }
  }

  if (!jwtA && userA) jwtA = await fetchTokenForUser(userA);
  if (!jwtB && userB) jwtB = await fetchTokenForUser(userB);
  if (!jwtC && userC) jwtC = await fetchTokenForUser(userC);

  return { jwtA, jwtB, jwtC, errors };
}

/**
 * Runs preflight safety checks, resolves tokens, and executes the suite if safe.
 */
export async function runIsolatedSupabaseRls(
  config: RlsRunnerConfig
): Promise<RunnerExecutionResult> {
  const activeEnv = { ...config.env };

  // 1. Check for attempt against protected production target
  const targetUrl = activeEnv.TEST_SUPABASE_URL?.trim();
  if (targetUrl && isProductionDatabaseUrl(targetUrl)) {
    const errorMsg =
      'CRITICAL SECURITY ALERT: Target database matches protected production instance ' +
      '(vycrimzpywqyjhtvvuax.supabase.co). Execution strictly refused to prevent data destruction.';
    console.error('\n' + errorMsg + '\n');
    return {
      exitCode: 1,
      isReady: false,
      isBlocked: true,
      isProductionAttempt: true,
      message: errorMsg,
    };
  }

  // 2. Attempt dynamic Clerk token acquisition if configured
  if (activeEnv.CLERK_SECRET_KEY) {
    const tokenAcquisition = await acquireClerkTokensIfConfigured(activeEnv);
    if (tokenAcquisition.jwtA) activeEnv.TEST_JWT_TENANT_A = tokenAcquisition.jwtA;
    if (tokenAcquisition.jwtB) activeEnv.TEST_JWT_TENANT_B = tokenAcquisition.jwtB;
    if (tokenAcquisition.jwtC) activeEnv.TEST_JWT_USER_C = tokenAcquisition.jwtC;
    if (tokenAcquisition.errors.length > 0 && config.verbose) {
      console.warn('Notice during dynamic token acquisition:', tokenAcquisition.errors.join('; '));
    }
  }

  // 3. Validate Preflight
  const preflight = validateRlsPreflight(activeEnv);

  if (preflight.isBlocked) {
    console.log('\n' + formatPreflightReport(preflight) + '\n');
    return {
      exitCode: config.checkOnly ? 0 : 2,
      isReady: false,
      isBlocked: true,
      isProductionAttempt: preflight.isProductionAttempt,
      message: 'Integration test prerequisites are missing or unsatisfied.',
    };
  }

  // 4. If check-only flag is set, return ready without running tests
  if (config.checkOnly) {
    console.log('\n[RLS PREFLIGHT AUDIT: READY]');
    console.log(`Target URL: ${preflight.config?.url} (Local: ${preflight.config?.isLocal})`);
    console.log('All required authentic tenant JWTs and service keys validated successfully.\n');
    return {
      exitCode: 0,
      isReady: true,
      isBlocked: false,
      isProductionAttempt: false,
      message: 'Preflight validation successful. Environment is ready for RLS integration tests.',
    };
  }

  // 5. Execute integration tests with vitest
  console.log('\n[EXECUTING REAL SUPABASE TENANT-ISOLATION RLS INTEGRATION SUITE]');
  console.log(`Target: ${preflight.config?.url} (Local: ${preflight.config?.isLocal})`);
  console.log('Exercising real PostgreSQL Row-Level Security policies across all 9 scenarios...\n');

  const frontendDir = path.resolve(__dirname, '../frontend');
  const vitestArgs = [
    'test',
    'tests/supabase_tenant_isolation.integration.test.ts',
    '--run',
  ];

  return new Promise((resolve) => {
    const child = spawn('pnpm', vitestArgs, {
      cwd: frontendDir,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        ...activeEnv,
      },
    });

    child.on('close', (code) => {
      const exitCode = code ?? 1;
      resolve({
        exitCode,
        isReady: true,
        isBlocked: false,
        isProductionAttempt: false,
        message: exitCode === 0 ? 'All RLS integration scenarios passed.' : 'One or more RLS tests failed.',
      });
    });

    child.on('error', (err) => {
      resolve({
        exitCode: 1,
        isReady: true,
        isBlocked: false,
        isProductionAttempt: false,
        message: `Failed to spawn test process: ${sanitizeErrorMessage(err.message)}`,
      });
    });
  });
}

// CLI entry point
if (require.main === module) {
  const config = resolveRunnerConfig();
  runIsolatedSupabaseRls(config).then((result) => {
    process.exit(result.exitCode);
  });
}
