// ==============================================================================
// Sculra Deterministic Recovery Detector (worker/src/signals/recovery-detector.ts)
//
// Invariants (Prompt 64):
// - NO EVIDENCE -> NO INFERENCE
// - Distinguishes: SIGNAL_DISAPPEARED, WORKFLOW_RECOVERED, REGRESSION_RESOLVED, ROOT_CAUSE_FIXED
// - Never fabricates recovery when previous run was not failing (Fixture 4)
// - Never attributes causality without explicit code change / resolution evidence
// ==============================================================================

import { ProductionSignal, RecoveryState } from './types';

export interface RecoveryEvaluationContext {
  targetWorkflow: string;
  previousDeploymentId?: string | null;
  currentDeploymentId: string;
  previousWorkflowStatus?: 'passed' | 'failed' | 'untested' | null;
  currentWorkflowStatus?: 'passed' | 'failed' | 'untested' | null;
  previousProductionSignal?: ProductionSignal | null;
  currentProductionSignals?: ProductionSignal[];
  hasRootCauseFixEvidence?: boolean;
  hasResolutionVerification?: boolean;
}

export interface RecoveryDetectionResult {
  recoveryObserved: boolean;
  recoveryState: RecoveryState;
  confidence: number;
  reasons: string[];
  evidenceDetails: Record<string, any>;
}

export class RecoveryDetector {
  /**
   * Evaluates factual recovery between deployments without fabricating causal links.
   */
  public static evaluate(context: RecoveryEvaluationContext): RecoveryDetectionResult {
    const reasons: string[] = [];
    const evidenceDetails: Record<string, any> = {
      targetWorkflow: context.targetWorkflow,
      currentDeploymentId: context.currentDeploymentId,
      previousDeploymentId: context.previousDeploymentId || null,
      previousWorkflowStatus: context.previousWorkflowStatus || null,
      currentWorkflowStatus: context.currentWorkflowStatus || null,
    };

    const prevFailed =
      context.previousWorkflowStatus === 'failed' ||
      Boolean(context.previousProductionSignal && context.previousProductionSignal.status !== 'RESOLVED');

    // Fixture 4 guard: If previous run did not fail, there is no recovery to fabricate.
    if (!prevFailed) {
      return {
        recoveryObserved: false,
        recoveryState: 'NO_RECOVERY_OBSERVED',
        confidence: 1.0,
        reasons: ['No previous defect, failure, or active production signal observed; workflow was already passing/healthy.'],
        evidenceDetails,
      };
    }

    // If current workflow is not verified or failed again
    if (context.currentWorkflowStatus === 'failed') {
      return {
        recoveryObserved: false,
        recoveryState: 'NO_RECOVERY_OBSERVED',
        confidence: 1.0,
        reasons: [`Workflow '${context.targetWorkflow}' failed again in current deployment.`],
        evidenceDetails,
      };
    }

    if (!context.currentWorkflowStatus || context.currentWorkflowStatus === 'untested') {
      return {
        recoveryObserved: false,
        recoveryState: 'INSUFFICIENT_EVIDENCE',
        confidence: 0.0,
        reasons: [`Workflow '${context.targetWorkflow}' has not been re-tested in current deployment.`],
        evidenceDetails,
      };
    }

    // Current workflow is 'passed'
    // Check if active production signals remain open for this route/workflow
    const activeCurrentSignals = (context.currentProductionSignals || []).filter(
      (s) =>
        s.status === 'OPEN' ||
        s.status === 'INVESTIGATING' ||
        s.status === 'CONFIRMED_REGRESSION'
    );

    if (activeCurrentSignals.length > 0) {
      return {
        recoveryObserved: false,
        recoveryState: 'NO_RECOVERY_OBSERVED',
        confidence: 0.85,
        reasons: [
          `Workflow verification passed, but ${activeCurrentSignals.length} active production signal(s) remain open for this workflow.`,
        ],
        evidenceDetails: {
          ...evidenceDetails,
          activeSignalIds: activeCurrentSignals.map((s) => s.id),
        },
      };
    }

    // Factual distinctions per Phase 10
    if (context.hasRootCauseFixEvidence) {
      reasons.push(
        `Root-cause fix explicitly confirmed by code commit remediation evidence and passing QA verification.`
      );
      return {
        recoveryObserved: true,
        recoveryState: 'ROOT_CAUSE_FIXED',
        confidence: 0.95,
        reasons,
        evidenceDetails,
      };
    }

    if (context.hasResolutionVerification) {
      reasons.push(
        `Regression resolution verified: defect was reproduced in previous deployment and confirmed fixed in current deployment.`
      );
      return {
        recoveryObserved: true,
        recoveryState: 'REGRESSION_RESOLVED',
        confidence: 0.9,
        reasons,
        evidenceDetails,
      };
    }

    if (context.previousWorkflowStatus === 'failed' && context.currentWorkflowStatus === 'passed') {
      reasons.push(
        `Workflow '${context.targetWorkflow}' recovered: failed in deployment '${context.previousDeploymentId || 'previous'}' and passed in deployment '${context.currentDeploymentId}'.`
      );
      return {
        recoveryObserved: true,
        recoveryState: 'WORKFLOW_RECOVERED',
        confidence: 0.85,
        reasons,
        evidenceDetails,
      };
    }

    // Signal disappeared only
    reasons.push(
      `Production signal disappeared in current deployment window, but no direct root-cause fix was established.`
    );
    return {
      recoveryObserved: true,
      recoveryState: 'SIGNAL_DISAPPEARED',
      confidence: 0.7,
      reasons,
      evidenceDetails,
    };
  }
}
