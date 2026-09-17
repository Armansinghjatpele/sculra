// ==============================================================================
// Sculra Project CI/CD Configuration & History API Route
// (frontend/app/api/projects/[id]/cicd/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getProjectCIConfig,
  updateProjectCIConfig,
  getCICDWebhookEvents,
  getCICDGateResults,
  getProject,
} from '@/services/db';

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

    const [config, events, gateResults] = await Promise.all([
      getProjectCIConfig(token, id),
      getCICDWebhookEvents(token, id, 30),
      getCICDGateResults(token, id, 30),
    ]);

    return NextResponse.json({
      success: true,
      config,
      events,
      gateResults,
    });
  } catch (err: any) {
    console.error('[API Project CI/CD GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching CI/CD settings.' },
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

    // If request asks to regenerate webhook secret
    if (body.regenerateSecret) {
      body.ciWebhookSecret = `sec_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      delete body.regenerateSecret;
    }

    const updated = await updateProjectCIConfig(token, id, body);

    return NextResponse.json({
      success: true,
      config: updated,
      message: 'Project CI/CD settings updated successfully.',
    });
  } catch (err: any) {
    console.error('[API Project CI/CD PATCH Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating CI/CD settings.' },
      { status: 500 }
    );
  }
}
