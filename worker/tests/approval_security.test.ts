// ==============================================================================
// Prompt 35: Human Approval Governance & Security Tests
// (worker/tests/approval_security.test.ts)
// ==============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalSecurityManager, ObservabilityRedactor, OBSERVABILITY_POLICY } from '../src/observability';

describe('Prompt 35: Human Approval Governance & Security Suite', () => {
  const projectId = 'proj-sec-test';
  const sourceSha = 'abcdef0123456789abcdef0123456789abcdef01';

  beforeEach(() => {
    ApprovalSecurityManager.clearMemoryForTest();
  });

  it('rejects approval after 24-hour expiration window', async () => {
    const approval = await ApprovalSecurityManager.requestApproval({
      projectId,
      actionType: 'APPLY_REMEDIATION',
      sourceSha,
      fixPlanVersion: 1,
      riskLevel: 'HIGH',
      reason: 'Urgent fix',
      requestedBy: 'agent-1',
    });

    // Fast-forward time past 24 hours
    const futureTime = Date.now() + OBSERVABILITY_POLICY.APPROVAL_EXPIRATION_MS + 1000;
    vi.setSystemTime(futureTime);

    const result = await ApprovalSecurityManager.processDecision({
      approvalId: approval.id,
      decision: 'APPROVE',
      actorUserId: 'admin',
      currentSourceSha: sourceSha,
      currentPlanVersion: 1,
      targetProjectId: projectId,
    });

    vi.useRealTimers();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Approval request has expired');
    expect(result.approval.status).toBe('EXPIRED');
  });

  it('prevents replay attacks on already approved or rejected records', async () => {
    const approval = await ApprovalSecurityManager.requestApproval({
      projectId,
      actionType: 'CREATE_PR',
      sourceSha,
      fixPlanVersion: 1,
      riskLevel: 'LOW',
      reason: 'Standard PR',
      requestedBy: 'agent-1',
    });

    // 1. Initial Approval succeeds
    const firstAttempt = await ApprovalSecurityManager.processDecision({
      approvalId: approval.id,
      decision: 'APPROVE',
      actorUserId: 'user-1',
      currentSourceSha: sourceSha,
      targetProjectId: projectId,
    });
    expect(firstAttempt.success).toBe(true);
    expect(firstAttempt.approval.status).toBe('APPROVED');

    // 2. Replay attempt fails
    const replayAttempt = await ApprovalSecurityManager.processDecision({
      approvalId: approval.id,
      decision: 'APPROVE',
      actorUserId: 'user-2',
      currentSourceSha: sourceSha,
      targetProjectId: projectId,
    });
    expect(replayAttempt.success).toBe(false);
    expect(replayAttempt.error).toContain('Current status is APPROVED');
  });

  it('invalidates approval when remediation fix plan version is updated', async () => {
    const approval = await ApprovalSecurityManager.requestApproval({
      projectId,
      actionType: 'CREATE_PR',
      sourceSha,
      fixPlanVersion: 1, // Plan v1
      riskLevel: 'MEDIUM',
      reason: 'Fix plan v1',
      requestedBy: 'agent-1',
    });

    const decision = await ApprovalSecurityManager.processDecision({
      approvalId: approval.id,
      decision: 'APPROVE',
      actorUserId: 'user-1',
      currentSourceSha: sourceSha,
      currentPlanVersion: 2, // New plan v2 generated!
      targetProjectId: projectId,
    });

    expect(decision.success).toBe(false);
    expect(decision.error).toContain('Remediation fix plan was updated');
    expect(decision.approval.status).toBe('CANCELLED');
  });

  it('bounds large metadata payloads to the 64KB policy limit', () => {
    // Generate an oversized 120KB payload
    const largeObject: Record<string, any> = {};
    for (let i = 0; i < 500; i++) {
      largeObject[`key_${i}`] = 'x'.repeat(250);
    }

    const bounded = ObservabilityRedactor.boundMetadata(largeObject);
    const byteLength = Buffer.byteLength(JSON.stringify(bounded), 'utf8');

    expect(byteLength).toBeLessThanOrEqual(OBSERVABILITY_POLICY.MAX_METADATA_BYTES);
    expect(bounded._truncated).toBe(true);
  });
});
