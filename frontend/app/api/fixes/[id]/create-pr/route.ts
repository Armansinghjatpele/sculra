// ==============================================================================
// Sculra Approve & Create PR for Fix Remediation API Route
// (frontend/app/api/fixes/[id]/create-pr/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getFixRemediation, approveFixRemediation } from '@/services/db';

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

    const approved = await approveFixRemediation(token, id, userId);

    return NextResponse.json({
      success: true,
      remediation: approved,
      message: 'Remediation approved and PR creation initiated.',
    });
  } catch (err: any) {
    console.error('[API Fix Create PR Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed creating PR.' },
      { status: 500 }
    );
  }
}
