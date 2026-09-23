// ==============================================================================
// Sculra Project Release Detail API (GET / PATCH)
// (frontend/app/api/projects/[id]/releases/[releaseId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import {
  getProjectRelease,
  updateProjectRelease,
  getReleaseChecks,
  getReleaseDecisions,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id, releaseId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.RELEASES_READ);

    const release = await getProjectRelease(authContext.clerkToken, id, releaseId);
    if (!release) {
      return NextResponse.json(
        { success: false, error: 'Release not found.' },
        { status: 404 }
      );
    }

    const checks = await getReleaseChecks(authContext.clerkToken, releaseId);
    const decisions = await getReleaseDecisions(authContext.clerkToken, releaseId);

    return NextResponse.json({
      success: true,
      release,
      checks,
      decisions,
      latestCheck: checks[0] || null,
      latestDecision: decisions[0] || null,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching release details.', code: err.code },
      { status }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id, releaseId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.RELEASES_CREATE);

    const existing = await getProjectRelease(authContext.clerkToken, id, releaseId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Release not found.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updated = await updateProjectRelease(authContext.clerkToken, releaseId, body);

    return NextResponse.json({
      success: true,
      release: updated,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating release.', code: err.code },
      { status }
    );
  }
}
