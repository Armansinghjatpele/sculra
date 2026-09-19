// ==============================================================================
// Sculra Campaign Autonomous Decisions API (GET)
// (frontend/app/api/campaigns/[id]/decisions/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCampaignAutonomousDecisions } from '@/services/db';

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
    const decisions = await getCampaignAutonomousDecisions(token, id);

    return NextResponse.json({
      success: true,
      campaignId: id,
      count: decisions.length,
      decisions,
    });
  } catch (err: any) {
    console.error('[API Campaigns/[id]/decisions GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching campaign decisions.' },
      { status: 500 }
    );
  }
}
