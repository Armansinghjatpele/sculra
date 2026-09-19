// ==============================================================================
// Sculra Project Autonomous Telemetry & Health API (GET)
// (frontend/app/api/projects/[id]/autonomous/health/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject, getProjectAutonomousHealth } from '@/services/db';

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

    const health = await getProjectAutonomousHealth(token, id);

    return NextResponse.json({
      success: true,
      projectId: id,
      health,
    });
  } catch (err: any) {
    console.error('[API Project Autonomous Health GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching autonomous health.' },
      { status: 500 }
    );
  }
}
