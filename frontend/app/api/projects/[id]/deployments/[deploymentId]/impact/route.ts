// ==============================================================================
// Sculra Deployment Impact API (GET)
// (frontend/app/api/projects/[id]/deployments/[deploymentId]/impact/route.ts)
// Answers: "What is the release impact of this deployment?", "Are regressions introduced?"
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getDeploymentImpact } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  try {
    const { id, deploymentId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.DEPLOYMENTS_READ);

    const impact = await getDeploymentImpact(authContext.clerkToken, id, deploymentId);

    return NextResponse.json({
      success: true,
      impact,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching deployment impact.', code: err.code },
      { status }
    );
  }
}
