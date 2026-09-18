// ==============================================================================
// Sculra Project Fix Agent Remediations & Policy API Route
// (frontend/app/api/projects/[id]/fixes/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getProject,
  getProjectFixPolicy,
  updateProjectFixPolicy,
  getProjectFixRemediations,
  createFixRemediation,
} from '@/services/db';
import { FixAgentMode } from '@/lib/demoData';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access. Sign in required.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Session token expired or missing.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const [policy, remediations] = await Promise.all([
      getProjectFixPolicy(token, id),
      getProjectFixRemediations(token, id, 30),
    ]);

    return NextResponse.json({
      success: true,
      project,
      policy,
      remediations,
    });
  } catch (err: any) {
    console.error('[API Project Fixes GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching fix agent records.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access. Sign in required.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Session token expired or missing.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { issueId, remediationAnalysisId } = body;
    let mode: FixAgentMode = body.mode || 'PLAN_ONLY';

    if (!issueId) {
      return NextResponse.json(
        { success: false, error: 'issueId is required to initiate remediation.' },
        { status: 400 }
      );
    }

    const policy = await getProjectFixPolicy(token, id);
    if (policy && !policy.fixAgentEnabled && mode !== 'PLAN_ONLY') {
      return NextResponse.json(
        {
          success: false,
          error: `Fix agent is disabled for this project. Only PLAN_ONLY is permitted.`,
        },
        { status: 403 }
      );
    }

    const remediation = await createFixRemediation(token, {
      projectId: id,
      issueId,
      remediationAnalysisId,
      mode,
    });

    return NextResponse.json({
      success: true,
      remediation,
      message: `Fix remediation initiated in ${mode} mode.`,
    });
  } catch (err: any) {
    console.error('[API Project Fixes POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed creating fix remediation.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access. Sign in required.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Session token expired or missing.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const updatedPolicy = await updateProjectFixPolicy(token, id, body);

    return NextResponse.json({
      success: true,
      policy: updatedPolicy,
      message: 'Project Fix Agent policy updated successfully.',
    });
  } catch (err: any) {
    console.error('[API Project Fixes PATCH Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating fix agent policy.' },
      { status: 500 }
    );
  }
}
