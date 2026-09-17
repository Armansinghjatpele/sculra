import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cancelCampaign } from '@/services/db';

export async function POST(
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
    await cancelCampaign(token, id);

    return NextResponse.json({
      success: true,
      message: 'Campaign cancellation requested.',
    });
  } catch (err: any) {
    console.error('[API Campaigns/[id]/cancel POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed cancelling campaign.' },
      { status: 500 }
    );
  }
}
