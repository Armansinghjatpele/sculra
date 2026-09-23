// ==============================================================================
// Sculra Worker Typed Permissions (worker/src/authz/permissions.ts)
// ==============================================================================

export const PERMISSIONS = {
  // Organization
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',
  ORGANIZATION_DELETE: 'organization.delete',

  // Members
  MEMBERS_READ: 'members.read',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_REMOVE: 'members.remove',
  MEMBERS_CHANGE_ROLE: 'members.change_role',
  MEMBERS_TRANSFER_OWNERSHIP: 'members.transfer_ownership',

  // Projects
  PROJECTS_READ: 'projects.read',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_UPDATE: 'projects.update',
  PROJECTS_ARCHIVE: 'projects.archive',
  PROJECTS_DELETE: 'projects.delete',

  // Sources
  SOURCES_READ: 'sources.read',
  SOURCES_CREATE: 'sources.create',
  SOURCES_UPDATE: 'sources.update',
  SOURCES_DELETE: 'sources.delete',
  SOURCES_VALIDATE: 'sources.validate',

  // Campaigns
  CAMPAIGNS_READ: 'campaigns.read',
  CAMPAIGNS_CREATE: 'campaigns.create',
  CAMPAIGNS_START: 'campaigns.start',
  CAMPAIGNS_CANCEL: 'campaigns.cancel',
  CAMPAIGNS_CONFIGURE: 'campaigns.configure',

  // Tests
  TESTS_READ: 'tests.read',
  TESTS_RUN: 'tests.run',
  TESTS_CANCEL: 'tests.cancel',

  // Issues
  ISSUES_READ: 'issues.read',
  ISSUES_UPDATE: 'issues.update',
  ISSUES_RESOLVE: 'issues.resolve',

  // Reports
  REPORTS_READ: 'reports.read',
  REPORTS_CREATE: 'reports.create',

  // Release Readiness
  RELEASE_READ: 'release.read',
  RELEASE_EVALUATE: 'release.evaluate',

  // Strategy
  STRATEGY_READ: 'strategy.read',
  STRATEGY_CONFIGURE: 'strategy.configure',

  // Security QA
  SECURITY_READ: 'security.read',
  SECURITY_CONFIGURE: 'security.configure',
  SECURITY_RUN: 'security.run',

  // Performance QA
  PERFORMANCE_READ: 'performance.read',
  PERFORMANCE_CONFIGURE: 'performance.configure',
  PERFORMANCE_RUN: 'performance.run',

  // Accessibility QA
  ACCESSIBILITY_READ: 'accessibility.read',
  ACCESSIBILITY_CONFIGURE: 'accessibility.configure',
  ACCESSIBILITY_RUN: 'accessibility.run',

  // CI/CD
  CICD_READ: 'cicd.read',
  CICD_CONFIGURE: 'cicd.configure',
  CICD_TRIGGER: 'cicd.trigger',

  // Remediation
  REMEDIATION_READ: 'remediation.read',
  REMEDIATION_REQUEST: 'remediation.request',
  REMEDIATION_APPLY: 'remediation.apply',

  // Safe Fix Agent
  FIX_AGENT_READ: 'fix_agent.read',
  FIX_AGENT_CONFIGURE: 'fix_agent.configure',
  FIX_AGENT_PLAN: 'fix_agent.plan',
  FIX_AGENT_APPLY: 'fix_agent.apply',
  FIX_AGENT_CREATE_PR: 'fix_agent.create_pr',

  // Human Approvals
  APPROVALS_READ: 'approvals.read',
  APPROVALS_APPROVE: 'approvals.approve',
  APPROVALS_REJECT: 'approvals.reject',

  // Observability & Control Center
  OBSERVABILITY_READ: 'observability.read',
  OBSERVABILITY_ADMIN: 'observability.admin',

  // Integrations
  INTEGRATIONS_READ: 'integrations.read',
  INTEGRATIONS_CONFIGURE: 'integrations.configure',

  // Settings
  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',

  // Environments
  ENVIRONMENT_READ: 'environment.read',
  ENVIRONMENT_CREATE: 'environment.create',
  ENVIRONMENT_UPDATE: 'environment.update',
  ENVIRONMENT_DELETE: 'environment.delete',

  // Deployments
  DEPLOYMENTS_READ: 'deployments.read',
  DEPLOYMENTS_CREATE: 'deployments.create',

  // Releases
  RELEASES_READ: 'releases.read',
  RELEASES_CREATE: 'releases.create',
  RELEASES_CHECK: 'releases.check',
  RELEASES_DECIDE: 'releases.decide',
} as const;

export type SculraPermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
