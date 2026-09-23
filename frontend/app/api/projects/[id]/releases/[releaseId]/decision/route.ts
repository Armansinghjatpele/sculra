// ==============================================================================
// Sculra Human Release Decision Recording API (GET / POST)
// (frontend/app/api/projects/[id]/releases/[releaseId]/decision/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { PolicyManager } from '@/lib/authz/policy';
import {
  getProjectRelease,
  updateProjectRelease,
  getReleaseDecisions,
  recordReleaseDecision,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id, releaseId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.RELEASES_READ);

    const decisions = await getReleaseDecisions(authContext.clerkToken, releaseId);

    return NextResponse.json({
      success: true,
      releaseId,
      decisions,
      count: decisions.length,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching release decisions.', code: err.code },
      { status }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id, releaseId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.RELEASES_DECIDE);

    const release = await getProjectRelease(authContext.clerkToken, id, releaseId);
    if (!release) {
      return NextResponse.json(
        { success: false, error: 'Release not found.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { decision, notes } = body;

    if (!decision || !['APPROVE', 'BLOCK', 'REQUEST_RETEST'].includes(decision)) {
      return NextResponse.json(
        { success: false, error: 'Valid decision ("APPROVE", "BLOCK", "REQUEST_RETEST") is required.' },
        { status: 400 }
      );
    }

    // Role-based authorization & release state policy evaluation
    PolicyManager.evaluateReleaseDecision({
      callerRole: authContext.role,
      decision,
      releaseStatus: release.status,
    });

    const recorded = await recordReleaseDecision(authContext.clerkToken, {
      projectId: id,
      organizationId: authContext.orgId || '',
      releaseId,
      decision,
      decidedBy: authContext.userId || 'system-user',
      decidedByRole: authContext.role,
      notes: notes?.trim() || null,
      decidedAt: new Date().toISOString(),
    });

    // Mutate release status according to human decision
    if (decision === 'APPROVE') {
      await updateProjectRelease(authContext.clerkToken, releaseId, {
        status: 'RELEASED',
        releasedAt: new Date().toISOString(),
      });
    } else if (decision === 'BLOCK') {
      await updateProjectRelease(authContext.clerkToken, releaseId, {
        status: 'BLOCKED',
      });
    }

    return NextResponse.json({
      success: true,
      decision: recorded,
    }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'RoleNotAllowedError' ? 403 : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed recording release decision.', code: err.code },
      { status }
    );
  }
}
