// ==============================================================================
// Sculra Cancel Fix Remediation API Route
// (frontend/app/api/fixes/[id]/cancel/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cancelFixRemediation } from '@/services/db';

export async function POST(
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
    const cancelled = await cancelFixRemediation(token, id);

    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: 'Failed to cancel remediation or record not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      remediation: cancelled,
      message: 'Fix remediation cancelled successfully.',
    });
  } catch (err: any) {
    console.error('[API Fix Cancel Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed cancelling remediation.' },
      { status: 500 }
    );
  }
}
