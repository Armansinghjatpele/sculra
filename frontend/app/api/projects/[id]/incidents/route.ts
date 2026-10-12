// ==============================================================================
// Sculra Project Incidents API (GET)
// (frontend/app/api/projects/[id]/incidents/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getProjectIncidents } from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.INCIDENTS_READ);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const severity = searchParams.get('severity') || undefined;

    const incidents = await getProjectIncidents(authContext.clerkToken, id, {
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
      { success: false, error: err.message || 'Failed fetching incidents.', code: err.code },
      { status: statusCode }
    );
  }
}
