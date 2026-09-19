// ==============================================================================
// Sculra Structured Authorization Errors (frontend/lib/authz/authorization-errors.ts)
// ==============================================================================

import { SculraRole } from './roles';
import { SculraPermission } from './permissions';

export class AuthorizationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(message: string, code = 'AUTHORIZATION_ERROR', statusCode = 403, details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthenticatedError extends AuthorizationError {
  constructor(message = 'Authentication required. Please sign in to access this workspace.') {
    super(message, 'UNAUTHENTICATED', 401);
  }
}

export class ForbiddenError extends AuthorizationError {
  constructor(message = 'Access denied: Insufficient privileges for this action.') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class OrgAccessDeniedError extends AuthorizationError {
  constructor(message = 'You do not have an active membership in this organization.') {
    super(message, 'ORG_ACCESS_DENIED', 403);
  }
}

/**
 * Thrown when a resource does not exist or does not belong to the user's active organization.
 * Returns HTTP 404 to strictly prevent leaking resource existence across tenant boundaries (IDOR defense).
 */
export class ResourceAccessDeniedError extends AuthorizationError {
  constructor(resourceType = 'Resource', resourceId?: string) {
    const msg = resourceId 
      ? `${resourceType} not found or access denied.`
      : `${resourceType} not found or access denied.`;
    super(msg, 'RESOURCE_ACCESS_DENIED', 404, { resourceType, resourceId });
  }
}

export class PermissionDeniedError extends AuthorizationError {
  public readonly permission: SculraPermission;
  public readonly userRole?: SculraRole;

  constructor(permission: SculraPermission, userRole?: SculraRole, message?: string) {
    const defaultMsg = userRole
      ? `Action blocked because your role (${userRole}) does not include "${permission}".`
      : `Action blocked: Missing required permission "${permission}".`;
    super(message || defaultMsg, 'PERMISSION_DENIED', 403, { permission, userRole });
    this.permission = permission;
    this.userRole = userRole;
  }
}

export class RoleNotAllowedError extends AuthorizationError {
  constructor(message = 'Role operation not permitted by system policy.') {
    super(message, 'ROLE_NOT_ALLOWED', 403);
  }
}

export class OwnerSafetyError extends AuthorizationError {
  constructor(message = 'Action prohibited by organization owner safety policy.') {
    super(message, 'OWNER_SAFETY_VIOLATION', 400);
  }
}
