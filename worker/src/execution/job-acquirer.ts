// ==============================================================================
// Sculra Atomic Job Acquirer (worker/src/execution/job-acquirer.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { ExecutionJob, JobType, AcquisitionOptions } from './types';
import { DEFAULT_JOB_LEASE_SECONDS, DEFAULT_MAX_JOB_ATTEMPTS } from './execution-policy';

export class JobAcquirer {
  private supabase: SupabaseClient | null;

  constructor(supabaseClient?: SupabaseClient | null) {
    this.supabase = supabaseClient || null;
  }

  /**
   * Atomically acquires the next executable job from the distributed queue.
   */
  async acquireNextJob(options: AcquisitionOptions): Promise<ExecutionJob | null> {
    const jobs = await this.acquireJobs({ ...options, batchSize: 1 });
    return jobs.length > 0 ? jobs[0] : null;
  }

  /**
   * Atomically acquires up to `batchSize` executable jobs from the queue.
   */
  async acquireJobs(options: AcquisitionOptions): Promise<ExecutionJob[]> {
    if (!this.supabase) {
      return [];
    }

    const {
      workerId,
      leaseSeconds = DEFAULT_JOB_LEASE_SECONDS,
      supportedTypes = ['CAMPAIGN', 'TEST_RUN'],
      batchSize = 1,
    } = options;

    try {
      // 1. Primary Strategy: Try DB RPC `acquire_execution_job`
      const { data: rpcData, error: rpcError } = await this.supabase.rpc('acquire_execution_job', {
        p_worker_id: workerId,
        p_lease_seconds: leaseSeconds,
        p_supported_types: supportedTypes,
      });

      if (!rpcError && rpcData !== null && rpcData !== undefined) {
        const rows = Array.isArray(rpcData) ? rpcData : [rpcData];
        if (rows.length === 0) {
          return [];
        }
        if (rows[0]?.job_id) {
          return rows.slice(0, batchSize).map((row: any) => this.mapRowToExecutionJob(row));
        }
      }
    } catch (rpcErr) {
      // Fallback below
    }

    // 2. Fallback Strategy: Optimistic atomic claim directly via table updates
    return this.fallbackAcquire(options);
  }

  private async fallbackAcquire(options: AcquisitionOptions): Promise<ExecutionJob[]> {
    if (!this.supabase) return [];

    const {
      workerId,
      leaseSeconds = DEFAULT_JOB_LEASE_SECONDS,
      supportedTypes = ['CAMPAIGN', 'TEST_RUN'],
      batchSize = 1,
    } = options;

    const acquired: ExecutionJob[] = [];
    const now = new Date();
    const leaseExpires = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
    const nowIso = now.toISOString();

    // Try acquiring CAMPAIGN first if supported
    if (supportedTypes.includes('CAMPAIGN') && acquired.length < batchSize) {
      const { data: candidateCampaigns } = await this.supabase
        .from('qa_campaigns')
        .select('*, projects(*)')
        .or(`status.eq.QUEUED,and(status.eq.RUNNING,lease_expires_at.lt.${nowIso})`)
        .order('created_at', { ascending: true })
        .limit(batchSize - acquired.length);

      if (candidateCampaigns && candidateCampaigns.length > 0) {
        for (const c of candidateCampaigns) {
          const currentAttempt = typeof c.attempt === 'number' ? c.attempt : 0;
          const maxAttempts = c.max_attempts || DEFAULT_MAX_JOB_ATTEMPTS;

          if (currentAttempt >= maxAttempts && c.status === 'RUNNING') {
            continue;
          }

          const { data: updated, error } = await this.supabase
            .from('qa_campaigns')
            .update({
              status: 'RUNNING',
              worker_id: workerId,
              attempt: currentAttempt + 1,
              max_attempts: maxAttempts,
              lease_expires_at: leaseExpires,
              last_heartbeat_at: nowIso,
              started_at: c.started_at || nowIso,
              updated_at: nowIso,
              previous_worker_id: c.worker_id || c.previous_worker_id || null,
              recovery_count: c.status === 'RUNNING' ? (c.recovery_count || 0) + 1 : (c.recovery_count || 0),
            })
            .eq('id', c.id)
            .select('*, projects(*)')
            .maybeSingle();

          if (!error && updated) {
            const project = updated.projects;
            const targetUrl = project?.source_url || project?.url || updated.configuration?.targetUrl || '';
            acquired.push({
              jobId: updated.id,
              jobType: 'CAMPAIGN',
              projectId: updated.project_id,
              organizationId: updated.organization_id || null,
              campaignId: updated.id,
              testRunId: updated.test_run_id || null,
              status: 'RUNNING',
              attempt: updated.attempt || 1,
              maxAttempts: updated.max_attempts || DEFAULT_MAX_JOB_ATTEMPTS,
              workerId,
              leaseExpiresAt: updated.lease_expires_at,
              lastHeartbeatAt: updated.last_heartbeat_at,
              targetUrl,
              config: updated.configuration || {},
              metadata: { budget: updated.budget },
              createdAt: updated.created_at,
              startedAt: updated.started_at,
              previousWorkerId: updated.previous_worker_id,
              recoveryCount: updated.recovery_count || 0,
            });

            if (acquired.length >= batchSize) return acquired;
          }
        }
      }
    }

    // Try acquiring TEST_RUN if supported
    if (supportedTypes.includes('TEST_RUN') && acquired.length < batchSize) {
      const { data: candidateRuns } = await this.supabase
        .from('test_runs')
        .select('*, projects(*)')
        .or(`status.eq.queued,and(status.eq.running,lease_expires_at.lt.${nowIso})`)
        .order('created_at', { ascending: true })
        .limit(batchSize - acquired.length);

      if (candidateRuns && candidateRuns.length > 0) {
        for (const r of candidateRuns) {
          const currentAttempt = typeof r.attempt === 'number' ? r.attempt : 0;
          const maxAttempts = r.max_attempts || DEFAULT_MAX_JOB_ATTEMPTS;

          if (currentAttempt >= maxAttempts && r.status === 'running') {
            continue;
          }

          const { data: updated, error } = await this.supabase
            .from('test_runs')
            .update({
              status: 'running',
              worker_id: workerId,
              attempt: currentAttempt + 1,
              max_attempts: maxAttempts,
              lease_expires_at: leaseExpires,
              last_heartbeat_at: nowIso,
              started_at: r.started_at || nowIso,
              updated_at: nowIso,
              previous_worker_id: r.worker_id || r.previous_worker_id || null,
              recovery_count: r.status === 'running' ? (r.recovery_count || 0) + 1 : (r.recovery_count || 0),
            })
            .eq('id', r.id)
            .select('*, projects(*)')
            .maybeSingle();

          if (!error && updated) {
            const project = updated.projects;
            const targetUrl = project?.source_url || project?.url || '';
            acquired.push({
              jobId: updated.id,
              jobType: 'TEST_RUN',
              projectId: updated.project_id,
              organizationId: updated.organization_id || null,
              testRunId: updated.id,
              status: 'RUNNING',
              attempt: updated.attempt || 1,
              maxAttempts: updated.max_attempts || DEFAULT_MAX_JOB_ATTEMPTS,
              workerId,
              leaseExpiresAt: updated.lease_expires_at,
              lastHeartbeatAt: updated.last_heartbeat_at,
              targetUrl,
              config: updated.configuration || {},
              createdAt: updated.created_at,
              startedAt: updated.started_at,
              previousWorkerId: updated.previous_worker_id,
              recoveryCount: updated.recovery_count || 0,
            });

            if (acquired.length >= batchSize) return acquired;
          }
        }
      }
    }

    return acquired;
  }

  private mapRowToExecutionJob(row: any): ExecutionJob {
    const jobType: JobType = row.job_type?.toUpperCase() === 'CAMPAIGN' ? 'CAMPAIGN' : 'TEST_RUN';
    return {
      jobId: row.job_id,
      jobType,
      projectId: row.project_id,
      organizationId: row.organization_id || null,
      campaignId: jobType === 'CAMPAIGN' ? row.job_id : null,
      testRunId: jobType === 'TEST_RUN' ? row.job_id : null,
      status: 'RUNNING',
      attempt: Number(row.attempt) || 1,
      maxAttempts: Number(row.max_attempts) || DEFAULT_MAX_JOB_ATTEMPTS,
      workerId: row.worker_id,
      leaseExpiresAt: row.lease_expires_at,
      lastHeartbeatAt: row.last_heartbeat_at || new Date().toISOString(),
      targetUrl: row.target_url || '',
      config: typeof row.config === 'object' && row.config !== null ? row.config : {},
      metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {},
      createdAt: row.created_at,
      startedAt: new Date().toISOString(),
    };
  }
}
