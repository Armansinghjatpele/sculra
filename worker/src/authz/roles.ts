// ==============================================================================
// Sculra Worker Roles & Hierarchy (worker/src/authz/roles.ts)
// ==============================================================================

import { SculraRole } from './types';

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
