// ==============================================================================
// Sculra Single Project Source API (GET / PATCH)
// (frontend/app/api/projects/[id]/sources/[sourceId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getProjectSource, updateProjectSource } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id, sourceId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.SOURCES_READ);

    const source = await getProjectSource(authContext.clerkToken, sourceId);
    if (!source || source.projectId !== id) {
      return NextResponse.json(
        { success: false, error: 'Source not found in project.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      source,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching source details.', code: err.code },
      { status }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id, sourceId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.SOURCES_UPDATE);

    const existing = await getProjectSource(authContext.clerkToken, sourceId);
    if (!existing || existing.projectId !== id) {
      return NextResponse.json(
        { success: false, error: 'Source not found in project.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { locator, branch, environment, configuration, status } = body;

    const updated = await updateProjectSource(authContext.clerkToken, sourceId, {
      locator: locator?.trim(),
      branch,
      environment,
      configuration,
      status,
    });

    return NextResponse.json({
      success: true,
      source: updated,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating project source.', code: err.code },
      { status }
    );
  }
}
