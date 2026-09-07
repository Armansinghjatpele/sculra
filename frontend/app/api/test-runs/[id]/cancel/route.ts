import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTestRun, cancelTestRun } from '@/services/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized user access' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Failed retrieving session token' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const testRunId = resolvedParams.id;

    if (!testRunId) {
      return NextResponse.json(
        { success: false, error: 'Missing test run ID' },
        { status: 400 }
      );
    }

    // Verify test run exists and user has access
    const testRun = await getTestRun(token, testRunId);
    if (!testRun) {
      return NextResponse.json(
        { success: false, error: 'Test run not found or access denied in this workspace scope.' },
        { status: 404 }
      );
    }

    if (testRun.status === 'passed' || testRun.status === 'failed' || testRun.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: `Cannot cancel test run with final status "${testRun.status}".` },
        { status: 400 }
      );
    }

    await cancelTestRun(token, testRunId);

    return NextResponse.json({
      success: true,
      message: 'Test run cancelled successfully.',
    });

  } catch (err: any) {
    console.error('[API /api/test-runs/[id]/cancel Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error cancelling test run' },
      { status: 500 }
    );
  }
}
