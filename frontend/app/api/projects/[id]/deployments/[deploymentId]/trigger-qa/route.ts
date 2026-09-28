// ==============================================================================
// Sculra Deployment Trigger QA API Route (POST)
// (frontend/app/api/projects/[id]/deployments/[deploymentId]/trigger-qa/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject } from '@/services/db';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { buildDeploymentSnapshot } from '../../../../../../../../worker/src/release/deployment-snapshot';
import { buildDeploymentEvent } from '../../../../../../../../worker/src/release/deployment-event';
import { CDOrchestrator } from '../../../../../../../../worker/src/release/cd-orchestrator';

export async function POST(
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

    // Fetch deployment record
    const { data: deployment } = await supabase
      .from('deployments')
      .select('*, project_environments(*)')
      .eq('project_id', id)
      .eq('id', deploymentId)
      .maybeSingle();

    if (!deployment) {
      return NextResponse.json({ success: false, error: 'Deployment record not found.' }, { status: 404 });
    }

    const event = buildDeploymentEvent({
      projectId: id,
      orgId: project.organizationId || null,
      provider: deployment.provider || 'GENERIC',
      deploymentId: deployment.id,
      environmentId: deployment.environment_id,
      environmentName: deployment.project_environments?.name || null,
      environmentType: deployment.project_environments?.type || null,
      deploymentStatus: deployment.status === 'SUCCEEDED' ? 'READY' : deployment.status === 'RUNNING' ? 'DEPLOYING' : 'READY',
      commitSha: deployment.commit_sha,
      branch: deployment.branch,
      deploymentUrl: deployment.deployment_url,
      source: 'MANUAL',
    });

    const result = await CDOrchestrator.orchestrate({
      event,
      supabaseClient: supabase,
    });

    return NextResponse.json({
      success: true,
      eligibility: result.eligibility,
      campaignDecision: result.campaignDecision,
      gateDecision: result.gateDecision,
    });
  } catch (err: any) {
    console.error('[API Deployment Trigger QA Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
