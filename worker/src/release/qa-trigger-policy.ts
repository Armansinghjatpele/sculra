// ==============================================================================
// Sculra Automatic QA Trigger Policy Engine (worker/src/release/qa-trigger-policy.ts)
//
// Invariants (Prompt 63):
// - A deployment triggers automatic QA only when sufficient evidence exists
// - If required information is missing => do not invent it => mark INSUFFICIENT_EVIDENCE
// - DEPLOYING => DEFERRED (normal QA deferred)
// - FAILED / CANCELLED => INELIGIBLE (no normal post-deployment QA)
// - UNKNOWN => INSUFFICIENT_EVIDENCE
// - NO EVIDENCE -> NO INFERENCE
// ==============================================================================

import {
  DeploymentSnapshot,
  QATriggerPolicy,
  QATriggerEligibility,
  QATriggerStatus,
} from './types';

export const DEFAULT_QA_TRIGGER_POLICY: QATriggerPolicy = {
  projectId: '',
  enabled: true,
  autoTriggerOnReady: true,
  targetEnvironments: ['*'], // '*' means all known environments
  requireCommitSha: true,
  requireEnvironment: true,
  requireDeploymentId: true,
  allowedBranches: [],
  criticalOnlyOnDeploying: false,
};

export class QATriggerPolicyEvaluator {
  /**
   * Evaluates whether a DeploymentSnapshot satisfies QA trigger conditions.
   * Strictly evaluates factual evidence without fabricating missing properties.
   */
  public static evaluateEligibility(
    snapshot: DeploymentSnapshot,
    policyConfig?: Partial<QATriggerPolicy>
  ): QATriggerEligibility {
    const policy: QATriggerPolicy = {
      ...DEFAULT_QA_TRIGGER_POLICY,
      projectId: snapshot.projectId || '',
      ...policyConfig,
    };

    const evaluatedAt = new Date().toISOString();
    const reasons: string[] = [];
    const missingFields: string[] = [];

    // 1. Check if policy is enabled
    if (!policy.enabled) {
      return {
        eligible: false,
        status: 'INELIGIBLE',
        reasons: ['Automatic QA trigger policy is disabled for this project.'],
        missingFields: [],
        evaluatedAt,
      };
    }

    // 2. Validate Deployment Lifecycle Status
    const status = snapshot.deploymentStatus;

    if (status === 'DEPLOYING') {
      return {
        eligible: false,
        status: 'DEFERRED',
        reasons: ['Deployment is currently in progress (DEPLOYING). Automatic QA is deferred until status is READY.'],
        missingFields: [],
        evaluatedAt,
      };
    }

    if (status === 'FAILED') {
      return {
        eligible: false,
        status: 'INELIGIBLE',
        reasons: ['Deployment failed at provider. Post-deployment QA campaign will not be executed.'],
        missingFields: [],
        evaluatedAt,
      };
    }

    if (status === 'CANCELLED') {
      return {
        eligible: false,
        status: 'INELIGIBLE',
        reasons: ['Deployment was cancelled at provider. Post-deployment QA campaign will not be executed.'],
        missingFields: [],
        evaluatedAt,
      };
    }

    if (status === 'UNKNOWN' || !status) {
      return {
        eligible: false,
        status: 'INSUFFICIENT_EVIDENCE',
        reasons: ['Deployment lifecycle status is UNKNOWN. Evidence is insufficient to initiate automatic QA.'],
        missingFields: ['deploymentStatus'],
        evaluatedAt,
      };
    }

    if (status !== 'READY') {
      return {
        eligible: false,
        status: 'DEFERRED',
        reasons: [`Deployment is in '${status}' state. Automatic QA requires confirmed READY status.`],
        missingFields: [],
        evaluatedAt,
      };
    }

    // 3. Deployment is READY: Verify Required Factual Evidence
    if (!snapshot.projectId || snapshot.projectId === 'unknown-project') {
      missingFields.push('projectId');
    }

    if (policy.requireDeploymentId && !snapshot.deploymentId) {
      missingFields.push('deploymentId');
    }

    if (policy.requireEnvironment) {
      const hasEnv = Boolean(snapshot.environmentId || snapshot.environmentName);
      if (!hasEnv) {
        missingFields.push('environment');
      }
    }

    if (policy.requireCommitSha && !snapshot.commitSha) {
      missingFields.push('commitSha');
    }

    if (missingFields.length > 0) {
      return {
        eligible: false,
        status: 'INSUFFICIENT_EVIDENCE',
        reasons: [
          `Cannot trigger automatic QA: missing required deployment evidence (${missingFields.join(
            ', '
          )}). NO EVIDENCE -> NO INFERENCE.`,
        ],
        missingFields,
        evaluatedAt,
      };
    }

    // 4. Verify Target Environment Filtering
    if (
      policy.targetEnvironments &&
      policy.targetEnvironments.length > 0 &&
      !policy.targetEnvironments.includes('*')
    ) {
      const currentEnvName = (snapshot.environmentName || '').toLowerCase();
      const currentEnvType = (snapshot.environmentType || '').toLowerCase();
      const allowed = policy.targetEnvironments.map((e) => e.toLowerCase());

      const envMatched = allowed.includes(currentEnvName) || allowed.includes(currentEnvType);
      if (!envMatched) {
        return {
          eligible: false,
          status: 'INELIGIBLE',
          reasons: [
            `Environment '${snapshot.environmentName || snapshot.environmentType}' is not in configured target environments (${policy.targetEnvironments.join(', ')}).`,
          ],
          missingFields: [],
          evaluatedAt,
        };
      }
    }

    // 5. Verify Branch Filtering
    if (
      policy.allowedBranches &&
      policy.allowedBranches.length > 0 &&
      snapshot.branch
    ) {
      const branch = snapshot.branch.toLowerCase();
      const allowed = policy.allowedBranches.map((b) => b.toLowerCase());
      if (!allowed.includes(branch)) {
        return {
          eligible: false,
          status: 'INELIGIBLE',
          reasons: [
            `Deployment branch '${snapshot.branch}' is not in allowed branches list (${policy.allowedBranches.join(', ')}).`,
          ],
          missingFields: [],
          evaluatedAt,
        };
      }
    }

    // 6. Sufficient factual evidence verified
    reasons.push('Deployment verified READY with complete environment, commit, and deployment evidence.');
    return {
      eligible: true,
      status: 'ELIGIBLE',
      reasons,
      missingFields: [],
      evaluatedAt,
    };
  }
}
