// ==============================================================================
// Sculra Canonical Environment Snapshot Builder (worker/src/change-intelligence/environment-snapshot.ts)
// ==============================================================================

import { EnvironmentSnapshot, EnvironmentType } from './types';
import { redactSensitiveData } from './redaction';

export interface BuildEnvironmentSnapshotInput {
  environmentId: string;
  environmentName: string;
  environmentType?: EnvironmentType;
  projectId: string;
  organizationId?: string | null;
  targetUrl: string;
  branch?: string | null;
  commitSha?: string | null;
  deploymentId?: string | null;
  releaseId?: string | null;
  capturedAt?: string;
  source?: 'PROJECT_ENVIRONMENT' | 'DEPLOYMENT' | 'RELEASE' | 'CAMPAIGN_CONFIG' | 'MANUAL';
  availability?: 'ONLINE' | 'DEGRADED' | 'UNREACHABLE' | 'UNKNOWN';
  metadata?: Record<string, any>;
}

/**
 * Builds a deterministic canonical EnvironmentSnapshot representing actual evidence
 * about a runtime test target environment.
 *
 * Strict Guardrails:
 * - Never infers a commit SHA or branch from an environment name.
 * - Missing metadata is recorded as undefined/null, never fabricated.
 * - Secrets, API keys, tokens, and cookies are automatically redacted.
 */
export function buildEnvironmentSnapshot(input: BuildEnvironmentSnapshotInput): EnvironmentSnapshot {
  const {
    environmentId,
    environmentName,
    environmentType = inferEnvironmentType(environmentName),
    projectId,
    organizationId = null,
    targetUrl,
    branch = null,
    commitSha = null,
    deploymentId = null,
    releaseId = null,
    capturedAt = new Date().toISOString(),
    source = 'CAMPAIGN_CONFIG',
    availability = 'ONLINE',
    metadata = {},
  } = input;

  if (!environmentId || typeof environmentId !== 'string') {
    throw new Error('EnvironmentSnapshot requires a valid environmentId.');
  }

  if (!projectId || typeof projectId !== 'string') {
    throw new Error('EnvironmentSnapshot requires a valid projectId.');
  }

  if (!targetUrl || typeof targetUrl !== 'string') {
    throw new Error('EnvironmentSnapshot requires a valid targetUrl.');
  }

  // Safe metadata: redact any secrets, cookies, or authorization tokens
  const safeMetadata = redactSensitiveData(metadata) as Record<string, any>;

  return {
    environmentId,
    environmentName,
    environmentType,
    projectId,
    organizationId,
    targetUrl,
    branch: branch && branch.trim().length > 0 ? branch.trim() : null,
    commitSha: commitSha && commitSha.trim().length > 0 ? commitSha.trim() : null,
    deploymentId: deploymentId && deploymentId.trim().length > 0 ? deploymentId.trim() : null,
    releaseId: releaseId && releaseId.trim().length > 0 ? releaseId.trim() : null,
    capturedAt,
    source,
    availability,
    metadata: safeMetadata,
  };
}

/**
 * Deterministic helper to normalize environment type if not explicitly supplied.
 * Does NOT infer commit or branch, only canonical categorization.
 */
function inferEnvironmentType(name: string): EnvironmentType {
  const lower = (name || '').toLowerCase();
  if (lower.includes('prod')) return 'PRODUCTION';
  if (lower.includes('stag')) return 'STAGING';
  if (lower.includes('prev') || lower.includes('pr-') || lower.includes('review')) return 'PREVIEW';
  if (lower.includes('dev') || lower.includes('local')) return 'DEVELOPMENT';
  return 'CUSTOM';
}
