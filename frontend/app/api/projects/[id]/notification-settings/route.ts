// ==============================================================================
// Sculra Project Notification Settings API (GET / PATCH)
// (frontend/app/api/projects/[id]/notification-settings/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  getDeliveryHealth,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.NOTIFICATIONS_READ);

    const preferences = await getNotificationPreferences(
      authContext.clerkToken,
      authContext.orgId || undefined,
      id
    );

    const deliveryHealth = await getDeliveryHealth(
      authContext.clerkToken,
      authContext.orgId || undefined
    );

    return NextResponse.json({
      success: true,
      preferences,
      deliveryHealth,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching project settings.', code: err.code },
      { status: statusCode }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.NOTIFICATIONS_PREFERENCES_UPDATE);

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

    const updated = await updateNotificationPreference(authContext.clerkToken, {
      ...body,
      project_id: id,
      clerk_user_id: authContext.userId,
      organization_id: authContext.orgId,
    });

    return NextResponse.json({
      success: true,
      preference: updated,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating project settings.', code: err.code },
      { status: statusCode }
    );
  }
}
