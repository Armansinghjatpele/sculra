import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCampaignEvidence } from '@/services/db';

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
    const evidence = await getCampaignEvidence(token, id);

    return NextResponse.json({ success: true, evidence });
  } catch (err: any) {
    console.error('[API Campaigns/[id]/evidence GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching campaign evidence.' },
      { status: 500 }
    );
  }
}
