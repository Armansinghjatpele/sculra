// ==============================================================================
// Sculra Project Deployments Collection API (GET / POST)
// (frontend/app/api/projects/[id]/deployments/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import {
  getProjectDeployments,
  createProjectDeployment,
  getProjectEnvironment,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.DEPLOYMENTS_READ);

    const searchParams = req.nextUrl.searchParams;
    const environmentId = searchParams.get('environmentId') || undefined;

    const deployments = await getProjectDeployments(authContext.clerkToken, id, environmentId);

    return NextResponse.json({
      success: true,
      projectId: id,
      deployments,
      count: deployments.length,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching deployments.', code: err.code },
      { status }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.DEPLOYMENTS_CREATE);

    const body = await req.json();
    const { environmentId, commitSha, branch, deploymentUrl, provider, status, trigger, idempotencyKey, metadata } = body;

    if (!environmentId || !commitSha) {
      return NextResponse.json(
        { success: false, error: 'environmentId and commitSha are required.' },
        { status: 400 }
      );
    }

    const env = await getProjectEnvironment(authContext.clerkToken, id, environmentId);
    if (!env) {
      return NextResponse.json(
        { success: false, error: 'Target environment not found for this project.' },
        { status: 404 }
      );
    }

    const created = await createProjectDeployment(authContext.clerkToken, {
      projectId: id,
      organizationId: authContext.orgId || '',
      environmentId,
      commitSha: commitSha.trim(),
      branch: branch?.trim() || undefined,
      deploymentUrl: deploymentUrl?.trim() || env.baseUrl,
      provider: provider || 'GENERIC',
      status: status || 'PENDING',
      trigger: trigger || 'MANUAL',
      idempotencyKey: idempotencyKey || undefined,
      metadata: metadata || {},
      startedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      deployment: created,
    }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed recording deployment.', code: err.code },
      { status }
    );
  }
}
