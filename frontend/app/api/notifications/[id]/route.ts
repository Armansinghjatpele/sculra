// ==============================================================================
// Sculra Notification Item API (PATCH Mark Read)
// (frontend/app/api/notifications/[id]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS } from '@/lib/authz';
import { markNotificationRead } from '@/services/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    const { id } = await params;

    if (!authContext.permissions.has(PERMISSIONS.NOTIFICATIONS_READ)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to update notification.' },
        { status: 403 }
      );
    }

    const success = await markNotificationRead(authContext.clerkToken, id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Notification not found or update failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating notification.' },
      { status }
    );
  }
}
