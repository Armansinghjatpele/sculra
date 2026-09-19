import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requirePermission, PERMISSIONS } from '@/lib/authz';
import { cancelCampaign, getCampaign, getProject } from '@/services/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.CAMPAIGNS_CANCEL);

    const { id } = await params;
    const campaign = await getCampaign(authContext.clerkToken, id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found or access denied.' },
        { status: 404 }
      );
    }

    const project = await getProject(authContext.clerkToken, campaign.projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found or access denied.' },
        { status: 404 }
      );
    }

    await cancelCampaign(authContext.clerkToken, id);

    return NextResponse.json({
      success: true,
      message: 'Campaign cancellation requested.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed cancelling campaign.', code: err.code },
      { status }
    );
  }
}
