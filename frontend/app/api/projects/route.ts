import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProjects, createProject, createProjectSource } from '@/services/db';
import { validateTestUrl } from '../../../../shared/utils/security';

export async function GET() {
  try {
    const { userId, orgId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized user access. Please sign in.' }, { status: 401 });
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Failed retrieving session token.' }, { status: 401 });
    }

    const projects = await getProjects(token, orgId);
    return NextResponse.json({ success: true, projects });
  } catch (err: any) {
    console.error('[API Projects GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed fetching projects.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized user access. Please sign in.' }, { status: 401 });
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Failed retrieving session token.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, type, url, repoUrl, environment, branch } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Project name is required.' }, { status: 400 });
    }

    const targetType = (type || 'website').toLowerCase();
    const validTypes = ['website', 'github', 'zip', 'desktop', 'api'];
    if (!validTypes.includes(targetType)) {
      return NextResponse.json({
        success: false,
        error: `Invalid project source type "${targetType}". Supported types: website, github, api.`,
      }, { status: 400 });
    }

    // SSRF & URL validation for website / API
    if (targetType === 'website' || targetType === 'api') {
      const targetUrl = typeof url === 'string' ? url.trim() : '';
      if (!targetUrl) {
        return NextResponse.json({ success: false, error: 'Target URL is required for website/api projects.' }, { status: 400 });
      }

      const urlValidation = validateTestUrl(targetUrl, {
        allowLocalhost: process.env.NODE_ENV === 'development',
      });

      if (!urlValidation.valid) {
        return NextResponse.json({
          success: false,
          error: `Invalid target URL: ${urlValidation.error}`,
        }, { status: 400 });
      }
    }

    // GitHub repository URL validation
    if (targetType === 'github') {
      const gitHubUrl = typeof (repoUrl || url) === 'string' ? (repoUrl || url).trim() : '';
      if (!gitHubUrl) {
        return NextResponse.json({ success: false, error: 'GitHub repository URL is required.' }, { status: 400 });
      }

      const gitHubRegex = /^(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git)$/;
      if (!gitHubRegex.test(gitHubUrl)) {
        return NextResponse.json({
          success: false,
          error: 'Must be a valid GitHub repository URL (e.g. https://github.com/company/project).',
        }, { status: 400 });
      }
    }

    const targetBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : undefined;
    const targetEnv = typeof environment === 'string' && environment.trim() ? environment.trim() : undefined;

    const project = await createProject(token, {
      name: name.trim(),
      type: targetType as any,
      url: targetType === 'website' || targetType === 'api' ? url?.trim() : undefined,
      repoUrl: targetType === 'github' ? (repoUrl || url)?.trim() : undefined,
      clerkOrgId: orgId,
      clerkUserId: userId,
      environment: targetEnv,
      branch: targetBranch,
    });

    // Also register the project source record with honest status
    try {
      await createProjectSource(token, {
        projectId: project.id,
        type: targetType.toUpperCase() as any,
        locator: targetType === 'github' ? (repoUrl || url)?.trim() : url?.trim(),
        branch: targetBranch,
        environment: targetEnv,
        status: targetType === 'website' || targetType === 'api' ? 'AVAILABLE' : 'CONFIGURED',
      });
    } catch (srcErr) {
      console.warn('[ProjectSource registration warning]:', srcErr);
    }

    return NextResponse.json({
      success: true,
      project,
    }, { status: 201 });

  } catch (err: any) {
    console.error('[API Projects POST Error]:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal error creating project.',
    }, { status: 500 });
  }
}
