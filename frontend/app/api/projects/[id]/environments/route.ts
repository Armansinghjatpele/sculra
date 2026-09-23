// ==============================================================================
// Sculra Project Environments API (GET / POST)
// (frontend/app/api/projects/[id]/environments/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { PolicyManager } from '@/lib/authz/policy';
import {
  getProjectEnvironments,
  createProjectEnvironment,
  validateEnvironmentUrl,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.ENVIRONMENT_READ);

    const environments = await getProjectEnvironments(authContext.clerkToken, id);

    return NextResponse.json({
      success: true,
      projectId: id,
      environments,
      count: environments.length,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching project environments.', code: err.code },
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
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.ENVIRONMENT_CREATE);

    const body = await req.json();
    const { name, type, baseUrl, branch, commitSha } = body;

    if (!name || !baseUrl) {
      return NextResponse.json(
        { success: false, error: 'Environment name and baseUrl are required.' },
        { status: 400 }
      );
    }

    // SSRF validation
    const ssrfCheck = validateEnvironmentUrl(baseUrl);
    if (!ssrfCheck.valid) {
      return NextResponse.json(
        { success: false, error: ssrfCheck.error || 'Base URL violated SSRF defense policy.' },
        { status: 422 }
      );
    }

    const isProduction = type === 'PRODUCTION' || body.isProduction === true;

    // Production mutation authorization guard
    if (isProduction) {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: authContext.role,
        isProduction: true,
        action: 'CREATE',
      });
    }

    const created = await createProjectEnvironment(authContext.clerkToken, {
      projectId: id,
      organizationId: authContext.orgId || '',
      name: name.trim(),
      type: type || 'PREVIEW',
      baseUrl: baseUrl.trim(),
      branch: branch?.trim() || undefined,
      commitSha: commitSha?.trim() || undefined,
      isProduction,
      healthStatus: 'HEALTHY',
    });

    return NextResponse.json({
      success: true,
      environment: created,
    }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'RoleNotAllowedError' ? 403 : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed creating project environment.', code: err.code },
      { status }
    );
  }
}
