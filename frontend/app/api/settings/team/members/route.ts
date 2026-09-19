// ==============================================================================
// Sculra Team Members Collection API Route (GET)
// (frontend/app/api/settings/team/members/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requirePermission, PERMISSIONS } from '@/lib/authz';
import { getOrganizationMembers } from '@/services/db';

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.MEMBERS_READ);

    const members = await getOrganizationMembers(authContext.clerkToken, authContext.orgId);

    return NextResponse.json({
      success: true,
      orgId: authContext.orgId,
      members,
      count: members.length,
      callerRole: authContext.role,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching team members', code: err.code },
      { status }
    );
  }
}
