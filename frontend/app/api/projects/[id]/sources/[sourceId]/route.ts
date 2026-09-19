// ==============================================================================
// Sculra Single Project Source API (GET / PATCH)
// (frontend/app/api/projects/[id]/sources/[sourceId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getProject,
  getProjectSource,
  updateProjectSource,
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

    const source = await getProjectSource(token, sourceId);
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
    console.error('[API Project Single Source GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching source details.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = await req.json();
    const updated = await updateProjectSource(token, sourceId, body);

    return NextResponse.json({
      success: true,
      source: updated,
    });
  } catch (err: any) {
    console.error('[API Project Single Source PATCH Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating source.' },
      { status: 500 }
    );
  }
}
