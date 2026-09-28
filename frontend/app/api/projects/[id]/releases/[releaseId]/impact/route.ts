// ==============================================================================
// Sculra Release Impact Analysis API (GET)
// (frontend/app/api/projects/[id]/releases/[releaseId]/impact/route.ts)
// Answers: "What is the release impact of this release?", "Which workflows are affected?"
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getReleaseImpact } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id, releaseId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.RELEASE_READ);

    const impact = await getReleaseImpact(authContext.clerkToken, id, releaseId);

    return NextResponse.json({
      success: true,
      impact,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching release impact.', code: err.code },
      { status }
    );
  }
}
