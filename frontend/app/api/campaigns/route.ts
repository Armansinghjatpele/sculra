import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject, createCampaign, getProjectCampaigns } from '@/services/db';
import { validateTestUrl } from '../../../../shared/utils/security';

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const { projectId, name, objective, enabledDomains, budget, adaptiveInsertion, minReleaseScoreThreshold, targetUrl: explicitUrl, targetRole } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter "projectId".' },
        { status: 400 }
      );
    }

    const project = await getProject(token, projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied in this workspace scope.' },
        { status: 404 }
      );
    }

    const targetUrl = explicitUrl || project.url;
    if (!targetUrl) {
      return NextResponse.json(
        { success: false, error: 'Project does not have a configured target website URL.' },
        { status: 400 }
      );
    }

    const urlValidation = validateTestUrl(targetUrl);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { success: false, error: `Invalid target URL: ${urlValidation.error}` },
        { status: 400 }
      );
    }

    const campaignConfig = {
      name: name || `${project.name} — Autonomous QA Campaign`,
      objective: objective || 'RELEASE_GATE',
      enabledDomains: enabledDomains || [
        'discovery',
        'product',
        'strategy',
        'journey',
        'visual',
        'auth',
        'api',
        'security',
        'performance',
        'accessibility',
        'historical',
        'release',
      ],
      targetUrl,
      targetRole,
      budget: {
        maxDurationSeconds: budget?.maxDurationSeconds ? Math.min(1800, Math.max(30, Number(budget.maxDurationSeconds))) : 600,
        maxTasks: budget?.maxTasks ? Math.min(100, Math.max(1, Number(budget.maxTasks))) : 25,
        maxParallelStages: budget?.maxParallelStages ? Math.min(4, Math.max(1, Number(budget.maxParallelStages))) : 2,
        maxRetriesPerTask: budget?.maxRetriesPerTask ? Math.min(3, Math.max(0, Number(budget.maxRetriesPerTask))) : 1,
      },
      adaptiveInsertion: adaptiveInsertion !== false,
      minReleaseScoreThreshold: minReleaseScoreThreshold !== undefined ? Number(minReleaseScoreThreshold) : 80,
      environment: project.environment || 'Staging',
      branch: project.branch || 'main',
    };

    const campaign = await createCampaign(token, projectId, campaignConfig);

    return NextResponse.json(
      {
        success: true,
        campaign,
        message: 'Autonomous QA campaign initialized successfully.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API Campaigns POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while initializing campaign.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter "projectId".' },
        { status: 400 }
      );
    }

    const campaigns = await getProjectCampaigns(token, projectId);
    return NextResponse.json({ success: true, campaigns });
  } catch (err: any) {
    console.error('[API Campaigns GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching QA campaigns.' },
      { status: 500 }
    );
  }
}
