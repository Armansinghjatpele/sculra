// ==============================================================================
// Sculra Project Releases Collection API (GET / POST)
// (frontend/app/api/projects/[id]/releases/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import {
  getProjectReleases,
  createProjectRelease,
  getProjectEnvironment,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.RELEASES_READ);

    const releases = await getProjectReleases(authContext.clerkToken, id);

    return NextResponse.json({
      success: true,
      projectId: id,
      releases,
      count: releases.length,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching releases.', code: err.code },
      { status }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.RELEASES_CREATE);

    const body = await req.json();
    const { version, environmentId, deploymentId, commitSha, branch, targetDate, previousReleaseId, metadata } = body;

    if (!version || !environmentId || !commitSha) {
      return NextResponse.json(
        { success: false, error: 'version, environmentId, and commitSha are required.' },
        { status: 400 }
      );
    }

    const env = await getProjectEnvironment(authContext.clerkToken, id, environmentId);
    if (!env) {
      return NextResponse.json(
        { success: false, error: 'Target environment not found for this project.' },
        { status: 404 }
      );
    }

    const created = await createProjectRelease(authContext.clerkToken, {
      projectId: id,
      organizationId: authContext.orgId || '',
      environmentId,
      deploymentId: deploymentId || undefined,
      version: version.trim(),
      commitSha: commitSha.trim(),
      branch: branch?.trim() || undefined,
      status: 'CANDIDATE',
      targetDate: targetDate || undefined,
      previousReleaseId: previousReleaseId || undefined,
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      release: created,
    }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed creating release.', code: err.code },
      { status }
    );
  }
}
