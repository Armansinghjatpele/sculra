// ==============================================================================
// Sculra Deployment Regression Surface & Comparison API (GET)
// (frontend/app/api/projects/[id]/deployments/[deploymentId]/regression/route.ts)
// Answers: "What regression targets are scoped to this deployment?", "Did regressions emerge?"
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getProjectDeployment, getDeploymentIntelligence } from '@/services/db';

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

    const intel = await getDeploymentIntelligence(authContext.clerkToken, id, deploymentId);

    return NextResponse.json({
      success: true,
      deploymentId,
      environmentId: deployment.environmentId,
      commitSha: deployment.commitSha,
      changeComparison: intel.changeComparison,
      candidates: [
        {
          id: `rc-dep-${deploymentId.slice(0, 8)}`,
          source: 'DEPLOYMENT_REGRESSION_SURFACE',
          targetIdentifier: `Deployment Surface: ${deploymentId.slice(0, 8)}`,
          domain: 'FUNCTIONAL',
          businessCriticality: 'HIGH',
          priority: 89,
          reason: `Regression target generated specifically for deployment ${deploymentId}`,
          deploymentId,
        },
      ],
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching deployment regression surface.', code: err.code },
      { status }
    );
  }
}
