// ==============================================================================
// Sculra Release Gate Human Approval & Override Engine
// (worker/src/release/human-approval.ts)
//
// Invariants (Prompt 63):
// - Approvals and overrides must be authenticated, authorized, and organization-scoped
// - Approvals/overrides do NOT modify underlying factual QA evidence
// - Overrides require explicit permission (release.gates.override)
// - Full audit logging: actor, original decision, override decision, reason, timestamp
// ==============================================================================

import { randomUUID } from 'crypto';
import {
  ReleaseGateDecision,
  ReleaseGateApproval,
  ReleaseGateApprovalStatus,
  ReleaseGateOverride,
  ReleaseGateDecisionType,
} from './types';

export const APPROVAL_EXPIRATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CreateApprovalRequestInput {
  decision: ReleaseGateDecision;
  organizationId?: string | null;
  requesterId: string;
  reason?: string | null;
  validityWindowMs?: number;
}

export interface ProcessApprovalInput {
  approval: ReleaseGateApproval;
  decision: ReleaseGateDecision;
  approverId: string;
  approverRole: string;
  outcome: 'APPROVED' | 'REJECTED';
  reason: string;
}

export interface ProcessOverrideInput {
  decision: ReleaseGateDecision;
  organizationId?: string | null;
  actorId: string;
  actorRole: string;
  overrideDecision: ReleaseGateDecisionType;
  reason: string;
  hasOverridePermission: boolean;
}

export class ReleaseGateApprovalManager {
  /**
   * Creates a formal human approval request for a gate decision in REVIEW.
   */
  public static createApprovalRequest(input: CreateApprovalRequestInput): ReleaseGateApproval {
    const { decision, organizationId = null, requesterId, reason = null, validityWindowMs = APPROVAL_EXPIRATION_WINDOW_MS } = input;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityWindowMs).toISOString();

    return {
      id: randomUUID(),
      decisionId: decision.id,
      releaseId: decision.releaseId,
      deploymentId: decision.deploymentId,
      projectId: decision.projectId,
      organizationId,
      status: 'PENDING',
      requesterId,
      approverId: null,
      reason,
      requestedAt: now.toISOString(),
      decidedAt: null,
      expiresAt,
    };
  }

  /**
   * Processes a human approval decision (APPROVED or REJECTED).
   * Strict invariant: Factual QA evidence remains untouched; only gate decision outcome is updated.
   */
  public static processApproval(input: ProcessApprovalInput): {
    updatedApproval: ReleaseGateApproval;
    updatedDecision: ReleaseGateDecision;
  } {
    const { approval, decision, approverId, approverRole, outcome, reason } = input;

    // Check expiration
    const now = new Date();
    if (new Date(approval.expiresAt).getTime() < now.getTime()) {
      throw new Error(`Approval request '${approval.id}' has expired.`);
    }

    if (approval.status !== 'PENDING') {
      throw new Error(`Approval request '${approval.id}' is not in PENDING state (current: ${approval.status}).`);
    }

    const updatedApproval: ReleaseGateApproval = {
      ...approval,
      status: outcome,
      approverId,
      reason,
      decidedAt: now.toISOString(),
    };

    // If APPROVED, gate decision changes from REVIEW to PASS
    // If REJECTED, gate decision changes from REVIEW to BLOCK
    const newDecisionType: ReleaseGateDecisionType = outcome === 'APPROVED' ? 'PASS' : 'BLOCK';

    const updatedDecision: ReleaseGateDecision = {
      ...decision,
      decision: newDecisionType,
      evaluatedBy: `human_approval:${approverId} (${approverRole})`,
      evaluatedAt: now.toISOString(),
    };

    return { updatedApproval, updatedDecision };
  }

  /**
   * Processes an explicit administrative override of a gate decision.
   * Requires explicit `release.gates.override` permission.
   * Produces an immutable audit record.
   */
  public static processOverride(input: ProcessOverrideInput): {
    overrideRecord: ReleaseGateOverride;
    updatedDecision: ReleaseGateDecision;
  } {
    const {
      decision,
      organizationId = null,
      actorId,
      actorRole,
      overrideDecision,
      reason,
      hasOverridePermission,
    } = input;

    if (!hasOverridePermission) {
      throw new Error(
        `Actor '${actorId}' lacks required 'release.gates.override' permission to override release gate.`
      );
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error('A detailed justification reason (min 5 chars) is mandatory for release gate overrides.');
    }

    const now = new Date().toISOString();

    const overrideRecord: ReleaseGateOverride = {
      id: randomUUID(),
      decisionId: decision.id,
      releaseId: decision.releaseId,
      deploymentId: decision.deploymentId,
      projectId: decision.projectId,
      organizationId,
      actorId,
      originalDecision: decision.decision,
      overrideDecision,
      reason: reason.trim(),
      timestamp: now,
      policyVersion: decision.policyVersion,
    };

    const updatedDecision: ReleaseGateDecision = {
      ...decision,
      decision: overrideDecision,
      evaluatedBy: `override:${actorId} (${actorRole})`,
      evaluatedAt: now,
    };

    return { overrideRecord, updatedDecision };
  }
}
