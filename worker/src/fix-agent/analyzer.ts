// ==============================================================================
// Sculra Autonomous Safe Fix Agent Master Orchestrator (worker/src/fix-agent/analyzer.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  FixRequest,
  FixRemediationRecord,
  ProjectFixPolicy,
  FixEvidenceRecord,
  StructuredPatch,
  DiffReviewResult,
  VerificationResult,
  PullRequestResult,
} from './types';
import { DEFAULT_PROJECT_FIX_POLICY } from './policy';
import { FixAgentStateMachine } from './state';
import { FixAuthorizationManager } from './authorization';
import { FixPlanValidator } from './plan-validator';
import { FixCodeContextRetriever } from './code-context';
import { FixPatchGenerator } from './patch-generator';
import { FixPatchValidator } from './patch-validator';
import { IsolatedWorkspaceManager } from './workspace';
import { SafeGitOperations } from './git';
import { PatchApplier } from './patch-applier';
import { DiffReviewer, FileDiffData } from './diff-reviewer';
import { TestPlanner } from './test-planner';
import { TestRunner } from './test-runner';
import { VerificationManager } from './verification';
import { RollbackManager } from './rollback';
import { GitHubPRCreator } from './pr';
import { FixTelemetryTracker } from './telemetry';
import { ConcurrencyLockError, CancellationError, FixAgentError } from './errors';
import { CancellationToken } from '../types';
import { WorkerLogger } from '../logger';

// Concurrency tracker across worker instance
const ACTIVE_CONCURRENCY_LOCKS = new Set<string>();

export interface OrchestratorOptions {
  supabaseClient?: SupabaseClient;
  logger?: WorkerLogger;
  testRunner?: TestRunner;
  cancellationToken?: CancellationToken;
  githubToken?: string;
  customWorkspaceRoot?: string;
}

export class FixAgentOrchestrator {
  private supabase?: SupabaseClient;
  private logger: WorkerLogger;
  private testRunner?: TestRunner;
  private cancellationToken?: CancellationToken;
  private githubToken?: string;
  private customWorkspaceRoot?: string;

  constructor(options: OrchestratorOptions = {}) {
    this.supabase = options.supabaseClient;
    this.logger = options.logger || new WorkerLogger('fix_agent');
    this.testRunner = options.testRunner;
    this.cancellationToken = options.cancellationToken;
    this.githubToken = options.githubToken || process.env.GITHUB_TOKEN;
    this.customWorkspaceRoot = options.customWorkspaceRoot;
  }

  /**
   * Orchestrates the complete end-to-end safe code remediation pipeline.
   */
  async remediate(
    request: FixRequest,
    projectPolicy: ProjectFixPolicy = DEFAULT_PROJECT_FIX_POLICY
  ): Promise<FixRemediationRecord> {
    const remediationId = request.id || `fix-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lockKey = `${request.organizationId || 'personal'}:${request.projectId}:${request.issueId}`;

    // 1. Concurrency Lock
    if (ACTIVE_CONCURRENCY_LOCKS.has(lockKey)) {
      throw new ConcurrencyLockError(
        `A remediation is already active for issue "${request.issueId}" in project "${request.projectId}"`,
        lockKey
      );
    }
    ACTIVE_CONCURRENCY_LOCKS.add(lockKey);

    const stateMachine = new FixAgentStateMachine('REQUESTED', remediationId);
    const telemetry = new FixTelemetryTracker(
      remediationId,
      request.projectId,
      request.issueId,
      request.requestedMode,
      this.logger
    );

    let workspace: IsolatedWorkspaceManager | null = null;
    let generatedPatch: StructuredPatch | null = null;
    let diffReview: DiffReviewResult | null = null;
    let verification: VerificationResult | null = null;
    let prResult: PullRequestResult | null = null;
    const evidenceList: FixEvidenceRecord[] = [];

    try {
      this.checkCancellation(remediationId);

      // 2. Authorization
      const { effectiveMode } = FixAuthorizationManager.authorizeRequest(request, projectPolicy);
      stateMachine.transition('AUTHORIZED', request.requesterUserId, `Mode authorized: ${effectiveMode}`);

      this.checkCancellation(remediationId);

      // 3. Grounded Diagnosis & FixPlan Validation
      const planValidation = FixPlanValidator.validate(request, request.remediationAnalysis);
      stateMachine.transition('DIAGNOSIS_VALIDATED', 'system', planValidation.fixPlanSummary);

      this.checkCancellation(remediationId);

      // 4. Bounded Read-Only Code Context Retrieval
      const context = await FixCodeContextRetriever.retrieveContext({
        files: planValidation.validatedFiles,
        repoOwner: request.repoOwner,
        repoName: request.repoName,
        ref: request.sourceCommitSha,
        githubToken: this.githubToken,
        fileMap: (request.metadata as any)?.fileMap,
      });
      telemetry.recordFilesInspected(context.files.length);
      stateMachine.transition('CONTEXT_COLLECTED', 'system', `Retrieved ${context.files.length} context file(s)`);

      this.checkCancellation(remediationId);

      // 5. Structured Patch Generation
      const patchGenerator = new FixPatchGenerator();
      generatedPatch = await patchGenerator.generatePatch(
        request.remediationAnalysis!,
        context.files
      );
      telemetry.recordPatchGenerated(
        generatedPatch.affectedFiles.length,
        generatedPatch.edits.length,
        1
      );
      stateMachine.transition('PATCH_GENERATED', 'system', generatedPatch.summary);

      evidenceList.push({
        remediationId,
        type: 'patch_generated',
        summary: generatedPatch.summary,
        metadata: {
          editsCount: generatedPatch.edits.length,
          affectedFiles: generatedPatch.affectedFiles,
          isDeterministic: generatedPatch.isDeterministic,
        },
      });

      this.checkCancellation(remediationId);

      // 6. Deterministic Patch Safety Validation
      const patchValidation = FixPatchValidator.validate(generatedPatch, projectPolicy);
      stateMachine.transition('PATCH_VALIDATED', 'system', `Patch validated: ${patchValidation.filesCount} file(s)`);

      // If PLAN_ONLY mode, our work is successfully complete!
      if (effectiveMode === 'PLAN_ONLY') {
        stateMachine.transition('VERIFIED', 'system', 'PLAN_ONLY mode completed successfully');
        return await this.buildAndPersistRecord(
          remediationId,
          request,
          effectiveMode,
          stateMachine.currentState,
          generatedPatch,
          null,
          null,
          null,
          evidenceList,
          telemetry
        );
      }

      this.checkCancellation(remediationId);

      // 7. Isolated Workspace Creation
      workspace = new IsolatedWorkspaceManager(remediationId, this.customWorkspaceRoot);
      await workspace.init(context.files);
      stateMachine.transition('WORKSPACE_CREATED', 'system', `Isolated workspace created at ${workspace.workspacePath}`);

      this.checkCancellation(remediationId);

      // 8. Baseline Failure Reproduction
      const verificationManager = new VerificationManager(this.testRunner);
      const testPlan = TestPlanner.planTests(
        request.remediationAnalysis!.verificationPlan,
        projectPolicy,
        (request.metadata as any)?.customTestCommands
      );

      const baseline = await verificationManager.runBaselineReproduction(
        workspace,
        request.observation,
        testPlan
      );
      stateMachine.transition('BASELINE_VERIFIED', 'system', baseline.details);

      evidenceList.push({
        remediationId,
        type: 'baseline_reproduction',
        summary: baseline.details,
        metadata: { status: baseline.status },
      });

      this.checkCancellation(remediationId);

      // 9. Patch Application
      await PatchApplier.applyPatch(generatedPatch, workspace);
      stateMachine.transition('PATCH_APPLIED', 'system', `Applied ${generatedPatch.edits.length} edit(s)`);

      evidenceList.push({
        remediationId,
        type: 'patch_applied',
        summary: `Applied ${generatedPatch.edits.length} edit(s) cleanly to isolated workspace`,
        metadata: { files: generatedPatch.affectedFiles },
      });

      this.checkCancellation(remediationId);

      // 10. Independent Diff Review
      const fileDiffs: FileDiffData[] = [];
      for (const filePath of generatedPatch.affectedFiles) {
        const original = context.files.find((f) => f.path === filePath)?.content || '';
        const updated = (await workspace.readFile(filePath)) || '';
        fileDiffs.push({ filePath, originalContent: original, newContent: updated });
      }

      diffReview = DiffReviewer.reviewDiff(fileDiffs);
      stateMachine.transition('DIFF_REVIEWED', 'system', diffReview.summary);

      evidenceList.push({
        remediationId,
        type: 'diff_review',
        summary: diffReview.summary,
        metadata: {
          additions: diffReview.additions,
          deletions: diffReview.deletions,
          filesChanged: diffReview.filesChanged,
        },
      });

      this.checkCancellation(remediationId);

      // 11. Targeted Post-Patch Verification
      stateMachine.transition('VERIFICATION_RUNNING', 'system', `Running ${testPlan.commands.length} verification command(s)`);

      verification = await verificationManager.runPostFixVerification(
        workspace,
        testPlan,
        baseline.status
      );
      telemetry.recordVerification(verification.durationMs, testPlan.commands.length);

      evidenceList.push({
        remediationId,
        type: 'verification_result',
        summary: verification.summary,
        metadata: {
          status: verification.status,
          allPassed: verification.allPassed,
        },
      });

      if (!verification.allPassed) {
        const rollbackEvidence = await RollbackManager.rollback(
          workspace,
          `Verification failed: ${verification.summary}`
        );
        evidenceList.push(rollbackEvidence);
        stateMachine.transition('ROLLED_BACK', 'system', 'Workspace rolled back due to verification failure');
        stateMachine.transition('FAILED', 'system', verification.summary);

        return await this.buildAndPersistRecord(
          remediationId,
          request,
          effectiveMode,
          stateMachine.currentState,
          generatedPatch,
          diffReview,
          verification,
          null,
          evidenceList,
          telemetry,
          'VERIFICATION_FAILED',
          verification.summary
        );
      }

      stateMachine.transition('VERIFIED', 'system', verification.summary);

      this.checkCancellation(remediationId);

      // 12. Isolated Branch Creation & GitHub PR
      if (effectiveMode === 'CREATE_PR' && verification.status === 'VERIFIED_FIXED') {
        const branchName = SafeGitOperations.generateBranchName(
          request.issueId,
          request.remediationAnalysis!.diagnosis.summary
        );
        stateMachine.transition('BRANCH_CREATED', 'system', `Branch: ${branchName}`);

        prResult = await GitHubPRCreator.createPullRequest({
          repoOwner: request.repoOwner || 'unknown',
          repoName: request.repoName || 'unknown',
          sourceSha: request.sourceCommitSha,
          targetBranch: request.targetBranch || 'main',
          branchName,
          issueId: request.issueId,
          remediationId,
          analysis: request.remediationAnalysis!,
          diffReview,
          verification,
          githubToken: this.githubToken,
          customPRHandler: (request.metadata as any)?.customPRHandler,
        });

        stateMachine.transition('PR_CREATED', 'system', `PR #${prResult.prNumber} opened: ${prResult.prUrl}`);

        evidenceList.push({
          remediationId,
          type: 'pr_created',
          summary: `Pull Request #${prResult.prNumber} created`,
          metadata: { prNumber: prResult.prNumber, prUrl: prResult.prUrl, branch: branchName },
        });
      }

      // 13. Successful Completion
      return await this.buildAndPersistRecord(
        remediationId,
        request,
        effectiveMode,
        stateMachine.currentState,
        generatedPatch,
        diffReview,
        verification,
        prResult,
        evidenceList,
        telemetry
      );
    } catch (err: any) {
      if (workspace) {
        await RollbackManager.rollback(workspace, err?.message || 'Exception during remediation');
      }

      const isCancelled = err instanceof CancellationError || this.cancellationToken?.isCancelled;
      const finalState = isCancelled ? 'CANCELLED' : 'FAILED';

      if (stateMachine.canTransitionTo(finalState)) {
        stateMachine.transition(finalState, 'system', err?.message || 'Error occurred');
      }

      return await this.buildAndPersistRecord(
        remediationId,
        request,
        request.requestedMode,
        finalState,
        generatedPatch,
        diffReview,
        verification,
        prResult,
        evidenceList,
        telemetry,
        err?.code || 'REMEDIATION_ERROR',
        err?.message || String(err)
      );
    } finally {
      if (workspace) {
        await workspace.cleanup();
      }
      ACTIVE_CONCURRENCY_LOCKS.delete(lockKey);
    }
  }

  private checkCancellation(remediationId: string): void {
    if (this.cancellationToken?.isCancelled) {
      throw new CancellationError('Remediation was cancelled by user', remediationId);
    }
  }

  private async buildAndPersistRecord(
    remediationId: string,
    request: FixRequest,
    mode: any,
    status: any,
    patch: StructuredPatch | null,
    diffReview: DiffReviewResult | null,
    verification: VerificationResult | null,
    prResult: PullRequestResult | null,
    evidence: FixEvidenceRecord[],
    telemetry: FixTelemetryTracker,
    errorCode?: string,
    errorMessage?: string
  ): Promise<FixRemediationRecord> {
    telemetry.finalize(status);

    const record: FixRemediationRecord = {
      id: remediationId,
      organizationId: request.organizationId,
      projectId: request.projectId,
      issueId: request.issueId,
      testRunId: request.testRunId,
      campaignId: request.campaignId,
      diagnosisId: request.diagnosisId,
      fixPlanId: request.fixPlanId,
      requesterUserId: request.requesterUserId,
      sourceCommitSha: request.sourceCommitSha,
      targetBranch: request.targetBranch || 'main',
      remediationBranch: prResult?.branchName,
      mode,
      status,
      baselineStatus: verification?.baselineStatus,
      verificationStatus: verification?.status,
      changedFiles: diffReview?.filesChanged || patch?.affectedFiles || [],
      changedLines: (diffReview?.additions || 0) + (diffReview?.deletions || 0),
      testCommands: verification?.targetedCommandResults.map((r) => r.command) || [],
      verificationSummary: verification ? { summary: verification.summary, allPassed: verification.allPassed } : {},
      diffSummary: diffReview ? { additions: diffReview.additions, deletions: diffReview.deletions } : {},
      patchData: patch ? { summary: patch.summary, editsCount: patch.edits.length } : {},
      errorCode,
      errorMessage,
      prNumber: prResult?.prNumber,
      prUrl: prResult?.prUrl,
      metadata: request.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: ['VERIFIED', 'PR_CREATED', 'FAILED', 'BLOCKED', 'CANCELLED'].includes(status)
        ? new Date().toISOString()
        : undefined,
    };

    // Database persistence if Supabase client is configured
    if (this.supabase) {
      try {
        await this.supabase.from('fix_remediations').upsert({
          id: record.id,
          organization_id: record.organizationId,
          project_id: record.projectId,
          issue_id: record.issueId,
          test_run_id: record.testRunId,
          campaign_id: record.campaignId,
          diagnosis_id: record.diagnosisId,
          fix_plan_id: record.fixPlanId,
          requester_user_id: record.requesterUserId,
          source_commit_sha: record.sourceCommitSha,
          target_branch: record.targetBranch,
          remediation_branch: record.remediationBranch,
          mode: record.mode,
          status: record.status,
          baseline_status: record.baselineStatus,
          verification_status: record.verificationStatus,
          changed_files: record.changedFiles,
          changed_lines: record.changedLines,
          test_commands: record.testCommands,
          verification_summary: record.verificationSummary,
          diff_summary: record.diffSummary,
          patch_data: record.patchData,
          error_code: record.errorCode,
          error_message: record.errorMessage,
          pr_number: record.prNumber,
          pr_url: record.prUrl,
          metadata: record.metadata,
          created_at: record.createdAt,
          updated_at: record.updatedAt,
          completed_at: record.completedAt,
        });

        if (evidence.length > 0) {
          const evidenceRows = evidence.map((e) => ({
            remediation_id: record.id,
            type: e.type,
            summary: e.summary,
            metadata: e.metadata || {},
            created_at: new Date().toISOString(),
          }));
          await this.supabase.from('fix_evidence').insert(evidenceRows);
        }
      } catch (dbErr: any) {
        this.logger.warn('remediation_db_persistence_error', {
          message: dbErr?.message || String(dbErr),
        });
      }
    }

    return record;
  }
}
