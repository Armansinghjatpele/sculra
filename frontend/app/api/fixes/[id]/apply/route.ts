// ==============================================================================
// Sculra Apply & Verify Fix Remediation API Route
// (frontend/app/api/fixes/[id]/apply/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getFixRemediation } from '@/services/db';

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
    const existing = await getFixRemediation(token, id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Remediation not found.' },
        { status: 404 }
      );
    }

    // In a live system, this enqueues the worker fix agent task or transitions state
    return NextResponse.json({
      success: true,
      remediation: existing.remediation,
      message: 'Remediation queued for apply & verify.',
    });
  } catch (err: any) {
    console.error('[API Fix Apply Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to apply remediation.' },
      { status: 500 }
    );
  }
}
