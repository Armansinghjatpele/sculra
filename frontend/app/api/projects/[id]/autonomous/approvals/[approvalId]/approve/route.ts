// ==============================================================================
// Sculra Project Approve Human Approval API Route (POST)
// (frontend/app/api/projects/[id]/autonomous/approvals/[approvalId]/approve/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject, getHumanApproval, decideHumanApproval } from '@/services/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sign in required.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Session token expired or missing.' },
        { status: 401 }
      );
    }

    const { id, approvalId } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const approval = await getHumanApproval(token, approvalId);
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
      token,
      approvalId,
      'APPROVED',
      reason,
      userId
    );

    return NextResponse.json({
      success: true,
      approval: updated,
      message: 'Human approval granted. Remediation PR dispatch unlocked.',
    });
  } catch (err: any) {
    console.error('[API Project Approval Approve POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed processing approval.' },
      { status: 500 }
    );
  }
}
