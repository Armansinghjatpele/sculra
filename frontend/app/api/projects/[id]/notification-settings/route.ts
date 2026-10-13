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

    const ALLOWED_FIELDS = new Set([
      'channel',
      'frequency',
      'min_severity',
      'enabled',
      'email_enabled',
      'event_type',
    ]);

    const keys = Object.keys(body);
    for (const key of keys) {
      if (!ALLOWED_FIELDS.has(key)) {
        return NextResponse.json(
          { success: false, error: `Invalid field in notification settings: "${key}".` },
          { status: 400 }
        );
      }
    }

    if (keys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No notification preference fields provided to update.' },
        { status: 400 }
      );
    }

    if (body.channel !== undefined && !['IN_APP', 'EMAIL', 'WEBHOOK'].includes(body.channel)) {
      return NextResponse.json(
        { success: false, error: 'Invalid channel. Must be IN_APP, EMAIL, or WEBHOOK.' },
        { status: 400 }
      );
    }

    if (
      body.frequency !== undefined &&
      !['IMMEDIATE', 'HOURLY_DIGEST', 'DAILY_DIGEST', 'NEVER'].includes(body.frequency)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid frequency. Must be IMMEDIATE, HOURLY_DIGEST, DAILY_DIGEST, or NEVER.' },
        { status: 400 }
      );
    }

    if (
      body.min_severity !== undefined &&
      !['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(body.min_severity)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid min_severity. Must be INFO, LOW, MEDIUM, HIGH, or CRITICAL.' },
        { status: 400 }
      );
    }

    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Field "enabled" must be a boolean.' },
        { status: 400 }
      );
    }

    if (body.email_enabled !== undefined && typeof body.email_enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Field "email_enabled" must be a boolean.' },
        { status: 400 }
      );
    }

    if (body.event_type !== undefined && body.event_type !== null && typeof body.event_type !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Field "event_type" must be a string or null.' },
        { status: 400 }
      );
    }

    const sanitizedUpdate: Record<string, any> = {
      project_id: id,
      clerk_user_id: authContext.userId,
      organization_id: authContext.orgId,
    };
    if (body.channel !== undefined) sanitizedUpdate.channel = body.channel;
    if (body.frequency !== undefined) sanitizedUpdate.frequency = body.frequency;
    if (body.min_severity !== undefined) sanitizedUpdate.min_severity = body.min_severity;
    if (body.enabled !== undefined) sanitizedUpdate.enabled = body.enabled;
    if (body.email_enabled !== undefined) sanitizedUpdate.email_enabled = body.email_enabled;
    if (body.event_type !== undefined) sanitizedUpdate.event_type = body.event_type;

    const updated = await updateNotificationPreference(authContext.clerkToken, sanitizedUpdate as any);

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
