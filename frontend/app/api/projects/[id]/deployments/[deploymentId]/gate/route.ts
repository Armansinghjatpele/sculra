// ==============================================================================
// Sculra Deployment Gate API Route (GET)
// (frontend/app/api/projects/[id]/deployments/[deploymentId]/gate/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject } from '@/services/db';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Session token expired.' }, { status: 401 });
    }

    const { id, deploymentId } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found.' }, { status: 404 });
    }

    const supabase = getSupabaseServiceClient();

    // 1. Fetch deployment record or snapshot
    const { data: snapshot } = await supabase
      .from('deployment_snapshots')
      .select('*')
      .eq('project_id', id)
      .eq('deployment_id', deploymentId)
      .maybeSingle();

    // 2. Fetch latest gate decision for deployment
    const { data: decision } = await supabase
      .from('release_gate_decisions')
      .select('*')
      .eq('project_id', id)
      .eq('deployment_id', deploymentId)
      .order('evaluated_at', { ascending: false })
      .maybeSingle();

    // 3. Fetch QA trigger decision
    const { data: triggerDecision } = await supabase
      .from('qa_trigger_decisions')
      .select('*')
      .eq('project_id', id)
      .eq('deployment_id', deploymentId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      projectId: id,
      deploymentId,
      snapshot: snapshot || null,
      decision: decision || null,
      triggerDecision: triggerDecision || null,
    });
  } catch (err: any) {
    console.error('[API Deployment Gate GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
