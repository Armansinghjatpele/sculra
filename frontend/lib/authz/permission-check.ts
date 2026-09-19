// ==============================================================================
// Sculra Permission Checkers & Route Guards (frontend/lib/authz/permission-check.ts)
// ==============================================================================

import { NextRequest } from 'next/server';
import { SculraRole } from './roles';
import { SculraPermission } from './permissions';
import { ROLE_PERMISSIONS, hasPermission } from './role-permissions';
import { AuthContext, getAuthContext } from './organization-access';
import { requireProjectAccess, VerifiedProjectAccess } from './project-access';
import { PermissionDeniedError } from './authorization-errors';

export { hasPermission };

/**
 * Asserts that the authenticated context holds the requested permission.
 * Throws structured PermissionDeniedError (403) if missing.
 */
export function requirePermission(ctx: AuthContext, permission: SculraPermission): void {
  if (!ctx.permissions.has(permission)) {
    throw new PermissionDeniedError(permission, ctx.role);
  }
}

/**
 * Asserts that the user's role is within the allowed set.
 */
export function requireRole(ctx: AuthContext, allowedRoles: SculraRole[]): void {
  if (!allowedRoles.includes(ctx.role)) {
    throw new PermissionDeniedError(
      `Requires one of: [${allowedRoles.join(', ')}]` as any,
      ctx.role
    );
  }
}

export interface VerifiedRoutePermission extends VerifiedProjectAccess {
  authContext: AuthContext;
}

/**
 * Unified guard for API route handlers operating on a specific project.
 * Concurrently evaluates:
 * 1. User authentication
 * 2. Workspace / Organization context
 * 3. Required permission for the target operation
 * 4. Project existence and multi-tenant access (IDOR defense)
 */
export async function requireProjectPermission(
  req: NextRequest,
  projectId: string,
  permission: SculraPermission
): Promise<VerifiedRoutePermission> {
  const authContext = await getAuthContext(req);
  requirePermission(authContext, permission);
  const { project } = await requireProjectAccess(authContext, projectId);

  return { authContext, project };
}
