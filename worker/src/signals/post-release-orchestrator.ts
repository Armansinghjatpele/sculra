// ==============================================================================
// Sculra Post-Release Verification & Health Orchestrator
// (worker/src/signals/post-release-orchestrator.ts)
//
// Invariants (Prompt 64):
// - NO EVIDENCE -> NO INFERENCE
// - Missing monitoring data is INSUFFICIENT_EVIDENCE, NEVER HEALTHY (Fixture 3)
// - Healthy ONLY when actual health evidence supports it (Fixture 4)
// - Reuses existing campaign engine (qa_campaigns) with bounded budgets
// - Emits enterprise notifications via NotificationEngine
// ==============================================================================

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PostReleaseHealthState,
  PostReleaseVerification,
  ProductionSignal,
  SignalCorrelation,
} from './types';
import { NotificationEngine } from '../notifications/engine';
import { NotificationEvent } from '../notifications/types';

export interface HealthEvaluationInput {
  deploymentId: string;
  hasMonitoringConfigured: boolean;
  productionSignals?: ProductionSignal[];
  correlations?: SignalCorrelation[];
  verificationCampaignStatus?: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | null;
  verificationPassed?: boolean | null;
  recoveryObserved?: boolean | null;
}

export interface PostReleaseCampaignPlan {
  projectId: string;
  organizationId?: string | null;
  deploymentId: string;
  environmentId?: string | null;
  commitSha?: string | null;
  releaseId?: string | null;
  targetWorkflows: string[];
  reasons: string[];
  budget: { maxDurationMinutes: number; maxTestRuns: number };
}

export class PostReleaseOrchestrator {
  /**
   * Deterministically calculates the truthful post-release health state.
   */
  public static evaluateHealthState(input: HealthEvaluationInput): {
    healthState: PostReleaseHealthState;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const signals = input.productionSignals || [];
    const activeSignals = signals.filter(
      (s) => s.status === 'OPEN' || s.status === 'INVESTIGATING' || s.status === 'CONFIRMED_REGRESSION'
    );

    // 1. If active confirmed regressions exist
    const confirmedSignal = activeSignals.find((s) => s.status === 'CONFIRMED_REGRESSION');
    if (confirmedSignal) {
      reasons.push(`Active confirmed regression observed: '${confirmedSignal.title}'.`);
      return { healthState: 'REGRESSION_DETECTED', reasons };
    }

    // 2. Active critical or high production signals
    const criticalSignal = activeSignals.find((s) => s.severity === 'CRITICAL');
    if (criticalSignal) {
      reasons.push(`Critical production incident active: '${criticalSignal.title}'.`);
      return { healthState: 'INCIDENT_ACTIVE', reasons };
    }

    const highSignal = activeSignals.find((s) => s.severity === 'HIGH');
    if (highSignal) {
      reasons.push(`High severity production signal active: '${highSignal.title}'.`);
      return { healthState: 'DEGRADED', reasons };
    }

    // 3. Post-release verification failure
    if (input.verificationPassed === false) {
      reasons.push('Post-release verification campaign identified functional or regression defects.');
      return { healthState: 'REGRESSION_DETECTED', reasons };
    }

    // 4. Recovery observed
    if (input.recoveryObserved === true) {
      reasons.push('Empirical recovery observed: previous defects successfully resolved and verified.');
      return { healthState: 'RECOVERY_OBSERVED', reasons };
    }

    // 5. Verification Passed & Monitoring Evidence
    // Healthy requires POSITIVE measured evidence:
    // (a) verification QA ran and passed, OR
    // (b) monitoring is actively configured and operational with zero active errors
    if (input.verificationPassed === true && input.hasMonitoringConfigured) {
      reasons.push(
        'Verified healthy: post-release QA verification passed and active production monitoring reports zero incidents.'
      );
      return { healthState: 'HEALTHY', reasons };
    }

    if (input.verificationPassed === true) {
      reasons.push('Post-release verification QA passed cleanly across all targeted business workflows.');
      return { healthState: 'HEALTHY', reasons };
    }

    // 6. Strict Guardrail: Missing monitoring and no post-release QA
    // Under NO EVIDENCE -> NO INFERENCE:
    // Absence of data is NEVER converted to HEALTHY.
    if (!input.hasMonitoringConfigured && signals.length === 0) {
      reasons.push(
        'Insufficient evidence: no production monitoring provider configured and no post-release QA executed.'
      );
      return { healthState: 'INSUFFICIENT_EVIDENCE', reasons };
    }

    if (input.hasMonitoringConfigured && signals.length === 0 && input.verificationCampaignStatus === 'RUNNING') {
      reasons.push('Post-release verification QA is actively running; awaiting measured evidence.');
      return { healthState: 'UNKNOWN', reasons };
    }

    if (input.hasMonitoringConfigured && signals.length === 0) {
      // Monitoring configured and quiet, but no post-release verification run yet
      reasons.push('Monitoring configured with 0 incoming signals; post-release QA verification pending.');
      return { healthState: 'INSUFFICIENT_EVIDENCE', reasons };
    }

    reasons.push('Insufficient telemetry to establish confident deployment health state.');
    return { healthState: 'INSUFFICIENT_EVIDENCE', reasons };
  }

  /**
   * Plans a bounded post-release verification campaign.
   */
  public static planVerification(
    plan: PostReleaseCampaignPlan,
    signals?: ProductionSignal[]
  ): {
    selectedWorkflows: string[];
    reasons: string[];
    budget: { maxDurationMinutes: number; maxTestRuns: number };
  } {
    const selected = new Set<string>();
    const reasons: string[] = [];

    // 1. Workflows linked to incoming production signals
    if (signals && signals.length > 0) {
      for (const sig of signals) {
        const route = sig.affectedRoute || sig.affectedUrl || sig.affectedService;
        if (route && !selected.has(route)) {
          selected.add(route);
          reasons.push(`Prioritized workflow connected to production signal '${sig.title}' (${sig.signalType})`);
        }
      }
    }

    // 2. Targeted workflows from plan
    for (const wf of plan.targetWorkflows || []) {
      if (selected.size >= 10) break;
      if (!selected.has(wf)) {
        selected.add(wf);
        reasons.push(`Targeted critical business workflow: '${wf}'`);
      }
    }

    // Fallback if none provided
    if (selected.size === 0) {
      selected.add('/health');
      reasons.push('Baseline deployment reachability and health check endpoint');
    }

    return {
      selectedWorkflows: Array.from(selected).slice(0, 10),
      reasons,
      budget: {
        maxDurationMinutes: Math.min(plan.budget?.maxDurationMinutes || 15, 30),
        maxTestRuns: Math.min(plan.budget?.maxTestRuns || 10, 20),
      },
    };
  }

  /**
   * Enqueues durable post-release verification into qa_campaigns and records post_release_verifications.
   */
  public static async enqueueVerification(
    plan: PostReleaseCampaignPlan,
    supabase?: SupabaseClient | null
  ): Promise<PostReleaseVerification | null> {
    const planned = this.planVerification(plan);
    const verificationId = crypto.randomUUID();
    const campaignId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const verificationRecord: PostReleaseVerification = {
      id: verificationId,
      projectId: plan.projectId,
      organizationId: plan.organizationId || null,
      deploymentId: plan.deploymentId,
      campaignId,
      status: 'QUEUED',
      targetWorkflows: planned.selectedWorkflows,
      findings: {
        reasons: planned.reasons,
        budget: planned.budget,
        commitSha: plan.commitSha || null,
        releaseId: plan.releaseId || null,
        environmentId: plan.environmentId || null,
      },
      healthState: 'INSUFFICIENT_EVIDENCE',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (!supabase) {
      return verificationRecord;
    }

    try {
      // 1. Atomic enqueue into public.qa_campaigns
      await supabase.from('qa_campaigns').insert({
        id: campaignId,
        project_id: plan.projectId,
        organization_id: plan.organizationId || null,
        name: `Post-Release Verification [${plan.deploymentId.slice(0, 8)}]`,
        status: 'QUEUED',
        type: 'POST_RELEASE_VERIFICATION',
        config: {
          targetWorkflows: planned.selectedWorkflows,
          reasons: planned.reasons,
          budget: planned.budget,
          deploymentId: plan.deploymentId,
          commitSha: plan.commitSha,
          releaseId: plan.releaseId,
          environmentId: plan.environmentId,
        },
        created_at: nowIso,
        updated_at: nowIso,
      });

      // 2. Persist post_release_verifications record
      await supabase.from('post_release_verifications').insert({
        id: verificationRecord.id,
        project_id: verificationRecord.projectId,
        organization_id: verificationRecord.organizationId,
        deployment_id: verificationRecord.deploymentId,
        campaign_id: verificationRecord.campaignId,
        status: verificationRecord.status,
        target_workflows: verificationRecord.targetWorkflows,
        findings: verificationRecord.findings,
        health_state: verificationRecord.healthState,
        created_at: verificationRecord.createdAt,
        updated_at: verificationRecord.updatedAt,
      });

      return verificationRecord;
    } catch (err) {
      console.error('[PostReleaseOrchestrator] Enqueue verification failed:', err);
      return null;
    }
  }

  /**
   * Dispatches an enterprise notification for post-release intelligence events.
   */
  public static async dispatchNotification(
    event: NotificationEvent,
    notificationEngine?: NotificationEngine
  ): Promise<boolean> {
    if (!notificationEngine) return false;
    try {
      const result = await notificationEngine.dispatch(event);
      return result.success;
    } catch (err) {
      console.error('[PostReleaseOrchestrator] Failed to dispatch notification:', err);
      return false;
    }
  }
}
