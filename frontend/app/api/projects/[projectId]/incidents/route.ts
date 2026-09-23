// ==============================================================================
// Sculra Project Incidents API (GET)
// (frontend/app/api/projects/[projectId]/incidents/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS } from '@/lib/authz';
import { getProjectIncidents } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    const { projectId } = await params;

    if (!authContext.permissions.has(PERMISSIONS.INCIDENTS_READ)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to view incidents.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const severity = searchParams.get('severity') || undefined;

    const incidents = await getProjectIncidents(authContext.clerkToken, projectId, {
      status,
      severity,
    });

    return NextResponse.json({
      success: true,
      incidents,
      count: incidents.length,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching incidents.' },
      { status: statusCode }
    );
  }
}
