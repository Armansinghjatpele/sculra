import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCampaignTasks } from '@/services/db';

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
    const tasks = await getCampaignTasks(token, id);

    return NextResponse.json({ success: true, tasks });
  } catch (err: any) {
    console.error('[API Campaigns/[id]/tasks GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching campaign tasks.' },
      { status: 500 }
    );
  }
}
