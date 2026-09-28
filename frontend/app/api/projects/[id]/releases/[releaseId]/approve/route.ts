// ==============================================================================
// Sculra Release Gate Human Approval API Route (POST)
// (frontend/app/api/projects/[id]/releases/[releaseId]/approve/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject } from '@/services/db';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { ReleaseGateApprovalManager } from '../../../../../../../../worker/src/release/human-approval';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { userId, getToken, orgRole } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Session token expired.' }, { status: 401 });
    }

    const { id, releaseId } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found.' }, { status: 404 });
    }

    const body = await req.json();
    const { reason = 'Approved release for deployment promotion.', approvalId } = body;

    const supabase = getSupabaseServiceClient();

    // 1. Fetch latest pending approval for release
    let query = supabase
      .from('release_gate_approvals')
      .select('*')
      .eq('project_id', id)
      .eq('release_id', releaseId)
      .eq('status', 'PENDING');

    if (approvalId) {
      query = query.eq('id', approvalId);
    }

    const { data: approvalRow } = await query.order('requested_at', { ascending: false }).maybeSingle();

    if (!approvalRow) {
      return NextResponse.json(
        { success: false, error: 'No pending approval request found for this release.' },
        { status: 404 }
      );
    }

    // 2. Fetch corresponding decision
    const { data: decisionRow } = await supabase
      .from('release_gate_decisions')
      .select('*')
      .eq('id', approvalRow.decision_id)
      .single();

    if (!decisionRow) {
      return NextResponse.json(
        { success: false, error: 'Corresponding release gate decision record not found.' },
        { status: 404 }
      );
    }

    // 3. Process Approval
    const { updatedApproval, updatedDecision } = ReleaseGateApprovalManager.processApproval({
      approval: {
        id: approvalRow.id,
        decisionId: approvalRow.decision_id,
        releaseId: approvalRow.release_id,
        deploymentId: approvalRow.deployment_id,
        projectId: approvalRow.project_id,
        organizationId: approvalRow.organization_id,
        status: approvalRow.status,
        requesterId: approvalRow.requester_id,
        approverId: approvalRow.approver_id,
        reason: approvalRow.reason,
        requestedAt: approvalRow.requested_at,
        decidedAt: approvalRow.decided_at,
        expiresAt: approvalRow.expires_at,
      },
      decision: {
        id: decisionRow.id,
        releaseId: decisionRow.release_id,
        deploymentId: decisionRow.deployment_id,
        projectId: decisionRow.project_id,
        environmentId: decisionRow.environment_id,
        policyId: decisionRow.policy_id,
        policyVersion: decisionRow.policy_version,
        decision: decisionRow.decision,
        blockers: decisionRow.blockers || [],
        warnings: decisionRow.warnings || [],
        evidence: decisionRow.evidence || [],
        confidence: Number(decisionRow.confidence) || 1.0,
        evaluatedAt: decisionRow.evaluated_at,
        evaluatedBy: decisionRow.evaluated_by,
        source: decisionRow.source,
      },
      approverId: userId,
      approverRole: orgRole || 'member',
      outcome: 'APPROVED',
      reason,
    });

    // 4. Update Database records
    await supabase
      .from('release_gate_approvals')
      .update({
        status: updatedApproval.status,
        approver_id: updatedApproval.approverId,
        reason: updatedApproval.reason,
        decided_at: updatedApproval.decidedAt,
      })
      .eq('id', updatedApproval.id);

    await supabase
      .from('release_gate_decisions')
      .update({
        decision: updatedDecision.decision,
        evaluated_by: updatedDecision.evaluatedBy,
        evaluated_at: updatedDecision.evaluatedAt,
      })
      .eq('id', updatedDecision.id);

    return NextResponse.json({
      success: true,
      approval: updatedApproval,
      decision: updatedDecision,
    });
  } catch (err: any) {
    console.error('[API Release Approve Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
