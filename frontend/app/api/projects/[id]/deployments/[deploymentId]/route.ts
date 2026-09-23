// ==============================================================================
// Sculra Project Deployment Detail API (GET)
// (frontend/app/api/projects/[id]/deployments/[deploymentId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getProjectDeployment } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  try {
    const { id, deploymentId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.DEPLOYMENTS_READ);

    const deployment = await getProjectDeployment(authContext.clerkToken, id, deploymentId);
    if (!deployment) {
      return NextResponse.json(
        { success: false, error: 'Deployment not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deployment,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching deployment.', code: err.code },
      { status }
    );
  }
}
