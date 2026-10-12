// ==============================================================================
// Sculra Project Incident Item API (GET / PATCH)
// (frontend/app/api/projects/[id]/incidents/[incidentId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import {
  getProjectIncidentById,
  updateIncidentStatus,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; incidentId: string }> }
) {
  try {
    const { id, incidentId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.INCIDENTS_READ);

    const incident = await getProjectIncidentById(
      authContext.clerkToken,
      id,
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
      { success: false, error: err.message || 'Failed fetching incident.', code: err.code },
      { status: statusCode }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; incidentId: string }> }
) {
  try {
    const { id, incidentId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.INCIDENTS_MANAGE);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Request body must be an object.' },
        { status: 400 }
      );
    }

    const { status, notes } = body;

    if (!status || !['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid incident status transition.' },
        { status: 400 }
      );
    }

    const existing = await getProjectIncidentById(authContext.clerkToken, id, incidentId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Incident not found.' },
        { status: 404 }
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
      { success: false, error: err.message || 'Failed updating incident.', code: err.code },
      { status: statusCode }
    );
  }
}
