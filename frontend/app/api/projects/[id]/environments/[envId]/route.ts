// ==============================================================================
// Sculra Project Environment Detail API (GET / PATCH / DELETE)
// (frontend/app/api/projects/[id]/environments/[envId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { PolicyManager } from '@/lib/authz/policy';
import {
  getProjectEnvironment,
  updateProjectEnvironment,
  deleteProjectEnvironment,
  validateEnvironmentUrl,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.ENVIRONMENT_READ);

    const environment = await getProjectEnvironment(authContext.clerkToken, id, envId);
    if (!environment) {
      return NextResponse.json(
        { success: false, error: 'Environment not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      environment,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching environment.', code: err.code },
      { status }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.ENVIRONMENT_UPDATE);

    const existing = await getProjectEnvironment(authContext.clerkToken, id, envId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Environment not found.' },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Check SSRF if baseUrl updated
    if (body.baseUrl) {
      const ssrfCheck = validateEnvironmentUrl(body.baseUrl);
      if (!ssrfCheck.valid) {
        return NextResponse.json(
          { success: false, error: ssrfCheck.error || 'Base URL violated SSRF defense policy.' },
          { status: 422 }
        );
      }
    }

    const targetIsProduction = existing.isProduction || body.type === 'PRODUCTION' || body.isProduction === true;
    if (targetIsProduction) {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: authContext.role,
        isProduction: true,
        action: 'UPDATE',
      });
    }

    const updated = await updateProjectEnvironment(authContext.clerkToken, envId, body);

    return NextResponse.json({
      success: true,
      environment: updated,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'RoleNotAllowedError' ? 403 : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating environment.', code: err.code },
      { status }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.ENVIRONMENT_DELETE);

    const existing = await getProjectEnvironment(authContext.clerkToken, id, envId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Environment not found.' },
        { status: 404 }
      );
    }

    if (existing.isProduction) {
      PolicyManager.evaluateEnvironmentMutation({
        callerRole: authContext.role,
        isProduction: true,
        action: 'DELETE',
      });
    }

    await deleteProjectEnvironment(authContext.clerkToken, envId);

    return NextResponse.json({
      success: true,
      message: 'Environment successfully deleted.',
    });
  } catch (err: any) {
    const status = err.statusCode || (err.name === 'RoleNotAllowedError' ? 403 : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed deleting environment.', code: err.code },
      { status }
    );
  }
}
