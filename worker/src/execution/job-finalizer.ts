// ==============================================================================
// Sculra Guarded Job State Finalizer (worker/src/execution/job-finalizer.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { ExecutionJob, ExecutionResult, ExecutionJobStatus } from './types';
import { WorkerLogger } from '../logger';

export interface FinalizationOutcome {
  success: boolean;
  conflict: boolean;
  finalStatus: string;
  error?: string;
}

export class JobFinalizer {
  private supabase: SupabaseClient | null;
  private logger: WorkerLogger;

  constructor(supabaseClient?: SupabaseClient | null) {
    this.supabase = supabaseClient || null;
    this.logger = new WorkerLogger('finalizer');
  }

  /**
   * Guarded idempotent finalizer that updates job terminal state and clears lease.
   * Enforces worker ownership guard: stale workers that lost their lease cannot overwrite newer worker state.
   */
  async finalizeJob(
    job: ExecutionJob,
    result: ExecutionResult
  ): Promise<FinalizationOutcome> {
    if (!this.supabase) {
      return { success: true, conflict: false, finalStatus: result.status };
    }

    const nowIso = new Date().toISOString();
    const isCampaign = job.jobType === 'CAMPAIGN';
    const table = isCampaign ? 'qa_campaigns' : 'test_runs';

    // Map canonical status to table-specific status enum / string
    let dbStatus: string;
    if (isCampaign) {
      if (result.status === 'COMPLETED' || (result.success && result.status !== 'CANCELLED' && result.status !== 'FAILED')) {
        dbStatus = 'COMPLETED';
      } else if (result.status === 'CANCELLED') {
        dbStatus = 'CANCELLED';
      } else {
        dbStatus = 'FAILED';
      }
    } else {
      if (result.status === 'COMPLETED' || (result.success && result.status !== 'CANCELLED' && result.status !== 'FAILED')) {
        dbStatus = 'passed';
      } else if (result.status === 'CANCELLED') {
        dbStatus = 'cancelled';
      } else {
        dbStatus = 'failed';
      }
    }

    const updatePayload: Record<string, any> = {
      status: dbStatus,
      completed_at: nowIso,
      updated_at: nowIso,
      lease_expires_at: null, // Always release lease on terminal completion
      error_code: result.errorCode || (result.success ? null : 'EXECUTION_FAILED'),
      error_message: result.error || null,
    };

    if (isCampaign && result.summary) {
      updatePayload.summary = result.summary;
    }

    // Ownership guard: only update if this worker is still the registered owner
    let query = this.supabase
      .from(table)
      .update(updatePayload)
      .eq('id', job.jobId);

    if (job.workerId) {
      query = query.eq('worker_id', job.workerId);
    }

    const { data, error } = await query.select('id, worker_id, status').maybeSingle();

    if (error) {
      this.logger.error('finalization_db_error', {
        jobId: job.jobId,
        jobType: job.jobType,
        error: error.message,
      });
      return {
        success: false,
        conflict: false,
        finalStatus: dbStatus,
        error: error.message,
      };
    }

    if (!data) {
      // Lease was reclaimed or modified by another worker
      this.logger.warn('finalization_conflict_lease_lost', {
        jobId: job.jobId,
        workerId: job.workerId,
        jobType: job.jobType,
        attemptedStatus: dbStatus,
      });
      return {
        success: false,
        conflict: true,
        finalStatus: dbStatus,
        error: 'Job lease was reclaimed or modified by another worker during execution',
      };
    }

    this.logger.log('job_finalized_successfully', {
      jobId: job.jobId,
      workerId: job.workerId,
      finalStatus: dbStatus,
    });

    return {
      success: true,
      conflict: false,
      finalStatus: dbStatus,
    };
  }
}
