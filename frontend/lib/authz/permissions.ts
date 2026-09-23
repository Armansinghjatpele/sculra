// ==============================================================================
// Sculra Centralized Permission Constants & Types (frontend/lib/authz/permissions.ts)
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

  // Credentials & Integration Vault
  CREDENTIALS_READ: 'credentials.read',
  CREDENTIALS_CREATE: 'credentials.create',
  CREDENTIALS_UPDATE: 'credentials.update',
  CREDENTIALS_DELETE: 'credentials.delete',
  CREDENTIALS_ROTATE: 'credentials.rotate',
  CREDENTIALS_VALIDATE: 'credentials.validate',
  CREDENTIALS_USE: 'credentials.use',
};

export type SculraPermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionCategory {
  id: string;
  name: string;
  description: string;
  permissions: {
    key: SculraPermission;
    label: string;
    description: string;
    isSensitive?: boolean;
  }[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'organization',
    name: 'Organization & Workspace',
    description: 'Workspace lifecycle and billing governance',
    permissions: [
      { key: PERMISSIONS.ORGANIZATION_READ, label: 'View Workspace', description: 'View organization details' },
      { key: PERMISSIONS.ORGANIZATION_UPDATE, label: 'Update Workspace', description: 'Modify workspace name, slug, or profile', isSensitive: true },
      { key: PERMISSIONS.ORGANIZATION_DELETE, label: 'Delete Workspace', description: 'Permanently delete organization and data', isSensitive: true },
    ],
  },
  {
    id: 'members',
    name: 'Team & Members',
    description: 'Manage organization collaborators and roles',
    permissions: [
      { key: PERMISSIONS.MEMBERS_READ, label: 'View Members', description: 'View team members and roles' },
      { key: PERMISSIONS.MEMBERS_INVITE, label: 'Invite Members', description: 'Invite new collaborators' },
      { key: PERMISSIONS.MEMBERS_REMOVE, label: 'Remove Members', description: 'Remove members from organization', isSensitive: true },
      { key: PERMISSIONS.MEMBERS_CHANGE_ROLE, label: 'Change Roles', description: 'Promote or demote member roles', isSensitive: true },
      { key: PERMISSIONS.MEMBERS_TRANSFER_OWNERSHIP, label: 'Transfer Ownership', description: 'Transfer primary owner rights', isSensitive: true },
    ],
  },
  {
    id: 'projects',
    name: 'Projects',
    description: 'Project provisioning and configuration',
    permissions: [
      { key: PERMISSIONS.PROJECTS_READ, label: 'View Projects', description: 'Read project configuration' },
      { key: PERMISSIONS.PROJECTS_CREATE, label: 'Create Projects', description: 'Onboard new projects' },
      { key: PERMISSIONS.PROJECTS_UPDATE, label: 'Update Projects', description: 'Modify project parameters' },
      { key: PERMISSIONS.PROJECTS_ARCHIVE, label: 'Archive Projects', description: 'Archive existing projects' },
      { key: PERMISSIONS.PROJECTS_DELETE, label: 'Delete Projects', description: 'Permanently delete projects', isSensitive: true },
    ],
  },
  {
    id: 'sources',
    name: 'Sources & Ingestion',
    description: 'Manage website, GitHub, and API connection sources',
    permissions: [
      { key: PERMISSIONS.SOURCES_READ, label: 'View Sources', description: 'Inspect connected sources' },
      { key: PERMISSIONS.SOURCES_CREATE, label: 'Add Sources', description: 'Register new project sources' },
      { key: PERMISSIONS.SOURCES_UPDATE, label: 'Update Sources', description: 'Update source credentials or branch' },
      { key: PERMISSIONS.SOURCES_DELETE, label: 'Delete Sources', description: 'Remove project source connections' },
      { key: PERMISSIONS.SOURCES_VALIDATE, label: 'Validate Sources', description: 'Trigger source reachability probing' },
    ],
  },
  {
    id: 'campaigns',
    name: 'Autonomous Campaigns',
    description: 'Autonomous QA campaign management',
    permissions: [
      { key: PERMISSIONS.CAMPAIGNS_READ, label: 'View Campaigns', description: 'Inspect campaign state and progress' },
      { key: PERMISSIONS.CAMPAIGNS_CREATE, label: 'Create Campaigns', description: 'Plan new autonomous campaigns' },
      { key: PERMISSIONS.CAMPAIGNS_START, label: 'Start Campaigns', description: 'Launch campaign execution' },
      { key: PERMISSIONS.CAMPAIGNS_CANCEL, label: 'Cancel Campaigns', description: 'Halt active campaign execution' },
      { key: PERMISSIONS.CAMPAIGNS_CONFIGURE, label: 'Configure Campaigns', description: 'Configure campaign parameters' },
    ],
  },
  {
    id: 'tests',
    name: 'Test Execution',
    description: 'Direct test runs and cancelation',
    permissions: [
      { key: PERMISSIONS.TESTS_READ, label: 'View Tests', description: 'Read test runs and artifacts' },
      { key: PERMISSIONS.TESTS_RUN, label: 'Execute Tests', description: 'Trigger targeted test executions' },
      { key: PERMISSIONS.TESTS_CANCEL, label: 'Cancel Tests', description: 'Cancel executing test runs' },
    ],
  },
  {
    id: 'issues',
    name: 'Issues & Findings',
    description: 'QA issues and triage management',
    permissions: [
      { key: PERMISSIONS.ISSUES_READ, label: 'View Issues', description: 'Read detected issues and traces' },
      { key: PERMISSIONS.ISSUES_UPDATE, label: 'Update Issues', description: 'Triage, tag, or reassign issues' },
      { key: PERMISSIONS.ISSUES_RESOLVE, label: 'Resolve Issues', description: 'Mark issues resolved or ignored' },
    ],
  },
  {
    id: 'reports',
    name: 'Reports & Diagnostics',
    description: 'Executive PDF and diagnostic reports',
    permissions: [
      { key: PERMISSIONS.REPORTS_READ, label: 'View Reports', description: 'Read generated QA reports' },
      { key: PERMISSIONS.REPORTS_CREATE, label: 'Generate Reports', description: 'Generate fresh diagnostic summaries' },
    ],
  },
  {
    id: 'release',
    name: 'Release Readiness',
    description: 'Release score evaluation and gating',
    permissions: [
      { key: PERMISSIONS.RELEASE_READ, label: 'View Readiness', description: 'Read release score and risk index' },
      { key: PERMISSIONS.RELEASE_EVALUATE, label: 'Evaluate Readiness', description: 'Trigger release readiness evaluation' },
    ],
  },
  {
    id: 'strategy',
    name: 'Test Strategy',
    description: 'Application discovery and strategy planning',
    permissions: [
      { key: PERMISSIONS.STRATEGY_READ, label: 'View Strategy', description: 'Inspect test surfaces and journeys' },
      { key: PERMISSIONS.STRATEGY_CONFIGURE, label: 'Configure Strategy', description: 'Adjust surface priority weights' },
    ],
  },
  {
    id: 'security',
    name: 'Security QA',
    description: 'Autonomous security vulnerability scanning',
    permissions: [
      { key: PERMISSIONS.SECURITY_READ, label: 'View Security QA', description: 'Read security findings' },
      { key: PERMISSIONS.SECURITY_CONFIGURE, label: 'Configure Security', description: 'Set security scan parameters', isSensitive: true },
      { key: PERMISSIONS.SECURITY_RUN, label: 'Run Security Checks', description: 'Execute security tests' },
    ],
  },
  {
    id: 'performance',
    name: 'Performance QA',
    description: 'Performance auditing and Lighthouse profiling',
    permissions: [
      { key: PERMISSIONS.PERFORMANCE_READ, label: 'View Performance QA', description: 'Read performance metrics' },
      { key: PERMISSIONS.PERFORMANCE_CONFIGURE, label: 'Configure Performance', description: 'Set performance budgets' },
      { key: PERMISSIONS.PERFORMANCE_RUN, label: 'Run Performance', description: 'Execute performance audits' },
    ],
  },
  {
    id: 'accessibility',
    name: 'Accessibility QA',
    description: 'WCAG 2.1 compliance auditing',
    permissions: [
      { key: PERMISSIONS.ACCESSIBILITY_READ, label: 'View Accessibility QA', description: 'Read WCAG compliance findings' },
      { key: PERMISSIONS.ACCESSIBILITY_CONFIGURE, label: 'Configure Accessibility', description: 'Set compliance standards' },
      { key: PERMISSIONS.ACCESSIBILITY_RUN, label: 'Run Accessibility', description: 'Execute axe-core evaluations' },
    ],
  },
  {
    id: 'cicd',
    name: 'CI/CD & Webhooks',
    description: 'GitHub Actions integration and pull request gating',
    permissions: [
      { key: PERMISSIONS.CICD_READ, label: 'View CI/CD', description: 'Inspect webhook events and gate evaluations' },
      { key: PERMISSIONS.CICD_CONFIGURE, label: 'Configure CI/CD', description: 'Manage webhook secret and gate thresholds', isSensitive: true },
      { key: PERMISSIONS.CICD_TRIGGER, label: 'Trigger Gate Evaluation', description: 'Manually evaluate pull request gates' },
    ],
  },
  {
    id: 'fix_agent',
    name: 'Safe Fix Agent',
    description: 'Automated patch generation and remediation',
    permissions: [
      { key: PERMISSIONS.FIX_AGENT_READ, label: 'View Fix Agent', description: 'Inspect remediations and diffs' },
      { key: PERMISSIONS.FIX_AGENT_CONFIGURE, label: 'Configure Fix Agent', description: 'Set allowed branches and modes', isSensitive: true },
      { key: PERMISSIONS.FIX_AGENT_PLAN, label: 'Plan Remediation', description: 'Generate diagnostic fix proposals' },
      { key: PERMISSIONS.FIX_AGENT_APPLY, label: 'Apply Remediation', description: 'Apply and verify patch locally', isSensitive: true },
      { key: PERMISSIONS.FIX_AGENT_CREATE_PR, label: 'Create Pull Request', description: 'Publish verified fix to repository', isSensitive: true },
      { key: PERMISSIONS.REMEDIATION_READ, label: 'View Remediation', description: 'Read remediation plans' },
      { key: PERMISSIONS.REMEDIATION_REQUEST, label: 'Request Remediation', description: 'Request autonomous bug fixing' },
      { key: PERMISSIONS.REMEDIATION_APPLY, label: 'Apply Remediation Action', description: 'Apply patch to target', isSensitive: true },
    ],
  },
  {
    id: 'approvals',
    name: 'Human Approvals',
    description: 'Human-in-the-loop remediation and governance gating',
    permissions: [
      { key: PERMISSIONS.APPROVALS_READ, label: 'View Approvals', description: 'Inspect pending approval requests' },
      { key: PERMISSIONS.APPROVALS_APPROVE, label: 'Approve Actions', description: 'Grant cryptographic human approval', isSensitive: true },
      { key: PERMISSIONS.APPROVALS_REJECT, label: 'Reject Actions', description: 'Reject and block remediation requests' },
    ],
  },
  {
    id: 'observability',
    name: 'Observability & Control Center',
    description: 'Autonomous timelines, explanations, and decision logs',
    permissions: [
      { key: PERMISSIONS.OBSERVABILITY_READ, label: 'View Observability', description: 'Inspect live actor and timeline' },
      { key: PERMISSIONS.OBSERVABILITY_ADMIN, label: 'Manage Observability', description: 'Filter and export audit telemetry' },
    ],
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'External service connections (GitHub, Slack, etc.)',
    permissions: [
      { key: PERMISSIONS.INTEGRATIONS_READ, label: 'View Integrations', description: 'Inspect active integration status' },
      { key: PERMISSIONS.INTEGRATIONS_CONFIGURE, label: 'Configure Integrations', description: 'Connect or disconnect third-party apps', isSensitive: true },
    ],
  },
  {
    id: 'settings',
    name: 'Organization Settings',
    description: 'Security configurations and platform policies',
    permissions: [
      { key: PERMISSIONS.SETTINGS_READ, label: 'View Settings', description: 'Read security and workspace settings' },
      { key: PERMISSIONS.SETTINGS_UPDATE, label: 'Update Settings', description: 'Modify security and operational policies', isSensitive: true },
    ],
  },
  {
    id: 'environments',
    name: 'Environments',
    description: 'Target deployment environments (Development, Staging, Production)',
    permissions: [
      { key: PERMISSIONS.ENVIRONMENT_READ, label: 'View Environments', description: 'Inspect environment URLs, branches, and health' },
      { key: PERMISSIONS.ENVIRONMENT_CREATE, label: 'Create Environment', description: 'Provision new deployment environments' },
      { key: PERMISSIONS.ENVIRONMENT_UPDATE, label: 'Update Environment', description: 'Modify environment configuration and base URL', isSensitive: true },
      { key: PERMISSIONS.ENVIRONMENT_DELETE, label: 'Delete Environment', description: 'Decommission deployment environments', isSensitive: true },
    ],
  },
  {
    id: 'deployments',
    name: 'Deployments',
    description: 'Confirmed deployment tracking and artifact inspection',
    permissions: [
      { key: PERMISSIONS.DEPLOYMENTS_READ, label: 'View Deployments', description: 'Inspect deployment timeline and triggers' },
      { key: PERMISSIONS.DEPLOYMENTS_CREATE, label: 'Trigger Deployment Record', description: 'Record confirmed deployment event' },
    ],
  },
  {
    id: 'releases',
    name: 'Release Orchestration',
    description: 'Release candidates, evaluation checks, and governance decisions',
    permissions: [
      { key: PERMISSIONS.RELEASES_READ, label: 'View Releases', description: 'Inspect release candidates and gate evaluations' },
      { key: PERMISSIONS.RELEASES_CREATE, label: 'Create Release', description: 'Assemble release candidate for testing' },
      { key: PERMISSIONS.RELEASES_CHECK, label: 'Run Release Check', description: 'Execute bounded QA campaign against release candidate' },
      { key: PERMISSIONS.RELEASES_DECIDE, label: 'Record Release Decision', description: 'Approve, block, or request retest on release', isSensitive: true },
    ],
  },
  {
    id: 'credentials',
    name: 'Credentials & Vault',
    description: 'Secure credential storage, key rotation, and secret lifecycle',
    permissions: [
      { key: PERMISSIONS.CREDENTIALS_READ, label: 'View Credential Metadata', description: 'View non-sensitive credential records' },
      { key: PERMISSIONS.CREDENTIALS_CREATE, label: 'Create Credentials', description: 'Store write-only encrypted secrets', isSensitive: true },
      { key: PERMISSIONS.CREDENTIALS_UPDATE, label: 'Update Credential Metadata', description: 'Modify credential metadata or scopes' },
      { key: PERMISSIONS.CREDENTIALS_DELETE, label: 'Delete Credentials', description: 'Permanently revoke and delete credentials', isSensitive: true },
      { key: PERMISSIONS.CREDENTIALS_ROTATE, label: 'Rotate Encryption Keys', description: 'Rotate encryption key versions for secrets', isSensitive: true },
      { key: PERMISSIONS.CREDENTIALS_VALIDATE, label: 'Validate Credentials', description: 'Perform bounded validation against providers' },
      { key: PERMISSIONS.CREDENTIALS_USE, label: 'Use Credentials', description: 'Authorize worker execution to resolve secrets' },
    ],
  },
];
