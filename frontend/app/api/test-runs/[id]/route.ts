import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTestRun, getTestEvidence, getTestRunIssues } from '@/services/db';

export async function GET(
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

    const [testRun, evidence, issues] = await Promise.all([
      getTestRun(token, testRunId),
      getTestEvidence(token, testRunId),
      getTestRunIssues(token, testRunId),
    ]);

    if (!testRun) {
      return NextResponse.json(
        { success: false, error: 'Test run not found or access denied in this workspace scope.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      testRun,
      evidence,
      issues,
    });

  } catch (err: any) {
    console.error('[API /api/test-runs/[id] Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error retrieving test run' },
      { status: 500 }
    );
  }
}
