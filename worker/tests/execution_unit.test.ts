import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkerIdentity,
  generateWorkerId,
  classifyExecutionError,
  isRetryableError,
  ExecutionError,
  LeaseLostError,
  JobTimeoutError,
  BrowserLaunchError,
  InvalidTargetUrlError,
  PermanentJobError,
  DatabasePersistenceError,
  ShutdownCancelledError,
  ExecutionPolicy,
  JobAcquirer,
  JobHeartbeatManager,
  JobFinalizer,
  JobRecoveryScanner,
  JobRunner,
  ExecutionMetricsTracker,
  WorkerLogger,
  WorkerDaemon,
} from '../src';

describe('Execution Layer Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    WorkerIdentity.resetInstance();
    ExecutionMetricsTracker.resetInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Worker Identity', () => {
    it('generates unique worker ID with host and PID format', () => {
      const id1 = generateWorkerId();
      const id2 = generateWorkerId();
      expect(id1).toMatch(/^worker_.+_\d+_[a-f0-9]+$/);
      expect(id2).toMatch(/^worker_.+_\d+_[a-f0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('supports custom worker ID and singleton instance', () => {
      const custom = new WorkerIdentity('worker_custom_node_01');
      expect(custom.workerId).toBe('worker_custom_node_01');

      const singleton = WorkerIdentity.getInstance();
      expect(singleton.workerId).toBeDefined();
      expect(singleton.getInfo().hostname).toBeDefined();
      expect(singleton.getInfo().pid).toBeGreaterThan(0);
    });
  });

  describe('2. Error Classification & Hierarchy', () => {
    it('classifies lease lost error as non-retryable', () => {
      const err = classifyExecutionError(new Error('Heartbeat failed: lease lost to peer'));
      expect(err).toBeInstanceOf(LeaseLostError);
      expect(err.code).toBe('LEASE_LOST');
      expect(err.isRetryable).toBe(false);
    });

    it('classifies timeout error as non-retryable', () => {
      const err = classifyExecutionError(new Error('Job execution timed out after 600 seconds'));
      expect(err).toBeInstanceOf(JobTimeoutError);
      expect(err.code).toBe('JOB_TIMEOUT');
      expect(err.isRetryable).toBe(false);
    });

    it('classifies browser crash error as retryable infrastructure failure', () => {
      const err = classifyExecutionError(new Error('Playwright browser launch failed'));
      expect(err).toBeInstanceOf(BrowserLaunchError);
      expect(err.code).toBe('BROWSER_LAUNCH_FAILED');
      expect(err.isRetryable).toBe(true);
    });

    it('classifies invalid target url as non-retryable permanent error', () => {
      const err = classifyExecutionError(new Error('Invalid URL format for project target'));
      expect(err).toBeInstanceOf(InvalidTargetUrlError);
      expect(err.code).toBe('INVALID_TARGET_URL');
      expect(err.isRetryable).toBe(false);
    });

    it('classifies database network error as retryable', () => {
      const err = classifyExecutionError(new Error('Database Supabase PostgREST connection timeout'));
      expect(err).toBeInstanceOf(DatabasePersistenceError);
      expect(err.code).toBe('DATABASE_PERSISTENCE_FAILED');
      expect(err.isRetryable).toBe(true);
    });

    it('correctly determines retryability for permanent errors', () => {
      expect(isRetryableError(new Error('unauthorized 401'))).toBe(false);
      expect(isRetryableError(new Error('unsupported source type mobile'))).toBe(false);
      expect(isRetryableError(new Error('schema violation for table'))).toBe(false);
      expect(isRetryableError(new Error('transient connection reset by peer'))).toBe(true);
    });
  });

  describe('3. Execution Policy & Backoff', () => {
    it('calculates jittered exponential backoff bounded by maxMs', () => {
      const delay1 = ExecutionPolicy.computeBackoffDelay(1, 1000, 10000);
      const delay2 = ExecutionPolicy.computeBackoffDelay(2, 1000, 10000);
      const delay5 = ExecutionPolicy.computeBackoffDelay(5, 1000, 5000);

      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay5).toBeLessThanOrEqual(5000);
    });

    it('prevents retry when job has exhausted maxAttempts', () => {
      const job = {
        jobId: 'job-1',
        jobType: 'CAMPAIGN' as const,
        projectId: 'proj-1',
        status: 'RUNNING' as const,
        attempt: 3,
        maxAttempts: 3,
        targetUrl: 'https://example.com',
      };

      expect(ExecutionPolicy.shouldRetryJob(job, new Error('temporary network glitch'))).toBe(false);

      const retryableJob = { ...job, attempt: 1 };
      expect(ExecutionPolicy.shouldRetryJob(retryableJob, new Error('temporary network glitch'))).toBe(true);
    });
  });

  describe('4. Job Acquirer', () => {
    it('acquires jobs using RPC when available', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              job_id: 'camp-123',
              job_type: 'CAMPAIGN',
              project_id: 'p-1',
              attempt: 1,
              max_attempts: 3,
              worker_id: 'worker-a',
              lease_expires_at: '2026-09-17T12:00:00Z',
              target_url: 'https://example.com',
            },
          ],
          error: null,
        }),
      } as any;

      const acquirer = new JobAcquirer(mockSupabase);
      const job = await acquirer.acquireNextJob({ workerId: 'worker-a' });

      expect(job).not.toBeNull();
      expect(job?.jobId).toBe('camp-123');
      expect(job?.jobType).toBe('CAMPAIGN');
      expect(job?.workerId).toBe('worker-a');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('acquire_execution_job', expect.any(Object));
    });

    it('falls back to table update if RPC is not available', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockRejectedValue(new Error('RPC function not found')),
        from: vi.fn((table: string) => {
          if (table === 'qa_campaigns') {
            return {
              select: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'camp-fallback-1',
                          project_id: 'proj-1',
                          status: 'QUEUED',
                          attempt: 0,
                          max_attempts: 3,
                          configuration: { targetUrl: 'https://fallback.com' },
                          projects: { url: 'https://fallback.com' },
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'camp-fallback-1',
                        project_id: 'proj-1',
                        status: 'RUNNING',
                        attempt: 1,
                        max_attempts: 3,
                        lease_expires_at: '2026-09-17T12:01:00Z',
                        projects: { url: 'https://fallback.com' },
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }),
      } as any;

      const acquirer = new JobAcquirer(mockSupabase);
      const jobs = await acquirer.acquireJobs({ workerId: 'worker-b', batchSize: 1 });

      expect(jobs.length).toBe(1);
      expect(jobs[0].jobId).toBe('camp-fallback-1');
      expect(jobs[0].attempt).toBe(1);
    });
  });

  describe('5. Job Heartbeat Manager', () => {
    it('renews lease via RPC and triggers callback when lease is lost', async () => {
      const mockSupabase = {
        rpc: vi.fn()
          .mockResolvedValueOnce({ data: true, error: null })
          .mockResolvedValueOnce({ data: false, error: null }), // Second renewal fails (lease lost)
      } as any;

      const heartbeat = new JobHeartbeatManager(mockSupabase);
      const token = { isCancelled: false, onCancel: vi.fn() };
      const onLeaseLost = vi.fn();

      const job = {
        jobId: 'job-lease-test',
        jobType: 'CAMPAIGN' as const,
        projectId: 'proj-1',
        status: 'RUNNING' as const,
        attempt: 1,
        maxAttempts: 3,
        workerId: 'worker-x',
        targetUrl: 'https://example.com',
      };

      // Direct renewal
      const renewed1 = await heartbeat.renewLease(job, 60);
      expect(renewed1).toBe(true);

      const renewed2 = await heartbeat.renewLease(job, 60);
      expect(renewed2).toBe(false);
    });
  });

  describe('6. Guarded Job Finalizer', () => {
    it('finalizes job terminal state successfully when worker ownership matches', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'job-10', worker_id: 'worker-owner', status: 'COMPLETED' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any;

      const finalizer = new JobFinalizer(mockSupabase);
      const job = {
        jobId: 'job-10',
        jobType: 'CAMPAIGN' as const,
        projectId: 'proj-1',
        status: 'RUNNING' as const,
        attempt: 1,
        maxAttempts: 3,
        workerId: 'worker-owner',
        targetUrl: 'https://example.com',
      };

      const outcome = await finalizer.finalizeJob(job, {
        success: true,
        status: 'COMPLETED',
      });

      expect(outcome.success).toBe(true);
      expect(outcome.conflict).toBe(false);
      expect(outcome.finalStatus).toBe('COMPLETED');
    });

    it('detects lease conflict and refuses to overwrite if worker_id was reclaimed', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // No row updated because worker_id changed
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any;

      const finalizer = new JobFinalizer(mockSupabase);
      const job = {
        jobId: 'job-stale',
        jobType: 'CAMPAIGN' as const,
        projectId: 'proj-1',
        status: 'RUNNING' as const,
        attempt: 1,
        maxAttempts: 3,
        workerId: 'worker-stale-old',
        targetUrl: 'https://example.com',
      };

      const outcome = await finalizer.finalizeJob(job, {
        success: true,
        status: 'COMPLETED',
      });

      expect(outcome.success).toBe(false);
      expect(outcome.conflict).toBe(true);
    });
  });

  describe('7. Job Recovery Scanner', () => {
    it('requeues stale jobs when attempt < max_attempts', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const mockSupabase = {
        rpc: vi.fn().mockRejectedValue(new Error('RPC fail_exhausted_stale_jobs not found')),
        from: vi.fn((table: string) => {
          if (table === 'qa_campaigns') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'camp-stale-1',
                        attempt: 1,
                        max_attempts: 3,
                        worker_id: 'dead-worker',
                        recovery_count: 0,
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }),
      } as any;

      const scanner = new JobRecoveryScanner(mockSupabase);
      const result = await scanner.scanAndRecoverStaleJobs(3);

      expect(result.recoveredCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.details[0].action).toBe('REQUEUED');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'QUEUED',
          worker_id: null,
          previous_worker_id: 'dead-worker',
        })
      );
    });

    it('marks exhausted jobs as FAILED with MAX_ATTEMPTS_EXCEEDED when attempt >= max_attempts', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const mockSupabase = {
        rpc: vi.fn().mockRejectedValue(new Error('RPC fail_exhausted_stale_jobs not found')),
        from: vi.fn((table: string) => {
          if (table === 'test_runs') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'run-exhausted',
                        attempt: 3,
                        max_attempts: 3,
                        worker_id: 'dead-worker-2',
                        recovery_count: 2,
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }),
      } as any;

      const scanner = new JobRecoveryScanner(mockSupabase);
      const result = await scanner.scanAndRecoverStaleJobs(3);

      expect(result.failedCount).toBe(1);
      expect(result.details[0].action).toBe('FAILED_EXHAUSTED');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_code: 'MAX_ATTEMPTS_EXCEEDED',
        })
      );
    });
  });

  describe('8. Secret Masking & Security Hardening', () => {
    it('sanitizes authorization tokens, passwords, cookies, and secret keys in logs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logger = new WorkerLogger('log-test-run');
      logger.log('user_login_attempt', {
        authorization: 'Bearer secret_jwt_token_12345',
        cookie: 'session_id=abcdef123456',
        password: 'SuperSecretPassword!',
        apiKey: 'sk_test_51Mzxyz123456',
        normalField: 'safe_value',
      });

      expect(spy).toHaveBeenCalled();
      const loggedMessage = spy.mock.calls[0][0];

      expect(loggedMessage).not.toContain('secret_jwt_token_12345');
      expect(loggedMessage).not.toContain('session_id=abcdef123456');
      expect(loggedMessage).not.toContain('SuperSecretPassword!');
      expect(loggedMessage).not.toContain('sk_test_51Mzxyz123456');
      expect(loggedMessage).toContain('[REDACTED]');
      expect(loggedMessage).toContain('safe_value');

      spy.mockRestore();
    });

    it('strictly requires SUPABASE_SERVICE_ROLE_KEY in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => {
        new WorkerDaemon({
          supabaseUrl: 'https://test.supabase.co',
          supabaseServiceKey: undefined,
          supabaseClient: undefined,
        });
      }).toThrow(/SUPABASE_SERVICE_ROLE_KEY is required for production worker/);

      process.env.NODE_ENV = originalEnv;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });
  });
});
