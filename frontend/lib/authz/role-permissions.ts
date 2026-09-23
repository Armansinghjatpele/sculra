// ==============================================================================
// Sculra Role-Permission Mapping Matrix (frontend/lib/authz/role-permissions.ts)
// ==============================================================================

import { SculraRole } from './roles';
import { PERMISSIONS, SculraPermission } from './permissions';

// Common Read-Only Permissions across all authenticated workspace members
const BASE_VIEWER_PERMISSIONS: readonly SculraPermission[] = [
  PERMISSIONS.ORGANIZATION_READ,
  PERMISSIONS.MEMBERS_READ,
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.SOURCES_READ,
  PERMISSIONS.CAMPAIGNS_READ,
  PERMISSIONS.TESTS_READ,
  PERMISSIONS.ISSUES_READ,
  PERMISSIONS.REPORTS_READ,
  PERMISSIONS.RELEASE_READ,
  PERMISSIONS.STRATEGY_READ,
  PERMISSIONS.SECURITY_READ,
  PERMISSIONS.PERFORMANCE_READ,
  PERMISSIONS.ACCESSIBILITY_READ,
  PERMISSIONS.CICD_READ,
  PERMISSIONS.REMEDIATION_READ,
  PERMISSIONS.FIX_AGENT_READ,
  PERMISSIONS.APPROVALS_READ,
  PERMISSIONS.OBSERVABILITY_READ,
  PERMISSIONS.INTEGRATIONS_READ,
  PERMISSIONS.SETTINGS_READ,
  // Environments & Release read permissions
  PERMISSIONS.ENVIRONMENT_READ,
  PERMISSIONS.DEPLOYMENTS_READ,
  PERMISSIONS.RELEASES_READ,
  // Credentials safe metadata read
  PERMISSIONS.CREDENTIALS_READ,
  // Notifications & Incidents read
  PERMISSIONS.NOTIFICATIONS_READ,
  PERMISSIONS.NOTIFICATIONS_PREFERENCES_UPDATE,
  PERMISSIONS.INCIDENTS_READ,
] as const;

// Developer: Viewer permissions + Issue triage + Fix planning & requests + Deployments/Releases creation + Credential usage
const DEVELOPER_PERMISSIONS: readonly SculraPermission[] = [
  ...BASE_VIEWER_PERMISSIONS,
  PERMISSIONS.ISSUES_UPDATE,
  PERMISSIONS.ISSUES_RESOLVE,
  PERMISSIONS.REMEDIATION_REQUEST,
  PERMISSIONS.FIX_AGENT_PLAN,
  PERMISSIONS.DEPLOYMENTS_CREATE,
  PERMISSIONS.RELEASES_CREATE,
  PERMISSIONS.CREDENTIALS_USE,
  PERMISSIONS.INCIDENTS_MANAGE,
] as const;

// QA Lead: Developer permissions + Campaign, Test, Source, Strategy & QA Engine executions + Environments/Release Checks
const QA_LEAD_PERMISSIONS: readonly SculraPermission[] = [
  ...DEVELOPER_PERMISSIONS,
  // Projects configuration for QA
  PERMISSIONS.PROJECTS_UPDATE,
  // Sources management & validation
  PERMISSIONS.SOURCES_CREATE,
  PERMISSIONS.SOURCES_UPDATE,
  PERMISSIONS.SOURCES_VALIDATE,
  // Environments management (non-production)
  PERMISSIONS.ENVIRONMENT_CREATE,
  PERMISSIONS.ENVIRONMENT_UPDATE,
  // Campaigns full control
  PERMISSIONS.CAMPAIGNS_CREATE,
  PERMISSIONS.CAMPAIGNS_START,
  PERMISSIONS.CAMPAIGNS_CANCEL,
  PERMISSIONS.CAMPAIGNS_CONFIGURE,
  // Tests execution
  PERMISSIONS.TESTS_RUN,
  PERMISSIONS.TESTS_CANCEL,
  // Reports generation
  PERMISSIONS.REPORTS_CREATE,
  // Release readiness evaluation & release orchestration
  PERMISSIONS.RELEASE_EVALUATE,
  PERMISSIONS.RELEASES_CHECK,
  PERMISSIONS.RELEASES_DECIDE,
  // Credential validation
  PERMISSIONS.CREDENTIALS_VALIDATE,
  // Strategy configuration
  PERMISSIONS.STRATEGY_CONFIGURE,
  // QA engines execution & configuration
  PERMISSIONS.SECURITY_CONFIGURE,
  PERMISSIONS.SECURITY_RUN,
  PERMISSIONS.PERFORMANCE_CONFIGURE,
  PERMISSIONS.PERFORMANCE_RUN,
  PERMISSIONS.ACCESSIBILITY_CONFIGURE,
  PERMISSIONS.ACCESSIBILITY_RUN,
  // CI/CD triggering & configuration
  PERMISSIONS.CICD_TRIGGER,
  PERMISSIONS.CICD_CONFIGURE,
  // Remediation application & QA approvals
  PERMISSIONS.REMEDIATION_APPLY,
  PERMISSIONS.FIX_AGENT_APPLY,
  PERMISSIONS.FIX_AGENT_CREATE_PR,
  PERMISSIONS.APPROVALS_APPROVE,
  PERMISSIONS.APPROVALS_REJECT,
  // Observability admin
  PERMISSIONS.OBSERVABILITY_ADMIN,
  // Notifications management
  PERMISSIONS.NOTIFICATIONS_MANAGE,
] as const;

// Admin: QA Lead permissions + Full project lifecycle, member management, and integrations
// (Cannot delete organization or transfer ownership)
const ADMIN_PERMISSIONS: readonly SculraPermission[] = [
  ...QA_LEAD_PERMISSIONS,
  // Organization update
  PERMISSIONS.ORGANIZATION_UPDATE,
  // Member management (invite, change roles, remove - except owner transfer)
  PERMISSIONS.MEMBERS_INVITE,
  PERMISSIONS.MEMBERS_REMOVE,
  PERMISSIONS.MEMBERS_CHANGE_ROLE,
  // Projects lifecycle
  PERMISSIONS.PROJECTS_CREATE,
  PERMISSIONS.PROJECTS_ARCHIVE,
  PERMISSIONS.PROJECTS_DELETE,
  // Sources deletion & Environment deletion
  PERMISSIONS.SOURCES_DELETE,
  PERMISSIONS.ENVIRONMENT_DELETE,
  // Fix agent policy configuration
  PERMISSIONS.FIX_AGENT_CONFIGURE,
  // Integrations & settings management
  PERMISSIONS.INTEGRATIONS_CONFIGURE,
  PERMISSIONS.SETTINGS_UPDATE,
  // Credentials vault management & key rotation
  PERMISSIONS.CREDENTIALS_CREATE,
  PERMISSIONS.CREDENTIALS_UPDATE,
  PERMISSIONS.CREDENTIALS_DELETE,
  PERMISSIONS.CREDENTIALS_ROTATE,
] as const;

// Owner: All permissions in the system, including ownership transfer & organization deletion
const OWNER_PERMISSIONS: readonly SculraPermission[] = [
  ...ADMIN_PERMISSIONS,
  PERMISSIONS.ORGANIZATION_DELETE,
  PERMISSIONS.MEMBERS_TRANSFER_OWNERSHIP,
] as const;

/**
 * Deterministic role to permissions lookup sets.
 */
export const ROLE_PERMISSIONS: Record<SculraRole, ReadonlySet<SculraPermission>> = {
  OWNER: new Set(OWNER_PERMISSIONS),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  QA_LEAD: new Set(QA_LEAD_PERMISSIONS),
  DEVELOPER: new Set(DEVELOPER_PERMISSIONS),
  VIEWER: new Set(BASE_VIEWER_PERMISSIONS),
};

/**
 * Pure helper to verify whether a given role holds a specific permission.
 */
export function hasPermission(role: SculraRole, permission: SculraPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.has(permission) : false;
}
