// ==============================================================================
// Sculra Test Worker Continuous Polling Daemon (worker/src/daemon.ts)
// ==============================================================================
// Continuously monitors the Supabase `test_runs` queue for pending test jobs,
// claims jobs atomically, invokes the JobExecutor, and handles graceful shutdown.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { JobExecutor } from './executor';
import { WorkerLogger } from './logger';
import { CancellationToken } from './types';

export interface DaemonConfig {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseClient?: SupabaseClient;
  executor?: JobExecutor;
  pollIntervalMs?: number;
  concurrency?: number;
}

export class WorkerDaemon {
  private supabase: SupabaseClient | null = null;
  private executor: JobExecutor;
  private pollIntervalMs: number;
  private concurrency: number;
  private isRunning: boolean = false;
  private pollTimeout: NodeJS.Timeout | null = null;
  private activeJobs: Map<string, CancellationToken> = new Map();
  private logger: WorkerLogger;

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

    this.logger = new WorkerLogger('daemon');
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
      pollIntervalMs: this.pollIntervalMs,
      concurrency: this.concurrency,
      hasDbConnection: !!this.supabase,
    });

    console.log(`[Worker Daemon]: Started listening for queued test runs (poll interval: ${this.pollIntervalMs}ms, concurrency: ${this.concurrency})`);

    this.scheduleNextPoll(0);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.log('daemon_stopping', { activeJobs: this.activeJobs.size });
    console.log(`[Worker Daemon]: Stopping daemon gracefully (active jobs: ${this.activeJobs.size})...`);
    this.isRunning = false;

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    // Cancel all in-flight jobs
    for (const [testRunId, token] of this.activeJobs.entries()) {
      token.isCancelled = true;
      token.onCancel?.();
      this.logger.log('cancelling_job_on_shutdown', { testRunId });
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
      this.logger.warn('supabase_not_configured', { message: 'Supabase credentials missing, skipping poll cycle.' });
      return 0;
    }

    const availableSlots = this.concurrency - this.activeJobs.size;
    if (availableSlots <= 0) {
      return 0;
    }

    // 1. Fetch pending queued campaigns
    const { data: queuedCampaigns } = await this.supabase
      .from('qa_campaigns')
      .select('id, project_id, created_at')
      .eq('status', 'QUEUED')
      .order('created_at', { ascending: true })
      .limit(availableSlots);

    let processedCount = 0;

    if (queuedCampaigns && queuedCampaigns.length > 0) {
      for (const camp of queuedCampaigns) {
        if (this.activeJobs.has(camp.id)) continue;

        const { data: claimed, error: claimError } = await this.supabase
          .from('qa_campaigns')
          .update({
            status: 'RUNNING',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', camp.id)
          .eq('status', 'QUEUED')
          .select('id')
          .maybeSingle();

        if (claimError || !claimed) continue;

        processedCount++;
        const token: CancellationToken = { isCancelled: false };
        this.activeJobs.set(camp.id, token);

        this.logger.log('campaign_job_claimed_by_daemon', { campaignId: camp.id });

        (async () => {
          try {
            await this.executor.executeCampaign(camp.id, token);
          } catch (execErr: any) {
            this.logger.error('campaign_execution_failed_in_daemon', execErr.message);
          } finally {
            this.activeJobs.delete(camp.id);
          }
        })();

        if (this.activeJobs.size >= this.concurrency) {
          return processedCount;
        }
      }
    }

    const remainingSlots = this.concurrency - this.activeJobs.size;
    if (remainingSlots <= 0) return processedCount;

    // 2. Fetch pending queued test runs
    const { data: queuedRuns, error } = await this.supabase
      .from('test_runs')
      .select('id, project_id, created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(remainingSlots);

    if (error) {
      this.logger.error('failed_fetching_queued_runs', error.message);
      return processedCount;
    }

    if (!queuedRuns || queuedRuns.length === 0) {
      return processedCount;
    }

    for (const run of queuedRuns) {
      if (this.activeJobs.has(run.id)) {
        continue;
      }

      // Claim test run job atomically by transitioning status from 'queued' to 'running'
      const { data: claimed, error: claimError } = await this.supabase
        .from('test_runs')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', run.id)
        .eq('status', 'queued')
        .select('id')
        .maybeSingle();

      if (claimError || !claimed) {
        continue;
      }

      processedCount++;
      const token: CancellationToken = { isCancelled: false };
      this.activeJobs.set(run.id, token);

      this.logger.log('job_claimed_by_daemon', { testRunId: run.id });

      (async () => {
        try {
          await this.executor.executeTestRun(run.id, token);
        } catch (execErr: any) {
          this.logger.error('job_execution_failed_in_daemon', execErr.message);
        } finally {
          this.activeJobs.delete(run.id);
        }
      })();
    }

    return processedCount;
  }

  private async executeJob(testRunId: string, cancellationToken: CancellationToken): Promise<void> {
    try {
      const result = await this.executor.executeTestRun(testRunId, cancellationToken);
      console.log(`[Worker Daemon]: Job ${testRunId} finished with status "${result.status}"`);
      this.logger.log('job_finished', { testRunId, status: result.status });
    } catch (err: any) {
      console.error(`[Worker Daemon]: Uncaught error executing job ${testRunId}:`, err);
      this.logger.error('job_execution_failed', err.message);
    } finally {
      this.activeJobs.delete(testRunId);
    }
  }
}
