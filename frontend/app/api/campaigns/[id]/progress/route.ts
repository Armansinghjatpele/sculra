import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCampaign, getCampaignTasks } from '@/services/db';

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
    const campaign = await getCampaign(token, id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found or access denied.' },
        { status: 404 }
      );
    }

    const tasks = await getCampaignTasks(token, id);

    return NextResponse.json({
      success: true,
      campaignId: id,
      status: campaign.status,
      currentStage: campaign.currentStage,
      overallScore: campaign.overallScore,
      releaseVerdict: campaign.releaseVerdict,
      progress: campaign.progressSnapshot,
      budget: campaign.budgetStatus,
      tasksCount: tasks.length,
      tasksCompleted: tasks.filter((t) => t.status === 'COMPLETED').length,
      tasksRunning: tasks.filter((t) => t.status === 'RUNNING').length,
      tasksFailed: tasks.filter((t) => t.status === 'FAILED').length,
    });
  } catch (err: any) {
    console.error('[API Campaigns/[id]/progress GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching campaign progress.' },
      { status: 500 }
    );
  }
}
