import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject, createTestRun, getTestRuns } from '@/services/db';
import { validateTestUrl } from '../../../../shared/utils/security';

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, getToken } = await auth();

    // 1. Authenticate Clerk user
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
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter "projectId".' },
        { status: 400 }
      );
    }

    // 2. Verify project ownership & access via multi-tenant RLS query
    const project = await getProject(token, projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied in this workspace scope.' },
        { status: 404 }
      );
    }

    // 3. Verify project is testable
    if (project.type !== 'website') {
      return NextResponse.json(
        {
          success: false,
          error: `Project type "${project.type}" is not currently testable. Only website targets are supported.`,
        },
        { status: 400 }
      );
    }

    const targetUrl = project.url;
    if (!targetUrl) {
      return NextResponse.json(
        { success: false, error: 'Project does not have a configured target website URL.' },
        { status: 400 }
      );
    }

    // Validate URL against SSRF and protocol policies
    const urlValidation = validateTestUrl(targetUrl, {
      allowLocalhost: process.env.NODE_ENV === 'development',
    });

    if (!urlValidation.valid) {
      return NextResponse.json(
        { success: false, error: `Invalid project URL: ${urlValidation.error}` },
        { status: 400 }
      );
    }

    // 4. Duplicate Run Protection: Prevent rapid double-clicking / duplicate in-flight runs
    const existingRuns = await getTestRuns(token, orgId);
    const activeRun = existingRuns.find(
      (r) =>
        r.projectId === projectId &&
        (r.status === 'queued' || r.status === 'running')
    );

    if (activeRun) {
      return NextResponse.json(
        {
          success: true,
          testRunId: activeRun.id,
          message: 'An active test run is already queued or running for this project.',
        },
        { status: 200 }
      );
    }

    // 5. Create test_run record (Derived auth context: created_by and organization_id)
    const testRun = await createTestRun(token, {
      projectId,
      clerkUserId: userId,
      clerkOrgId: orgId,
      triggerType: 'manual',
    });

    // 6. Return test run ID immediately to client without blocking
    return NextResponse.json(
      {
        success: true,
        testRunId: testRun.id,
        status: testRun.status,
      },
      { status: 201 }
    );

  } catch (err: any) {
    console.error('[API /api/test-runs Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error creating test run' },
      { status: 500 }
    );
  }
}
