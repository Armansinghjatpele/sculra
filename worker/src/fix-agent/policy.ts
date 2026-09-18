// ==============================================================================
// Sculra Fix Agent Policy, Ceilings & Conservative Defaults (worker/src/fix-agent/policy.ts)
// ==============================================================================

import { ProjectFixPolicy } from './types';

/**
 * Hard operational boundaries for the Autonomous Fix Agent.
 */
export const FIX_AGENT_POLICY = {
  MAX_REMEDIATIONS_PER_CAMPAIGN: 10,
  MAX_FILES_CHANGED: 10,
  MAX_DIFF_LINES: 500,
  MAX_CONTEXT_FILES: 20,
  MAX_FILE_BYTES: 50 * 1024, // 50 KB
  MAX_CONTEXT_BYTES: 300 * 1024, // 300 KB
  MAX_TEST_COMMANDS: 5,
  MAX_TEST_OUTPUT_BYTES: 200 * 1024, // 200 KB
  MAX_PATCH_ATTEMPTS: 2,
  MAX_AI_REQUESTS_PER_REMEDIATION: 2,
  MAX_REMEDIATION_SECONDS: 300,
  MAX_COMMAND_SECONDS: 120,
  MAX_CONCURRENT_REMEDIATIONS_PER_PROJECT: 1,
} as const;

/**
 * Default blocked paths representing sensitive infrastructure.
 */
export const DEFAULT_BLOCKED_PATHS: string[] = [
  '.env*',
  '**/.env*',
  '**/secrets/**',
  '**/*.pem',
  '**/*.key',
  '**/credentials/**',
  'supabase/config.toml',
  '.github/workflows/**',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

/**
 * Default allowed application paths.
 */
export const DEFAULT_ALLOWED_PATHS: string[] = [
  'src/**',
  'app/**',
  'pages/**',
  'components/**',
  'lib/**',
  'utils/**',
  'tests/**',
  '__tests__/**',
];

/**
 * Conservative project defaults.
 * Remediation is disabled by default.
 */
export const DEFAULT_PROJECT_FIX_POLICY: ProjectFixPolicy = {
  fix_agent_enabled: false,
  fix_agent_mode: 'PLAN_ONLY',
  fix_agent_allowed_branches: ['main', 'master', 'develop'],
  fix_agent_max_files: 10,
  fix_agent_max_diff_lines: 500,
  fix_agent_max_test_commands: 5,
  fix_agent_allow_dependency_changes: false,
  fix_agent_allow_config_changes: false,
  fix_agent_allow_database_changes: false,
  fix_agent_allow_auth_changes: false,
  fix_agent_allow_security_sensitive_changes: false,
  fix_agent_require_pr: true,
  fix_agent_auto_verify: true,
  fix_agent_allowed_paths: DEFAULT_ALLOWED_PATHS,
  fix_agent_blocked_paths: DEFAULT_BLOCKED_PATHS,
};
