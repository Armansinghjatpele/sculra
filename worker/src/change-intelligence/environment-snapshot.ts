// ==============================================================================
// Sculra Canonical Environment Snapshot Builder (worker/src/change-intelligence/environment-snapshot.ts)
// ==============================================================================

import { EnvironmentSnapshot, EnvironmentType } from './types';
import { redactSensitiveData } from './redaction';

export interface BuildEnvironmentSnapshotInput {
  environmentId?: string | null;
  environmentName?: string | null;
  environmentType?: EnvironmentType | null;
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
 * - Never fabricates an environmentId, environmentName, or environmentType.
 * - Missing environment identity is recorded as null, never fabricated.
 * - Never infers a commit SHA or branch from an environment name.
 * - Never infers environment type from target URL, branch, campaign name, or arbitrary strings.
 * - Secrets, API keys, tokens, and cookies are automatically redacted.
 */
export function buildEnvironmentSnapshot(input: BuildEnvironmentSnapshotInput): EnvironmentSnapshot {
  const {
    environmentId = null,
    environmentName = null,
    environmentType = null,
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

  if (!projectId || typeof projectId !== 'string') {
    throw new Error('EnvironmentSnapshot requires a valid projectId.');
  }

  if (!targetUrl || typeof targetUrl !== 'string') {
    throw new Error('EnvironmentSnapshot requires a valid targetUrl.');
  }

  const validEnvId =
    environmentId && typeof environmentId === 'string' && environmentId.trim().length > 0
      ? environmentId.trim()
      : null;

  const validEnvName =
    environmentName && typeof environmentName === 'string' && environmentName.trim().length > 0
      ? environmentName.trim()
      : null;

  // Infer environment type ONLY if environmentType was not explicitly provided and an explicit environmentName exists
  const resolvedEnvType: EnvironmentType | null =
    environmentType !== undefined && environmentType !== null
      ? environmentType
      : validEnvName
      ? inferEnvironmentType(validEnvName)
      : null;

  // Safe metadata: redact any secrets, cookies, or authorization tokens
  const safeMetadata = redactSensitiveData(metadata) as Record<string, any>;

  return {
    environmentId: validEnvId,
    environmentName: validEnvName,
    environmentType: resolvedEnvType,
    projectId,
    organizationId,
    targetUrl,
    branch: branch && typeof branch === 'string' && branch.trim().length > 0 ? branch.trim() : null,
    commitSha: commitSha && typeof commitSha === 'string' && commitSha.trim().length > 0 ? commitSha.trim() : null,
    deploymentId: deploymentId && typeof deploymentId === 'string' && deploymentId.trim().length > 0 ? deploymentId.trim() : null,
    releaseId: releaseId && typeof releaseId === 'string' && releaseId.trim().length > 0 ? releaseId.trim() : null,
    capturedAt,
    source,
    availability,
    metadata: safeMetadata,
  };
}

/**
 * Deterministic helper to normalize environment type if explicit name is supplied.
 * Does NOT infer commit or branch, and returns null if name is missing/empty.
 */
export function inferEnvironmentType(name?: string | null): EnvironmentType | null {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }
  const lower = name.toLowerCase().trim();
  if (lower.includes('prod')) return 'PRODUCTION';
  if (lower.includes('stag')) return 'STAGING';
  if (lower.includes('prev') || lower.includes('pr-') || lower.includes('review')) return 'PREVIEW';
  if (lower.includes('dev') || lower.includes('local')) return 'DEVELOPMENT';
  return 'CUSTOM';
}
