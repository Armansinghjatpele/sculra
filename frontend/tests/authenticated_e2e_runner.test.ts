// ==============================================================================
// Authenticated E2E Runner Safety & Orchestration Unit Tests
// (frontend/tests/authenticated_e2e_runner.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  isProductionUrl,
  validateEnvironment,
  E2EOrchestrator,
  E2EEnvConfig,
} from '../../scripts/run-authenticated-browser-e2e';

describe('Authenticated E2E Runner - Production Safety & Validation', () => {
  it('correctly identifies production URLs vs local/staging URLs', () => {
    // Production targets
    expect(isProductionUrl('https://sculra-frontend.vercel.app')).toBe(true);
    expect(isProductionUrl('https://sculra-frontend.vercel.app/dashboard')).toBe(true);
    expect(isProductionUrl('https://sculra.com')).toBe(true);
    expect(isProductionUrl('https://app.sculra.com')).toBe(true);
    expect(isProductionUrl('https://preview-123.vercel.app')).toBe(true);

    // Non-production targets
    expect(isProductionUrl('http://localhost:3000')).toBe(false);
    expect(isProductionUrl('http://localhost:3000/dashboard')).toBe(false);
    expect(isProductionUrl('http://127.0.0.1:3000')).toBe(false);
    expect(isProductionUrl('http://127.0.0.1:54321')).toBe(false);
    expect(isProductionUrl('invalid-url')).toBe(false);
  });

  it('blocks execution against production hostnames when ALLOW_PRODUCTION is not set', () => {
    const config: E2EEnvConfig = {
      baseUrl: 'https://sculra-frontend.vercel.app',
      testUserId: 'user_test_valid',
      clerkSecretKey: 'sk_test_valid',
      supabaseUrl: 'https://test-db.supabase.co',
      supabaseAnonKey: 'anon-key-valid',
      allowProduction: false,
    };

    const res = validateEnvironment(config);
    expect(res.ok).toBe(false);
    expect(res.blockedReason).toContain('production environment');
    expect(res.blockedReason).toContain('ALLOW_PRODUCTION=true');
  });

  it('allows execution against production hostnames when ALLOW_PRODUCTION is explicitly set', () => {
    const config: E2EEnvConfig = {
      baseUrl: 'https://sculra-frontend.vercel.app',
      testUserId: 'user_test_valid',
      clerkSecretKey: 'sk_test_valid',
      supabaseUrl: 'https://test-db.supabase.co',
      supabaseAnonKey: 'anon-key-valid',
      allowProduction: true,
    };

    const res = validateEnvironment(config);
    expect(res.ok).toBe(true);
  });

  it('blocks execution when TEST_USER_ID is not configured', () => {
    const config: E2EEnvConfig = {
      baseUrl: 'http://localhost:3000',
      testUserId: undefined,
      clerkSecretKey: 'sk_test_valid',
      supabaseUrl: 'https://test-db.supabase.co',
      supabaseAnonKey: 'anon-key-valid',
      allowProduction: false,
    };

    const res = validateEnvironment(config);
    expect(res.ok).toBe(false);
    expect(res.blockedReason).toContain('TEST_USER_ID is not configured');
  });

  it('blocks execution when CLERK_SECRET_KEY is missing', () => {
    const config: E2EEnvConfig = {
      baseUrl: 'http://localhost:3000',
      testUserId: 'user_test_valid',
      clerkSecretKey: '',
      supabaseUrl: 'https://test-db.supabase.co',
      supabaseAnonKey: 'anon-key-valid',
      allowProduction: false,
    };

    const res = validateEnvironment(config);
    expect(res.ok).toBe(false);
    expect(res.blockedReason).toContain('CLERK_SECRET_KEY is missing');
  });

  it('blocks execution when Supabase environment variables are missing', () => {
    const configWithoutUrl: E2EEnvConfig = {
      baseUrl: 'http://localhost:3000',
      testUserId: 'user_test_valid',
      clerkSecretKey: 'sk_test_valid',
      supabaseUrl: '',
      supabaseAnonKey: 'anon-key-valid',
      allowProduction: false,
    };

    const res1 = validateEnvironment(configWithoutUrl);
    expect(res1.ok).toBe(false);
    expect(res1.blockedReason).toContain('NEXT_PUBLIC_SUPABASE_URL is missing');

    const configWithoutKey: E2EEnvConfig = {
      baseUrl: 'http://localhost:3000',
      testUserId: 'user_test_valid',
      clerkSecretKey: 'sk_test_valid',
      supabaseUrl: 'https://test-db.supabase.co',
      supabaseAnonKey: '',
      allowProduction: false,
    };

    const res2 = validateEnvironment(configWithoutKey);
    expect(res2.ok).toBe(false);
    expect(res2.blockedReason).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
  });
});

describe('Authenticated E2E Runner - Step Orchestration & Prerequisite Propagation', () => {
  it('records successful steps with PASSED status and details', async () => {
    const orchestrator = new E2EOrchestrator();

    const val = await orchestrator.recordStep(1, 'Initial Step', async () => {
      return { details: 'Step 1 completed smoothly', value: 'res-1' };
    });

    expect(val).toBe('res-1');
    expect(orchestrator.results).toHaveLength(1);
    expect(orchestrator.results[0].status).toBe('PASSED');
    expect(orchestrator.results[0].details).toBe('Step 1 completed smoothly');

    const summary = orchestrator.getSummary();
    expect(summary.total).toBe(1);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.blocked).toBe(0);
    expect(summary.isSuccess).toBe(true);
  });

  it('marks failed steps with FAILED status and records error details', async () => {
    const orchestrator = new E2EOrchestrator();

    await orchestrator.recordStep(1, 'Failing Step', async () => {
      throw new Error('Connection refused to backend API');
    });

    expect(orchestrator.results).toHaveLength(1);
    expect(orchestrator.results[0].status).toBe('FAILED');
    expect(orchestrator.results[0].details).toBe('Connection refused to backend API');

    const summary = orchestrator.getSummary();
    expect(summary.total).toBe(1);
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(1);
    expect(summary.isSuccess).toBe(false);
  });

  it('automatically blocks subsequent dependent steps when a prerequisite fails', async () => {
    const orchestrator = new E2EOrchestrator();
    let step2Executed = false;
    let step3Executed = false;

    // Step 1 fails
    await orchestrator.recordStep(1, 'Sign In (Prerequisite)', async () => {
      throw new Error('Clerk API invalid credentials');
    });

    // Step 2 depends on Step 1
    await orchestrator.recordStep(2, 'Navigate to Dashboard', async () => {
      step2Executed = true;
      return { details: 'Dashboard reached' };
    });

    // Step 3 depends on Step 1
    await orchestrator.recordStep(3, 'Create Project', async () => {
      step3Executed = true;
      return { details: 'Project created' };
    });

    // Steps 2 and 3 should NOT execute
    expect(step2Executed).toBe(false);
    expect(step3Executed).toBe(false);

    expect(orchestrator.results).toHaveLength(3);
    expect(orchestrator.results[0].status).toBe('FAILED');
    expect(orchestrator.results[1].status).toBe('BLOCKED');
    expect(orchestrator.results[1].details).toContain('Dependent on prerequisite step');
    expect(orchestrator.results[2].status).toBe('BLOCKED');

    const summary = orchestrator.getSummary();
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(1);
    expect(summary.blocked).toBe(2);
    expect(summary.isSuccess).toBe(false);
  });

  it('handles BLOCKED errors gracefully and records them as BLOCKED', async () => {
    const orchestrator = new E2EOrchestrator();

    await orchestrator.recordStep(1, 'Check Test Environment', async () => {
      throw new Error('BLOCKED: Missing isolated test database fixture');
    });

    expect(orchestrator.results).toHaveLength(1);
    expect(orchestrator.results[0].status).toBe('BLOCKED');

    const summary = orchestrator.getSummary();
    expect(summary.failed).toBe(0);
    expect(summary.blocked).toBe(1);
    expect(summary.isSuccess).toBe(false);
  });
});
