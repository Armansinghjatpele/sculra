// ==============================================================================
// Sculra Sensitive Action Policies & Owner Safety (frontend/lib/authz/policy.ts)
// ==============================================================================

import { SculraRole, ROLE_RANKS } from './roles';
import { OwnerSafetyError, RoleNotAllowedError } from './authorization-errors';

export type PolicyLevel = 'STANDARD' | 'SENSITIVE' | 'CRITICAL';

export interface OwnerSafetyContext {
  callerRole: SculraRole;
  targetCurrentRole: SculraRole;
  targetNewRole?: SculraRole;
  isSelfOperation: boolean;
  activeOwnerCount: number;
}

export class PolicyManager {
  /**
   * Enforces explicit owner safety rules on role modification.
   * - Organization must always retain at least 1 active owner.
   * - Caller cannot promote anyone (or themselves) above their own rank.
   * - Admins cannot assign OWNER role.
   * - Sole owner cannot downgrade their own role.
   */
  public static evaluateRoleChange(ctx: OwnerSafetyContext): void {
    const { callerRole, targetCurrentRole, targetNewRole, isSelfOperation, activeOwnerCount } = ctx;

    if (!targetNewRole) {
      throw new RoleNotAllowedError('Target role must be specified.');
    }

    // 1. Admins / non-owners cannot assign or manage OWNER role
    if (callerRole !== 'OWNER' && (targetCurrentRole === 'OWNER' || targetNewRole === 'OWNER')) {
      throw new RoleNotAllowedError('Only organization Owners can manage or assign the Owner role.');
    }

    // 2. Caller cannot assign a role higher than their own rank
    if (ROLE_RANKS[targetNewRole] > ROLE_RANKS[callerRole]) {
      throw new RoleNotAllowedError(
        `Your role (${callerRole}) does not have permission to assign higher role (${targetNewRole}).`
      );
    }

    // 3. Sole owner cannot be demoted
    if (targetCurrentRole === 'OWNER' && targetNewRole !== 'OWNER') {
      if (activeOwnerCount <= 1) {
        throw new OwnerSafetyError(
          'Cannot demote the sole organization owner. Transfer ownership or appoint another owner first.'
        );
      }
    }

    // 4. Users cannot modify their own role (except owner transferring ownership)
    if (isSelfOperation && targetCurrentRole !== 'OWNER') {
      throw new RoleNotAllowedError('Users cannot alter their own organizational role.');
    }
  }

  /**
   * Enforces explicit owner safety rules on member removal.
   * - Sole owner cannot be removed.
   * - Non-owners cannot remove owners.
   * - Admins cannot remove other Admins (unless Owner).
   */
  public static evaluateMemberRemoval(ctx: OwnerSafetyContext): void {
    const { callerRole, targetCurrentRole, isSelfOperation, activeOwnerCount } = ctx;

    // 1. Sole owner protection
    if (targetCurrentRole === 'OWNER') {
      if (activeOwnerCount <= 1) {
        throw new OwnerSafetyError(
          'Cannot remove the sole organization owner. Transfer ownership to another member before leaving.'
        );
      }
      if (callerRole !== 'OWNER') {
        throw new RoleNotAllowedError('Non-owners cannot remove an organization Owner.');
      }
    }

    // 2. Admins cannot remove Admins unless they are Owner
    if (callerRole === 'ADMIN' && targetCurrentRole === 'ADMIN' && !isSelfOperation) {
      throw new RoleNotAllowedError('Admins cannot remove other Admins. Request Owner assistance.');
    }

    // 3. Lower rank cannot remove higher rank
    if (ROLE_RANKS[callerRole] < ROLE_RANKS[targetCurrentRole]) {
      throw new RoleNotAllowedError(`Cannot remove member with higher rank (${targetCurrentRole}).`);
    }
  }

  /**
   * Evaluates Safe Fix Agent APPLY policy requirements.
   */
  public static evaluateFixAgentApply(params: {
    fixAgentEnabled: boolean;
    allowedBranches: string[];
    targetBranch: string;
    sourceSha: string;
    currentHeadSha?: string;
    requiresApproval: boolean;
    approvalStatus?: string;
    approvalExpiresAt?: string;
  }): { allowed: boolean; reason?: string } {
    if (!params.fixAgentEnabled) {
      return { allowed: false, reason: 'Fix Agent is disabled in project settings.' };
    }

    if (!params.allowedBranches.includes(params.targetBranch)) {
      return {
        allowed: false,
        reason: `Branch "${params.targetBranch}" is not in the project's allowed branches: [${params.allowedBranches.join(', ')}]`,
      };
    }

    if (params.currentHeadSha && params.sourceSha !== params.currentHeadSha) {
      return {
        allowed: false,
        reason: `Source SHA drift detected: Fix was generated against ${params.sourceSha.slice(0, 7)} but HEAD is ${params.currentHeadSha.slice(0, 7)}. Re-evaluation required.`,
      };
    }

    if (params.requiresApproval) {
      if (params.approvalStatus !== 'APPROVED') {
        return {
          allowed: false,
          reason: `Remediation requires cryptographic human approval (current status: ${params.approvalStatus || 'NONE'}).`,
        };
      }

      if (params.approvalExpiresAt && new Date(params.approvalExpiresAt).getTime() < Date.now()) {
        return {
          allowed: false,
          reason: 'Human approval has expired (24h window). Re-evaluation required.',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Evaluates Safe Fix Agent CREATE_PR policy requirements.
   */
  public static evaluateCreatePr(params: {
    verificationStatus: 'PASSED' | 'FAILED' | 'SKIPPED' | 'NOT_RUN' | 'ERROR' | string;
    allowedBranches: string[];
    targetBranch: string;
    sourceSha: string;
    currentHeadSha?: string;
  }): { allowed: boolean; reason?: string } {
    if (params.verificationStatus !== 'PASSED') {
      return {
        allowed: false,
        reason: `Pull request creation blocked: Verification status is "${params.verificationStatus}". Only verified fixes with passing tests may be published.`,
      };
    }

    if (!params.allowedBranches.includes(params.targetBranch)) {
      return {
        allowed: false,
        reason: `Branch "${params.targetBranch}" is not permitted for PR creation.`,
      };
    }

    if (params.currentHeadSha && params.sourceSha !== params.currentHeadSha) {
      return {
        allowed: false,
        reason: `Source SHA drift detected against repository HEAD. Fix must be re-verified.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Enforces role requirements on environment configuration.
   * Only OWNER or ADMIN can create, modify, or delete PRODUCTION environments.
   */
  public static evaluateEnvironmentMutation(params: {
    callerRole: SculraRole;
    isProduction: boolean;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
  }): void {
    if (params.isProduction && params.callerRole !== 'OWNER' && params.callerRole !== 'ADMIN') {
      throw new RoleNotAllowedError(
        `Only organization Owners and Admins can configure or delete Production environments.`
      );
    }
  }

  /**
   * Evaluates human release decision requirements.
   * Ensures caller has adequate rank to approve or block a release.
   */
  public static evaluateReleaseDecision(params: {
    callerRole: SculraRole;
    decision: 'APPROVE' | 'BLOCK' | 'REQUEST_RETEST';
    releaseStatus: string;
  }): void {
    if (params.callerRole === 'VIEWER') {
      throw new RoleNotAllowedError('Viewers are not permitted to record release decisions.');
    }
    if (params.releaseStatus === 'RELEASED') {
      throw new RoleNotAllowedError('Cannot alter decision for an already released version.');
    }
    if (params.releaseStatus === 'ABANDONED') {
      throw new RoleNotAllowedError('Cannot alter decision for an abandoned release candidate.');
    }
  }

  /**
   * Enforces role requirements on credential management.
   * Only OWNER or ADMIN can create, update, delete, or rotate credentials.
   * QA_LEAD can trigger validation.
   */
  public static evaluateCredentialMutation(params: {
    callerRole: SculraRole;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROTATE' | 'VALIDATE';
    isProductionScope?: boolean;
  }): void {
    if (params.action === 'VALIDATE') {
      if (params.callerRole === 'VIEWER' || params.callerRole === 'DEVELOPER') {
        throw new RoleNotAllowedError('Role does not have permission to trigger credential validation.');
      }
      return;
    }

    if (params.callerRole !== 'OWNER' && params.callerRole !== 'ADMIN') {
      throw new RoleNotAllowedError(
        `Only organization Owners and Admins can perform ${params.action} on credentials.`
      );
    }
  }

  /**
   * Evaluates credential usage/resolution permissions.
   */
  public static evaluateCredentialAccess(params: {
    callerRole: SculraRole;
    credentialScope: string;
    requestedScope: string;
    isProduction?: boolean;
  }): void {
    if (params.callerRole === 'VIEWER') {
      throw new RoleNotAllowedError('Viewers are not permitted to resolve or use credentials.');
    }

    if (params.isProduction && params.callerRole !== 'OWNER' && params.callerRole !== 'ADMIN' && params.callerRole !== 'QA_LEAD') {
      throw new RoleNotAllowedError(
        'Resolving credentials for Production environments requires QA_LEAD, ADMIN, or OWNER role.'
      );
    }

    if (params.credentialScope === 'ADMIN' && params.callerRole !== 'OWNER' && params.callerRole !== 'ADMIN') {
      throw new RoleNotAllowedError('ADMIN scoped credentials can only be resolved by Admins or Owners.');
    }

    if (params.credentialScope === 'READ_ONLY' && (params.requestedScope === 'READ_WRITE' || params.requestedScope === 'ADMIN')) {
      throw new RoleNotAllowedError('Credential has READ_ONLY scope and cannot be used for write operations.');
    }
  }
}
