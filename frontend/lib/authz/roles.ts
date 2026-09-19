// ==============================================================================
// Sculra Canonical Roles & Membership Definitions (frontend/lib/authz/roles.ts)
// ==============================================================================

export type SculraRole = 'OWNER' | 'ADMIN' | 'QA_LEAD' | 'DEVELOPER' | 'VIEWER';

export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';

export type ActorType = 'HUMAN_ACTOR' | 'WORKER_ACTOR' | 'GITHUB_ACTOR' | 'SYSTEM_ACTOR';

export const ALL_ROLES: readonly SculraRole[] = [
  'OWNER',
  'ADMIN',
  'QA_LEAD',
  'DEVELOPER',
  'VIEWER',
] as const;

export const ROLE_RANKS: Record<SculraRole, number> = {
  OWNER: 5,
  ADMIN: 4,
  QA_LEAD: 3,
  DEVELOPER: 2,
  VIEWER: 1,
};

export interface RoleMetadata {
  role: SculraRole;
  title: string;
  description: string;
  badgeVariant: 'owner' | 'admin' | 'qa' | 'developer' | 'viewer';
  isAssignableByAdmin: boolean;
}

export const ROLE_METADATA: Record<SculraRole, RoleMetadata> = {
  OWNER: {
    role: 'OWNER',
    title: 'Owner',
    description: 'Complete organization control, billing authority, member management, security policies, and resource deletion.',
    badgeVariant: 'owner',
    isAssignableByAdmin: false,
  },
  ADMIN: {
    role: 'ADMIN',
    title: 'Admin',
    description: 'Manage members, projects, campaigns, CI/CD, and Fix Agent policies. Cannot transfer ownership.',
    badgeVariant: 'admin',
    isAssignableByAdmin: false,
  },
  QA_LEAD: {
    role: 'QA_LEAD',
    title: 'QA Lead',
    description: 'Create, configure, and execute test campaigns, manage test strategy, release readiness, and QA approvals.',
    badgeVariant: 'qa',
    isAssignableByAdmin: true,
  },
  DEVELOPER: {
    role: 'DEVELOPER',
    title: 'Developer',
    description: 'View project QA findings, inspect RCA, request Fix Agent remediations, and interact with CI/CD PR feedback.',
    badgeVariant: 'developer',
    isAssignableByAdmin: true,
  },
  VIEWER: {
    role: 'VIEWER',
    title: 'Viewer',
    description: 'Read-only access across projects, campaigns, test runs, issues, reports, and observability. No mutations.',
    badgeVariant: 'viewer',
    isAssignableByAdmin: true,
  },
};

/**
 * Safely maps Clerk organization roles to Sculra canonical roles.
 * Defaults to 'VIEWER' (least privilege) if unrecognized.
 */
export function mapClerkRoleToSculra(clerkRole: string | null | undefined): SculraRole {
  if (!clerkRole) return 'VIEWER';
  
  const normalized = clerkRole.toLowerCase().trim();

  // Clerk default owner / admin roles
  if (normalized === 'org:admin' || normalized === 'admin') {
    return 'ADMIN';
  }
  if (normalized === 'org:owner' || normalized === 'owner') {
    return 'OWNER';
  }
  // QA roles
  if (
    normalized === 'qa_lead' ||
    normalized === 'org:qa_lead' ||
    normalized === 'qa' ||
    normalized === 'qa_engineer'
  ) {
    return 'QA_LEAD';
  }
  // Developer roles
  if (
    normalized === 'org:member' ||
    normalized === 'member' ||
    normalized === 'developer' ||
    normalized === 'dev'
  ) {
    return 'DEVELOPER';
  }
  // Viewer roles
  if (
    normalized === 'org:viewer' ||
    normalized === 'viewer' ||
    normalized === 'guest' ||
    normalized === 'readonly'
  ) {
    return 'VIEWER';
  }

  // Safe fallback to least privilege
  return 'VIEWER';
}
