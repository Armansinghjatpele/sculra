// ==============================================================================
// Sculra Campaign Database Persistence Manager (worker/src/campaign/persistence.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  CampaignRecord,
  CampaignTaskRecord,
  CampaignTask,
  CampaignTaskResult,
  CampaignSummary,
  QACampaignStatus,
} from './types';
import { TestEvidencePayload } from './evidence';

export class CampaignPersistenceManager {
  private supabase: SupabaseClient | null;

  constructor(supabaseClient?: SupabaseClient | null) {
    this.supabase = supabaseClient || null;
  }

  /**
   * Persists initial campaign record to public.qa_campaigns.
   */
  async createCampaign(campaign: Partial<CampaignRecord>): Promise<CampaignRecord | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('qa_campaigns')
      .insert({
        id: campaign.id,
        project_id: campaign.project_id,
        organization_id: campaign.organization_id || null,
        test_run_id: campaign.test_run_id || null,
        status: campaign.status || 'QUEUED',
        objective: campaign.objective || 'release_readiness',
        configuration: campaign.configuration || {},
        budget: campaign.budget || {},
        state: campaign.state || {},
        summary: campaign.summary || {},
      })
      .select('*')
      .single();

    if (error) {
      console.error('[CampaignPersistence] createCampaign error:', error.message);
      return null;
    }

    return data as CampaignRecord;
  }

  /**
   * Updates status, state snapshot, and summary snapshot for a campaign.
   */
  async updateCampaign(
    campaignId: string,
    status: QACampaignStatus,
    updates: {
      stateSnapshot?: any;
      summarySnapshot?: Partial<CampaignSummary>;
      startedAt?: string;
      completedAt?: string;
    } = {}
  ): Promise<boolean> {
    if (!this.supabase) return true;

    const payload: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (updates.stateSnapshot) payload.state = updates.stateSnapshot;
    if (updates.summarySnapshot) payload.summary = updates.summarySnapshot;
    if (updates.startedAt) payload.started_at = updates.startedAt;
    if (updates.completedAt) payload.completed_at = updates.completedAt;

    const { error } = await this.supabase
      .from('qa_campaigns')
      .update(payload)
      .eq('id', campaignId);

    if (error) {
      console.error('[CampaignPersistence] updateCampaign error:', error.message);
      return false;
    }

    return true;
  }

  /**
   * Batch inserts campaign tasks to public.qa_campaign_tasks.
   */
  async insertTasks(
    campaignId: string,
    projectId: string,
    tasks: CampaignTask[],
    organizationId?: string
  ): Promise<boolean> {
    if (!this.supabase || tasks.length === 0) return true;

    const rows = tasks.map((t) => ({
      id: t.id,
      campaign_id: campaignId,
      project_id: projectId,
      organization_id: organizationId || null,
      task_type: t.taskType,
      target_type: t.target.type,
      target_identifier: t.target.identifier,
      status: t.status,
      priority: t.priority,
      reason: t.reason,
      dependencies: t.dependencies,
      result: t.result ? (t.result as any) : null,
    }));

    const { error } = await this.supabase
      .from('qa_campaign_tasks')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('[CampaignPersistence] insertTasks error:', error.message);
      return false;
    }

    return true;
  }

  /**
   * Updates an individual campaign task status and result.
   */
  async updateTask(
    taskId: string,
    status: string,
    result?: CampaignTaskResult,
    startedAt?: string,
    completedAt?: string
  ): Promise<boolean> {
    if (!this.supabase) return true;

    const payload: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (result) payload.result = result;
    if (startedAt) payload.started_at = startedAt;
    if (completedAt) payload.completed_at = completedAt;

    const { error } = await this.supabase
      .from('qa_campaign_tasks')
      .update(payload)
      .eq('id', taskId);

    if (error) {
      console.error('[CampaignPersistence] updateTask error:', error.message);
      return false;
    }

    return true;
  }

  /**
   * Persists campaign evidence rows to public.test_evidence.
   */
  async persistEvidence(evidenceItems: TestEvidencePayload[]): Promise<boolean> {
    if (!this.supabase || evidenceItems.length === 0) return true;

    const { error } = await this.supabase
      .from('test_evidence')
      .insert(evidenceItems);

    if (error) {
      console.error('[CampaignPersistence] persistEvidence error:', error.message);
      return false;
    }

    return true;
  }
}
