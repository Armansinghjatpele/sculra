// ==============================================================================
// Sculra Project Notification Settings API (GET / PATCH)
// (frontend/app/api/projects/[projectId]/notification-settings/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS } from '@/lib/authz';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  getDeliveryHealth,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    const { projectId } = await params;

    if (!authContext.permissions.has(PERMISSIONS.NOTIFICATIONS_READ)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied.' },
        { status: 403 }
      );
    }

    const preferences = await getNotificationPreferences(
      authContext.clerkToken,
      authContext.orgId || undefined,
      projectId
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
      { success: false, error: err.message || 'Failed fetching project settings.' },
      { status: statusCode }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    const { projectId } = await params;

    if (!authContext.permissions.has(PERMISSIONS.NOTIFICATIONS_PREFERENCES_UPDATE)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to update settings.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updated = await updateNotificationPreference(authContext.clerkToken, {
      ...body,
      project_id: projectId,
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
      { success: false, error: err.message || 'Failed updating project settings.' },
      { status: statusCode }
    );
  }
}
