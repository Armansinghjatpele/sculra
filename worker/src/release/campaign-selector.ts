// ==============================================================================
// Sculra Smart QA Campaign Selector & Critical Workflow Protection Engine
// (worker/src/release/campaign-selector.ts)
//
// Invariants (Prompt 63):
// - Critical workflows (payment, auth, authorization, checkout, account creation)
//   can NEVER be silently skipped.
// - If deployment changes touch critical workflows => force inclusion into campaign.
// - If evidence is insufficient for critical workflow => REVIEW.
// - Every decision is explainable: no silent selection, no silent skipping.
// - Decisions: RUN_FULL | RUN_TARGETED | RUN_CRITICAL_ONLY | DEFER | REVIEW | DO_NOT_RUN.
// ==============================================================================

import { randomUUID } from 'crypto';
import {
  DeploymentSnapshot,
  DeploymentChangeComparison,
  CampaignTriggerDecision,
  CampaignTriggerDecisionType,
  DeploymentEvidenceReference,
} from './types';
import { ProductModel } from '../product/types';

export const CORE_CRITICAL_WORKFLOW_KEYWORDS = [
  'checkout',
  'payment',
  'pay',
  'auth',
  'login',
  'signin',
  'signup',
  'authorization',
  'account',
  'billing',
  'subscription',
];

export interface CampaignSelectorInput {
  snapshot: DeploymentSnapshot;
  changeComparison?: DeploymentChangeComparison | null;
  productModel?: ProductModel | null;
  historicalFailures?: Array<{ targetId: string; failureCount: number }>;
  criticalWorkflows?: string[];
  candidateTargets?: string[];
  allowDeployingCriticalOnly?: boolean;
}

export class SmartCampaignSelector {
  /**
   * Deterministically determines which QA campaign and targets should execute
   * based on deployment evidence, change impact, and critical workflow protections.
   */
  public static select(input: CampaignSelectorInput): CampaignTriggerDecision {
    const {
      snapshot,
      changeComparison,
      productModel,
      historicalFailures = [],
      criticalWorkflows: customCritical = [],
      candidateTargets = [],
      allowDeployingCriticalOnly = false,
    } = input;

    const decisionId = randomUUID();
    const evaluatedAt = new Date().toISOString();
    const reasons: string[] = [];
    const evidence: DeploymentEvidenceReference[] = [...(snapshot.evidence || [])];

    const selectedTargets: string[] = [];
    const skippedTargets: string[] = [];
    const deferredTargets: string[] = [];
    const reviewTargets: string[] = [];

    // Extract all known critical workflows
    const allCriticalWorkflows = new Set<string>();
    for (const kw of CORE_CRITICAL_WORKFLOW_KEYWORDS) {
      allCriticalWorkflows.add(kw);
    }
    for (const cw of customCritical) {
      allCriticalWorkflows.add(cw.toLowerCase());
    }
    if (productModel && productModel.workflows) {
      for (const w of productModel.workflows) {
        const level = w.criticality?.level || (w.criticality as any);
        if (level === 'CRITICAL' || level === 'HIGH') {
          allCriticalWorkflows.add(w.name.toLowerCase());
        }
      }
    }

    // Helper: is target critical?
    const isTargetCritical = (t: string) => {
      const lower = t.toLowerCase();
      for (const kw of allCriticalWorkflows) {
        if (lower.includes(kw)) return true;
      }
      return false;
    };

    // 1. Lifecycle State Checks
    const status = snapshot.deploymentStatus;

    if (status === 'DEPLOYING') {
      if (allowDeployingCriticalOnly) {
        // Critical-only override explicitly enabled by policy
        for (const t of candidateTargets) {
          if (isTargetCritical(t)) {
            selectedTargets.push(t);
          } else {
            deferredTargets.push(t);
          }
        }
        reasons.push(
          'Deployment is currently DEPLOYING. Non-critical targets deferred; critical workflow smoke executed under explicit policy.'
        );
        return {
          id: decisionId,
          decision: 'RUN_CRITICAL_ONLY',
          campaignType: 'CRITICAL_SMOKE',
          projectId: snapshot.projectId,
          deploymentId: snapshot.deploymentId,
          environmentId: snapshot.environmentId,
          selectedTargets,
          skippedTargets,
          deferredTargets,
          reviewTargets,
          reasons,
          evidence,
          confidence: 0.8,
          evaluatedAt,
        };
      }

      // Normal safe behavior: defer entire QA
      for (const t of candidateTargets) {
        deferredTargets.push(t);
      }
      reasons.push('Deployment is currently DEPLOYING. Automatic QA campaign deferred until deployment status is READY.');
      return {
        id: decisionId,
        decision: 'DEFER',
        campaignType: 'NONE',
        projectId: snapshot.projectId,
        deploymentId: snapshot.deploymentId,
        environmentId: snapshot.environmentId,
        selectedTargets: [],
        skippedTargets: [],
        deferredTargets,
        reviewTargets: [],
        reasons,
        evidence,
        confidence: 0.9,
        evaluatedAt,
      };
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      reasons.push(`Deployment is in '${status}' state. Automatic post-deployment QA will not run.`);
      return {
        id: decisionId,
        decision: 'DO_NOT_RUN',
        campaignType: 'NONE',
        projectId: snapshot.projectId,
        deploymentId: snapshot.deploymentId,
        environmentId: snapshot.environmentId,
        selectedTargets: [],
        skippedTargets: candidateTargets,
        deferredTargets: [],
        reviewTargets: [],
        reasons,
        evidence,
        confidence: 1.0,
        evaluatedAt,
      };
    }

    if (status === 'UNKNOWN' || !status) {
      reasons.push('Deployment status is UNKNOWN. Candidate targets require human or automated review.');
      return {
        id: decisionId,
        decision: 'REVIEW',
        campaignType: 'REVIEW_REQUIRED',
        projectId: snapshot.projectId,
        deploymentId: snapshot.deploymentId,
        environmentId: snapshot.environmentId,
        selectedTargets: [],
        skippedTargets: [],
        deferredTargets: [],
        reviewTargets: candidateTargets,
        reasons,
        evidence,
        confidence: 0.3,
        evaluatedAt,
      };
    }

    // 2. Deployment is READY: Evaluate Change Impact
    const changeStatus = changeComparison ? changeComparison.status : 'INCONCLUSIVE';

    // Check if critical workflows were touched by changes
    const touchedCriticalWorkflows = new Set<string>();
    if (changeComparison && changeComparison.criticalWorkflows) {
      for (const cw of changeComparison.criticalWorkflows) {
        touchedCriticalWorkflows.add(cw.toLowerCase());
      }
    }
    if (changeComparison && changeComparison.affectedRoutes) {
      for (const r of changeComparison.affectedRoutes) {
        if (isTargetCritical(r)) {
          touchedCriticalWorkflows.add(r.toLowerCase());
        }
      }
    }

    // Check historical failure targets
    const flakyOrFailingTargets = new Set(
      historicalFailures.filter((f) => f.failureCount > 0).map((f) => f.targetId.toLowerCase())
    );

    // 3. Selection Strategy
    let decision: CampaignTriggerDecisionType = 'RUN_TARGETED';
    let campaignType = 'TARGETED_REGRESSION';

    if (changeStatus === 'IDENTICAL_COMMITS') {
      // Redeployment with zero code mutations
      reasons.push('Redeployment of identical commit SHA. Zero code mutations detected.');
      // Keep critical smoke if candidates exist
      for (const t of candidateTargets) {
        if (isTargetCritical(t)) {
          selectedTargets.push(t);
        } else {
          skippedTargets.push(t);
        }
      }
      if (selectedTargets.length > 0) {
        decision = 'RUN_CRITICAL_ONLY';
        campaignType = 'CRITICAL_SMOKE';
        reasons.push('Running critical smoke tests to verify redeployment environment health.');
      } else {
        decision = 'DO_NOT_RUN';
        campaignType = 'NONE';
        reasons.push('No critical workflows configured; identical commit redeployment does not require QA.');
      }
    } else if (changeStatus === 'INCONCLUSIVE' || !changeComparison) {
      // Missing baseline commit or diff: safe fallback to full run
      decision = 'RUN_FULL';
      campaignType = 'FULL_REGRESSION';
      reasons.push('Change analysis inconclusive or missing prior deployment baseline commit. Executing full QA campaign.');
      for (const t of candidateTargets) {
        selectedTargets.push(t);
      }
    } else {
      // ANALYZED: Targeted selection with CRITICAL WORKFLOW PROTECTION
      const affectedRoutes = (changeComparison.affectedRoutes || []).map((r) => r.toLowerCase());
      const affectedApis = (changeComparison.affectedApis || []).map((a) => a.toLowerCase());

      for (const target of candidateTargets) {
        const lowerTarget = target.toLowerCase();
        const isCritical = isTargetCritical(target);
        const isDirectlyAffected =
          affectedRoutes.some((r) => lowerTarget.includes(r) || r.includes(lowerTarget)) ||
          affectedApis.some((a) => lowerTarget.includes(a) || a.includes(lowerTarget));
        const hasRecentFailures = flakyOrFailingTargets.has(lowerTarget);

        if (isCritical && isDirectlyAffected) {
          // Rule: Mutated critical workflow -> MUST run
          selectedTargets.push(target);
          reasons.push(`Target '${target}' included: critical workflow directly mutated by change.`);
        } else if (isDirectlyAffected) {
          selectedTargets.push(target);
          reasons.push(`Target '${target}' included: affected by change diff.`);
        } else if (isCritical) {
          // Rule: Critical workflows cannot be silently removed when changes occur
          selectedTargets.push(target);
          reasons.push(`Target '${target}' included: protected critical business workflow.`);
        } else if (hasRecentFailures) {
          selectedTargets.push(target);
          reasons.push(`Target '${target}' included: historical failure detected in regression memory.`);
        } else {
          // Unaffected non-critical target: explainable skip
          skippedTargets.push(target);
        }
      }

      if (selectedTargets.length === 0 && candidateTargets.length > 0) {
        // Fallback: if nothing matched, run critical only or review
        decision = 'RUN_CRITICAL_ONLY';
        campaignType = 'CRITICAL_SMOKE';
        for (const t of candidateTargets) {
          if (isTargetCritical(t)) selectedTargets.push(t);
          else skippedTargets.push(t);
        }
      }
    }

    return {
      id: decisionId,
      decision,
      campaignType,
      projectId: snapshot.projectId,
      deploymentId: snapshot.deploymentId,
      environmentId: snapshot.environmentId,
      selectedTargets,
      skippedTargets,
      deferredTargets,
      reviewTargets,
      reasons,
      evidence,
      confidence: changeStatus === 'ANALYZED' ? 0.95 : 0.7,
      evaluatedAt,
    };
  }
}
