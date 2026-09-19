// ==============================================================================
// Sculra Project Sources Collection API (GET / POST)
// (frontend/app/api/projects/[id]/sources/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getProject,
  getProjectSources,
  createProjectSource,
  validateProjectSource,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sign in required.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Session token expired or missing.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const sources = await getProjectSources(token, id);

    return NextResponse.json({
      success: true,
      projectId: id,
      sources,
      count: sources.length,
    });
  } catch (err: any) {
    console.error('[API Project Sources GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching project sources.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sign in required.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Session token expired or missing.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { type, locator, branch, environment, configuration } = body;

    if (!type || !locator) {
      return NextResponse.json(
        { success: false, error: 'Source type and locator are required.' },
        { status: 400 }
      );
    }

    // Preflight validate source
    const validation = await validateProjectSource(token, type, locator, configuration);
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

    const created = await createProjectSource(token, {
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
    console.error('[API Project Sources POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed creating project source.' },
      { status: 500 }
    );
  }
}
