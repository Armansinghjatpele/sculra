// ==============================================================================
// Sculra Worker Policy Manager (worker/src/authz/policy.ts)
// ==============================================================================

import { ROLE_RANKS } from './roles';
import { SculraRole } from './types';
import { WorkerAuthorizationError } from './errors';

export class WorkerPolicyManager {
  /**
   * Evaluates role changes under owner safety constraints.
   */
  public static evaluateRoleChange(params: {
    callerRole: SculraRole;
    targetCurrentRole: SculraRole;
    targetNewRole: SculraRole;
    activeOwnerCount: number;
    isSelf: boolean;
  }): void {
    const { callerRole, targetCurrentRole, targetNewRole, activeOwnerCount, isSelf } = params;

    // Only OWNER can manage OWNER role
    if (callerRole !== 'OWNER' && (targetCurrentRole === 'OWNER' || targetNewRole === 'OWNER')) {
      throw new WorkerAuthorizationError('Only Owners can assign or manage Owner roles.');
    }

    // Caller cannot assign higher role than their own
    if (ROLE_RANKS[targetNewRole] > ROLE_RANKS[callerRole]) {
      throw new WorkerAuthorizationError(
        `Caller role (${callerRole}) cannot assign higher role (${targetNewRole}).`
      );
    }

    // Sole owner cannot be demoted
    if (targetCurrentRole === 'OWNER' && targetNewRole !== 'OWNER' && activeOwnerCount <= 1) {
      throw new WorkerAuthorizationError('Cannot demote the sole organization owner.');
    }

    // Cannot change own role unless Owner transferring ownership
    if (isSelf && targetCurrentRole !== 'OWNER') {
      throw new WorkerAuthorizationError('Cannot change your own role.');
    }
  }

  /**
   * Evaluates member removal under owner safety constraints.
   */
  public static evaluateMemberRemoval(params: {
    callerRole: SculraRole;
    targetRole: SculraRole;
    activeOwnerCount: number;
    isSelf: boolean;
  }): void {
    const { callerRole, targetRole, activeOwnerCount, isSelf } = params;

    if (targetRole === 'OWNER') {
      if (activeOwnerCount <= 1) {
        throw new WorkerAuthorizationError('Cannot remove the sole organization owner.');
      }
      if (callerRole !== 'OWNER') {
        throw new WorkerAuthorizationError('Non-owners cannot remove an organization owner.');
      }
    }

    if (callerRole === 'ADMIN' && targetRole === 'ADMIN' && !isSelf) {
      throw new WorkerAuthorizationError('Admins cannot remove other Admins.');
    }

    if (ROLE_RANKS[callerRole] < ROLE_RANKS[targetRole]) {
      throw new WorkerAuthorizationError(`Cannot remove member with higher role (${targetRole}).`);
    }
  }

  /**
   * Evaluates environment configuration constraints.
   */
  public static evaluateEnvironmentMutation(params: {
    callerRole: SculraRole;
    isProduction: boolean;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
  }): void {
    if (params.isProduction && params.callerRole !== 'OWNER' && params.callerRole !== 'ADMIN') {
      throw new WorkerAuthorizationError(
        'Only organization Owners and Admins can configure or delete Production environments.'
      );
    }
  }

  /**
   * Evaluates release decision constraints.
   */
  public static evaluateReleaseDecision(params: {
    callerRole: SculraRole;
    decision: 'APPROVE' | 'BLOCK' | 'REQUEST_RETEST';
    releaseStatus: string;
  }): void {
    if (params.callerRole === 'VIEWER') {
      throw new WorkerAuthorizationError('Viewers are not permitted to record release decisions.');
    }
    if (params.releaseStatus === 'RELEASED') {
      throw new WorkerAuthorizationError('Cannot alter decision for an already released version.');
    }
    if (params.releaseStatus === 'ABANDONED') {
      throw new WorkerAuthorizationError('Cannot alter decision for an abandoned release candidate.');
    }
  }
}

export const PolicyManager = WorkerPolicyManager;
export const RoleNotAllowedError = WorkerAuthorizationError;
