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
import { CIGateEngine } from '../cicd/gate';
import { CIFeedbackGenerator } from '../cicd/feedback';
import { CDOrchestrator } from '../release/cd-orchestrator';

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
          let campaignConfig = job.config || {};
          let campaignObjective = job.config?.objective;
          let targetUrl = job.targetUrl;
          let testRunId = job.testRunId;

          if (this.supabase) {
            const { data: campRow } = await this.supabase
              .from('qa_campaigns')
              .select('configuration, budget, objective, test_run_id')
              .eq('id', job.jobId)
              .maybeSingle();

            if (campRow) {
              const cfg = campRow.configuration || {};
              campaignConfig = { ...cfg, budget: campRow.budget, ...campaignConfig };
              campaignObjective = campRow.objective || cfg.objective || campaignObjective;
              if (!targetUrl) {
                targetUrl = cfg.targetUrl || cfg.url;
              }
              if (!testRunId && campRow.test_run_id) {
                testRunId = campRow.test_run_id;
              }
            }
          }

          if (this.supabase && !targetUrl && job.projectId) {
            const { data: projRow } = await this.supabase
              .from('projects')
              .select('source_url')
              .eq('id', job.projectId)
              .maybeSingle();
            if (projRow) {
              targetUrl = projRow.source_url || '';
            }
          }

          // Ensure companion test_runs record exists so test_evidence satisfies foreign key and not-null constraints
          if (this.supabase && !testRunId && job.projectId) {
            try {
              const { data: newRun } = await this.supabase
                .from('test_runs')
                .insert({
                  project_id: job.projectId,
                  organization_id: job.organizationId || null,
                  status: 'running',
                  trigger_type: 'future_ai_agent',
                  started_at: new Date().toISOString(),
                  created_by: 'system_campaign_orchestrator',
                })
                .select('id')
                .maybeSingle();

              if (newRun) {
                testRunId = newRun.id;
                await this.supabase
                  .from('qa_campaigns')
                  .update({ test_run_id: testRunId })
                  .eq('id', job.jobId);
              }
            } catch (err: any) {
              this.logger.warn(`Failed to create companion test_runs record: ${err?.message}`);
            }
          }

          const campaignExecutor = new CampaignExecutor({
            campaignId: job.jobId,
            projectId: job.projectId,
            organizationId: job.organizationId || undefined,
            testRunId: testRunId || undefined,
            targetUrl: targetUrl || 'http://localhost:3000',
            objective: campaignObjective,
            config: campaignConfig,
            supabaseClient: this.supabase,
            cancellationToken: token,
          });

          const campResult = await campaignExecutor.execute();
          const finalStatus: ExecutionJobStatus =
            token.isCancelled
              ? (isTimedOut ? 'TIMEOUT' : 'CANCELLED')
              : (campResult.success ? 'COMPLETED' : 'FAILED');

          // Update companion test_runs record if created
          if (this.supabase && testRunId) {
            try {
              const testRunStatus = campResult.success ? 'passed' : 'failed';
              await this.supabase
                .from('test_runs')
                .update({
                  status: testRunStatus,
                  completed_at: new Date().toISOString(),
                  overall_score: campResult.summary?.releaseAssessment?.overallScore ?? (campResult.success ? 100 : 50),
                })
                .eq('id', testRunId);
            } catch (err: any) {
              this.logger.warn(`Failed to finalize companion test_runs: ${err?.message}`);
            }
          }

          // CI/CD Gate evaluation if campaign summary is available
          if (this.supabase && campResult.summary) {
            try {
              const gatePolicy = job.config?.gatePolicy || 'BLOCK_ON_CRITICAL_ISSUE';
              const decision = CIGateEngine.evaluateGate(campResult.summary, gatePolicy);
              const feedback = CIFeedbackGenerator.generateFeedback(decision, campResult.summary, {
                deliveryId: job.config?.deliveryId || '',
                provider: job.config?.provider || 'github',
                eventType: job.config?.eventType || 'push',
                repository: { owner: '', name: '', fullName: '' },
                commit: job.config?.commitSha ? {
                  sha: job.config.commitSha,
                  shortSha: String(job.config.commitSha).slice(0, 7),
                  message: job.config.commitMessage || '',
                  branch: job.config.branch || '',
                } : undefined,
                pullRequest: job.config?.pullRequestNumber ? {
                  number: job.config.pullRequestNumber,
                  title: job.config.commitMessage || '',
                  headSha: job.config.commitSha || '',
                  headBranch: job.config.branch || '',
                  baseBranch: '',
                  sender: '',
                } : undefined,
                receivedAt: new Date().toISOString(),
              });

              await this.supabase.from('cicd_gate_results').insert({
                campaign_id: job.jobId,
                test_run_id: job.testRunId || null,
                project_id: job.projectId,
                organization_id: job.organizationId || null,
                commit_sha: job.config?.commitSha || null,
                pull_request_number: job.config?.pullRequestNumber || null,
                branch: job.config?.branch || null,
                gate_verdict: decision.verdict,
                gate_policy: decision.gatePolicy,
                release_verdict: decision.releaseVerdict || null,
                reason_codes: decision.reasonCodes,
                critical_findings_count: decision.criticalFindingsCount,
                regression_count: decision.regressionCount,
                evidence_status: decision.evidenceStatus,
                summary_markdown: feedback.markdownSummary,
                feedback_json: feedback.structuredDetails,
              });

              if (job.config?.deliveryId) {
                await this.supabase
                  .from('cicd_webhook_events')
                  .update({
                    status: decision.passed ? 'COMPLETED' : 'FAILED',
                    processed_at: new Date().toISOString(),
                  })
                  .eq('delivery_id', job.config.deliveryId);
              }
            } catch (gateErr: any) {
              this.logger.warn('ci_gate_evaluation_failed', {
                jobId: job.jobId,
                error: gateErr.message,
              });
            }
          }

          // Continuous Deployment Gate evaluation for deployment-triggered campaigns
          if (
            this.supabase &&
            (job.config?.trigger === 'AUTOMATIC_DEPLOYMENT' ||
              job.config?.deploymentEventId ||
              job.config?.deploymentId)
          ) {
            try {
              await CDOrchestrator.finalizeDeploymentGate({
                campaignId: job.jobId,
                projectId: job.projectId,
                organizationId: job.organizationId || null,
                deploymentEventId: job.config?.deploymentEventId,
                deploymentId: job.config?.deploymentId,
                campResult,
                supabaseClient: this.supabase,
                ciFeedbackOptions: job.config?.ciFeedbackOptions,
                releaseGatePolicy: job.config?.releaseGatePolicy,
              });
            } catch (cdGateErr: any) {
              this.logger.warn('cd_gate_finalization_failed', {
                jobId: job.jobId,
                error: cdGateErr.message,
              });
            }
          }

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
