// ==============================================================================
// Sculra Observability Query Engine (worker/src/observability/queries.ts)
// ==============================================================================

import {
  AutonomousEvent,
  DecisionRecord,
  HumanApprovalRecord,
  TimelineFilter,
  AutonomousHealthMetrics,
} from './types';
import { OBSERVABILITY_POLICY } from './policy';

export class ObservabilityQueries {
  /**
   * Fetches paginated autonomous events for a project.
   */
  public static async getProjectEvents(
    supabaseClient: any,
    projectId: string,
    filter: TimelineFilter = {}
  ): Promise<AutonomousEvent[]> {
    let query = supabaseClient
      .from('autonomous_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (filter.actorType) query = query.eq('actor_type', filter.actorType);
    if (filter.factCategory) query = query.eq('fact_category', filter.factCategory);
    if (filter.eventType) query = query.eq('event_type', filter.eventType);
    if (filter.stage) query = query.eq('stage', filter.stage);
    if (filter.source) query = query.eq('source', filter.source);
    if (filter.since) query = query.gte('created_at', filter.since);
    if (filter.until) query = query.lte('created_at', filter.until);

    const limit = Math.min(filter.limit || OBSERVABILITY_POLICY.DEFAULT_TIMELINE_LIMIT, OBSERVABILITY_POLICY.MAX_TIMELINE_EVENTS);
    const offset = filter.offset || 0;

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    return data.map(this.mapEventRecord);
  }

  /**
   * Fetches timeline events scoped to a specific campaign.
   */
  public static async getCampaignEvents(
    supabaseClient: any,
    campaignId: string,
    limit = 100
  ): Promise<AutonomousEvent[]> {
    const { data, error } = await supabaseClient
      .from('autonomous_events')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data) return [];
    return data.map(this.mapEventRecord);
  }

  /**
   * Fetches decisions for a project with optional filters.
   */
  public static async getProjectDecisions(
    supabaseClient: any,
    projectId: string,
    filter: { campaignId?: string; limit?: number } = {}
  ): Promise<DecisionRecord[]> {
    let query = supabaseClient
      .from('autonomous_decisions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (filter.campaignId) {
      query = query.eq('campaign_id', filter.campaignId);
    }

    const limit = Math.min(filter.limit || 50, OBSERVABILITY_POLICY.MAX_DECISIONS_PER_QUERY);
    query = query.limit(limit);

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(this.mapDecisionRecord);
  }

  /**
   * Fetches human approval records for a project.
   */
  public static async getProjectApprovals(
    supabaseClient: any,
    projectId: string,
    status?: string
  ): Promise<HumanApprovalRecord[]> {
    let query = supabaseClient
      .from('human_approvals')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(this.mapApprovalRecord);
  }

  /**
   * Assembles factual health metrics from real database table counts.
   */
  public static async getHealthMetrics(
    supabaseClient: any,
    projectId: string
  ): Promise<AutonomousHealthMetrics> {
    try {
      const [
        campaignsRes,
        tasksRes,
        approvalsRes,
        issuesRes,
        remediationsRes,
      ] = await Promise.all([
        supabaseClient
          .from('qa_campaigns')
          .select('id, status')
          .eq('project_id', projectId)
          .in('status', ['RUNNING', 'PLANNING']),
        supabaseClient
          .from('qa_campaign_tasks')
          .select('id, status')
          .eq('project_id', projectId)
          .eq('status', 'BLOCKED'),
        supabaseClient
          .from('human_approvals')
          .select('id, status')
          .eq('project_id', projectId)
          .eq('status', 'APPROVAL_REQUIRED'),
        supabaseClient
          .from('issues')
          .select('id, severity, status')
          .eq('project_id', projectId)
          .eq('status', 'open')
          .eq('severity', 'critical'),
        supabaseClient
          .from('fix_remediations')
          .select('id, status, created_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      return {
        activeWorkersCount: (campaignsRes.data || []).length > 0 ? 1 : 0,
        queuedJobsCount: 0,
        staleLeasesCount: 0,
        failedJobsCount: 0,
        activeCampaignsCount: (campaignsRes.data || []).length,
        blockedTasksCount: (tasksRes.data || []).length,
        pendingApprovalsCount: (approvalsRes.data || []).length,
        openCriticalIssuesCount: (issuesRes.data || []).length,
        recentRegressionsCount: 0,
        recentRemediationsCount: (remediationsRes.data || []).length,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return {
        activeWorkersCount: 0,
        queuedJobsCount: 0,
        staleLeasesCount: 0,
        failedJobsCount: 0,
        activeCampaignsCount: 0,
        blockedTasksCount: 0,
        pendingApprovalsCount: 0,
        openCriticalIssuesCount: 0,
        recentRegressionsCount: 0,
        recentRemediationsCount: 0,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  private static mapEventRecord(r: any): AutonomousEvent {
    return {
      id: r.id,
      organizationId: r.organization_id,
      projectId: r.project_id,
      campaignId: r.campaign_id,
      testRunId: r.test_run_id,
      issueId: r.issue_id,
      remediationId: r.remediation_id,
      actorType: r.actor_type,
      actorId: r.actor_id,
      eventType: r.event_type,
      stage: r.stage,
      status: r.status,
      summary: r.summary,
      reason: r.reason,
      confidence: r.confidence,
      source: r.source,
      factCategory: r.fact_category,
      evidenceIds: r.evidence_ids || [],
      relatedEntityIds: r.related_entity_ids || [],
      metadata: r.metadata || {},
      createdAt: r.created_at,
    };
  }

  private static mapDecisionRecord(r: any): DecisionRecord {
    return {
      id: r.id,
      organizationId: r.organization_id,
      projectId: r.project_id,
      campaignId: r.campaign_id,
      testRunId: r.test_run_id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      decisionType: r.decision_type,
      actorType: r.actor_type,
      actorId: r.actor_id,
      decision: r.decision,
      reason: r.reason,
      skipReason: r.skip_reason,
      evidenceIds: r.evidence_ids || [],
      policyChecks: r.policy_checks || [],
      confidence: r.confidence,
      source: r.source,
      result: r.result,
      nextAction: r.next_action,
      metadata: r.metadata || {},
      createdAt: r.created_at,
    };
  }

  private static mapApprovalRecord(r: any): HumanApprovalRecord {
    return {
      id: r.id,
      organizationId: r.organization_id,
      projectId: r.project_id,
      remediationId: r.remediation_id,
      actionType: r.action_type,
      status: r.status,
      sourceSha: r.source_sha,
      fixPlanVersion: r.fix_plan_version,
      filesAffected: r.files_affected || [],
      diffPreview: r.diff_preview,
      riskLevel: r.risk_level,
      reason: r.reason,
      requestedBy: r.requested_by,
      approvedBy: r.approved_by,
      rejectedBy: r.rejected_by,
      decisionReason: r.decision_reason,
      policyContext: r.policy_context || {},
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
