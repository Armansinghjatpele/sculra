// ==============================================================================
// Sculra Stale Job Recovery Scanner (worker/src/execution/job-recovery.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_MAX_JOB_ATTEMPTS } from './execution-policy';
import { WorkerLogger } from '../logger';

export interface RecoveryScanResult {
  recoveredCount: number;
  failedCount: number;
  details: Array<{
    jobId: string;
    jobType: 'CAMPAIGN' | 'TEST_RUN';
    action: 'REQUEUED' | 'FAILED_EXHAUSTED';
    attempt: number;
  }>;
}

export class JobRecoveryScanner {
  private supabase: SupabaseClient | null;
  private logger: WorkerLogger;

  constructor(supabaseClient?: SupabaseClient | null) {
    this.supabase = supabaseClient || null;
    this.logger = new WorkerLogger('recovery-scanner');
  }

  /**
   * Scans for stale jobs whose leases have expired and recovers them.
   * If attempts are exhausted (>= max_attempts), transitions to FAILED with MAX_ATTEMPTS_EXCEEDED.
   * Otherwise resets to QUEUED with incremented recovery_count.
   */
  async scanAndRecoverStaleJobs(
    defaultMaxAttempts: number = DEFAULT_MAX_JOB_ATTEMPTS
  ): Promise<RecoveryScanResult> {
    const result: RecoveryScanResult = {
      recoveredCount: 0,
      failedCount: 0,
      details: [],
    };

    if (!this.supabase) return result;

    // 1. Try DB RPC `fail_exhausted_stale_jobs`
    try {
      const { data: rpcData, error: rpcError } = await this.supabase.rpc('fail_exhausted_stale_jobs');
      if (!rpcError && rpcData && typeof rpcData.recovered_count === 'number') {
        result.recoveredCount = rpcData.recovered_count;
        result.failedCount = rpcData.failed_count;
        return result;
      }
    } catch (rpcErr) {
      // Fallback below
    }

    // 2. Fallback SQL-based scan
    const nowIso = new Date().toISOString();

    // A. Check qa_campaigns
    try {
      const { data: staleCampaigns } = await this.supabase
        .from('qa_campaigns')
        .select('id, attempt, max_attempts, worker_id, recovery_count')
        .eq('status', 'RUNNING')
        .lt('lease_expires_at', nowIso);

      if (staleCampaigns && staleCampaigns.length > 0) {
        for (const camp of staleCampaigns) {
          const attempt = camp.attempt || 1;
          const maxAttempts = camp.max_attempts || defaultMaxAttempts;

          if (attempt >= maxAttempts) {
            // Exhausted -> Mark FAILED
            await this.supabase
              .from('qa_campaigns')
              .update({
                status: 'FAILED',
                error_code: 'MAX_ATTEMPTS_EXCEEDED',
                error_message: `Campaign execution failed: heartbeat lease expired and max retry attempts (${maxAttempts}) exceeded.`,
                lease_expires_at: null,
                completed_at: nowIso,
                updated_at: nowIso,
              })
              .eq('id', camp.id)
              .eq('status', 'RUNNING');

            result.failedCount++;
            result.details.push({
              jobId: camp.id,
              jobType: 'CAMPAIGN',
              action: 'FAILED_EXHAUSTED',
              attempt,
            });
            this.logger.warn('stale_campaign_exhausted', { campaignId: camp.id, attempt, maxAttempts });
          } else {
            // Recoverable -> Reset to QUEUED
            await this.supabase
              .from('qa_campaigns')
              .update({
                status: 'QUEUED',
                worker_id: null,
                previous_worker_id: camp.worker_id || null,
                recovery_count: (camp.recovery_count || 0) + 1,
                lease_expires_at: null,
                updated_at: nowIso,
              })
              .eq('id', camp.id)
              .eq('status', 'RUNNING');

            result.recoveredCount++;
            result.details.push({
              jobId: camp.id,
              jobType: 'CAMPAIGN',
              action: 'REQUEUED',
              attempt,
            });
            this.logger.log('stale_campaign_requeued', { campaignId: camp.id, attempt });
          }
        }
      }
    } catch (campErr: any) {
      this.logger.error('campaign_recovery_scan_error', campErr.message);
    }

    // B. Check test_runs
    try {
      const { data: staleRuns } = await this.supabase
        .from('test_runs')
        .select('id, attempt, max_attempts, worker_id, recovery_count')
        .eq('status', 'running')
        .lt('lease_expires_at', nowIso);

      if (staleRuns && staleRuns.length > 0) {
        for (const run of staleRuns) {
          const attempt = run.attempt || 1;
          const maxAttempts = run.max_attempts || defaultMaxAttempts;

          if (attempt >= maxAttempts) {
            // Exhausted -> Mark failed
            await this.supabase
              .from('test_runs')
              .update({
                status: 'failed',
                error_code: 'MAX_ATTEMPTS_EXCEEDED',
                error_message: `Test run execution failed: heartbeat lease expired and max retry attempts (${maxAttempts}) exceeded.`,
                lease_expires_at: null,
                completed_at: nowIso,
                updated_at: nowIso,
              })
              .eq('id', run.id)
              .eq('status', 'running');

            result.failedCount++;
            result.details.push({
              jobId: run.id,
              jobType: 'TEST_RUN',
              action: 'FAILED_EXHAUSTED',
              attempt,
            });
            this.logger.warn('stale_run_exhausted', { testRunId: run.id, attempt, maxAttempts });
          } else {
            // Recoverable -> Reset to queued
            await this.supabase
              .from('test_runs')
              .update({
                status: 'queued',
                worker_id: null,
                previous_worker_id: run.worker_id || null,
                recovery_count: (run.recovery_count || 0) + 1,
                lease_expires_at: null,
                updated_at: nowIso,
              })
              .eq('id', run.id)
              .eq('status', 'running');

            result.recoveredCount++;
            result.details.push({
              jobId: run.id,
              jobType: 'TEST_RUN',
              action: 'REQUEUED',
              attempt,
            });
            this.logger.log('stale_run_requeued', { testRunId: run.id, attempt });
          }
        }
      }
    } catch (runErr: any) {
      this.logger.error('run_recovery_scan_error', runErr.message);
    }

    return result;
  }
}
