// ==============================================================================
// Sculra Comprehensive Job Runner Orchestrator (worker/src/execution/job-runner.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ExecutionJob,
  ExecutionResult,
  ExecutionJobStatus,
  ExecutionErrorCode,
} from './types';
import { CancellationToken } from '../types';
import { JobHeartbeatManager } from './job-heartbeat';
import { JobFinalizer } from './job-finalizer';
import { ExecutionMetricsTracker } from './metrics';
import {
  classifyExecutionError,
  ExecutionError,
  JobTimeoutError,
  LeaseLostError,
  ShutdownCancelledError,
} from './execution-errors';
import {
  DEFAULT_JOB_TIMEOUT_SECONDS,
  DEFAULT_JOB_HEARTBEAT_SECONDS,
  DEFAULT_JOB_LEASE_SECONDS,
} from './execution-policy';
import { JobExecutor } from '../executor';
import { CampaignExecutor } from '../campaign/executor';
import { IEvidenceStorage } from '../storage';
import { WorkerLogger } from '../logger';

export interface JobRunnerOptions {
  cancellationToken?: CancellationToken;
  timeoutSeconds?: number;
  leaseSeconds?: number;
  heartbeatIntervalMs?: number;
  supabaseClient?: SupabaseClient | null;
  storage?: IEvidenceStorage;
  executor?: JobExecutor;
  logger?: WorkerLogger;
}

export class JobRunner {
  private supabase: SupabaseClient | null;
  private heartbeatManager: JobHeartbeatManager;
  private finalizer: JobFinalizer;
  private metricsTracker: ExecutionMetricsTracker;
  private logger: WorkerLogger;

  constructor(supabaseClient?: SupabaseClient | null) {
    this.supabase = supabaseClient || null;
    this.heartbeatManager = new JobHeartbeatManager(this.supabase);
    this.finalizer = new JobFinalizer(this.supabase);
    this.metricsTracker = ExecutionMetricsTracker.getInstance();
    this.logger = new WorkerLogger('job-runner');
  }

  /**
   * Executes a single job lifecycle from acquisition to guarded finalization.
   */
  async runJob(job: ExecutionJob, options: JobRunnerOptions = {}): Promise<ExecutionResult> {
    const startTime = Date.now();
    const token: CancellationToken = options.cancellationToken || { isCancelled: false };
    const timeoutSeconds =
      options.timeoutSeconds ||
      job.config?.maxDurationSeconds ||
      DEFAULT_JOB_TIMEOUT_SECONDS;

    this.metricsTracker.recordJobAcquired();
    this.logger.log('job_execution_starting', {
      jobId: job.jobId,
      jobType: job.jobType,
      attempt: job.attempt,
      workerId: job.workerId,
    });

    let timeoutTimer: NodeJS.Timeout | null = null;
    let stopHeartbeat: (() => Promise<void>) | null = null;
    const leaseState: { lostError: LeaseLostError | null } = { lostError: null };
    let isTimedOut = false;

    // 1. Setup Lease Heartbeat
    stopHeartbeat = this.heartbeatManager.startHeartbeat(job, token, {
      leaseSeconds: options.leaseSeconds || DEFAULT_JOB_LEASE_SECONDS,
      intervalMs: options.heartbeatIntervalMs || DEFAULT_JOB_HEARTBEAT_SECONDS * 1000,
      onLeaseLost: (jobId, err) => {
        leaseState.lostError = err as LeaseLostError;
        this.metricsTracker.recordHeartbeat(false);
      },
    });

    // 2. Setup Job Timeout Timer
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        isTimedOut = true;
        token.isCancelled = true;
        token.onCancel?.();
        reject(new JobTimeoutError(`Job execution timed out after ${timeoutSeconds} seconds`));
      }, timeoutSeconds * 1000);
    });

    let result: ExecutionResult;

    try {
      // 3. Race Execution with Timeout
      const executionPromise = (async (): Promise<ExecutionResult> => {
        if (job.jobType === 'CAMPAIGN') {
          const campaignExecutor = new CampaignExecutor({
            campaignId: job.jobId,
            projectId: job.projectId,
            organizationId: job.organizationId || undefined,
            testRunId: job.testRunId || undefined,
            targetUrl: job.targetUrl,
            objective: job.config?.objective,
            config: job.config,
            supabaseClient: this.supabase,
            cancellationToken: token,
          });

          const campResult = await campaignExecutor.execute();
          const finalStatus: ExecutionJobStatus =
            token.isCancelled
              ? (isTimedOut ? 'TIMEOUT' : 'CANCELLED')
              : (campResult.success ? 'COMPLETED' : 'FAILED');

          return {
            success: campResult.success && !token.isCancelled,
            status: finalStatus,
            summary: campResult.summary,
            error: campResult.error,
            errorCode: campResult.error ? 'CAMPAIGN_EXECUTION_FAILED' : undefined,
          };
        } else {
          // TEST_RUN
          const executor =
            options.executor ||
            new JobExecutor({
              supabaseClient: this.supabase || undefined,
              storage: options.storage,
            });

          const testResult = await executor.executeTestRun(job.jobId, token);
          const finalStatus: ExecutionJobStatus =
            token.isCancelled
              ? (isTimedOut ? 'TIMEOUT' : 'CANCELLED')
              : (testResult.success ? 'COMPLETED' : 'FAILED');

          return {
            success: testResult.success && !token.isCancelled,
            status: finalStatus,
            error: testResult.error,
            errorCode: testResult.error ? 'TEST_RUN_EXECUTION_FAILED' : undefined,
          };
        }
      })();

      result = await Promise.race([executionPromise, timeoutPromise]);
    } catch (err: any) {
      if (leaseState.lostError) {
        result = {
          success: false,
          status: 'FAILED',
          errorCode: 'LEASE_LOST',
          error: leaseState.lostError.message,
        };
      } else if (isTimedOut || err instanceof JobTimeoutError) {
        result = {
          success: false,
          status: 'TIMEOUT',
          errorCode: 'JOB_TIMEOUT',
          error: err.message,
        };
      } else if (token.isCancelled) {
        result = {
          success: false,
          status: 'CANCELLED',
          errorCode: 'SHUTDOWN_CANCELLED',
          error: 'Job execution was cancelled',
        };
      } else {
        const classified = classifyExecutionError(err);
        result = {
          success: false,
          status: 'FAILED',
          errorCode: classified.code,
          error: classified.message,
        };
      }
    } finally {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      if (stopHeartbeat) {
        await stopHeartbeat();
      }
    }

    result.durationMs = Date.now() - startTime;

    // 4. Guarded Finalization (only if lease wasn't lost)
    if (!leaseState.lostError) {
      await this.finalizer.finalizeJob(job, result);
    }

    // 5. Record Metrics
    this.metricsTracker.recordJobOutcome(result.status, result.errorCode);

    return result;
  }
}
