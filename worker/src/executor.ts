// ==============================================================================
// Sculra Test Worker Job Executor (worker/src/executor.ts)
// ==============================================================================
// Orchestrates test job execution: updates DB states, invokes Playwright runner,
// saves evidence rows, and reports final status.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BrowserRunner } from './runner';
import { SupabaseEvidenceStorage, IEvidenceStorage, LocalEvidenceStorage } from './storage';
import { WorkerLogger } from './logger';
import { CancellationToken } from './types';
import { IssueManager } from './issues';
import {
  DeterministicReleaseScorer,
  ReleaseAnalyzer,
  ReleaseReportGenerator,
  ReleaseAssessment,
} from './release';
import { createAIQAProvider } from './ai-qa';

export interface ExecutorConfig {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseClient?: SupabaseClient;
  storage?: IEvidenceStorage;
}

export class JobExecutor {
  private supabase: SupabaseClient | null = null;
  private storage: IEvidenceStorage;

  constructor(config: ExecutorConfig = {}) {
    const url = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isProduction = process.env.NODE_ENV === 'production';
    const key =
      config.supabaseServiceKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      (!isProduction ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

    if (config.supabaseClient) {
      this.supabase = config.supabaseClient;
    } else if (url && key) {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false },
      });
    }

    if (isProduction && !this.supabase) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for production worker');
    }

    if (config.storage) {
      this.storage = config.storage;
    } else if (this.supabase) {
      this.storage = new SupabaseEvidenceStorage(this.supabase);
    } else {
      this.storage = new LocalEvidenceStorage();
    }
  }

  async executeTestRun(
    testRunId: string,
    cancellationToken?: CancellationToken
  ): Promise<{ success: boolean; status: string; error?: string }> {
    const logger = new WorkerLogger(testRunId);
    logger.log('job_execution_initiated');

    if (!this.supabase) {
      logger.error('supabase_client_missing', 'Supabase credentials are not configured.');
      return { success: false, status: 'failed', error: 'Database client not configured' };
    }

    // 1. Fetch Test Run & Project details
    const { data: testRun, error: trError } = await this.supabase
      .from('test_runs')
      .select('*, projects(*)')
      .eq('id', testRunId)
      .single();

    if (trError || !testRun) {
      logger.error('test_run_fetch_failed', trError?.message || 'Test run not found');
      return { success: false, status: 'failed', error: 'Test run record not found' };
    }

    const project = testRun.projects;
    if (!project) {
      logger.error('project_not_found', 'Associated project record is missing.');
      await this.updateTestRunState(testRunId, 'failed', {
        completed_at: new Date().toISOString(),
      });
      return { success: false, status: 'failed', error: 'Project record not found' };
    }

    // 2. Validate Project Source Type
    if (project.source_type !== 'website') {
      logger.error('unsupported_source_type', `Source type "${project.source_type}" is not supported for browser testing.`);
      await this.updateTestRunState(testRunId, 'failed', {
        completed_at: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'failed',
        error: `Only "website" projects can be browser tested (got ${project.source_type}).`,
      };
    }

    const targetUrl = project.source_url || project.url;
    if (!targetUrl) {
      logger.error('missing_target_url', 'Project does not have a source_url configured.');
      await this.updateTestRunState(testRunId, 'failed', {
        completed_at: new Date().toISOString(),
      });
      return { success: false, status: 'failed', error: 'Target URL is missing.' };
    }

    // 3. Mark Test Run as RUNNING
    const startedAt = new Date().toISOString();
    await this.updateTestRunState(testRunId, 'running', {
      started_at: startedAt,
    });
    logger.log('test_run_state_updated_to_running');

    // 4. Execute Browser Test Runner
    const runner = new BrowserRunner(testRunId, project.id);
    const result = await runner.run(targetUrl, cancellationToken);

    // 5. Persist Evidence Records
    const completedAt = new Date().toISOString();

    try {
      // 5a. Save Screenshots
      for (let i = 0; i < result.screenshots.length; i++) {
        const item = result.screenshots[i];
        const upload = await this.storage.uploadScreenshot(
          testRunId,
          `screenshot_${i + 1}.png`,
          item.buffer,
          item.mimeType
        );

        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'screenshot',
          title: item.title || `Viewport Capture ${i + 1}`,
          url: result.finalUrl || targetUrl,
          storage_path: upload.storagePath,
          message: upload.publicUrl,
          metadata: {
            width: 1280,
            height: 720,
            publicUrl: upload.publicUrl,
          },
        });
      }

      // 5b. Save Console Errors
      for (const err of result.consoleErrors) {
        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'console_error',
          title: 'Browser Console Error',
          url: err.url || targetUrl,
          message: err.message,
          metadata: {
            location: err.location,
            timestamp: err.timestamp,
          },
        });
      }

      // 5c. Save Network Errors
      for (const net of result.networkErrors) {
        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'network_error',
          title: `Network Failure (${net.method} ${net.status || 'Failed'})`,
          url: net.url,
          message: net.errorText || 'Request failed',
          metadata: {
            method: net.method,
            status: net.status,
            resourceType: net.resourceType,
            timestamp: net.timestamp,
          },
        });
      }

      // 5d. Save Navigation Snapshot
      await this.supabase.from('test_evidence').insert({
        test_run_id: testRunId,
        project_id: project.id,
        type: 'navigation',
        title: 'Initial Page Navigation',
        url: result.finalUrl || targetUrl,
        message: result.pageTitle || 'Navigation Completed',
        metadata: {
          targetUrl,
          finalUrl: result.finalUrl,
          pageTitle: result.pageTitle,
          statusCode: result.statusCode,
          durationMs: result.durationMs,
        },
      });

      // 5e. Save Application Discovery Map
      if (result.applicationMap) {
        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'application_map',
          title: `Application Discovery Map (${result.applicationMap.totalPages} Pages Mapped)`,
          url: result.applicationMap.startUrl,
          message: `Discovered ${result.applicationMap.totalPages} pages, ${result.applicationMap.totalForms} forms, ${result.applicationMap.totalButtons} buttons, and ${result.applicationMap.totalLinks} links.`,
          metadata: {
            applicationMap: result.applicationMap,
          },
        });
      }

      // 5f. Save User Journey Results
      if (result.journeyResults && result.journeyResults.length > 0) {
        for (const jRes of result.journeyResults) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'journey_result',
            title: `User Journey: ${jRes.name}`,
            url: result.finalUrl || targetUrl,
            message: `Journey [${jRes.status}] - ${jRes.actionsPassed} passed, ${jRes.actionsFailed} failed, ${jRes.actionsSkipped} skipped across ${jRes.steps.length} steps.`,
            metadata: {
              journeyResult: jRes,
            },
          });
        }
      }

      // 5g. Save Visual & Responsive QA Evidence
      if (result.visualResult) {
        // Visual Comparisons
        for (const comp of result.visualResult.comparisons) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'visual_comparison',
            title: `Visual Comparison: ${comp.viewport.name.toUpperCase()} (${comp.status})`,
            url: comp.pageUrl,
            message: `Visual diff ratio: ${(comp.pixelDifferenceRatio * 100).toFixed(2)}% (${comp.changedPixelCount} px changed) - Status: ${comp.status}`,
            metadata: {
              comparison: comp,
            },
          });
        }

        // Responsive Observations
        for (const obs of result.visualResult.observations) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'responsive_observation',
            title: `Responsive QA: ${obs.type} on ${obs.viewport.name}`,
            url: obs.pageUrl,
            message: obs.description,
            metadata: {
              observation: obs,
            },
          });
        }
      }

      // 5h. Persist Deterministic Bug Observations & Issues
      if (result.bugObservations && result.bugObservations.length > 0) {
        const issueManager = new IssueManager(logger);
        await issueManager.persistBugs(
          this.supabase,
          result.bugObservations,
          testRunId,
          project.id,
          project.organization_id
        );
      }

      // 5i. Persist AI QA Plans & Results
      if (result.aiQaPlans && result.aiQaPlans.length > 0) {
        for (const plan of result.aiQaPlans) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'ai_qa_plan',
            title: `AI QA Plan (Iter ${plan.iteration}) - ${plan.priority.toUpperCase()}`,
            url: result.finalUrl || targetUrl,
            message: plan.reasoningSummary,
            metadata: {
              plan,
            },
          });
        }
      }

      if (result.aiQaResults && result.aiQaResults.length > 0) {
        for (const res of result.aiQaResults) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'ai_qa_result',
            title: `AI QA Result (Iter ${res.iteration}) - ${res.stopReason}`,
            url: result.finalUrl || targetUrl,
            message: `Iteration ${res.iteration} (${res.provider}/${res.model}): ${res.approvedActions.length} approved, ${res.rejectedActions.length} rejected, ${res.issuesIdentified.length} issues identified.`,
            metadata: {
              result: res,
            },
          });
        }
      }

      // 5j. Persist AI QA State Summary
      if (result.aiQaStateSummary) {
        const summary = result.aiQaStateSummary;
        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'ai_qa_state_summary',
          title: `Adaptive AI QA State Summary (Iter ${summary.iteration})`,
          url: result.finalUrl || targetUrl,
          message: `Coverage: ${summary.coverage.pages.visited}/${summary.coverage.pages.discovered} pages, ${summary.coverage.forms.exercised}/${summary.coverage.forms.discovered} forms, ${summary.coverage.buttons.exercised}/${summary.coverage.buttons.discovered} buttons. Hypotheses: ${summary.coverage.hypotheses.confirmed} confirmed, ${summary.coverage.hypotheses.disproven} disproven.`,
          metadata: {
            stateSummary: summary,
          },
        });
      }

      // 5k. Persist AI QA Stop Summary
      if (result.aiQaResults && result.aiQaResults.length > 0) {
        const lastResult = result.aiQaResults[result.aiQaResults.length - 1];
        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'ai_qa_stop',
          title: `AI QA Execution Stopped: ${lastResult.stopReason}`,
          url: result.finalUrl || targetUrl,
          message: `Orchestration concluded after ${result.aiQaResults.length} iterations with reason: ${lastResult.stopReason}.`,
          metadata: {
            stopReason: lastResult.stopReason,
            totalIterations: result.aiQaResults.length,
            provider: lastResult.provider,
            model: lastResult.model,
          },
        });
      }

      // 5l. Persist Strategy Decisions
      if (result.strategyDecisions && result.strategyDecisions.length > 0) {
        for (const decision of result.strategyDecisions) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'strategy_decision',
            title: `AI Test Strategy (Iter ${decision.iteration}) — ${decision.mode}`,
            url: result.finalUrl || targetUrl,
            message: `Strategy Mode: ${decision.mode}. Selected ${decision.selectedTargets.length} target(s). Fallback: ${decision.isFallback ? 'Yes' : 'No'}. ${decision.aiRecommendation?.strategyRationale || ''}`,
            metadata: {
              decision,
              mode: decision.mode,
              iteration: decision.iteration,
              selectedTargets: decision.selectedTargets,
              isFallback: decision.isFallback,
            },
          });
        }
      }

      // 5m. Persist AI Product Understanding & Workflow Discovery Evidence
      if (result.productModel) {
        const pm = result.productModel;
        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'product_model',
          title: `AI Product Model — ${pm.applicationProfile.primaryType} (${pm.features.length} features, ${pm.workflows.length} workflows)`,
          url: result.finalUrl || targetUrl,
          message: `Identified as "${pm.applicationProfile.primaryType}" with ${pm.features.length} feature capabilities, ${pm.workflows.length} workflows (${pm.coverage.highCriticalityWorkflowsTotal} high/critical), ${pm.roles.length} roles. Workflow Coverage: ${(pm.coverage.workflowCoverageRatio * 100).toFixed(0)}%.`,
          metadata: {
            productModel: pm,
            applicationProfile: pm.applicationProfile,
            coverage: pm.coverage,
            featuresCount: pm.features.length,
            workflowsCount: pm.workflows.length,
            rolesCount: pm.roles.length,
          },
        });

        // Persist individual high-criticality workflows
        for (const wf of pm.workflows) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'product_workflow',
            title: `Product Workflow: ${wf.name} [${wf.criticality.level}] (${wf.executionStatus})`,
            url: wf.entryPoint || result.finalUrl || targetUrl,
            message: `Goal: ${wf.goal}. Role: ${wf.roleName || 'User'}. Steps: ${wf.steps.length}. Status: ${wf.executionStatus}. Criticality Score: ${wf.criticality.score}/100.`,
            metadata: {
              workflow: wf,
              criticality: wf.criticality,
              steps: wf.steps,
              executionStatus: wf.executionStatus,
            },
          });
        }
      }

      // 5n. Persist Authenticated Sessions & Role Context Evidence
      if (result.authenticatedSessions && result.authenticatedSessions.length > 0) {
        for (const session of result.authenticatedSessions) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'authenticated_session',
            title: `Authenticated Session: ${session.role} [${session.outcome}]`,
            url: session.finalUrl || targetUrl,
            message: `Identity "${session.identityId}" (${session.role}): ${session.outcome}. Discovered ${session.discoveredPagesCount || 0} authenticated page(s).`,
            metadata: {
              identityId: session.identityId,
              role: session.role,
              outcome: session.outcome,
              authenticated: session.authenticated,
              authenticatedAt: session.authenticatedAt,
              discoveredPagesCount: session.discoveredPagesCount,
              telemetryEvidence: session.telemetryEvidence,
            },
          });
        }
      }

      if (result.roleContexts && result.roleContexts.length > 0) {
        for (const roleCtx of result.roleContexts) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'role_context',
            title: `Role Context: ${roleCtx.roleName}`,
            url: targetUrl,
            message: `Role "${roleCtx.roleName}" (${roleCtx.roleId}): ${roleCtx.capabilities.length} capabilities, ${roleCtx.discoveredPageUrls.length} pages mapped.`,
            metadata: {
              roleContext: roleCtx,
            },
          });
        }
      }

      // 5o. Persist Authorization Checks & Security Findings
      if (result.authorizationResults && result.authorizationResults.length > 0) {
        for (const authRes of result.authorizationResults) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: authRes.isUnauthorizedAccess ? 'unauthorized_access' : 'authorization_check',
            title: authRes.isUnauthorizedAccess
              ? `SECURITY VIOLATION: Unauthorized Access (${authRes.role} -> ${authRes.path})`
              : `Authorization Check: ${authRes.role} -> ${authRes.path} [${authRes.status}]`,
            url: authRes.finalUrl || targetUrl,
            message: `Expected: ${authRes.expectedAccess}, Observed: ${authRes.observedAccess} (${authRes.denialReason || `HTTP ${authRes.statusCode || '200'}`}). Status: ${authRes.status}.`,
            metadata: {
              authorizationCheck: authRes,
            },
          });
        }
      }

      // 5p. Persist Role Differences
      if (result.roleComparisons && result.roleComparisons.length > 0) {
        for (const comp of result.roleComparisons) {
          await this.supabase.from('test_evidence').insert({
            test_run_id: testRunId,
            project_id: project.id,
            type: 'role_difference',
            title: `Role Surface Comparison: ${comp.roleA} vs ${comp.roleB}`,
            url: targetUrl,
            message: comp.comparisonSummary,
            metadata: {
              comparison: comp,
            },
          });
        }
      }

    } catch (evidenceErr: any) {
      logger.warn('evidence_persistence_warning', { message: evidenceErr.message });
    }

    // 6. Compute Deterministic Release Readiness Assessment
    let assessment: ReleaseAssessment | undefined;
    try {
      // 6a. Fetch previous release score for this project for historical delta comparison
      let previousAssessment: { overallScore: number; testRunId?: string; createdAt?: string } | undefined;
      try {
        const { data: prevScore } = await this.supabase
          .from('release_scores')
          .select('overall_score, test_run_id, created_at')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevScore && typeof prevScore.overall_score === 'number') {
          previousAssessment = {
            overallScore: prevScore.overall_score,
            testRunId: prevScore.test_run_id,
            createdAt: prevScore.created_at,
          };
        }
      } catch {
        // Ignore previous score lookup failure
      }

      // 6b. Calculate Authoritative Deterministic Release Assessment
      assessment = DeterministicReleaseScorer.calculateAssessment({
        testRunId,
        projectId: project.id,
        organizationId: project.organization_id,
        testRunStatus: result.status,
        targetUrl,
        applicationMap: result.applicationMap,
        journeyResults: result.journeyResults,
        bugObservations: result.bugObservations,
        visualResult: result.visualResult,
        consoleErrors: result.consoleErrors,
        networkErrors: result.networkErrors,
        aiQaStateSummary: result.aiQaStateSummary,
        productModel: result.productModel,
        authorizationResults: result.authorizationResults,
        previousAssessment,
      });

      // 6c. Run AI Release Analysis (OpenAI or Mock Provider)
      try {
        const provider = createAIQAProvider();
        const analyzer = new ReleaseAnalyzer(provider, logger);
        const aiAnalysis = await analyzer.analyze(assessment, targetUrl, cancellationToken);
        if (aiAnalysis) {
          assessment.aiAnalysis = aiAnalysis;
        }
      } catch (aiErr: any) {
        logger.warn('ai_release_analysis_warning', { message: aiErr.message });
      }

      // 6d. Persist Release Score Record to public.release_scores
      await this.supabase.from('release_scores').insert({
        organization_id: project.organization_id || null,
        project_id: project.id,
        test_run_id: testRunId,
        overall_score: assessment.overallScore,
        functionality_score: assessment.scores.functional,
        ui_score: assessment.scores.visual,
        responsive_score: assessment.scores.responsive,
        performance_score: assessment.scores.reliability,
        accessibility_score: assessment.scores.coverage,
        security_score: 100,
        recommendation: assessment.recommendation,
        risk_level: assessment.riskLevel,
        confidence_level: assessment.confidenceLevel,
        scoring_version: assessment.scoringVersion,
        blockers_count: assessment.blockers.length,
        reliability_score: assessment.scores.reliability,
        coverage_score: assessment.scores.coverage,
        breakdown: assessment.breakdown,
        blockers: assessment.blockers,
        ai_analysis: assessment.aiAnalysis || null,
        metadata: {
          evaluatedAt: assessment.evaluatedAt,
          targetUrl,
        },
      });

      // 6e. Persist Release Report Evidence
      const markdownReport = ReleaseReportGenerator.generateMarkdownReport(assessment, {
        targetUrl,
        projectName: project.name,
        durationMs: result.durationMs,
        testRunStatus: result.status,
      });

      await this.supabase.from('test_evidence').insert({
        test_run_id: testRunId,
        project_id: project.id,
        type: 'release_report',
        title: `Release Readiness Assessment: ${assessment.scores.overall}/100 (${assessment.recommendation})`,
        url: result.finalUrl || targetUrl,
        message: markdownReport,
        metadata: {
          assessment,
          scoringVersion: assessment.scoringVersion,
          overallScore: assessment.overallScore,
          recommendation: assessment.recommendation,
          riskLevel: assessment.riskLevel,
          confidenceLevel: assessment.confidenceLevel,
        },
      });

    } catch (scoringErr: any) {
      logger.error('release_scoring_error', { message: scoringErr.message });
    }

    // 7. Update Test Run Final Status and Overall Score
    await this.updateTestRunState(testRunId, result.status, {
      completed_at: completedAt,
      duration_ms: result.durationMs,
      overall_score: assessment ? assessment.overallScore : null,
    });

    logger.log('job_execution_finished', {
      finalStatus: result.status,
      durationMs: result.durationMs,
      overallScore: assessment ? assessment.overallScore : null,
      recommendation: assessment ? assessment.recommendation : 'N/A',
    });

    return {
      success: result.status === 'passed',
      status: result.status,
      error: result.failureReason,
    };
  }

  private async updateTestRunState(
    testRunId: string,
    status: string,
    additionalFields: Record<string, any> = {}
  ) {
    if (!this.supabase) return;
    try {
      await this.supabase
        .from('test_runs')
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...additionalFields,
        })
        .eq('id', testRunId);
    } catch (err) {
      console.error(`[JobExecutor]: Failed updating test run state to ${status}`, err);
    }
  }
}
