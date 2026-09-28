// ==============================================================================
// Sculra Deployment Intelligence API (GET)
// (frontend/app/api/projects/[id]/deployments/[deploymentId]/intelligence/route.ts)
// Answers: "What deployment contains this code change?", "Which environment received it?",
// "What changed relative to the previous deployment?"
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getDeploymentIntelligence } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  try {
    const { id, deploymentId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.DEPLOYMENTS_READ);

    const intelligence = await getDeploymentIntelligence(authContext.clerkToken, id, deploymentId);

    return NextResponse.json({
      success: true,
      intelligence,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching deployment intelligence.', code: err.code },
      { status }
    );
  }
}
