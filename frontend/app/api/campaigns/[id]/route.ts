import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCampaign } from '@/services/db';

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
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing campaign id parameter.' },
        { status: 400 }
      );
    }

    const campaign = await getCampaign(token, id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    console.error('[API Campaigns/[id] GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching campaign details.' },
      { status: 500 }
    );
  }
}
