// ==============================================================================
// Sculra Centralized Server-Side Authorization Layer (frontend/lib/auth.ts)
// ==============================================================================
// Exposes robust, reusable server-side authorization checks and helpers.
// Integrates with Clerk session context and organization roles.
// Throws custom typed errors (401/403 exceptions) on authorization failures.

import { auth, currentUser } from '@clerk/nextjs/server';
import { AuthError, PermissionError } from '../../shared/utils/errors';

export type SculraRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'QA' | 'VIEWER';

/**
 * Assures user session is active.
 * Throws typed AuthError (401) if user is unauthenticated.
 */
export async function requireUser() {
  const { userId } = await auth();

  if (!userId) {
    throw new AuthError('Authentication required. Plese sign in to access this resource.', 'UNAUTHENTICATED');
  }

  const user = await currentUser();
  return { userId, user };
}

/**
 * Assures an active organization is selected.
 * Throws PermissionError (403) if no organization context is active.
 */
export async function requireOrganization() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    throw new AuthError('Authentication required.', 'UNAUTHENTICATED');
  }

  if (!orgId) {
    throw new PermissionError('Please select or create an organization to access this workspace.');
  }

  return { userId, orgId, orgRole };
}

/**
 * Assures active user has one of the requested application roles inside the organization.
 */
export async function requireRole(allowedRoles: SculraRole[]) {
  const { orgRole } = await requireOrganization();

  // Clerk maps roles as: 'org:admin' (Admin/Owner), 'org:member' (Member)
  // We align these to application-level roles
  const mappedRole = mapClerkRoleToSculra(orgRole);

  if (!mappedRole || !allowedRoles.includes(mappedRole)) {
    throw new PermissionError(`Unauthorized access: Requires one of these roles: [${allowedRoles.join(', ')}]`);
  }

  return { orgRole, mappedRole };
}

/**
 * central helper to check role permissions
 */
export function hasPermission(userRole: string | undefined, allowedRoles: SculraRole[]): boolean {
  const mapped = mapClerkRoleToSculra(userRole);
  return mapped ? allowedRoles.includes(mapped) : false;
}

/**
 * central helper mapping Clerk role strings to Sculra roles
 */
export function mapClerkRoleToSculra(clerkRole: string | null | undefined): SculraRole | null {
  if (!clerkRole) return null;
  // Standard Clerk roles mapping:
  if (clerkRole === 'org:admin' || clerkRole === 'admin' || clerkRole === 'owner') return 'ADMIN';
  if (clerkRole === 'org:member' || clerkRole === 'member') return 'DEVELOPER';
  if (clerkRole === 'qa_engineer' || clerkRole === 'qa') return 'QA';
  if (clerkRole === 'viewer') return 'VIEWER';
  
  // Default fallback if custom role configuration matches
  return 'VIEWER';
}

// Role-specific helpers for use in server components / API handlers
export async function isOwner() {
  const { orgRole } = await requireOrganization();
  return orgRole === 'org:admin'; // Defaulting owner as admin in Clerk
}

export async function isAdmin() {
  const { orgRole } = await requireOrganization();
  return orgRole === 'org:admin';
}

export async function isDeveloper() {
  const { orgRole } = await requireOrganization();
  return orgRole === 'org:member';
}

export async function isQA() {
  const { orgRole } = await requireOrganization();
  return mapClerkRoleToSculra(orgRole) === 'QA';
}

export async function isViewer() {
  const { orgRole } = await requireOrganization();
  return mapClerkRoleToSculra(orgRole) === 'VIEWER';
}
