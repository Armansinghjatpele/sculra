// ==============================================================================
// Prompt 53: Production Worker Containerization & Infrastructure Test Suite
// ==============================================================================
// Verifies configuration validation, missing service-role key enforcement,
// health & readiness HTTP states, graceful shutdown, job drain semantics,
// error classification, zero secret leakage, browser smoke test, and queue execution.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateWorkerConfig,
  getSafeWorkerConfig,
  WorkerConfig,
  WORKER_ENV_SCHEMA,
} from '../src/config';
import {
  StartupConfigurationError,
  DatabaseConnectionError,
  BrowserInitializationError,
  QueueError,
  WorkerExecutionError,
  CancellationError,
  ShutdownTimeoutError,
} from '../src/errors';
import { WorkerHealthServer, WorkerHealthState } from '../src/health';
import { ProductionWorkerServer } from '../src/server';
import { WorkerDaemon } from '../src/daemon';
import { runBrowserSmokeTest } from '../src/smoke-test';
import { JobAcquirer } from '../src/execution/job-acquirer';
import { JobRunner } from '../src/execution/job-runner';
import { JobFinalizer } from '../src/execution/job-finalizer';
import { ExecutionJob } from '../src/execution/types';
import * as http from 'node:http';

describe('Prompt 53: Production Worker Infrastructure & Containerization', () => {
  describe('Phase 3: Centralized Environment Configuration Validation', () => {
    it('classifies schema variables into REQUIRED, OPTIONAL, DEVELOPMENT_ONLY, and TEST_ONLY', () => {
      expect(WORKER_ENV_SCHEMA.SUPABASE_URL.classification).toBe('REQUIRED');
      expect(WORKER_ENV_SCHEMA.SUPABASE_SERVICE_ROLE_KEY.classification).toBe('REQUIRED');
      expect(WORKER_ENV_SCHEMA.WORKER_CONCURRENCY.classification).toBe('OPTIONAL');
      expect(WORKER_ENV_SCHEMA.NEXT_PUBLIC_SUPABASE_ANON_KEY.classification).toBe('DEVELOPMENT_ONLY');
      expect(WORKER_ENV_SCHEMA.MOCK_TEST_SERVER_PORT.classification).toBe('TEST_ONLY');
    });

    it('fails fast with StartupConfigurationError in production when SUPABASE_URL is missing', () => {
      expect(() =>
        validateWorkerConfig({
          NODE_ENV: 'production',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-123456789012345',
        })
      ).toThrow(StartupConfigurationError);
    });

    it('fails fast with StartupConfigurationError in production when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      expect(() =>
        validateWorkerConfig({
          NODE_ENV: 'production',
          SUPABASE_URL: 'https://testproject.supabase.co',
        })
      ).toThrow(StartupConfigurationError);
    });

    it('rejects using NEXT_PUBLIC_SUPABASE_ANON_KEY as SUPABASE_SERVICE_ROLE_KEY in production', () => {
      const anonKey = 'sb_anon_key_abcdefghijklmnopqrstuvwxyz123';
      expect(() =>
        validateWorkerConfig({
          NODE_ENV: 'production',
          SUPABASE_URL: 'https://testproject.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: anonKey,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
        })
      ).toThrow(StartupConfigurationError);
    });

    it('validates and extracts valid production configuration', () => {
      const config = validateWorkerConfig({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://valid-supabase.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key-valid-length',
        WORKER_CONCURRENCY: '2',
        WORKER_POLL_INTERVAL_MS: '1500',
        WORKER_HEALTH_PORT: '9090',
      });

      expect(config.isProduction).toBe(true);
      expect(config.concurrency).toBe(2);
      expect(config.pollIntervalMs).toBe(1500);
      expect(config.healthPort).toBe(9090);
      expect(config.supabaseUrl).toBe('https://valid-supabase.supabase.co');
      expect(config.supabaseServiceRoleKey).toContain('test-service-role-key');
    });

    it('sanitizes configuration for safe logging without exposing secrets', () => {
      const config: WorkerConfig = {
        supabaseUrl: 'https://safe-url.supabase.co',
        supabaseServiceRoleKey: 'secret_key_value_do_not_leak',
        workerId: 'worker-test-1',
        pollIntervalMs: 2000,
        concurrency: 1,
        shutdownGracePeriodMs: 30000,
        healthPort: 8080,
        leaseSeconds: 60,
        recoveryIntervalMs: 60000,
        openAiApiKey: 'sk-proj-secret-openai-key',
        sentryDsn: 'https://sentry.test/123',
        nodeEnv: 'production',
        isProduction: true,
      };

      const safe = getSafeWorkerConfig(config);
      const safeJson = JSON.stringify(safe);

      expect(safeJson).not.toContain('secret_key_value_do_not_leak');
      expect(safeJson).not.toContain('sk-proj-secret-openai-key');
      expect(safe.hasServiceRoleKey).toBe(true);
      expect(safe.hasOpenAiKey).toBe(true);
      expect(safe.workerId).toBe('worker-test-1');
    });

    it('rejects invalid concurrency limits (less than 1 or exceeding 10)', () => {
      expect(() =>
        validateWorkerConfig({
          WORKER_CONCURRENCY: '0',
        })
      ).toThrow(StartupConfigurationError);

      expect(() =>
        validateWorkerConfig({
          WORKER_CONCURRENCY: '15',
        })
      ).toThrow(StartupConfigurationError);
    });
  });

  describe('Phase 4: Worker Health & Readiness HTTP Endpoints', () => {
    it('returns 200 for /health and 503 for /ready when state is STARTING', async () => {
      const healthServer = new WorkerHealthServer({
        port: 0,
        workerId: 'worker-health-test',
        concurrency: 2,
        getActiveJobsCount: () => 0,
      });
      healthServer.setState('STARTING');
      await healthServer.start();
      const port = healthServer.getBoundPort();

      try {
        const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
        expect(healthRes.status).toBe(200);
        const healthData = await healthRes.json();
        expect(healthData.status).toBe('STARTING');
        expect(healthData.workerId).toBe('worker-health-test');

        const readyRes = await fetch(`http://127.0.0.1:${port}/ready`);
        expect(readyRes.status).toBe(503);
        const readyData = await readyRes.json();
        expect(readyData.ready).toBe(false);
      } finally {
        await healthServer.stop();
      }
    });

    it('returns 200 for both /health and /ready when state is READY', async () => {
      const healthServer = new WorkerHealthServer({
        port: 0,
        workerId: 'worker-ready-test',
        concurrency: 2,
        getActiveJobsCount: () => 0,
      });
      healthServer.setState('READY');
      await healthServer.start();
      const port = healthServer.getBoundPort();

      try {
        const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
        expect(healthRes.status).toBe(200);

        const readyRes = await fetch(`http://127.0.0.1:${port}/ready`);
        expect(readyRes.status).toBe(200);
        const readyData = await readyRes.json();
        expect(readyData.ready).toBe(true);
        expect(readyData.status).toBe('READY');
        expect(readyData.availableSlots).toBe(2);
      } finally {
        await healthServer.stop();
      }
    });

    it('dynamically reports BUSY when active jobs are being processed and remains ready', async () => {
      const busyHealthServer = new WorkerHealthServer({
        port: 0,
        workerId: 'worker-busy-test',
        concurrency: 2,
        getActiveJobsCount: () => 1,
      });
      busyHealthServer.setState('READY');
      await busyHealthServer.start();
      const port = busyHealthServer.getBoundPort();

      try {
        const readyRes = await fetch(`http://127.0.0.1:${port}/ready`);
        expect(readyRes.status).toBe(200);
        const readyData = await readyRes.json();
        expect(readyData.status).toBe('BUSY');
        expect(readyData.activeJobs).toBe(1);
        expect(readyData.availableSlots).toBe(1);
      } finally {
        await busyHealthServer.stop();
      }
    });

    it('returns 503 for /ready when state is DRAINING during shutdown', async () => {
      const healthServer = new WorkerHealthServer({
        port: 0,
        workerId: 'worker-drain-test',
        concurrency: 2,
        getActiveJobsCount: () => 0,
      });
      healthServer.setState('DRAINING');
      await healthServer.start();
      const port = healthServer.getBoundPort();

      try {
        // Liveness probe (/health) can remain 200 during drain so orchestrator doesn't kill it prematurely
        const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
        expect(healthRes.status).toBe(200);

        // Readiness probe (/ready) must be 503 so no new traffic or jobs are routed
        const readyRes = await fetch(`http://127.0.0.1:${port}/ready`);
        expect(readyRes.status).toBe(503);
        const readyData = await readyRes.json();
        expect(readyData.ready).toBe(false);
        expect(readyData.status).toBe('DRAINING');
      } finally {
        await healthServer.stop();
      }
    });

    it('returns 503 for /health and /ready when state is UNHEALTHY', async () => {
      const healthServer = new WorkerHealthServer({
        port: 0,
        workerId: 'worker-unhealthy-test',
        concurrency: 2,
        getActiveJobsCount: () => 0,
      });
      healthServer.setState('UNHEALTHY', 'Database connection lost');
      await healthServer.start();
      const port = healthServer.getBoundPort();

      try {
        const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
        expect(healthRes.status).toBe(503);
        const healthData = await healthRes.json();
        expect(healthData.status).toBe('UNHEALTHY');
        expect(healthData.error).toBe('Database connection lost');

        const readyRes = await fetch(`http://127.0.0.1:${port}/ready`);
        expect(readyRes.status).toBe(503);
      } finally {
        await healthServer.stop();
      }
    });
  });

  describe('Phase 10: Graceful Shutdown & Drain Semantics', () => {
    it('shuts down cleanly when idle without cancelling jobs', async () => {
      const daemon = new WorkerDaemon({
        supabaseClient: undefined,
        pollIntervalMs: 10000,
      });

      await daemon.start();
      expect(daemon.getIsRunning()).toBe(true);

      // Drain when idle
      await daemon.drain(500);
      expect(daemon.getIsRunning()).toBe(false);
      expect(daemon.getIsDraining()).toBe(false);
      expect(daemon.getActiveJobsCount()).toBe(0);
    });

    it('allows in-flight active job to finish within grace period without cancelling', async () => {
      const daemon = new WorkerDaemon({
        supabaseClient: undefined,
        pollIntervalMs: 10000,
      });

      await daemon.start();

      const fakeToken = { isCancelled: false, onCancel: vi.fn() };
      (daemon as any).activeJobs.set('job-in-flight-1', fakeToken);

      // Simulate the job completing after 200ms
      setTimeout(() => {
        (daemon as any).activeJobs.delete('job-in-flight-1');
      }, 200);

      const drainStart = Date.now();
      await daemon.drain(2000); // 2 second grace period
      const duration = Date.now() - drainStart;

      expect(duration).toBeLessThan(1500); // Finished early when job completed
      expect(fakeToken.isCancelled).toBe(false); // Job was NOT cancelled
      expect(fakeToken.onCancel).not.toHaveBeenCalled();
      expect(daemon.getActiveJobsCount()).toBe(0);
    });

    it('safely cancels in-flight jobs when grace period expires', async () => {
      const daemon = new WorkerDaemon({
        supabaseClient: undefined,
        pollIntervalMs: 10000,
      });

      await daemon.start();

      const stubbornToken = { isCancelled: false, onCancel: vi.fn() };
      (daemon as any).activeJobs.set('job-stubborn-1', stubbornToken);

      const drainStart = Date.now();
      await daemon.drain(300); // Short grace period (300ms)
      const duration = Date.now() - drainStart;

      expect(duration).toBeGreaterThanOrEqual(300);
      expect(stubbornToken.isCancelled).toBe(true); // Forced cancellation triggered
      expect(stubbornToken.onCancel).toHaveBeenCalled();
    });
  });

  describe('Phase 8: Container Browser Smoke Test', () => {
    it('executes the deterministic Playwright Chromium smoke test successfully', async () => {
      const result = await runBrowserSmokeTest();
      expect(result.success).toBe(true);
      expect(result.chromiumVersion).toBeDefined();
      expect(result.screenshotBytes).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Phase 13: Error Classification Hierarchy', () => {
    it('preserves distinct error codes across infrastructure and execution categories', () => {
      const startupErr = new StartupConfigurationError('Missing key');
      expect(startupErr.code).toBe('STARTUP_CONFIGURATION_ERROR');
      expect(startupErr.isFatal).toBe(true);

      const dbErr = new DatabaseConnectionError('Connection refused');
      expect(dbErr.code).toBe('DATABASE_CONNECTION_ERROR');
      expect(dbErr.isFatal).toBe(true);

      const browserErr = new BrowserInitializationError('Chromium not found');
      expect(browserErr.code).toBe('BROWSER_INITIALIZATION_ERROR');

      const queueErr = new QueueError('Lease conflict');
      expect(queueErr.code).toBe('QUEUE_ERROR');

      const execErr = new WorkerExecutionError('Script crash');
      expect(execErr.code).toBe('EXECUTION_ERROR');

      const cancelErr = new CancellationError('Signal received');
      expect(cancelErr.code).toBe('CANCELLATION');

      const timeoutErr = new ShutdownTimeoutError();
      expect(timeoutErr.code).toBe('SHUTDOWN_TIMEOUT');
    });
  });

  describe('Phase 9: Controlled Queue Execution Integration', () => {
    it('processes a legitimate test-run job from acquisition to guarded finalization', async () => {
      const finalizedJobs: any[] = [];
      const mockSupabase: any = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'run-queue-test-1',
                  status: 'queued',
                  project_id: 'proj-queue-test',
                  projects: {
                    id: 'proj-queue-test',
                    source_type: 'website',
                    source_url: 'http://127.0.0.1:9', // mocked executor will intercept
                  },
                },
                error: null,
              }),
            }),
          }),
          update: (updates: any) => {
            const queryObj: any = {
              eq: (col: string, val: string) => {
                finalizedJobs.push({ table, updates, col, val });
                return queryObj;
              },
              select: () => ({
                maybeSingle: async () => ({
                  data: { id: 'run-queue-test-1', worker_id: 'worker-unit-test-1', status: updates.status },
                  error: null,
                }),
              }),
            };
            return queryObj;
          },
        }),
        rpc: (fn: string) => {
          if (fn === 'heartbeat_execution_job') {
            return Promise.resolve({ data: true, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };

      const mockExecutor: any = {
        executeTestRun: async (testRunId: string) => {
          return {
            success: true,
            status: 'passed',
            durationMs: 120,
          };
        },
      };

      const runner = new JobRunner(mockSupabase);
      const testJob: ExecutionJob = {
        jobId: 'run-queue-test-1',
        jobType: 'TEST_RUN',
        projectId: 'proj-queue-test',
        workerId: 'worker-unit-test-1',
        attempt: 1,
        targetUrl: 'http://127.0.0.1:9',
      };

      const result = await runner.runJob(testJob, {
        executor: mockExecutor,
        leaseSeconds: 60,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(finalizedJobs.length).toBeGreaterThan(0);
      const testRunUpdate = finalizedJobs.find((f) => f.table === 'test_runs');
      expect(testRunUpdate).toBeDefined();
      expect(testRunUpdate.updates.status).toBe('passed');
    });
  });
});
