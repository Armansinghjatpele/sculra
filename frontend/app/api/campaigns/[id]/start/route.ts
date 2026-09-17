import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCampaign } from '@/services/db';
import { getSupabaseUserClient } from '@/lib/supabase';

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
    const campaign = await getCampaign(token, id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found or access denied.' },
        { status: 404 }
      );
    }

    if (campaign.status === 'RUNNING') {
      return NextResponse.json(
        { success: false, error: 'Campaign is already running.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseUserClient(token);
    const { error: updateError } = await supabase
      .from('qa_campaigns')
      .update({
        status: 'QUEUED',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.warn('[Supabase update campaign start]:', updateError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign execution queued successfully.',
    });
  } catch (err: any) {
    console.error('[API Campaigns/[id]/start POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed starting campaign execution.' },
      { status: 500 }
    );
  }
}
