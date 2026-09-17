// ==============================================================================
// Sculra Master Remediation & Root Cause Analyzer (worker/src/remediation/analyzer.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  RemediationAnalysis,
  RemediationAnalysisContext,
  FailureObservation,
  BugDiagnosis,
  RootCauseHypothesis,
  FixPlan,
  VerificationPlan,
  DiagnosisStatus,
  DiagnosisConfidence,
} from './types';
import { REMEDIATION_POLICY } from './policy';
import { EvidenceContextBundler } from './evidence-context';
import { StackTraceParser } from './stack-trace';
import { ErrorParser } from './error-parser';
import { SourceMapResolver } from './source-map';
import { CodeContextSelector } from './code-context';
import { ChangeContextCorrelator } from './change-context';
import { HistoryContextCorrelator } from './history-context';
import { RemediationCandidateGenerator } from './candidate-generator';
import { HypothesisValidator } from './hypothesis-validator';
import { ConfidenceCalculator } from './confidence';
import { FixPlanner } from './fix-plan';
import { VerificationPlanner } from './verification-plan';
import { AIRootCauseAnalyzer } from './ai-analyzer';
import { RemediationEvidenceFormatter } from './evidence';
import { WorkerLogger } from '../logger';
import { BugObservation } from '../issues/types';

export class RemediationAnalyzer {
  private logger: WorkerLogger;
  private aiAnalyzer: AIRootCauseAnalyzer;

  constructor(logger?: WorkerLogger, aiAnalyzer?: AIRootCauseAnalyzer) {
    this.logger = logger || new WorkerLogger('remediation_analyzer');
    this.aiAnalyzer = aiAnalyzer || new AIRootCauseAnalyzer();
  }

  /**
   * Executes end-to-end code-aware bug diagnosis and fix planning for an observed failure.
   */
  async analyze(
    context: RemediationAnalysisContext,
    supabase?: SupabaseClient | null
  ): Promise<RemediationAnalysis> {
    const startTime = Date.now();
    const {
      observation: rawObservation,
      projectId,
      organizationId,
      campaignId,
      testRunId,
      fileMap = new Map<string, string>(),
      sourceMaps = new Map<string, string>(),
      changeAnalysis,
      historicalRuns = [],
      historicalFindings = [],
      githubToken,
      repoOwner,
      repoName,
    } = context;

    // 1. Normalize Failure Observation
    const observation: FailureObservation =
      'sourceObservation' in rawObservation
        ? {
            ...(rawObservation as FailureObservation),
            bugType: (rawObservation as FailureObservation).bugType || (rawObservation as any).type || 'UNKNOWN_FAILURE',
          }
        : (rawObservation as any).bugType
        ? (rawObservation as unknown as FailureObservation)
        : EvidenceContextBundler.normalizeObservation(rawObservation as unknown as BugObservation);

    const issueId = observation.issueId || `issue-${observation.fingerprint.slice(0, 12)}`;
    this.logger.log('remediation_analysis_started', {
      issueId,
      fingerprint: observation.fingerprint,
      bugType: observation.bugType,
    });

    // 2. Parse Stack Trace & Errors
    let stackFrames = StackTraceParser.parse(observation.stackTrace || '');
    if (sourceMaps.size > 0 && stackFrames.length > 0) {
      stackFrames = stackFrames.map((f) => {
        const mapData = sourceMaps.get(f.filePath) || sourceMaps.get('./' + f.filePath);
        return SourceMapResolver.resolveFrame(f, mapData);
      });
    }

    const parsedError = ErrorParser.parse(observation.errorMessage || observation.consoleError || '');

    // 3. Correlate Change Context (Prompt 32)
    const changeContext = ChangeContextCorrelator.correlate(observation, changeAnalysis);

    // 4. Correlate Historical Context (Prompt 28)
    const historyContext = HistoryContextCorrelator.correlate(
      observation,
      historicalRuns,
      historicalFindings
    );

    // 5. Select & Retrieve Relevant Code Context
    const changedFileNames = changeContext.relevantChanges.map((c) => c.file);
    const codeContext = await CodeContextSelector.selectContext({
      stackFrames,
      changedFiles: changedFileNames,
      targetUrl: observation.url,
      apiEndpoint: observation.apiEndpoint,
      mentionedFiles: parsedError.mentionedFiles,
      fileMap,
      githubToken,
      repoOwner,
      repoName,
      commitRef: changeContext.commitSha,
    });

    // 6. Bundle Empirical Evidence
    const evidenceList = EvidenceContextBundler.bundleEvidence(observation);

    // 7. Generate Deterministic Candidate Hypotheses
    const candidateHypotheses = RemediationCandidateGenerator.generateCandidates(
      observation,
      evidenceList,
      codeContext,
      changeContext,
      historyContext
    );

    // 8. Attempt AI Root Cause Analysis (Structured Outputs)
    const existingTargets = [observation.url];
    if (observation.apiEndpoint && observation.apiEndpoint !== observation.url) {
      existingTargets.push(observation.apiEndpoint);
    }

    let diagnosis: BugDiagnosis;
    let hypotheses: RootCauseHypothesis[];
    let fixPlan: FixPlan;
    let verificationPlan: VerificationPlan;
    let telemetryInfo: any;

    const aiResult = await this.aiAnalyzer.analyze(
      observation,
      evidenceList,
      codeContext,
      changeContext,
      historyContext,
      candidateHypotheses,
      existingTargets
    );

    if (aiResult) {
      // AI analysis succeeded
      hypotheses = HypothesisValidator.validateHypotheses(
        aiResult.hypotheses,
        observation,
        evidenceList,
        codeContext,
        changeContext,
        historyContext
      );

      fixPlan = aiResult.fixPlan;
      verificationPlan = aiResult.verificationPlan;
      telemetryInfo = aiResult.telemetry;

      // Select primary supported hypothesis
      const primaryHypothesis = hypotheses.find((h) => h.status === 'SUPPORTED') || hypotheses[0];
      const conf = ConfidenceCalculator.evaluate(
        observation,
        primaryHypothesis,
        codeContext,
        changeContext,
        historyContext
      );

      diagnosis = {
        ...aiResult.diagnosis,
        confidence: conf.level,
        directLocations: stackFrames.map((f) => ({
          filePath: f.originalFilePath || f.filePath,
          line: f.originalLine || f.line,
          functionName: f.functionName,
        })),
        provenanceTrail: ['DIRECT_QA_EVIDENCE', 'AI_INFERENCE'],
      };
    } else {
      // Deterministic Fallback Analysis
      const validatedCandidates = HypothesisValidator.validateHypotheses(
        candidateHypotheses,
        observation,
        evidenceList,
        codeContext,
        changeContext,
        historyContext
      );

      hypotheses = validatedCandidates;
      const primaryHypothesis =
        hypotheses.find((h) => h.status === 'SUPPORTED') ||
        hypotheses.find((h) => h.status === 'WEAKLY_SUPPORTED') ||
        hypotheses[0];

      const conf = ConfidenceCalculator.evaluate(
        observation,
        primaryHypothesis,
        codeContext,
        changeContext,
        historyContext
      );

      fixPlan = FixPlanner.generateFixPlan(primaryHypothesis, observation, codeContext);
      verificationPlan = VerificationPlanner.generateVerificationPlan(primaryHypothesis, observation);

      let status: DiagnosisStatus = 'DIAGNOSED';
      if (codeContext.isPartial) {
        status = 'PARTIAL';
      } else if (conf.level === 'VERY_LOW' && (!primaryHypothesis || primaryHypothesis.status === 'REJECTED')) {
        status = 'INSUFFICIENT_EVIDENCE';
      }

      diagnosis = {
        summary: primaryHypothesis
          ? primaryHypothesis.statement
          : `Diagnosed ${observation.bugType} on ${observation.url}`,
        category: primaryHypothesis ? primaryHypothesis.category : 'UNKNOWN',
        status,
        confidence: conf.level,
        directLocations: stackFrames.map((f) => ({
          filePath: f.originalFilePath || f.filePath,
          line: f.originalLine || f.line,
          functionName: f.functionName,
        })),
        explanation: primaryHypothesis
          ? `${primaryHypothesis.statement} Supported by ${primaryHypothesis.supportingEvidenceIds.length} evidence items.`
          : 'Determined from empirical runtime observations.',
        limitations: codeContext.isPartial ? [codeContext.partialReason || 'Context bounded'] : [],
        provenanceTrail: ['DIRECT_QA_EVIDENCE', ...(stackFrames.length > 0 ? ['RUNTIME_ERROR_STACK' as const] : [])],
      };

      telemetryInfo = {
        provider: 'deterministic_engine',
        model: 'sculra_deterministic_v1',
        latencyMs: Date.now() - startTime,
        aiRequestCount: 0,
        deterministicFallback: true,
      };
    }

    // 9. Assemble Full Remediation Analysis Record
    const analysisResult: RemediationAnalysis = {
      id: `remediation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      organizationId,
      projectId,
      issueId,
      campaignId,
      testRunId,
      fingerprint: observation.fingerprint,
      analysisVersion: REMEDIATION_POLICY.CURRENT_ANALYSIS_VERSION,
      status: diagnosis.status,
      confidence: diagnosis.confidence,
      diagnosis,
      hypotheses,
      fixPlan,
      verificationPlan,
      codeContextSummary: {
        filesRetrieved: codeContext.files.length,
        symbolsIdentified: codeContext.symbols.length,
        isPartial: codeContext.isPartial,
        partialReason: codeContext.partialReason,
      },
      changeContextSummary: {
        commitSha: changeContext.commitSha,
        hasRelevantChanges: changeContext.hasRelevantCodeChange,
        relationship: changeContext.relevantChanges[0]?.relationship || 'NO_KNOWN_CHANGE_RELATIONSHIP',
      },
      historicalContextSummary: {
        isRecurring: historyContext.isRecurring,
        isRecentRegression: historyContext.isRecentRegression,
        totalOccurrences: historyContext.totalOccurrences,
      },
      telemetry: telemetryInfo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 10. Persist to Supabase if client is available
    if (supabase) {
      await this.persistAnalysis(supabase, analysisResult);
    }

    this.logger.log('remediation_analysis_completed', {
      issueId,
      status: analysisResult.status,
      confidence: analysisResult.confidence,
      category: analysisResult.diagnosis.category,
      hypothesesCount: analysisResult.hypotheses.length,
      latencyMs: Date.now() - startTime,
    });

    return analysisResult;
  }

  /**
   * Persists the remediation analysis and associated test_evidence records.
   */
  private async persistAnalysis(
    supabase: SupabaseClient,
    analysis: RemediationAnalysis
  ): Promise<void> {
    try {
      // 1. Insert into public.issue_remediation_analyses
      await supabase.from('issue_remediation_analyses').insert({
        organization_id: analysis.organizationId || null,
        project_id: analysis.projectId,
        issue_id: analysis.issueId,
        campaign_id: analysis.campaignId || null,
        test_run_id: analysis.testRunId || null,
        fingerprint: analysis.fingerprint,
        analysis_version: analysis.analysisVersion,
        status: analysis.status,
        confidence: analysis.confidence,
        diagnosis: analysis.diagnosis,
        hypotheses: analysis.hypotheses,
        fix_plan: analysis.fixPlan,
        verification_plan: analysis.verificationPlan,
        code_context_summary: analysis.codeContextSummary,
        change_context_summary: analysis.changeContextSummary,
        historical_context_summary: analysis.historicalContextSummary,
        telemetry: analysis.telemetry,
        metadata: analysis.metadata || {},
      });

      // 2. Persist formatted test_evidence records
      const evidencePayloads = RemediationEvidenceFormatter.formatEvidence(analysis);
      for (const ep of evidencePayloads) {
        await supabase.from('test_evidence').insert(ep);
      }
    } catch (err: any) {
      this.logger.warn('remediation_persistence_failed', {
        message: err?.message || String(err),
      });
    }
  }
}
