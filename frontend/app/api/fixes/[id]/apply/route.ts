// ==============================================================================
// Sculra Apply & Verify Fix Remediation API Route
// (frontend/app/api/fixes/[id]/apply/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requirePermission, PERMISSIONS, PolicyManager } from '@/lib/authz';
import { getFixRemediation, getProjectFixPolicy, getProject } from '@/services/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.FIX_AGENT_APPLY);

    const { id } = await params;
    const existing = await getFixRemediation(authContext.clerkToken, id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Remediation not found or access denied.' },
        { status: 404 }
      );
    }

    // Verify project multi-tenant access (IDOR defense)
    const project = await getProject(authContext.clerkToken, existing.remediation.projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Remediation not found or access denied.' },
        { status: 404 }
      );
    }

    const policy = await getProjectFixPolicy(authContext.clerkToken, existing.remediation.projectId);

    const targetBranch = existing.remediation.baseBranch || 'main';
    const sourceSha = existing.remediation.commitSha || 'unknown';
    const approvalStatus = existing.remediation.humanApproved ? 'APPROVED' : 'PENDING';
    const approvalExpiresAt = existing.remediation.approvedAt
      ? new Date(new Date(existing.remediation.approvedAt).getTime() + 86400000).toISOString()
      : undefined;

    // Evaluate sensitive action policy
    const policyResult = PolicyManager.evaluateFixAgentApply({
      fixAgentEnabled: policy ? policy.fixAgentEnabled : true,
      allowedBranches: policy?.fixAllowedPaths && policy.fixAllowedPaths.length > 0 ? policy.fixAllowedPaths : ['main', 'master', 'develop'],
      targetBranch,
      sourceSha,
      requiresApproval: policy ? policy.fixRequireHumanApproval : true,
      approvalStatus,
      approvalExpiresAt,
    });

    if (!policyResult.allowed) {
      return NextResponse.json(
        { success: false, error: policyResult.reason || 'Policy blocked remediation apply.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      remediation: existing.remediation,
      message: 'Remediation queued for apply & verify.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to apply remediation.', code: err.code },
      { status }
    );
  }
}
