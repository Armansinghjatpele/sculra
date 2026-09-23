// ==============================================================================
// Sculra Notification Mark All Read API (POST)
// (frontend/app/api/notifications/read-all/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS } from '@/lib/authz';
import { markAllNotificationsRead } from '@/services/db';

export async function POST(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    if (!authContext.permissions.has(PERMISSIONS.NOTIFICATIONS_READ)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to update notifications.' },
        { status: 403 }
      );
    }

    const success = await markAllNotificationsRead(authContext.clerkToken);

    return NextResponse.json({
      success,
      message: 'All unread notifications marked as read.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed marking all read.' },
      { status }
    );
  }
}
