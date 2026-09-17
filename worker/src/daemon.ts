// ==============================================================================
// Sculra Test Worker Continuous Polling Daemon (worker/src/daemon.ts)
// ==============================================================================
// Continuously monitors the Supabase job queue for pending execution jobs,
// claims jobs atomically with worker leases, manages active heartbeats, recovers stale jobs,
// invokes JobRunner, and handles graceful shutdown.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { JobExecutor } from './executor';
import { WorkerLogger } from './logger';
import { CancellationToken } from './types';
import { WorkerIdentity } from './execution/identity';
import { JobAcquirer } from './execution/job-acquirer';
import { JobRecoveryScanner } from './execution/job-recovery';
import { JobRunner } from './execution/job-runner';
import { ExecutionMetricsTracker } from './execution/metrics';
import { ExecutionJob, JobType } from './execution/types';
import { DEFAULT_JOB_LEASE_SECONDS, DEFAULT_MAX_JOB_ATTEMPTS } from './execution/execution-policy';

export interface DaemonConfig {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseClient?: SupabaseClient;
  executor?: JobExecutor;
  pollIntervalMs?: number;
  concurrency?: number;
  workerId?: string;
  leaseSeconds?: number;
  supportedJobTypes?: JobType[];
  recoveryIntervalMs?: number;
}

export class WorkerDaemon {
  private supabase: SupabaseClient | null = null;
  private executor: JobExecutor;
  private pollIntervalMs: number;
  private concurrency: number;
  private isRunning: boolean = false;
  private pollTimeout: NodeJS.Timeout | null = null;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private activeJobs: Map<string, { job: ExecutionJob; token: CancellationToken }> = new Map();
  private logger: WorkerLogger;

  public readonly identity: WorkerIdentity;
  public readonly acquirer: JobAcquirer;
  public readonly recoveryScanner: JobRecoveryScanner;
  public readonly runner: JobRunner;
  public readonly metrics: ExecutionMetricsTracker;
  private leaseSeconds: number;
  private supportedJobTypes: JobType[];
  private recoveryIntervalMs: number;

  constructor(config: DaemonConfig = {}) {
    const url = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isProduction = process.env.NODE_ENV === 'production';
    const key =
      config.supabaseServiceKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      (!isProduction ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

    if (config.supabaseClient) {
      this.supabase = config.supabaseClient;
    } else if (url && key) {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false },
      });
    }

    if (isProduction && !this.supabase) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for production worker');
    }

    this.identity = new WorkerIdentity(config.workerId);
    this.acquirer = new JobAcquirer(this.supabase);
    this.recoveryScanner = new JobRecoveryScanner(this.supabase);
    this.runner = new JobRunner(this.supabase);
    this.metrics = ExecutionMetricsTracker.getInstance(this.identity.workerId);

    this.executor = config.executor || new JobExecutor({ supabaseClient: this.supabase || undefined });
    this.pollIntervalMs =
      config.pollIntervalMs ||
      (process.env.WORKER_POLL_INTERVAL_MS
        ? parseInt(process.env.WORKER_POLL_INTERVAL_MS, 10)
        : 2000);
    this.concurrency =
      config.concurrency ||
      (process.env.WORKER_CONCURRENCY
        ? parseInt(process.env.WORKER_CONCURRENCY, 10)
        : 1);
    this.leaseSeconds = config.leaseSeconds || DEFAULT_JOB_LEASE_SECONDS;
    this.supportedJobTypes = config.supportedJobTypes || ['CAMPAIGN', 'TEST_RUN'];
    this.recoveryIntervalMs = config.recoveryIntervalMs || 60000; // Run recovery scan every 60s

    this.logger = new WorkerLogger({
      workerId: this.identity.workerId,
    });
  }

  public getActiveJobsCount(): number {
    return this.activeJobs.size;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('daemon_already_running', { message: 'Daemon is already running.' });
      return;
    }

    this.isRunning = true;
    this.logger.log('daemon_started', {
      workerId: this.identity.workerId,
      pollIntervalMs: this.pollIntervalMs,
      concurrency: this.concurrency,
      leaseSeconds: this.leaseSeconds,
      hasDbConnection: !!this.supabase,
    });

    console.log(
      `[Worker Daemon ${this.identity.workerId}]: Started listening for jobs (poll interval: ${this.pollIntervalMs}ms, concurrency: ${this.concurrency})`
    );

    // Run an initial stale job recovery scan on startup
    try {
      const recoveryResult = await this.recoveryScanner.scanAndRecoverStaleJobs(DEFAULT_MAX_JOB_ATTEMPTS);
      if (recoveryResult.recoveredCount > 0 || recoveryResult.failedCount > 0) {
        this.logger.log('startup_recovery_scan_completed', recoveryResult);
      }
    } catch (err: any) {
      this.logger.error('startup_recovery_scan_failed', err.message);
    }

    // Schedule background recurring recovery scanner
    this.recoveryInterval = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.recoveryScanner.scanAndRecoverStaleJobs(DEFAULT_MAX_JOB_ATTEMPTS);
      } catch (recErr: any) {
        this.logger.error('periodic_recovery_scan_failed', recErr.message);
      }
    }, this.recoveryIntervalMs);

    this.scheduleNextPoll(0);
  }

  async stop(gracePeriodMs: number = 3000): Promise<void> {
    if (!this.isRunning) return;

    this.logger.log('daemon_stopping', { activeJobs: this.activeJobs.size });
    console.log(
      `[Worker Daemon ${this.identity.workerId}]: Stopping daemon gracefully (active jobs: ${this.activeJobs.size})...`
    );
    this.isRunning = false;

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }

    // Cancel all in-flight jobs
    for (const [jobId, entry] of this.activeJobs.entries()) {
      const token = (entry as any)?.token || entry;
      token.isCancelled = true;
      token.onCancel?.();
      this.logger.log('cancelling_job_on_shutdown', { jobId });
    }

    // Await active jobs or grace period timeout
    if (this.activeJobs.size > 0 && gracePeriodMs > 0) {
      const waitStart = Date.now();
      while (this.activeJobs.size > 0 && Date.now() - waitStart < gracePeriodMs) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  private scheduleNextPoll(delayMs: number = this.pollIntervalMs): void {
    if (!this.isRunning) return;
    this.pollTimeout = setTimeout(async () => {
      try {
        await this.pollOnce();
      } catch (err: any) {
        this.logger.error('poll_cycle_error', err.message);
      } finally {
        if (this.isRunning) {
          this.scheduleNextPoll(this.pollIntervalMs);
        }
      }
    }, delayMs);
  }

  async pollOnce(): Promise<number> {
    if (!this.supabase) {
      this.logger.warn('supabase_not_configured', {
        message: 'Supabase credentials missing, skipping poll cycle.',
      });
      return 0;
    }

    const availableSlots = this.concurrency - this.activeJobs.size;
    if (availableSlots <= 0) {
      return 0;
    }

    // Acquire available jobs atomically
    const acquiredJobs = await this.acquirer.acquireJobs({
      workerId: this.identity.workerId,
      leaseSeconds: this.leaseSeconds,
      supportedTypes: this.supportedJobTypes,
      batchSize: availableSlots,
    });

    if (!acquiredJobs || acquiredJobs.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const job of acquiredJobs) {
      if (this.activeJobs.has(job.jobId)) {
        continue;
      }

      processedCount++;
      const token: CancellationToken = { isCancelled: false };
      this.activeJobs.set(job.jobId, { job, token });

      this.logger.log('job_claimed_by_daemon', {
        jobId: job.jobId,
        jobType: job.jobType,
        attempt: job.attempt,
        workerId: this.identity.workerId,
      });

      // Execute asynchronously in background
      (async () => {
        try {
          const result = await this.runner.runJob(job, {
            cancellationToken: token,
            leaseSeconds: this.leaseSeconds,
            executor: this.executor,
          });

          this.logger.log('job_execution_completed', {
            jobId: job.jobId,
            jobType: job.jobType,
            status: result.status,
            success: result.success,
            durationMs: result.durationMs,
          });
        } catch (execErr: any) {
          this.logger.error('job_execution_fatal_in_daemon', {
            jobId: job.jobId,
            error: execErr.message,
          });
        } finally {
          this.activeJobs.delete(job.jobId);
        }
      })();

      if (this.activeJobs.size >= this.concurrency) {
        break;
      }
    }

    return processedCount;
  }
}
