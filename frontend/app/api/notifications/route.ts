// ==============================================================================
// Sculra Notifications API (GET)
// (frontend/app/api/notifications/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS } from '@/lib/authz';
import { getNotifications } from '@/services/db';

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    if (!authContext.permissions.has(PERMISSIONS.NOTIFICATIONS_READ)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to view notifications.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId') || authContext.orgId || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const readParam = searchParams.get('read');
    const read = readParam !== null ? readParam === 'true' : undefined;

    const notifications = await getNotifications(authContext.clerkToken, {
      orgId,
      projectId,
      severity,
      read,
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
      unreadCount,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching notifications.' },
      { status }
    );
  }
}
