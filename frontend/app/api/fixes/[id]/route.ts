// ==============================================================================
// Sculra Fix Remediation Detail API Route
// (frontend/app/api/fixes/[id]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getFixRemediation } from '@/services/db';

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

    const { id } = await params;
    const result = await getFixRemediation(token, id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Fix remediation record not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      remediation: result.remediation,
      evidence: result.evidence,
    });
  } catch (err: any) {
    console.error('[API Fix Detail GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching fix remediation.' },
      { status: 500 }
    );
  }
}
