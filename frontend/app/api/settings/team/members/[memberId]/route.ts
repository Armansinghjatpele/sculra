// ==============================================================================
// Sculra Team Member Mutation API Route (PATCH / DELETE)
// (frontend/app/api/settings/team/members/[memberId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthContext,
  requirePermission,
  PERMISSIONS,
  SculraRole,
} from '@/lib/authz';
import { updateOrganizationMemberRole, removeOrganizationMember } from '@/services/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.MEMBERS_CHANGE_ROLE);

    if (!authContext.orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization context required' },
        { status: 400 }
      );
    }

    const { memberId } = await params;
    const body = await req.json().catch(() => ({}));
    const { role } = body;

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'New role must be specified.' },
        { status: 400 }
      );
    }

    const newRole = role.toUpperCase() as SculraRole;

    const updated = await updateOrganizationMemberRole(
      authContext.clerkToken,
      authContext.orgId,
      memberId,
      newRole,
      authContext.role,
      authContext.userId
    );

    return NextResponse.json({
      success: true,
      member: updated,
      message: `Member role successfully updated to ${newRole}.`,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating member role', code: err.code },
      { status }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.MEMBERS_REMOVE);

    if (!authContext.orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization context required' },
        { status: 400 }
      );
    }

    const { memberId } = await params;

    const result = await removeOrganizationMember(
      authContext.clerkToken,
      authContext.orgId,
      memberId,
      authContext.role,
      authContext.userId
    );

    return NextResponse.json({
      success: true,
      memberId: result.memberId,
      message: 'Member removed from organization.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed removing member', code: err.code },
      { status }
    );
  }
}
