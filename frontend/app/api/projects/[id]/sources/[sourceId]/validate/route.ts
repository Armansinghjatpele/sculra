// ==============================================================================
// Sculra Project Source Preflight Validation API (POST)
// (frontend/app/api/projects/[id]/sources/[sourceId]/validate/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getProject,
  getProjectSource,
  validateProjectSource,
} from '@/services/db';

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

    const result = await validateProjectSource(
      token,
      source.type,
      source.locator,
      source.configuration
    );

    return NextResponse.json({
      success: true,
      sourceId,
      result,
    });
  } catch (err: any) {
    console.error('[API Source Validate POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed validating source.' },
      { status: 500 }
    );
  }
}
