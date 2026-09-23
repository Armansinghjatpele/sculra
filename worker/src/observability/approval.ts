// ==============================================================================
// Sculra Human-in-the-Loop Approval Security Manager
// (worker/src/observability/approval.ts)
// ==============================================================================

import {
  HumanApprovalRecord,
  HumanApprovalStatus,
  ApprovalActionType,
} from './types';
import { OBSERVABILITY_POLICY } from './policy';
import { ObservabilityRedactor } from './redaction';

export class ApprovalSecurityManager {
  private static approvalsMemory: HumanApprovalRecord[] = [];

  /**
   * Requests a human approval with cryptographic binding to project, remediation, and source SHA.
   */
  public static async requestApproval(
    params: {
      projectId: string;
      organizationId?: string | null;
      remediationId?: string | null;
      actionType: ApprovalActionType;
      sourceSha: string;
      fixPlanVersion?: number;
      filesAffected?: string[];
      diffPreview?: string | null;
      riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      reason: string;
      requestedBy: string;
      policyContext?: Record<string, any>;
    },
    supabaseClient?: any
  ): Promise<HumanApprovalRecord> {
    const expiresAt = new Date(
      Date.now() + OBSERVABILITY_POLICY.APPROVAL_EXPIRATION_MS
    ).toISOString();

    const record: HumanApprovalRecord = {
      id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: params.organizationId || null,
      projectId: params.projectId,
      remediationId: params.remediationId || null,
      actionType: params.actionType,
      status: 'APPROVAL_REQUIRED',
      sourceSha: params.sourceSha,
      fixPlanVersion: params.fixPlanVersion ?? 1,
      filesAffected: params.filesAffected || [],
      diffPreview: params.diffPreview ? ObservabilityRedactor.maskSecrets(params.diffPreview) : null,
      riskLevel: params.riskLevel,
      reason: ObservabilityRedactor.maskSecrets(params.reason),
      requestedBy: params.requestedBy,
      approvedBy: null,
      rejectedBy: null,
      decisionReason: null,
      policyContext: ObservabilityRedactor.boundMetadata(params.policyContext || {}),
      expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.approvalsMemory.unshift(record);

    if (supabaseClient) {
      try {
        await supabaseClient.from('human_approvals').insert({
          id: record.id.startsWith('appr-') ? undefined : record.id,
          organization_id: record.organizationId,
          project_id: record.projectId,
          remediation_id: record.remediationId,
          action_type: record.actionType,
          status: record.status,
          source_sha: record.sourceSha,
          fix_plan_version: record.fixPlanVersion,
          files_affected: record.filesAffected,
          diff_preview: record.diffPreview,
          risk_level: record.riskLevel,
          reason: record.reason,
          requested_by: record.requestedBy,
          policy_context: record.policyContext,
          expires_at: record.expiresAt,
        });
      } catch (err: any) {
        console.warn('[ApprovalSecurityManager] Failed inserting approval to DB:', err.message);
      }
    }

    // Secondary notification dispatch (fault-isolated)
    try {
      const { NotificationEngine } = await import('../notifications');
      const engine = new NotificationEngine(supabaseClient);
      engine.dispatch({
        eventType: record.remediationId ? 'FIX_APPROVAL_REQUIRED' : 'HUMAN_APPROVAL_REQUIRED',
        entityType: 'HUMAN_APPROVAL',
        entityId: record.id,
        title: `Approval Required: ${record.actionType}`,
        summary: record.reason,
        organizationId: record.organizationId,
        projectId: record.projectId,
        severity: record.riskLevel,
        deepLink: `/projects/${record.projectId}/fixes`,
        metadata: {
          actionType: record.actionType,
          remediationId: record.remediationId,
          expiresAt: record.expiresAt,
        },
      }).catch(() => {});
    } catch {
      // Non-blocking notification dispatch
    }

    return record;
  }

  /**
   * Processes a human decision (Approve or Reject) with strict security binding checks.
   */
  public static async processDecision(
    params: {
      approvalId: string;
      decision: 'APPROVE' | 'REJECT';
      actorUserId: string;
      decisionReason?: string;
      currentSourceSha: string;
      currentPlanVersion?: number;
      targetProjectId: string;
    },
    supabaseClient?: any
  ): Promise<{ success: boolean; approval: HumanApprovalRecord; error?: string }> {
    const existing = this.approvalsMemory.find((a) => a.id === params.approvalId);

    if (!existing) {
      return {
        success: false,
        approval: {} as HumanApprovalRecord,
        error: 'Approval record not found.',
      };
    }

    // 1. Cross-Project Isolation Check
    if (existing.projectId !== params.targetProjectId) {
      return {
        success: false,
        approval: existing,
        error: 'Cross-project approval access violation.',
      };
    }

    // 2. Replay & Terminal State Check
    if (existing.status !== 'APPROVAL_REQUIRED') {
      return {
        success: false,
        approval: existing,
        error: `Approval cannot be processed: Current status is ${existing.status}.`,
      };
    }

    // 3. Expiration Check (24-hour window)
    if (new Date(existing.expiresAt).getTime() < Date.now()) {
      existing.status = 'EXPIRED';
      existing.updatedAt = new Date().toISOString();
      return {
        success: false,
        approval: existing,
        error: 'Approval request has expired (24-hour limit exceeded).',
      };
    }

    // 4. Source Commit SHA Binding Check
    if (existing.sourceSha !== params.currentSourceSha) {
      existing.status = 'CANCELLED';
      existing.decisionReason = `Invalidated due to source commit change (Expected ${existing.sourceSha.slice(0, 7)}, found ${params.currentSourceSha.slice(0, 7)}).`;
      existing.updatedAt = new Date().toISOString();
      return {
        success: false,
        approval: existing,
        error: 'Source commit changed since approval was requested. Approval invalidated.',
      };
    }

    // 5. Fix Plan Version Binding Check
    if (
      params.currentPlanVersion !== undefined &&
      existing.fixPlanVersion !== params.currentPlanVersion
    ) {
      existing.status = 'CANCELLED';
      existing.decisionReason = `Invalidated due to fix plan modification (v${existing.fixPlanVersion} -> v${params.currentPlanVersion}).`;
      existing.updatedAt = new Date().toISOString();
      return {
        success: false,
        approval: existing,
        error: 'Remediation fix plan was updated. Approval invalidated.',
      };
    }

    // Apply decision
    if (params.decision === 'APPROVE') {
      existing.status = 'APPROVED';
      existing.approvedBy = params.actorUserId;
      existing.decisionReason = params.decisionReason || 'Approved by operator.';
    } else {
      existing.status = 'REJECTED';
      existing.rejectedBy = params.actorUserId;
      existing.decisionReason = params.decisionReason || 'Rejected by operator.';
    }

    existing.updatedAt = new Date().toISOString();

    if (supabaseClient) {
      try {
        await supabaseClient
          .from('human_approvals')
          .update({
            status: existing.status,
            approved_by: existing.approvedBy,
            rejected_by: existing.rejectedBy,
            decision_reason: existing.decisionReason,
            updated_at: existing.updatedAt,
          })
          .eq('id', existing.id);
      } catch (err: any) {
        console.warn('[ApprovalSecurityManager] Failed updating approval in DB:', err.message);
      }
    }

    return {
      success: true,
      approval: existing,
    };
  }

  public static getApprovals(projectId: string, status?: HumanApprovalStatus): HumanApprovalRecord[] {
    let list = this.approvalsMemory.filter((a) => a.projectId === projectId);
    if (status) {
      list = list.filter((a) => a.status === status);
    }
    return list;
  }

  public static clearMemoryForTest(): void {
    this.approvalsMemory = [];
  }
}
