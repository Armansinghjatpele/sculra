// ==============================================================================
// Sculra Team Member Invitation API Route (POST)
// (frontend/app/api/settings/team/members/invite/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthContext,
  requirePermission,
  PERMISSIONS,
  SculraRole,
  ROLE_RANKS,
} from '@/lib/authz';
import { inviteOrganizationMember } from '@/services/db';

export async function POST(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.MEMBERS_INVITE);

    const body = await req.json().catch(() => ({}));
    const { email, role } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    const requestedRole = (role?.toUpperCase() || 'DEVELOPER') as SculraRole;

    // Caller cannot invite a member with role higher than their own
    if (ROLE_RANKS[requestedRole] > ROLE_RANKS[authContext.role]) {
      return NextResponse.json(
        {
          success: false,
          error: `Your role (${authContext.role}) cannot invite members with higher role (${requestedRole}).`,
        },
        { status: 403 }
      );
    }

    // Only OWNER can invite another OWNER
    if (requestedRole === 'OWNER' && authContext.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Only Owners can invite new Owners.' },
        { status: 403 }
      );
    }

    const member = await inviteOrganizationMember(
      authContext.clerkToken,
      authContext.orgId || 'org_demo_1',
      email,
      requestedRole,
      authContext.userId
    );

    return NextResponse.json({
      success: true,
      member,
      message: `Invitation sent to ${email} as ${requestedRole}.`,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed inviting member', code: err.code },
      { status }
    );
  }
}
