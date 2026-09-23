// ==============================================================================
// Sculra Project Incident Item API (GET / PATCH)
// (frontend/app/api/projects/[projectId]/incidents/[incidentId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS } from '@/lib/authz';
import {
  getProjectIncidentById,
  updateIncidentStatus,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; incidentId: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    const { projectId, incidentId } = await params;

    if (!authContext.permissions.has(PERMISSIONS.INCIDENTS_READ)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to view incident.' },
        { status: 403 }
      );
    }

    const incident = await getProjectIncidentById(
      authContext.clerkToken,
      projectId,
      incidentId
    );

    if (!incident) {
      return NextResponse.json(
        { success: false, error: 'Incident not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      incident,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching incident.' },
      { status: statusCode }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; incidentId: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    const { incidentId } = await params;

    if (!authContext.permissions.has(PERMISSIONS.INCIDENTS_MANAGE)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to update incident.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { status, notes } = body;

    if (!status || !['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid incident status transition.' },
        { status: 400 }
      );
    }

    const updated = await updateIncidentStatus(
      authContext.clerkToken,
      incidentId,
      status,
      notes,
      authContext.userId
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Incident update failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      incident: updated,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating incident.' },
      { status: statusCode }
    );
  }
}
