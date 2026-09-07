// ==============================================================================
// Sculra AI Release Risk & Narrative Analyzer (worker/src/release/analyzer.ts)
// ==============================================================================
// Provider-agnostic AI interpretation layer that translates deterministic release
// scores and evidence into structured executive summaries, risk rankings, and actions.

import { AIQAProvider } from '../ai-qa/provider';
import { CancellationToken } from '../types';
import { WorkerLogger } from '../logger';
import { AIQAContextSanitizer } from '../ai-qa/sanitizer';
import {
  ReleaseAssessment,
  AIReleaseAnalysis,
} from './types';
import { validateAndNormalizeReleaseAnalysis } from './schema';

export interface ReleaseAnalysisContext {
  testRunId: string;
  targetUrl: string;
  overallScore: number;
  categoryScores: ReleaseAssessment['scores'];
  recommendation: ReleaseAssessment['recommendation'];
  riskLevel: ReleaseAssessment['riskLevel'];
  confidenceLevel: ReleaseAssessment['confidenceLevel'];
  blockers: ReleaseAssessment['blockers'];
  topIssues: Array<{
    title: string;
    type: string;
    severity: string;
    url: string;
    occurrences?: number;
  }>;
  coverageSummary: {
    pagesVisited: number;
    pagesDiscovered: number;
    formsExercised: number;
    formsDiscovered: number;
    buttonsExercised: number;
    buttonsDiscovered: number;
    viewportsTested: number;
  };
  scoreBreakdownText: string;
}

export class ReleaseAnalyzer {
  private provider: AIQAProvider;
  private logger: WorkerLogger;

  constructor(provider: AIQAProvider, logger?: WorkerLogger) {
    this.provider = provider;
    this.logger = logger || new WorkerLogger('release-analyzer');
  }

  /**
   * Generates structured AI release analysis from a completed deterministic ReleaseAssessment.
   * If the AI provider fails, times out, or returns invalid JSON, returns a safe fallback without throwing.
   */
  async analyze(
    assessment: ReleaseAssessment,
    targetUrl: string,
    cancellationToken?: CancellationToken
  ): Promise<AIReleaseAnalysis | undefined> {
    if (cancellationToken?.isCancelled) {
      return undefined;
    }

    try {
      this.logger.log('ai_release_analysis_started', {
        testRunId: assessment.testRunId,
        provider: this.provider.metadata.name,
      });

      // 1. Build Sanitized Context for AI Interpretation
      const context = this.buildSanitizedContext(assessment, targetUrl);

      // 2. Delegate to Provider if method exists
      if (typeof this.provider.analyzeRelease === 'function') {
        const result = await this.provider.analyzeRelease(context, cancellationToken);
        const validated = validateAndNormalizeReleaseAnalysis(result);
        this.logger.log('ai_release_analysis_completed', {
          confidence: validated.confidence,
          keyRisksCount: validated.keyRisks.length,
        });
        return validated;
      }

      // 3. Fallback Deterministic Analysis if provider does not support analyzeRelease
      return this.generateDeterministicFallbackAnalysis(assessment);
    } catch (err: any) {
      this.logger.warn('ai_release_analysis_failed_safe', {
        message: err.message,
        provider: this.provider.metadata.name,
      });
      // Malformed or failed AI analysis must NEVER break release scoring
      return this.generateDeterministicFallbackAnalysis(assessment);
    }
  }

  private buildSanitizedContext(
    assessment: ReleaseAssessment,
    targetUrl: string
  ): ReleaseAnalysisContext {
    const bd = assessment.breakdown;

    // Collect top deductions for summary text
    const allDeductions = [
      ...bd.functional.deductions,
      ...bd.visual.deductions,
      ...bd.responsive.deductions,
      ...bd.reliability.deductions,
    ];

    const topIssues = bd.functional.deductions.slice(0, 5).map((d) => ({
      title: AIQAContextSanitizer.sanitizeString(d.reason),
      type: 'FUNCTIONAL_DEFECT',
      severity: d.points >= 20 ? 'critical' : d.points >= 10 ? 'high' : 'medium',
      url: targetUrl,
    }));

    return {
      testRunId: assessment.testRunId,
      targetUrl: AIQAContextSanitizer.sanitizeString(targetUrl),
      overallScore: assessment.overallScore,
      categoryScores: assessment.scores,
      recommendation: assessment.recommendation,
      riskLevel: assessment.riskLevel,
      confidenceLevel: assessment.confidenceLevel,
      blockers: assessment.blockers.map((b) => ({
        id: b.id,
        title: AIQAContextSanitizer.sanitizeString(b.title),
        reason: AIQAContextSanitizer.sanitizeString(b.reason),
        category: b.category,
        severity: b.severity,
        evidenceSummary: AIQAContextSanitizer.sanitizeString(b.evidenceSummary),
        relatedIssueFingerprints: b.relatedIssueFingerprints,
      })),
      topIssues,
      coverageSummary: {
        pagesVisited: bd.coverage.pages.visited,
        pagesDiscovered: bd.coverage.pages.discovered,
        formsExercised: bd.coverage.forms.exercised,
        formsDiscovered: bd.coverage.forms.discovered,
        buttonsExercised: bd.coverage.buttons.exercised,
        buttonsDiscovered: bd.coverage.buttons.discovered,
        viewportsTested: bd.coverage.viewports.tested,
      },
      scoreBreakdownText: allDeductions
        .slice(0, 6)
        .map((d) => `-[${d.points} pts] (${d.category.toUpperCase()}): ${AIQAContextSanitizer.sanitizeString(d.reason)}`)
        .join('\n'),
    };
  }

  private generateDeterministicFallbackAnalysis(
    assessment: ReleaseAssessment
  ): AIReleaseAnalysis {
    const isReady = assessment.overallScore >= 85 && assessment.blockers.length === 0;
    const isCaution = assessment.overallScore >= 70 && assessment.blockers.filter((b) => b.severity === 'critical').length === 0;

    const keyRisks: string[] = [];
    for (const b of assessment.blockers) {
      keyRisks.push(`[${b.severity.toUpperCase()}] ${b.title}: ${b.reason}`);
    }
    if (assessment.breakdown.responsive.overflowCount > 0) {
      keyRisks.push(`Detected ${assessment.breakdown.responsive.overflowCount} mobile viewport horizontal layout overflow(s).`);
    }
    if (assessment.breakdown.visual.regressionsCount > 0) {
      keyRisks.push(`Detected ${assessment.breakdown.visual.regressionsCount} visual regression(s) against baseline snapshots.`);
    }

    const strengths: string[] = [];
    if (assessment.scores.functional >= 90) strengths.push('Core functional test journeys and API interactions passed reliably.');
    if (assessment.scores.visual >= 90) strengths.push('Visual presentation maintained high alignment across tested views.');
    if (assessment.scores.responsive >= 90) strengths.push('Multi-viewport responsive scaling exhibited zero horizontal clipping.');
    if (assessment.scores.coverage >= 80) strengths.push('Broad structural coverage achieved across discovered pages and interactive controls.');

    const evidenceGaps: string[] = [];
    if (assessment.breakdown.coverage.pages.visited < assessment.breakdown.coverage.pages.discovered) {
      evidenceGaps.push(`${assessment.breakdown.coverage.pages.discovered - assessment.breakdown.coverage.pages.visited} discovered page(s) were not visited during testing.`);
    }
    if (assessment.breakdown.visual.missingBaselinesCount > 0) {
      evidenceGaps.push(`${assessment.breakdown.visual.missingBaselinesCount} viewports established initial baselines without regression comparisons.`);
    }

    const recommendedActions: string[] = [];
    if (assessment.blockers.length > 0) {
      recommendedActions.push(`Resolve ${assessment.blockers.length} active release blocker(s) prior to production deployment.`);
    }
    if (keyRisks.length > 0) {
      recommendedActions.push('Perform targeted QA verification on routes exhibiting responsive overflow or step failures.');
    }
    recommendedActions.push('Establish automated regression test runs in CI/CD pipeline.');

    let releaseExplanation = '';
    if (assessment.confidenceLevel === 'INSUFFICIENT') {
      releaseExplanation = 'Insufficient test evidence captured to provide an authoritative release endorsement.';
    } else if (isReady) {
      releaseExplanation = `Application achieved a high stability score (${assessment.overallScore}/100) with zero active blockers and strong multi-viewport health.`;
    } else if (isCaution) {
      releaseExplanation = `Application scored ${assessment.overallScore}/100 with moderate non-critical risks. Deployment permitted with stakeholder review.`;
    } else {
      releaseExplanation = `Application scored ${assessment.overallScore}/100 and possesses ${assessment.blockers.length} active release blocker(s). Production release is NOT recommended.`;
    }

    return {
      summary: `Release readiness evaluated at ${assessment.overallScore}/100 (${assessment.recommendation.replace(/_/g, ' ')}).`,
      keyRisks: keyRisks.length > 0 ? keyRisks : ['No severe blockers identified in tested workflows.'],
      strengths: strengths.length > 0 ? strengths : ['Basic page navigation established successfully.'],
      evidenceGaps: evidenceGaps.length > 0 ? evidenceGaps : ['All discovered routes and viewports evaluated.'],
      recommendedActions,
      releaseExplanation,
      confidence: assessment.confidenceLevel === 'HIGH' ? 'high' : assessment.confidenceLevel === 'MEDIUM' ? 'medium' : 'low',
    };
  }
}
