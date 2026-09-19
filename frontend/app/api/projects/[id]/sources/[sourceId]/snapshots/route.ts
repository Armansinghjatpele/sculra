// ==============================================================================
// Sculra Project Source Snapshots API (GET)
// (frontend/app/api/projects/[id]/sources/[sourceId]/snapshots/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getProject,
  getProjectSourceSnapshots,
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

    const snapshots = await getProjectSourceSnapshots(token, sourceId);

    return NextResponse.json({
      success: true,
      sourceId,
      snapshots,
      count: snapshots.length,
    });
  } catch (err: any) {
    console.error('[API Source Snapshots GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching source snapshots.' },
      { status: 500 }
    );
  }
}
