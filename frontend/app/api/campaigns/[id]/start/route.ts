import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requirePermission, PERMISSIONS } from '@/lib/authz';
import { getCampaign, getProject } from '@/services/db';
import { getSupabaseUserClient } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.CAMPAIGNS_START);

    const { id } = await params;
    const campaign = await getCampaign(authContext.clerkToken, id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found or access denied.' },
        { status: 404 }
      );
    }

    // Verify project multi-tenant access (IDOR defense)
    const project = await getProject(authContext.clerkToken, campaign.projectId);
    if (!project) {
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

    const supabase = getSupabaseUserClient(authContext.clerkToken);
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
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed starting campaign execution.', code: err.code },
      { status }
    );
  }
}
