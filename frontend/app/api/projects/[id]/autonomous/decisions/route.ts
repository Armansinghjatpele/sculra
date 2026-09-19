// ==============================================================================
// Sculra Project Autonomous Decisions API (GET)
// (frontend/app/api/projects/[id]/autonomous/decisions/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject, getProjectAutonomousDecisions } from '@/services/db';

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

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '50', 10), 1),
      200
    );

    const decisions = await getProjectAutonomousDecisions(token, id, limit);

    return NextResponse.json({
      success: true,
      projectId: id,
      count: decisions.length,
      decisions,
    });
  } catch (err: any) {
    console.error('[API Project Autonomous Decisions GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching autonomous decisions.' },
      { status: 500 }
    );
  }
}
