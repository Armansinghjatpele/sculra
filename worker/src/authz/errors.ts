// ==============================================================================
// Sculra Worker Authorization Errors (worker/src/authz/errors.ts)
// ==============================================================================

import { SculraPermission } from './permissions';
import { SculraRole } from './types';

export class WorkerAuthorizationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'WORKER_AUTH_ERROR', statusCode = 403) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WorkerPermissionDeniedError extends WorkerAuthorizationError {
  public readonly permission: SculraPermission;
  public readonly role?: SculraRole;

  constructor(permission: SculraPermission, role?: SculraRole, message?: string) {
    const msg = message || `Worker permission denied for action "${permission}" (role: ${role || 'UNKNOWN'})`;
    super(msg, 'PERMISSION_DENIED', 403);
    this.permission = permission;
    this.role = role;
  }
}

export class WorkerServiceImpersonationError extends WorkerAuthorizationError {
  constructor(message = 'Security violation: Background worker cannot impersonate arbitrary user identities.') {
    super(message, 'SERVICE_IMPERSONATION_FORBIDDEN', 403);
  }
}
