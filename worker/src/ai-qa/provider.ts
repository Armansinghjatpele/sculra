import { AIQAContext, AIQAPlan, AIQAProviderMetadata } from './types';
import { CancellationToken } from '../types';
import { ReleaseAnalysisContext } from '../release/analyzer';
import { AIReleaseAnalysis } from '../release/types';
import { StrategyAnalysisContext, AIStrategyRecommendation } from '../strategy/types';

export interface AIQAProvider {
  readonly metadata: AIQAProviderMetadata;

  /**
   * Generates a structured, validatable AIQAPlan given a sanitized AIQAContext.
   * Must not execute any browser actions directly.
   */
  generatePlan(
    context: AIQAContext,
    cancellationToken?: CancellationToken
  ): Promise<AIQAPlan>;

  /**
   * Generates a structured AIReleaseAnalysis given a sanitized ReleaseAnalysisContext.
   * Must not modify numeric release scores or blockers.
   */
  analyzeRelease?(
    context: ReleaseAnalysisContext,
    cancellationToken?: CancellationToken
  ): Promise<AIReleaseAnalysis>;

  /**
   * Evaluates autonomous test strategy, target ranking, and hypotheses given StrategyAnalysisContext.
   * Must only select from candidate targets provided.
   */
  analyzeTestStrategy?(
    context: StrategyAnalysisContext,
    cancellationToken?: CancellationToken
  ): Promise<AIStrategyRecommendation>;
}

