// ==============================================================================
// Sculra Test Run Autonomous Timeline API (GET)
// (frontend/app/api/test-runs/[id]/timeline/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEntityAutonomousTimeline } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized user access. Please sign in.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Failed retrieving session authentication token.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const timeline = await getEntityAutonomousTimeline(token, 'testRun', id);

    return NextResponse.json({
      success: true,
      testRunId: id,
      count: timeline.length,
      timeline,
    });
  } catch (err: any) {
    console.error('[API Test-Runs/[id]/timeline GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching test run timeline.' },
      { status: 500 }
    );
  }
}
