// ==============================================================================
// Sculra Worker Service Identity & Tenant Scoping (worker/src/authz/service-identity.ts)
// ==============================================================================

import { WorkerServiceIdentity } from './types';
import { WorkerServiceImpersonationError, WorkerAuthorizationError } from './errors';

export class ServiceIdentityManager {
  /**
   * Asserts that a background worker execution identity is strictly scoped to its job
   * and does not attempt to impersonate arbitrary human user accounts.
   */
  public static validateWorkerJobScope(
    identity: WorkerServiceIdentity,
    targetOrgId: string,
    targetProjectId: string
  ): void {
    if (!identity || identity.actorType !== 'WORKER_ACTOR') {
      throw new WorkerAuthorizationError('Invalid or missing service identity context.');
    }

    if (identity.organizationId !== targetOrgId) {
      throw new WorkerAuthorizationError(
        `Cross-organization violation: Worker scoped to org "${identity.organizationId}" attempted accessing org "${targetOrgId}".`
      );
    }

    if (identity.projectId !== targetProjectId) {
      throw new WorkerAuthorizationError(
        `Cross-project violation: Worker scoped to project "${identity.projectId}" attempted accessing project "${targetProjectId}".`
      );
    }
  }

  /**
   * Prevents workers from spoofing human user identities.
   */
  public static assertNoUserImpersonation(identity: WorkerServiceIdentity, targetUserId?: string): void {
    if (targetUserId && targetUserId !== 'SYSTEM_SERVICE_ACTOR' && targetUserId !== 'WORKER_DAEMON') {
      throw new WorkerServiceImpersonationError();
    }
  }
}
