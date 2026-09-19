// ==============================================================================
// Sculra Organization Context & Identity Extraction (frontend/lib/authz/organization-access.ts)
// ==============================================================================

import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { SculraRole, MembershipStatus, ActorType, mapClerkRoleToSculra } from './roles';
import { SculraPermission } from './permissions';
import { ROLE_PERMISSIONS } from './role-permissions';
import { UnauthenticatedError, OrgAccessDeniedError } from './authorization-errors';

export interface AuthContext {
  actorType: ActorType;
  userId: string;
  orgId: string | null;
  orgRole: string | null;
  role: SculraRole;
  membershipStatus: MembershipStatus;
  permissions: ReadonlySet<SculraPermission>;
  clerkToken: string;
  isPersonalWorkspace: boolean;
}

/**
 * Extracts and verifies the current session identity and active workspace context.
 * Throws UnauthenticatedError (401) if not signed in.
 */
export async function getAuthContext(_req?: NextRequest): Promise<AuthContext> {
  const session = await auth();
  const { userId, orgId, orgRole, getToken } = session;

  if (!userId) {
    throw new UnauthenticatedError();
  }

  const clerkToken = (await getToken()) || '';

  // 1. Personal Workspace Context (no Clerk Organization selected)
  if (!orgId) {
    // In personal sandbox, user is the Owner of their personal resources
    return {
      actorType: 'HUMAN_ACTOR',
      userId,
      orgId: null,
      orgRole: null,
      role: 'OWNER',
      membershipStatus: 'ACTIVE',
      permissions: ROLE_PERMISSIONS['OWNER'],
      clerkToken,
      isPersonalWorkspace: true,
    };
  }

  // 2. Organization Workspace Context
  const mappedRole = mapClerkRoleToSculra(orgRole);
  const permissions = ROLE_PERMISSIONS[mappedRole];

  return {
    actorType: 'HUMAN_ACTOR',
    userId,
    orgId,
    orgRole: orgRole || null,
    role: mappedRole,
    membershipStatus: 'ACTIVE',
    permissions,
    clerkToken,
    isPersonalWorkspace: false,
  };
}

/**
 * Assures an active organization workspace is selected (not a personal workspace).
 * Throws OrgAccessDeniedError (403) if organization is missing.
 */
export function requireOrganizationMembership(ctx: AuthContext): void {
  if (ctx.isPersonalWorkspace || !ctx.orgId) {
    throw new OrgAccessDeniedError('This operation requires an active organization workspace.');
  }

  if (ctx.membershipStatus !== 'ACTIVE') {
    throw new OrgAccessDeniedError(`Access blocked: Membership status is "${ctx.membershipStatus}".`);
  }
}
