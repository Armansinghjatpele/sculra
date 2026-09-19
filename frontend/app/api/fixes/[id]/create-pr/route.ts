// ==============================================================================
// Sculra Approve & Create PR for Fix Remediation API Route
// (frontend/app/api/fixes/[id]/create-pr/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requirePermission, PERMISSIONS, PolicyManager } from '@/lib/authz';
import { getFixRemediation, approveFixRemediation, getProject } from '@/services/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.FIX_AGENT_CREATE_PR);

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

    const targetBranch = existing.remediation.baseBranch || 'main';
    const sourceSha = existing.remediation.commitSha || 'unknown';

    // Evaluate PR creation policy (requires verified fix)
    const policyResult = PolicyManager.evaluateCreatePr({
      verificationStatus: existing.remediation.verificationStatus,
      allowedBranches: ['main', 'master', 'develop'],
      targetBranch,
      sourceSha,
    });

    if (!policyResult.allowed) {
      return NextResponse.json(
        { success: false, error: policyResult.reason || 'Policy blocked PR creation.' },
        { status: 403 }
      );
    }

    const approved = await approveFixRemediation(authContext.clerkToken, id, authContext.userId);

    return NextResponse.json({
      success: true,
      remediation: approved,
      message: 'Remediation approved and PR creation initiated.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed creating PR.', code: err.code },
      { status }
    );
  }
}
