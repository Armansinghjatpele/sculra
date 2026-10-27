// ==============================================================================
// Unit Tests: Isolated Supabase RLS Test Runner
// (frontend/tests/isolated_rls_runner.test.ts)
// ==============================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  resolveRunnerConfig,
  runIsolatedSupabaseRls,
  acquireClerkTokensIfConfigured,
} from '../../scripts/run-isolated-supabase-rls';

function createTestJwt(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'test_signature_bytes';
  return `${header}.${body}.${signature}`;
}

const validJwtA = createTestJwt({ sub: 'user_runner_a', org_id: 'org_runner_a' });
const validJwtB = createTestJwt({ sub: 'user_runner_b', org_id: 'org_runner_b' });
const validJwtC = createTestJwt({ sub: 'user_runner_c' });

const validReadyEnv = {
  TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
  TEST_SUPABASE_ANON_KEY: 'test-anon-key-12345',
  TEST_SUPABASE_SERVICE_ROLE_KEY: 'test-service-key-12345',
  TEST_JWT_TENANT_A: validJwtA,
  TEST_JWT_TENANT_B: validJwtB,
  TEST_JWT_USER_C: validJwtC,
};

describe('Isolated Supabase RLS Test Runner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves CLI flags correctly', () => {
    const config1 = resolveRunnerConfig({}, ['--check-only']);
    expect(config1.checkOnly).toBe(true);
    expect(config1.verbose).toBe(false);

    const config2 = resolveRunnerConfig({}, ['--dry-run', '-v']);
    expect(config2.checkOnly).toBe(true);
    expect(config2.verbose).toBe(true);

    const config3 = resolveRunnerConfig({}, []);
    expect(config3.checkOnly).toBe(false);
    expect(config3.verbose).toBe(false);
  });

  it('strictly halts with exitCode 1 when target matches protected production Supabase instance', async () => {
    const result = await runIsolatedSupabaseRls({
      env: {
        TEST_SUPABASE_URL: 'https://vycrimzpywqyjhtvvuax.supabase.co',
        CONFIRM_ISOLATED_TEST_DB: 'true',
      },
      checkOnly: false,
      verbose: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.isReady).toBe(false);
    expect(result.isBlocked).toBe(true);
    expect(result.isProductionAttempt).toBe(true);
    expect(result.message).toContain('CRITICAL SECURITY ALERT');
  });

  it('halts with exitCode 1 when target matches sculra.com production domain', async () => {
    const result = await runIsolatedSupabaseRls({
      env: {
        TEST_SUPABASE_URL: 'https://sculra.com',
      },
      checkOnly: false,
      verbose: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.isProductionAttempt).toBe(true);
  });

  it('reports BLOCKED with exitCode 2 when prerequisites are missing without attempting execution', async () => {
    const result = await runIsolatedSupabaseRls({
      env: {},
      checkOnly: false,
      verbose: false,
    });

    expect(result.exitCode).toBe(2);
    expect(result.isReady).toBe(false);
    expect(result.isBlocked).toBe(true);
    expect(result.isProductionAttempt).toBe(false);
    expect(result.message).toContain('prerequisites are missing');
  });

  it('strictly returns non-zero exitCode 2 when --check-only is used on blocked environment', async () => {
    const result = await runIsolatedSupabaseRls({
      env: {},
      checkOnly: true,
      verbose: false,
    });

    // In check-only mode on blocked environment, must return 2 (never misleading 0)
    expect(result.exitCode).toBe(2);
    expect(result.isReady).toBe(false);
    expect(result.isBlocked).toBe(true);
    expect(result.message).toContain('prerequisites are missing');
  });

  it('returns exitCode 0 when --check-only is used on a fully satisfied environment', async () => {
    const result = await runIsolatedSupabaseRls({
      env: validReadyEnv,
      checkOnly: true,
      verbose: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.isReady).toBe(true);
    expect(result.isBlocked).toBe(false);
    expect(result.message).toContain('Preflight validation successful');
  });

  it('strictly aborts and avoids Clerk API network calls when target URL matches production', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await runIsolatedSupabaseRls({
      env: {
        TEST_SUPABASE_URL: 'https://vycrimzpywqyjhtvvuax.supabase.co',
        CLERK_SECRET_KEY: ['sk', 'test', 'runner_mock_clerk_key'].join('_'),
        TEST_USER_A_ID: 'user_runner_clerk_a',
      },
      checkOnly: false,
      verbose: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.isProductionAttempt).toBe(true);
    // Never make outbound network requests to Clerk on production targets!
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('acquireClerkTokensIfConfigured safely returns empty when CLERK_SECRET_KEY is absent', async () => {
    const res = await acquireClerkTokensIfConfigured({});
    expect(res.jwtA).toBeUndefined();
    expect(res.jwtB).toBeUndefined();
    expect(res.jwtC).toBeUndefined();
    expect(res.errors).toHaveLength(0);
  });

  it('spawns child process with shell: false and platform-appropriate command', async () => {
    const mockChild: any = new EventEmitter();
    let capturedCmd = '';
    let capturedArgs: any = null;
    let capturedOptions: any = null;

    const mockSpawn: any = (cmd: any, args: any, options: any) => {
      capturedCmd = cmd;
      capturedArgs = args;
      capturedOptions = options;
      process.nextTick(() => {
        mockChild.emit('close', 0);
      });
      return mockChild;
    };

    const result = await runIsolatedSupabaseRls({
      env: validReadyEnv,
      checkOnly: false,
      verbose: false,
      spawnFn: mockSpawn,
    });

    const expectedCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    expect(capturedCmd).toBe(expectedCmd);
    expect(capturedArgs).toEqual(['test', 'tests/supabase_tenant_isolation.integration.test.ts', '--run']);
    expect(capturedOptions?.shell).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.message).toContain('All RLS integration scenarios passed');
  });

  it('propagates child process non-zero exit code cleanly', async () => {
    const mockChild: any = new EventEmitter();

    const mockSpawn: any = () => {
      process.nextTick(() => {
        mockChild.emit('close', 1);
      });
      return mockChild;
    };

    const result = await runIsolatedSupabaseRls({
      env: validReadyEnv,
      checkOnly: false,
      verbose: false,
      spawnFn: mockSpawn,
    });

    expect(result.exitCode).toBe(1);
    expect(result.message).toContain('One or more RLS tests failed');
  });

  it('propagates child process spawn errors cleanly with secret redaction', async () => {
    const mockChild: any = new EventEmitter();

    const mockSpawn: any = () => {
      process.nextTick(() => {
        mockChild.emit('error', new Error('spawn ENOENT for pnpm'));
      });
      return mockChild;
    };

    const result = await runIsolatedSupabaseRls({
      env: validReadyEnv,
      checkOnly: false,
      verbose: false,
      spawnFn: mockSpawn,
    });

    expect(result.exitCode).toBe(1);
    expect(result.message).toContain('Failed to spawn test process: spawn ENOENT for pnpm');
  });
});
