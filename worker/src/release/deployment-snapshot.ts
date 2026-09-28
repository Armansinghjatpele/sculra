// ==============================================================================
// Sculra Canonical Deployment Snapshot Builder (worker/src/release/deployment-snapshot.ts)
// Answers: "What deployment contains this code change?", "Which environment received it?"
// ==============================================================================

import {
  DeploymentSnapshot,
  DeploymentLifecycleStatus,
  DeploymentSource,
  DeploymentEvidenceReference,
  EnvironmentType,
} from './types';
import { redactSensitiveData } from '../change-intelligence/redaction';
import { inferEnvironmentType } from '../change-intelligence/environment-snapshot';

export interface BuildDeploymentSnapshotInput {
  deploymentId?: string | null;
  projectId: string;
  organizationId?: string | null;

  environmentId?: string | null;
  environmentName?: string | null;
  environmentType?: EnvironmentType | null;

  deploymentStatus?: DeploymentLifecycleStatus | null;
  deploymentUrl?: string | null;

  commitSha?: string | null;
  branch?: string | null;

  previousDeploymentId?: string | null;
  previousCommitSha?: string | null;

  releaseId?: string | null;
  releaseVersion?: string | null;

  provider?: string | null;

  startedAt?: string | null;
  completedAt?: string | null;

  source?: DeploymentSource;
  evidence?: DeploymentEvidenceReference[];
  metadata?: Record<string, any>;
}

/**
 * Builds a deterministic canonical DeploymentSnapshot representing actual evidence
 * about a deployment event.
 *
 * Strict Guardrails (Prompt 62 & 61A):
 * - Missing deploymentId => null
 * - Missing environment => null
 * - Missing commit => null
 * - Missing branch => null
 * - Missing release => null
 * - Missing previous deployment => null
 * - Missing previous commit => null
 * - Missing provider => null
 *
 * NO EVIDENCE -> NO INFERENCE:
 * - NEVER infer environment, branch, commit, or release from:
 *   URL, project name, branch naming, deployment naming, environment naming,
 *   timestamp, current HEAD, latest commit, "production" text in URL, campaign name.
 * - Secrets and credentials in metadata are automatically redacted.
 */
export function buildDeploymentSnapshot(input: BuildDeploymentSnapshotInput): DeploymentSnapshot {
  const {
    deploymentId = null,
    projectId,
    organizationId = null,
    environmentId = null,
    environmentName = null,
    environmentType = null,
    deploymentStatus = null,
    deploymentUrl = null,
    commitSha = null,
    branch = null,
    previousDeploymentId = null,
    previousCommitSha = null,
    releaseId = null,
    releaseVersion = null,
    provider = null,
    startedAt = null,
    completedAt = null,
    source = 'UNKNOWN',
    evidence = [],
    metadata = {},
  } = input;

  if (!projectId || typeof projectId !== 'string') {
    throw new Error('DeploymentSnapshot requires a valid projectId.');
  }

  // Strict normalization: empty strings become null
  const cleanDeploymentId =
    deploymentId && typeof deploymentId === 'string' && deploymentId.trim().length > 0
      ? deploymentId.trim()
      : null;

  const cleanEnvironmentId =
    environmentId && typeof environmentId === 'string' && environmentId.trim().length > 0
      ? environmentId.trim()
      : null;

  const cleanEnvironmentName =
    environmentName && typeof environmentName === 'string' && environmentName.trim().length > 0
      ? environmentName.trim()
      : null;

  // Infer environment type ONLY if explicit environmentName exists and environmentType is omitted
  const cleanEnvironmentType: EnvironmentType | null =
    environmentType !== undefined && environmentType !== null
      ? environmentType
      : cleanEnvironmentName
      ? inferEnvironmentType(cleanEnvironmentName)
      : null;

  const cleanCommitSha =
    commitSha && typeof commitSha === 'string' && commitSha.trim().length > 0
      ? commitSha.trim()
      : null;

  const cleanBranch =
    branch && typeof branch === 'string' && branch.trim().length > 0
      ? branch.trim()
      : null;

  const cleanPreviousDeploymentId =
    previousDeploymentId && typeof previousDeploymentId === 'string' && previousDeploymentId.trim().length > 0
      ? previousDeploymentId.trim()
      : null;

  const cleanPreviousCommitSha =
    previousCommitSha && typeof previousCommitSha === 'string' && previousCommitSha.trim().length > 0
      ? previousCommitSha.trim()
      : null;

  const cleanReleaseId =
    releaseId && typeof releaseId === 'string' && releaseId.trim().length > 0
      ? releaseId.trim()
      : null;

  const cleanReleaseVersion =
    releaseVersion && typeof releaseVersion === 'string' && releaseVersion.trim().length > 0
      ? releaseVersion.trim()
      : null;

  const cleanProvider =
    provider && typeof provider === 'string' && provider.trim().length > 0
      ? provider.trim().toUpperCase()
      : null;

  const cleanDeploymentUrl =
    deploymentUrl && typeof deploymentUrl === 'string' && deploymentUrl.trim().length > 0
      ? deploymentUrl.trim()
      : null;

  // Safe metadata: redact any secrets, cookies, or authorization tokens
  const safeMetadata = redactSensitiveData(metadata) as Record<string, any>;

  // Construct deterministic evidence trail
  const resolvedEvidence: DeploymentEvidenceReference[] = [...evidence];

  if (cleanDeploymentId) {
    resolvedEvidence.push({
      kind: 'DEPLOYMENT_ID',
      source: source || 'UNKNOWN',
      ref: `deployment:${cleanDeploymentId}`,
      description: `Deployment identified by ID: ${cleanDeploymentId}`,
      confidence: 1.0,
    });
  }

  if (cleanCommitSha) {
    resolvedEvidence.push({
      kind: 'COMMIT_SHA',
      source: source || 'UNKNOWN',
      ref: `commit:${cleanCommitSha}`,
      description: `Deployment verified commit SHA: ${cleanCommitSha.slice(0, 7)}`,
      confidence: 1.0,
    });
  }

  if (cleanEnvironmentId || cleanEnvironmentName) {
    resolvedEvidence.push({
      kind: 'ENVIRONMENT',
      source: source || 'UNKNOWN',
      ref: `env:${cleanEnvironmentId || cleanEnvironmentName}`,
      description: `Target environment: ${cleanEnvironmentName || cleanEnvironmentId}`,
      confidence: 1.0,
    });
  }

  if (cleanReleaseId) {
    resolvedEvidence.push({
      kind: 'RELEASE_LINK',
      source: 'EXPLICIT_LINK',
      ref: `release:${cleanReleaseId}`,
      description: `Release linkage: ${cleanReleaseVersion || cleanReleaseId}`,
      confidence: 1.0,
    });
  }

  // Calculate evidence confidence (0.0 to 1.0)
  let confidence = 0.0;
  if (cleanDeploymentId) confidence += 0.3;
  if (cleanCommitSha) confidence += 0.3;
  if (cleanEnvironmentId || cleanEnvironmentName) confidence += 0.2;
  if (deploymentStatus && deploymentStatus !== 'UNKNOWN') confidence += 0.1;
  if (cleanProvider) confidence += 0.1;

  confidence = Math.min(1.0, Math.round(confidence * 100) / 100);

  return {
    deploymentId: cleanDeploymentId,
    projectId,
    organizationId,
    environmentId: cleanEnvironmentId,
    environmentName: cleanEnvironmentName,
    environmentType: cleanEnvironmentType,
    deploymentStatus: deploymentStatus || null,
    deploymentUrl: cleanDeploymentUrl,
    commitSha: cleanCommitSha,
    branch: cleanBranch,
    previousDeploymentId: cleanPreviousDeploymentId,
    previousCommitSha: cleanPreviousCommitSha,
    releaseId: cleanReleaseId,
    releaseVersion: cleanReleaseVersion,
    provider: cleanProvider,
    startedAt,
    completedAt,
    source,
    confidence,
    evidence: resolvedEvidence,
    metadata: safeMetadata,
  };
}
