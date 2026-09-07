// ==============================================================================
// Sculra AI QA Provider Interface (worker/src/ai-qa/provider.ts)
// ==============================================================================
// Provider-agnostic abstraction for AI QA reasoning & plan generation.

import { AIQAContext, AIQAPlan, AIQAProviderMetadata } from './types';
import { CancellationToken } from '../types';

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
}
