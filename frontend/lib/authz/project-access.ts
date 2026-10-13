// ==============================================================================
// Sculra Project Resource Access & IDOR Verification (frontend/lib/authz/project-access.ts)
// ==============================================================================

import { AuthContext } from './organization-access';
import { ResourceAccessDeniedError } from './authorization-errors';
import { getProject } from '../../services/db';

export interface VerifiedProjectAccess {
  project: any;
  authContext: AuthContext;
}

/**
 * Assures the target project exists and belongs to the authenticated user's active workspace scope.
 * 
 * If the project belongs to another organization or does not exist, throws ResourceAccessDeniedError (404),
 * guaranteeing that attackers cannot probe resource existence across organizations (IDOR defense).
 */
export async function requireProjectAccess(
  authContext: AuthContext,
  projectId: string
): Promise<VerifiedProjectAccess> {
  if (!projectId) {
    throw new ResourceAccessDeniedError('Project');
  }

  const project = await getProject(authContext.clerkToken, projectId);

  if (!project) {
    throw new ResourceAccessDeniedError('Project', projectId);
  }

  // Multi-tenant boundary check:
  if (authContext.isPersonalWorkspace) {
    // In personal sandbox:
    // 1. Project must not belong to an organization
    const projOrg = project.organization_id ?? project.organizationId;
    if (projOrg !== null && projOrg !== undefined) {
      throw new ResourceAccessDeniedError('Project', projectId);
    }
    if (project.clerk_organization_id || project.clerkOrgId) {
      throw new ResourceAccessDeniedError('Project', projectId);
    }
    // 2. Project must have been created by the current user
    const creator = project.created_by ?? project.createdBy;
    if (creator && creator !== authContext.userId) {
      throw new ResourceAccessDeniedError('Project', projectId);
    }
  } else {
    // In organization workspace:
    const projOrg = project.organization_id ?? project.organizationId;
    if (projOrg === null || projOrg === undefined) {
      // Personal project accessed from organization context: only allowed if owned by user
      const creator = project.created_by ?? project.createdBy;
      if (creator !== authContext.userId) {
        throw new ResourceAccessDeniedError('Project', projectId);
      }
    } else {
      // Project belongs to an organization.
      // Compare like-for-like identifiers to avoid comparing unrelated identifiers (UUID vs Clerk org ID):
      const projectClerkOrg = project.clerk_organization_id ?? project.clerkOrgId;
      if (projectClerkOrg && authContext.orgId && projectClerkOrg !== authContext.orgId) {
        throw new ResourceAccessDeniedError('Project', projectId);
      }

      // If authContext includes an internal organization UUID, compare against internal organization_id
      const authInternalOrg = (authContext as any).organizationId ?? (authContext as any).internalOrgId;
      if (authInternalOrg && projOrg && authInternalOrg !== projOrg) {
        throw new ResourceAccessDeniedError('Project', projectId);
      }
    }
  }

  return { project, authContext };
}
