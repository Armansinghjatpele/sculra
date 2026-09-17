// ==============================================================================
// Sculra Active Job Heartbeat & Lease Renewal Manager (worker/src/execution/job-heartbeat.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { ExecutionJob, HeartbeatOptions } from './types';
import { CancellationToken } from '../types';
import { DEFAULT_JOB_HEARTBEAT_SECONDS, DEFAULT_JOB_LEASE_SECONDS } from './execution-policy';
import { LeaseLostError } from './execution-errors';
import { WorkerLogger } from '../logger';

export class JobHeartbeatManager {
  private supabase: SupabaseClient | null;
  private activeIntervals: Map<string, NodeJS.Timeout> = new Map();
  private logger: WorkerLogger;

  constructor(supabaseClient?: SupabaseClient | null) {
    this.supabase = supabaseClient || null;
    this.logger = new WorkerLogger('heartbeat-mgr');
  }

  public getActiveHeartbeatCount(): number {
    return this.activeIntervals.size;
  }

  /**
   * Starts a background lease renewal loop for the specified execution job.
   * If lease renewal fails, cancels the token and fires the onLeaseLost callback.
   * Returns a cleanup callback to gracefully stop heartbeating.
   */
  startHeartbeat(
    job: ExecutionJob,
    cancellationToken: CancellationToken,
    options: HeartbeatOptions = {}
  ): () => Promise<void> {
    const jobId = job.jobId;
    const workerId = job.workerId || 'unknown-worker';
    const intervalMs = options.intervalMs || DEFAULT_JOB_HEARTBEAT_SECONDS * 1000;
    const leaseSeconds = options.leaseSeconds || DEFAULT_JOB_LEASE_SECONDS;

    // Clear any existing heartbeat for this jobId
    if (this.activeIntervals.has(jobId)) {
      clearInterval(this.activeIntervals.get(jobId)!);
      this.activeIntervals.delete(jobId);
    }

    const interval = setInterval(async () => {
      if (cancellationToken.isCancelled) {
        this.stopHeartbeat(jobId);
        return;
      }

      try {
        const renewed = await this.renewLease(job, leaseSeconds);
        if (!renewed) {
          const leaseErr = new LeaseLostError(
            `Heartbeat renewal rejected: worker ${workerId} lost lease for job ${jobId}`
          );
          this.logger.warn('heartbeat_lease_lost', {
            jobId,
            workerId,
            jobType: job.jobType,
          });

          // Trigger immediate cancellation
          cancellationToken.isCancelled = true;
          cancellationToken.onCancel?.();
          options.onLeaseLost?.(jobId, leaseErr);

          this.stopHeartbeat(jobId);
        }
      } catch (err: any) {
        this.logger.error('heartbeat_network_exception', err.message);
      }
    }, intervalMs);

    this.activeIntervals.set(jobId, interval);

    return async () => {
      this.stopHeartbeat(jobId);
    };
  }

  /**
   * Stops heartbeat loop for a specific job.
   */
  stopHeartbeat(jobId: string): void {
    const timer = this.activeIntervals.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.activeIntervals.delete(jobId);
    }
  }

  /**
   * Stops all active heartbeat timers.
   */
  stopAll(): void {
    for (const [jobId, timer] of this.activeIntervals.entries()) {
      clearInterval(timer);
    }
    this.activeIntervals.clear();
  }

  /**
   * Performs a single atomic lease renewal RPC or fallback query.
   * Returns true if lease was successfully extended, false if lease was lost.
   */
  async renewLease(job: ExecutionJob, leaseSeconds: number = DEFAULT_JOB_LEASE_SECONDS): Promise<boolean> {
    if (!this.supabase) return true;

    const workerId = job.workerId;
    if (!workerId) return false;

    // 1. Try DB RPC `heartbeat_execution_job`
    try {
      const { data: rpcRenewed, error: rpcError } = await this.supabase.rpc('heartbeat_execution_job', {
        p_job_id: job.jobId,
        p_job_type: job.jobType,
        p_worker_id: workerId,
        p_lease_seconds: leaseSeconds,
      });

      if (!rpcError && typeof rpcRenewed === 'boolean') {
        return rpcRenewed;
      }
    } catch (rpcErr) {
      // Fallback below
    }

    // 2. Fallback direct SQL update with guard on worker_id and active status
    const now = new Date();
    const leaseExpires = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
    const nowIso = now.toISOString();

    const table = job.jobType === 'CAMPAIGN' ? 'qa_campaigns' : 'test_runs';
    const activeStatus = job.jobType === 'CAMPAIGN' ? 'RUNNING' : 'running';

    const { data, error } = await this.supabase
      .from(table)
      .update({
        lease_expires_at: leaseExpires,
        last_heartbeat_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', job.jobId)
      .eq('worker_id', workerId)
      .eq('status', activeStatus)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    return true;
  }
}
