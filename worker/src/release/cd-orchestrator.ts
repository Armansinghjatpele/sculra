// ==============================================================================
// Sculra Continuous Deployment QA & Release Gate Orchestrator
// (worker/src/release/cd-orchestrator.ts)
//
// Complete bounded execution loop:
// DEPLOYMENT EVENT
//         ↓
// DEPLOYMENT SNAPSHOT
//         ↓
// CHANGE SNAPSHOT
//         ↓
// ENVIRONMENT + IMPACT ANALYSIS
//         ↓
// REGRESSION TARGETS
//         ↓
// QA CAMPAIGN
//         ↓
// EVIDENCE
//         ↓
// REGRESSION COMPARISON
//         ↓
// RELEASE IMPACT
//         ↓
// RELEASE READINESS
//         ↓
// RELEASE GATE
//         ↓
// PASS / BLOCK / REVIEW
//         ↓
// DEVELOPER / TEAM NOTIFICATION
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  DeploymentEvent,
  DeploymentSnapshot,
  DeploymentChangeComparison,
  DeploymentReleaseCorrelation,
  ReleaseImpact,
  CampaignTriggerDecision,
  ReleaseGateDecision,
  ReleaseGatePolicy,
  QATriggerPolicy,
  QATriggerEligibility,
  CategoryScores,
} from './types';
import { buildDeploymentSnapshot } from './deployment-snapshot';
import { buildDeploymentEvent } from './deployment-event';
import { PreviousDeploymentResolver } from './previous-deployment-resolver';
import { DeploymentReleaseCorrelator } from './deployment-release-correlator';
import { DeploymentChangeAnalyzer } from './deployment-change-analyzer';
import { QATriggerPolicyEvaluator } from './qa-trigger-policy';
import { SmartCampaignSelector } from './campaign-selector';
import { computeCampaignIdempotencyKey, CampaignDeduplicationManager } from './campaign-dedupe';
import { ReleaseImpactAnalyzer } from './release-impact';
import { ReleaseGatePolicyEvaluator, persistReleaseGateDecision } from './gate-policy';
import { ReleaseGateApprovalManager } from './human-approval';
import { CDNotificationDispatcher } from './cd-notifications';
import { CIFeedbackService, CIFeedbackOptions } from './ci-feedback';
import { NotificationEngine } from '../notifications/engine';
import { ProductModel } from '../product/types';
import { BugObservation } from '../issues/types';

export interface CDOrchestratorInput {
  event: DeploymentEvent;
  supabaseClient?: SupabaseClient | null;
  notificationEngine?: NotificationEngine | null;
  ciFeedbackOptions?: CIFeedbackOptions | null;
  qaTriggerPolicy?: Partial<QATriggerPolicy>;
  releaseGatePolicy?: Partial<ReleaseGatePolicy>;
  productModel?: ProductModel | null;
  candidateTargets?: string[];
  historicalDeployments?: DeploymentSnapshot[];
  existingReleases?: Array<{ id: string; version: string; commitSha: string; environmentId?: string | null }>;
  gitDiffFiles?: any[];
  campaignExecutorCallback?: (decision: CampaignTriggerDecision) => Promise<{
    campaignId: string;
    taskResults: any[];
    bugObservations: BugObservation[];
    regressions: any[];
    categoryScores?: CategoryScores;
    overallScore?: number;
  }>;
}

export interface CDOrchestrationResult {
  event: DeploymentEvent;
  snapshot: DeploymentSnapshot;
  eligibility: QATriggerEligibility;
  campaignDecision: CampaignTriggerDecision | null;
  campaignId: string | null;
  isDuplicateCampaign: boolean;
  correlation: DeploymentReleaseCorrelation | null;
  previousDeployment: DeploymentSnapshot | null;
  changeComparison: DeploymentChangeComparison | null;
  releaseImpact: ReleaseImpact | null;
  gateDecision: ReleaseGateDecision | null;
  approvalRequestId: string | null;
  notificationsDispatched: string[];
  ciFeedbackReported: boolean;
}

export class CDOrchestrator {
  /**
   * Orchestrates the complete automated CD QA and Release Gate flow.
   */
  public static async orchestrate(input: CDOrchestratorInput): Promise<CDOrchestrationResult> {
    const {
      event,
      supabaseClient = null,
      notificationEngine = null,
      ciFeedbackOptions = null,
      qaTriggerPolicy,
      releaseGatePolicy,
      productModel = null,
      candidateTargets = [],
      historicalDeployments = [],
      existingReleases = [],
      gitDiffFiles,
      campaignExecutorCallback,
    } = input;

    const notificationsDispatched: string[] = [];

    // 1. Build Canonical DeploymentSnapshot from Event
    const snapshot = buildDeploymentSnapshot({
      deploymentId: event.deploymentId,
      projectId: event.projectId || 'unknown-project',
      organizationId: event.orgId,
      environmentId: event.environmentId,
      environmentName: event.environmentName,
      environmentType: event.environmentType,
      deploymentStatus: event.deploymentStatus,
      deploymentUrl: event.deploymentUrl,
      commitSha: event.commitSha,
      branch: event.branch,
      provider: event.provider,
      startedAt: event.occurredAt,
      source: event.source,
      metadata: event.rawMetadataReference,
    });

    // 2. Evaluate Automatic QA Trigger Eligibility
    const eligibility = QATriggerPolicyEvaluator.evaluateEligibility(snapshot, qaTriggerPolicy);

    if (!eligibility.eligible) {
      // If deployment failed at provider, emit DEPLOYMENT_FAILED notification
      if (snapshot.deploymentStatus === 'FAILED' && event.projectId) {
        await CDNotificationDispatcher.dispatch(notificationEngine, {
          eventType: 'DEPLOYMENT_FAILED',
          projectId: event.projectId,
          organizationId: event.orgId,
          deploymentId: event.deploymentId,
          environmentName: event.environmentName,
          summaryMessage: `Deployment '${event.deploymentId}' failed at provider (${event.provider}).`,
        });
        notificationsDispatched.push('DEPLOYMENT_FAILED');
      }

      return {
        event,
        snapshot,
        eligibility,
        campaignDecision: null,
        campaignId: null,
        isDuplicateCampaign: false,
        correlation: null,
        previousDeployment: null,
        changeComparison: null,
        releaseImpact: null,
        gateDecision: null,
        approvalRequestId: null,
        notificationsDispatched,
        ciFeedbackReported: false,
      };
    }

    // 3. Resolve Previous Deployment (Strict: no fabrication across environments)
    const prevResolution = PreviousDeploymentResolver.resolve({
      currentDeployment: snapshot,
      candidateDeployments: historicalDeployments,
    });
    const previousDeployment = prevResolution.previousDeployment;

    // 4. Resolve Release Correlation (Strict: no guessing on ambiguous matches)
    const correlation = DeploymentReleaseCorrelator.correlate({
      deployment: snapshot,
      candidateReleases: existingReleases as any,
    });
    if (correlation.releaseId && !snapshot.releaseId) {
      snapshot.releaseId = correlation.releaseId;
      snapshot.releaseVersion = correlation.releaseVersion;
    }

    // 5. Connect Deployment to ChangeSnapshot (XYZ -> ABC)
    const changeComparison = await DeploymentChangeAnalyzer.analyze({
      currentDeployment: snapshot,
      previousDeployment,
      gitDiffFiles,
    });

    // 6. Smart Campaign Selection with Critical Workflow Protection
    const campaignDecision = SmartCampaignSelector.select({
      snapshot,
      changeComparison,
      productModel,
      candidateTargets,
    });

    // 7. Campaign Deduplication & Idempotency Key
    const idempotencyKey = computeCampaignIdempotencyKey({
      organizationId: event.orgId,
      projectId: snapshot.projectId,
      deploymentId: snapshot.deploymentId,
      triggerType: 'DEPLOYMENT_READY',
      policyVersion: releaseGatePolicy?.version,
      commitSha: snapshot.commitSha,
    });

    let campaignId: string | null = null;
    let isDuplicateCampaign = false;

    // Check if existing campaign exists for this key in database
    if (supabaseClient) {
      try {
        const { data: existingCamp } = await supabaseClient
          .from('qa_campaigns')
          .select('id')
          .eq('project_id', snapshot.projectId)
          .eq('metadata->>idempotencyKey', idempotencyKey)
          .maybeSingle();

        if (existingCamp) {
          campaignId = existingCamp.id;
          isDuplicateCampaign = true;
        }
      } catch {
        // Continue
      }
    }

    let taskResults: any[] = [];
    let bugObservations: BugObservation[] = [];
    let regressions: any[] = [];
    let categoryScores: CategoryScores | undefined;
    let overallScore: number | undefined;

    if (
      !isDuplicateCampaign &&
      (campaignDecision.decision === 'RUN_FULL' ||
        campaignDecision.decision === 'RUN_TARGETED' ||
        campaignDecision.decision === 'RUN_CRITICAL_ONLY')
    ) {
      // Emit QA_TRIGGERED notification
      if (event.projectId) {
        await CDNotificationDispatcher.dispatch(notificationEngine, {
          eventType: 'QA_TRIGGERED',
          projectId: event.projectId,
          organizationId: event.orgId,
          deploymentId: event.deploymentId,
          releaseId: snapshot.releaseId,
          environmentName: event.environmentName,
          summaryMessage: `Automatic QA Campaign triggered (${campaignDecision.campaignType}) for deployment ${event.deploymentId}.`,
        });
        notificationsDispatched.push('QA_TRIGGERED');
      }

      // Execute Campaign via callback if provided (e.g. CampaignExecutor)
      if (campaignExecutorCallback) {
        const execResult = await campaignExecutorCallback(campaignDecision);
        campaignId = execResult.campaignId;
        taskResults = execResult.taskResults || [];
        bugObservations = execResult.bugObservations || [];
        regressions = execResult.regressions || [];
        categoryScores = execResult.categoryScores;
        overallScore = execResult.overallScore;

        if (event.projectId) {
          await CDNotificationDispatcher.dispatch(notificationEngine, {
            eventType: 'QA_COMPLETED',
            projectId: event.projectId,
            organizationId: event.orgId,
            deploymentId: event.deploymentId,
            releaseId: snapshot.releaseId,
            environmentName: event.environmentName,
            campaignId,
          });
          notificationsDispatched.push('QA_COMPLETED');
        }
      }
    }

    // 8. Analyze Release Impact
    const releaseImpact = ReleaseImpactAnalyzer.analyze({
      deployment: snapshot,
      changeComparison,
      taskResults,
    });

    // 9. Deterministic Release Gate Evaluation (Factual evidence only)
    const hasMeasuredEvidence = Boolean(taskResults && taskResults.length > 0);
    const gateDecision = ReleaseGatePolicyEvaluator.evaluate({
      projectId: snapshot.projectId,
      organizationId: snapshot.organizationId || event.orgId,
      policy: releaseGatePolicy,
      releaseId: snapshot.releaseId,
      deploymentId: snapshot.deploymentId,
      environmentId: snapshot.environmentId,
      environmentName: snapshot.environmentName,
      categoryScores,
      overallReadinessScore: overallScore,
      openIssues: bugObservations,
      regressions,
      releaseImpact,
      correlation,
      hasMeasuredEvidence,
      confidence: snapshot.confidence,
    });

    if (supabaseClient) {
      try {
        await persistReleaseGateDecision(supabaseClient, gateDecision);
      } catch {
        // Table or network error in non-migrated environment
      }
    }

    // 10. Human Approval Flow if Decision is REVIEW
    let approvalRequestId: string | null = null;
    if (gateDecision.decision === 'REVIEW' && event.projectId) {
      const approval = ReleaseGateApprovalManager.createApprovalRequest({
        decision: gateDecision,
        organizationId: event.orgId,
        requesterId: 'system:cd_orchestrator',
        reason: 'Release gate requires human review and sign-off.',
      });
      approvalRequestId = approval.id;

      await CDNotificationDispatcher.dispatch(notificationEngine, {
        eventType: 'APPROVAL_REQUESTED',
        projectId: event.projectId,
        organizationId: event.orgId,
        deploymentId: event.deploymentId,
        releaseId: snapshot.releaseId,
        environmentName: event.environmentName,
        decision: gateDecision,
        summaryMessage: `Release gate for deployment ${event.deploymentId} requires human approval.`,
      });
      notificationsDispatched.push('APPROVAL_REQUESTED');
    }

    // 11. Emit Gate Decision Notification
    const gateNotificationMap: Record<string, any> = {
      PASS: 'RELEASE_GATE_PASSED',
      BLOCK: 'RELEASE_GATE_BLOCKED',
      REVIEW: 'RELEASE_GATE_REVIEW',
      INSUFFICIENT_EVIDENCE: 'RELEASE_GATE_INSUFFICIENT_EVIDENCE',
    };
    const gateNotificationEvent = gateNotificationMap[gateDecision.decision];
    if (gateNotificationEvent && event.projectId) {
      await CDNotificationDispatcher.dispatch(notificationEngine, {
        eventType: gateNotificationEvent,
        projectId: event.projectId,
        organizationId: event.orgId,
        deploymentId: event.deploymentId,
        releaseId: snapshot.releaseId,
        environmentName: event.environmentName,
        decision: gateDecision,
        blockers: gateDecision.blockers.map((b) => b.reason),
      });
      notificationsDispatched.push(gateNotificationEvent);
    }

    // 12. CI/CD Feedback (Truthful commit/check status report)
    let ciFeedbackReported = false;
    if (ciFeedbackOptions) {
      const fbResult = await CIFeedbackService.reportGateDecision(gateDecision, ciFeedbackOptions);
      ciFeedbackReported = fbResult.reported;
    }

    return {
      event,
      snapshot,
      eligibility,
      campaignDecision,
      campaignId,
      isDuplicateCampaign,
      correlation,
      previousDeployment,
      changeComparison,
      releaseImpact,
      gateDecision,
      approvalRequestId,
      notificationsDispatched,
      ciFeedbackReported,
    };
  }

  /**
   * Finalizes release gate evaluation when an asynchronous durable campaign finishes in worker.
   * Evaluates release gate against real stored evidence, updates deployment_events, and notifies team.
   */
  public static async finalizeDeploymentGate(input: {
    campaignId: string;
    projectId: string;
    organizationId?: string | null;
    deploymentEventId?: string | null;
    deploymentId?: string | null;
    campResult: {
      success: boolean;
      summary?: any;
      error?: any;
    };
    supabaseClient: SupabaseClient;
    notificationEngine?: NotificationEngine | null;
    ciFeedbackOptions?: CIFeedbackOptions | null;
    releaseGatePolicy?: Partial<ReleaseGatePolicy>;
  }): Promise<ReleaseGateDecision> {
    const {
      campaignId,
      projectId,
      organizationId,
      deploymentEventId,
      deploymentId,
      campResult,
      supabaseClient,
      notificationEngine,
      ciFeedbackOptions,
      releaseGatePolicy,
    } = input;

    let depEvent: any = null;
    if (deploymentEventId) {
      const { data } = await supabaseClient
        .from('deployment_events')
        .select('*')
        .eq('id', deploymentEventId)
        .maybeSingle();
      depEvent = data;
    } else if (deploymentId) {
      const { data } = await supabaseClient
        .from('deployment_events')
        .select('*')
        .eq('deployment_id', deploymentId)
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      depEvent = data;
    }

    const summary = campResult.summary;
    const taskCount = summary?.totalTasksExecuted ?? summary?.taskResults?.length ?? 0;
    const hasMeasuredEvidence = campResult.success && taskCount > 0;

    const categoryScores = summary?.releaseAssessment?.categoryScores || summary?.categoryScores || undefined;
    const overallScore = summary?.releaseAssessment?.overallScore ?? summary?.overallScore ?? undefined;
    const regressions = summary?.regressions || [];
    const openIssues = summary?.bugObservations || summary?.issues || [];

    const effectiveDepId = deploymentId || depEvent?.deployment_id || null;
    const effectiveOrgId = organizationId || depEvent?.organization_id || null;
    const effectiveEnvId = depEvent?.environment_id || null;
    const effectiveEnvName = depEvent?.environment_name || null;

    const gateDecision = ReleaseGatePolicyEvaluator.evaluate({
      projectId,
      organizationId: effectiveOrgId,
      policy: releaseGatePolicy,
      deploymentId: effectiveDepId,
      environmentId: effectiveEnvId,
      environmentName: effectiveEnvName,
      categoryScores,
      overallReadinessScore: overallScore,
      openIssues,
      regressions,
      hasMeasuredEvidence,
      source: 'WORKER_CAMPAIGN_FINALIZATION',
    });

    // Persist gate decision
    await persistReleaseGateDecision(supabaseClient, gateDecision);

    // Update deployment_events processing_status and gate_decision_id
    if (depEvent) {
      await supabaseClient
        .from('deployment_events')
        .update({
          processing_status: campResult.success ? 'COMPLETED' : 'FAILED',
          gate_decision_id: gateDecision.id,
          campaign_id: campaignId,
        })
        .eq('id', depEvent.id);
    }

    // Human Approval if REVIEW
    if (gateDecision.decision === 'REVIEW') {
      ReleaseGateApprovalManager.createApprovalRequest({
        decision: gateDecision,
        organizationId: effectiveOrgId,
        requesterId: 'system:cd_worker',
        reason: 'Release gate requires human review and sign-off.',
      });

      if (notificationEngine) {
        await CDNotificationDispatcher.dispatch(notificationEngine, {
          eventType: 'APPROVAL_REQUESTED',
          projectId,
          organizationId: effectiveOrgId,
          deploymentId: effectiveDepId,
          environmentName: effectiveEnvName,
          decision: gateDecision,
          summaryMessage: `Release gate for deployment ${effectiveDepId || campaignId} requires human approval.`,
        });
      }
    }

    // Truthful notification dispatch
    const gateNotificationMap: Record<string, any> = {
      PASS: 'RELEASE_GATE_PASSED',
      BLOCK: 'RELEASE_GATE_BLOCKED',
      REVIEW: 'RELEASE_GATE_REVIEW',
      INSUFFICIENT_EVIDENCE: 'RELEASE_GATE_INSUFFICIENT_EVIDENCE',
    };
    const gateNotificationEvent = gateNotificationMap[gateDecision.decision];
    if (gateNotificationEvent && notificationEngine) {
      await CDNotificationDispatcher.dispatch(notificationEngine, {
        eventType: gateNotificationEvent,
        projectId,
        organizationId: effectiveOrgId,
        deploymentId: effectiveDepId,
        environmentName: effectiveEnvName,
        decision: gateDecision,
        blockers: gateDecision.blockers.map((b) => b.reason),
      });
    }

    // CI feedback report
    if (ciFeedbackOptions) {
      await CIFeedbackService.reportGateDecision(gateDecision, ciFeedbackOptions);
    }

    return gateDecision;
  }
}
