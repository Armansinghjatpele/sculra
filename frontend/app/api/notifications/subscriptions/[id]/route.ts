// ==============================================================================
// Sculra Notification Subscription Item API (DELETE)
// (frontend/app/api/notifications/subscriptions/[id]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS } from '@/lib/authz';
import { deleteNotificationSubscription } from '@/services/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    const { id } = await params;

    if (!authContext.permissions.has(PERMISSIONS.NOTIFICATIONS_PREFERENCES_UPDATE)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to delete subscription.' },
        { status: 403 }
      );
    }

    const success = await deleteNotificationSubscription(authContext.clerkToken, id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found or delete failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription removed.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed deleting subscription.' },
      { status }
    );
  }
}
