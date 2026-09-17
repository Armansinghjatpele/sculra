// ==============================================================================
// Sculra Issue Remediation & Root Cause Diagnosis API Route
// (frontend/app/api/issues/[id]/remediation/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getIssueRemediationAnalysis } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access. Sign in required.' },
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

    const { id: issueId } = await params;
    const remediation = await getIssueRemediationAnalysis(token, issueId);

    return NextResponse.json({
      success: true,
      remediation,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to retrieve remediation analysis' },
      { status: 500 }
    );
  }
}
