// ==============================================================================
// Sculra Project Sources Collection API (GET / POST)
// (frontend/app/api/projects/[id]/sources/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import {
  getProjectSources,
  createProjectSource,
  validateProjectSource,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.SOURCES_READ);

    const sources = await getProjectSources(authContext.clerkToken, id);

    return NextResponse.json({
      success: true,
      projectId: id,
      sources,
      count: sources.length,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching project sources.', code: err.code },
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
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.SOURCES_CREATE);

    const body = await req.json();
    const { type, locator, branch, environment, configuration } = body;

    if (!type || !locator) {
      return NextResponse.json(
        { success: false, error: 'Source type and locator are required.' },
        { status: 400 }
      );
    }

    // Preflight validate source
    const validation = await validateProjectSource(authContext.clerkToken, type, locator, configuration);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.errors[0]?.message || 'Source validation failed',
          validation,
        },
        { status: 422 }
      );
    }

    const created = await createProjectSource(authContext.clerkToken, {
      projectId: id,
      type,
      locator: locator.trim(),
      branch: branch || undefined,
      environment: environment || 'PRODUCTION',
      status: validation.status,
      configuration: configuration || {},
      capabilities: validation.capabilities,
    });

    return NextResponse.json({
      success: true,
      source: created,
      validation,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed creating project source.', code: err.code },
      { status }
    );
  }
}
