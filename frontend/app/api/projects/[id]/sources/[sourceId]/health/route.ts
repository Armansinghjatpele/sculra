// ==============================================================================
// Sculra Project Source Health API (GET / POST)
// (frontend/app/api/projects/[id]/sources/[sourceId]/health/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getProject,
  getProjectSource,
  getProjectSourceHealth,
  validateProjectSource,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
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

    const { id, sourceId } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const healthHistory = await getProjectSourceHealth(token, sourceId);

    return NextResponse.json({
      success: true,
      sourceId,
      healthHistory,
      latest: healthHistory[0] || null,
    });
  } catch (err: any) {
    console.error('[API Source Health GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching health history.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
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

    const { id, sourceId } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const source = await getProjectSource(token, sourceId);
    if (!source || source.projectId !== id) {
      return NextResponse.json(
        { success: false, error: 'Source not found.' },
        { status: 404 }
      );
    }

    // Trigger fresh check
    const validation = await validateProjectSource(
      token,
      source.type,
      source.locator,
      source.configuration
    );

    const newObservation = {
      id: `hobs-${Date.now()}`,
      projectSourceId: sourceId,
      status: validation.health,
      latencyMs: validation.latencyMs,
      metadata: {
        warningsCount: validation.warnings.length,
        errorsCount: validation.errors.length,
      },
      observedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      observation: newObservation,
    });
  } catch (err: any) {
    console.error('[API Source Health POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed executing health check.' },
      { status: 500 }
    );
  }
}
