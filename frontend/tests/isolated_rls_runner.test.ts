// ==============================================================================
// Unit Tests: Isolated Supabase RLS Test Runner
// (frontend/tests/isolated_rls_runner.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  resolveRunnerConfig,
  runIsolatedSupabaseRls,
  acquireClerkTokensIfConfigured,
} from '../../scripts/run-isolated-supabase-rls';

describe('Isolated Supabase RLS Test Runner', () => {
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

  it('reports BLOCKED when prerequisites are missing without attempting execution', async () => {
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

  it('returns exitCode 0 when --check-only is used on blocked environment', async () => {
    const result = await runIsolatedSupabaseRls({
      env: {},
      checkOnly: true,
      verbose: false,
    });

    // In check-only mode, blocked status returns code 0 so preflight audits can inspect state cleanly
    expect(result.exitCode).toBe(0);
    expect(result.isReady).toBe(false);
    expect(result.isBlocked).toBe(true);
  });

  it('acquireClerkTokensIfConfigured safely returns empty when CLERK_SECRET_KEY is absent', async () => {
    const res = await acquireClerkTokensIfConfigured({});
    expect(res.jwtA).toBeUndefined();
    expect(res.jwtB).toBeUndefined();
    expect(res.jwtC).toBeUndefined();
    expect(res.errors).toHaveLength(0);
  });
});
