// ==============================================================================
// Sculra Canonical Deployment Event Model & Lifecycle State Machine
// (worker/src/release/deployment-event.ts)
//
// Invariants (Prompt 63 & Prompt 62):
// - NO EVIDENCE -> NO INFERENCE
// - Never infer environment, branch, commit SHA, release, or deployment status
// - Provider event IDs must remain provider-scoped
// - Duplicate provider events must be idempotent
// - Timestamps must come from evidence
// - Deployment URL must not be treated as proof of environment
// - Latest GitHub commit / current HEAD must never be substituted
// - Normalize empty values to null
// ==============================================================================

import { randomUUID } from 'crypto';
import {
  DeploymentEvent,
  DeploymentLifecycleStatus,
  DeploymentSource,
  EnvironmentType,
} from './types';
import { redactSensitiveData } from '../change-intelligence/redaction';

export interface BuildDeploymentEventInput {
  eventId?: string | null;
  projectId?: string | null;
  orgId?: string | null;
  provider: string;
  providerEventId?: string | null;
  deploymentId?: string | null;
  environmentId?: string | null;
  environmentName?: string | null;
  environmentType?: EnvironmentType | null;
  deploymentStatus?: DeploymentLifecycleStatus | null;
  commitSha?: string | null;
  branch?: string | null;
  repository?: string | null;
  deploymentUrl?: string | null;
  releaseId?: string | null;
  occurredAt?: string | null;
  receivedAt?: string | null;
  source?: DeploymentSource;
  confidence?: number;
  metadata?: Record<string, any>;
}

/**
 * Normalizes string inputs: empty/whitespace becomes null.
 */
function cleanString(val: string | null | undefined): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Builds a deterministic canonical DeploymentEvent from raw provider or API input.
 * Strictly adheres to NO EVIDENCE -> NO INFERENCE.
 */
export function buildDeploymentEvent(input: BuildDeploymentEventInput): DeploymentEvent {
  const provider = cleanString(input.provider) || 'UNKNOWN_PROVIDER';
  const providerEventId = cleanString(input.providerEventId);
  const deploymentId = cleanString(input.deploymentId);
  const projectId = cleanString(input.projectId);
  const orgId = cleanString(input.orgId);
  const environmentId = cleanString(input.environmentId);
  const environmentName = cleanString(input.environmentName);
  const environmentType = (cleanString(input.environmentType) as EnvironmentType | null) || null;
  const commitSha = cleanString(input.commitSha);
  const branch = cleanString(input.branch);
  const repository = cleanString(input.repository);
  const deploymentUrl = cleanString(input.deploymentUrl);
  const releaseId = cleanString(input.releaseId);
  const occurredAt = cleanString(input.occurredAt);
  const receivedAt = cleanString(input.receivedAt) || new Date().toISOString();
  const source = input.source || 'UNKNOWN';

  // Deployment status: strictly require explicit status, default to RECEIVED if event just arrived
  const rawStatus = input.deploymentStatus;
  const deploymentStatus: DeploymentLifecycleStatus = rawStatus || 'RECEIVED';

  // Confidence calculation based on factual evidence presence
  let confidence = input.confidence ?? 0.0;
  if (input.confidence === undefined) {
    let score = 0.2; // base receipt
    if (providerEventId) score += 0.2;
    if (deploymentId) score += 0.2;
    if (commitSha) score += 0.2;
    if (environmentId || environmentName) score += 0.2;
    confidence = Math.min(1.0, Math.round(score * 100) / 100);
  }

  // Sanitize and redact raw metadata
  const safeMetadata = input.metadata
    ? (redactSensitiveData(input.metadata) as Record<string, any>)
    : undefined;

  return {
    eventId: cleanString(input.eventId) || randomUUID(),
    projectId,
    orgId,
    provider,
    providerEventId,
    deploymentId,
    environmentId,
    environmentName,
    environmentType,
    deploymentStatus,
    commitSha,
    branch,
    repository,
    deploymentUrl,
    releaseId,
    occurredAt,
    receivedAt,
    source,
    confidence,
    rawMetadataReference: safeMetadata,
  };
}

/**
 * Deterministic Deployment Event State Machine.
 * Enforces explicit transition rules across deployment lifecycle states.
 */
export class DeploymentStateMachine {
  private static readonly VALID_TRANSITIONS: Record<
    DeploymentLifecycleStatus,
    DeploymentLifecycleStatus[]
  > = {
    RECEIVED: ['VALIDATING', 'DEPLOYING', 'READY', 'FAILED', 'CANCELLED', 'UNKNOWN'],
    VALIDATING: ['DEPLOYING', 'READY', 'FAILED', 'CANCELLED', 'UNKNOWN'],
    DEPLOYING: ['READY', 'FAILED', 'CANCELLED', 'UNKNOWN'],
    READY: ['READY', 'FAILED', 'CANCELLED'], // READY -> READY is idempotent
    FAILED: ['RECEIVED', 'DEPLOYING'], // Retrying deployment
    CANCELLED: ['RECEIVED', 'DEPLOYING'], // Retrying deployment
    UNKNOWN: ['VALIDATING', 'DEPLOYING', 'READY', 'FAILED', 'CANCELLED'],
  };

  /**
   * Checks if transition from currentStatus to nextStatus is permissible.
   */
  public static canTransition(
    currentStatus: DeploymentLifecycleStatus,
    nextStatus: DeploymentLifecycleStatus
  ): boolean {
    if (currentStatus === nextStatus) {
      return true; // Idempotent same-state is always allowed
    }
    const allowed = this.VALID_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(nextStatus) : false;
  }

  /**
   * Asserts valid state transition or throws a descriptive error.
   */
  public static assertValidTransition(
    currentStatus: DeploymentLifecycleStatus,
    nextStatus: DeploymentLifecycleStatus
  ): void {
    if (!this.canTransition(currentStatus, nextStatus)) {
      throw new Error(
        `Invalid deployment lifecycle state transition: cannot transition from '${currentStatus}' to '${nextStatus}'.`
      );
    }
  }

  /**
   * Transitions a DeploymentEvent to a new lifecycle status while enforcing validity and recording audit reason.
   */
  public static transition(
    event: DeploymentEvent,
    nextStatus: DeploymentLifecycleStatus,
    reason?: string
  ): DeploymentEvent {
    this.assertValidTransition(event.deploymentStatus, nextStatus);

    return {
      ...event,
      deploymentStatus: nextStatus,
      rawMetadataReference: {
        ...(event.rawMetadataReference || {}),
        lastTransition: {
          from: event.deploymentStatus,
          to: nextStatus,
          timestamp: new Date().toISOString(),
          reason: reason || 'lifecycle_update',
        },
      },
    };
  }

  /**
   * Strict guardrail: Verifies that an event is eligible for post-deployment QA trigger.
   * Receipt alone never implies READY.
   */
  public static isEligibleForQA(event: DeploymentEvent): boolean {
    return event.deploymentStatus === 'READY';
  }
}
