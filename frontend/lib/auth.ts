// ==============================================================================
// Sculra Centralized Server-Side Authorization Layer (frontend/lib/auth.ts)
// ==============================================================================
// Re-exports and delegates to the centralized authorization architecture (frontend/lib/authz)
// Preserves backward compatibility across server components and legacy callers.

import { auth, currentUser } from '@clerk/nextjs/server';
import { AuthError, PermissionError } from '../../shared/utils/errors';
import {
  SculraRole as CanonicalSculraRole,
  mapClerkRoleToSculra as canonicalMapRole,
  hasPermission as canonicalHasPermission,
  PERMISSIONS,
  SculraPermission,
} from './authz';

export * from './authz';

export type SculraRole = CanonicalSculraRole;

/**
 * Assures user session is active.
 * Throws typed AuthError (401) if user is unauthenticated.
 */
export async function requireUser() {
  const { userId } = await auth();

  if (!userId) {
    throw new AuthError('Authentication required. Please sign in to access this resource.', 'UNAUTHENTICATED');
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
  const mappedRole = mapClerkRoleToSculra(orgRole);

  if (!mappedRole || !allowedRoles.includes(mappedRole)) {
    throw new PermissionError(`Unauthorized access: Requires one of these roles: [${allowedRoles.join(', ')}]`);
  }

  return { orgRole, mappedRole };
}

/**
 * Helper to check role permissions (supports legacy array-of-roles check or single permission string check).
 */
export function hasPermission(
  userRole: string | undefined,
  allowedRolesOrPermission: SculraRole[] | SculraPermission
): boolean {
  if (!userRole) return false;
  const mapped = mapClerkRoleToSculra(userRole);
  if (!mapped) return false;

  if (Array.isArray(allowedRolesOrPermission)) {
    return allowedRolesOrPermission.includes(mapped);
  }

  // Permission string check
  return canonicalHasPermission(mapped, allowedRolesOrPermission);
}

/**
 * Maps Clerk role strings to Sculra roles with fallback.
 */
export function mapClerkRoleToSculra(clerkRole: string | null | undefined): SculraRole | null {
  if (!clerkRole) return null;
  return canonicalMapRole(clerkRole);
}

// Role-specific helpers for use in server components / API handlers
export async function isOwner(): Promise<boolean> {
  const { orgRole } = await requireOrganization();
  return mapClerkRoleToSculra(orgRole) === 'OWNER';
}

export async function isAdmin(): Promise<boolean> {
  const { orgRole } = await requireOrganization();
  const role = mapClerkRoleToSculra(orgRole);
  return role === 'ADMIN' || role === 'OWNER';
}

export async function isDeveloper(): Promise<boolean> {
  const { orgRole } = await requireOrganization();
  return mapClerkRoleToSculra(orgRole) === 'DEVELOPER';
}

export async function isQA(): Promise<boolean> {
  const { orgRole } = await requireOrganization();
  return mapClerkRoleToSculra(orgRole) === 'QA_LEAD';
}

export async function isViewer(): Promise<boolean> {
  const { orgRole } = await requireOrganization();
  return mapClerkRoleToSculra(orgRole) === 'VIEWER';
}
