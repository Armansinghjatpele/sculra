// ==============================================================================
// Sculra Project Reject Human Approval API Route (POST)
// (frontend/app/api/projects/[id]/autonomous/approvals/[approvalId]/reject/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getHumanApproval, decideHumanApproval } from '@/services/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> }
) {
  try {
    const { id, approvalId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.APPROVALS_REJECT);

    const approval = await getHumanApproval(authContext.clerkToken, approvalId);
    if (!approval || approval.projectId !== id) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found.' },
        { status: 404 }
      );
    }

    // Check status
    if (approval.status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: `Approval request is already in status ${approval.status}. Replay rejected.`,
        },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty body fallback
    }

    const reason = body?.reason?.trim() || 'Rejected by human operator';

    const updated = await decideHumanApproval(
      authContext.clerkToken,
      approvalId,
      'REJECTED',
      reason,
      authContext.userId
    );

    return NextResponse.json({
      success: true,
      approval: updated,
      message: 'Human approval rejected. Remediation blocked.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed processing rejection.', code: err.code },
      { status }
    );
  }
}
