// ==============================================================================
// Sculra Notification Subscriptions API (GET / POST)
// (frontend/app/api/notifications/subscriptions/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS } from '@/lib/authz';
import {
  getNotificationSubscriptions,
  createNotificationSubscription,
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

    const subscriptions = await getNotificationSubscriptions(
      authContext.clerkToken,
      orgId,
      projectId
    );

    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching subscriptions.' },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    if (!authContext.permissions.has(PERMISSIONS.NOTIFICATIONS_PREFERENCES_UPDATE)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to create subscription.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const created = await createNotificationSubscription(authContext.clerkToken, {
      ...body,
      clerk_user_id: authContext.userId,
      organization_id: body.organization_id || authContext.orgId,
    });

    return NextResponse.json({
      success: true,
      subscription: created,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed creating subscription.' },
      { status }
    );
  }
}
