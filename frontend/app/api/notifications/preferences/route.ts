// ==============================================================================
// Sculra Notification Preferences API (GET / PATCH)
// (frontend/app/api/notifications/preferences/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS } from '@/lib/authz';
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from '@/services/db';

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    if (!authContext.permissions.has(PERMISSIONS.NOTIFICATIONS_READ)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId') || authContext.orgId || undefined;
    const projectId = searchParams.get('projectId') || undefined;

    const preferences = await getNotificationPreferences(
      authContext.clerkToken,
      orgId,
      projectId
    );

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching preferences.' },
      { status }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    if (!authContext.permissions.has(PERMISSIONS.NOTIFICATIONS_PREFERENCES_UPDATE)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to update preferences.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updated = await updateNotificationPreference(authContext.clerkToken, {
      ...body,
      clerk_user_id: authContext.userId,
      organization_id: body.organization_id || authContext.orgId,
    });

    return NextResponse.json({
      success: true,
      preference: updated,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating preference.' },
      { status }
    );
  }
}
