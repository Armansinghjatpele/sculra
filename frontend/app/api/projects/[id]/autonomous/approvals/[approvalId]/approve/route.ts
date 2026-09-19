// ==============================================================================
// Sculra Project Approve Human Approval API Route (POST)
// (frontend/app/api/projects/[id]/autonomous/approvals/[approvalId]/approve/route.ts)
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
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.APPROVALS_APPROVE);

    const approval = await getHumanApproval(authContext.clerkToken, approvalId);
    if (!approval || approval.projectId !== id) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found.' },
        { status: 404 }
      );
    }

    // Check expiration window (24h)
    const isExpired = new Date(approval.expiresAt).getTime() < Date.now();
    if (isExpired) {
      return NextResponse.json(
        {
          success: false,
          error: 'Approval window has expired (24h limit). Fix plan must be re-evaluated.',
        },
        { status: 400 }
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

    const reason = body?.reason?.trim() || 'Approved by human operator';

    const updated = await decideHumanApproval(
      authContext.clerkToken,
      approvalId,
      'APPROVED',
      reason,
      authContext.userId
    );

    return NextResponse.json({
      success: true,
      approval: updated,
      message: 'Human approval granted. Remediation PR dispatch unlocked.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed processing approval.', code: err.code },
      { status }
    );
  }
}
