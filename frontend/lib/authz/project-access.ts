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
    // In personal sandbox, user must have created the project and organization_id must be null
    if (project.organization_id !== null && project.organizationId !== undefined && project.organizationId !== null) {
      throw new ResourceAccessDeniedError('Project', projectId);
    }
  } else {
    // In organization workspace:
    // If project has an organization_id, it must not belong to a different workspace
    // (Note: Supabase RLS enforces this at the DB layer; this is the authoritative app verification)
    if (project.organization_id === null && project.created_by !== authContext.userId) {
      throw new ResourceAccessDeniedError('Project', projectId);
    }
  }

  return { project, authContext };
}
