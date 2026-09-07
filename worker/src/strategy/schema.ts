// ==============================================================================
// Sculra AI Strategy Decision JSON Schema (worker/src/strategy/schema.ts)
// ==============================================================================
// OpenAI Structured Outputs JSON schema and deterministic validator for AI strategy decisions.

import { AIStrategyRecommendation, StrategyMode, TestTarget } from './types';

export const AI_STRATEGY_DECISION_JSON_SCHEMA = {
  name: 'ai_strategy_decision',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      recommendedMode: {
        type: 'string',
        enum: ['BREADTH_FIRST', 'DEPTH_FIRST', 'FAILURE_DRIVEN', 'REGRESSION_FOCUSED', 'RELEASE_GAP'],
        description: 'Recommended strategy mode for this iteration.',
      },
      selectedTargetIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of target IDs selected from the provided candidate list in priority order. Do NOT invent new IDs.',
      },
      investigationHypotheses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique hypothesis identifier.' },
            description: { type: 'string', description: 'Plain-English test hypothesis.' },
            targetUrl: { type: 'string', description: 'Target URL under investigation.' },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Confidence in hypothesis.',
            },
            supportingEvidence: { type: 'string', description: 'Telemetry or structural evidence.' },
          },
          required: ['id', 'description', 'targetUrl', 'confidence', 'supportingEvidence'],
          additionalProperties: false,
        },
        description: 'Targeted test hypotheses to experimentally verify.',
      },
      strategyRationale: {
        type: 'string',
        description: 'Clear, concise explanation of why these targets and mode were selected.',
      },
      recommendedFocus: {
        type: 'string',
        enum: ['BREADTH', 'DEPTH', 'FAILURE_INVESTIGATION', 'RELEASE_VERIFICATION'],
        description: 'Recommended focus for resource allocation.',
      },
      suggestedStop: {
        type: 'boolean',
        description: 'True if sufficient evidence exists and testing should conclude.',
      },
      stopReason: {
        type: 'string',
        description: 'Explanation if suggestedStop is true.',
      },
    },
    required: [
      'recommendedMode',
      'selectedTargetIds',
      'investigationHypotheses',
      'strategyRationale',
      'recommendedFocus',
      'suggestedStop',
      'stopReason',
    ],
    additionalProperties: false,
  },
} as const;

/**
 * Validates and normalizes raw AI strategy outputs against available candidates.
 * CRITICAL SAFETY: Strips any target IDs that were NOT in the candidate target list.
 */
export function validateAndNormalizeStrategyDecision(
  raw: any,
  validCandidates: TestTarget[],
  defaultMode: StrategyMode = 'BREADTH_FIRST'
): AIStrategyRecommendation {
  if (!raw || typeof raw !== 'object') {
    return createFallbackRecommendation(validCandidates, defaultMode, 'AI output was not a valid object.');
  }

  const validTargetIds = new Set(validCandidates.map((c) => c.id));

  // 1. Validate Mode
  const validModes: StrategyMode[] = [
    'BREADTH_FIRST',
    'DEPTH_FIRST',
    'FAILURE_DRIVEN',
    'REGRESSION_FOCUSED',
    'RELEASE_GAP',
  ];
  const recommendedMode: StrategyMode = validModes.includes(raw.recommendedMode)
    ? raw.recommendedMode
    : defaultMode;

  // 2. Validate Selected Target IDs (AI must NOT invent targets)
  let selectedTargetIds: string[] = [];
  if (Array.isArray(raw.selectedTargetIds)) {
    selectedTargetIds = raw.selectedTargetIds
      .filter((id: any) => typeof id === 'string' && validTargetIds.has(id))
      .slice(0, 5);
  }

  // If AI selected 0 valid targets, fallback to top deterministic candidate
  if (selectedTargetIds.length === 0 && validCandidates.length > 0) {
    selectedTargetIds = [validCandidates[0].id];
  }

  // 3. Validate Hypotheses
  const investigationHypotheses: AIStrategyRecommendation['investigationHypotheses'] = [];
  if (Array.isArray(raw.investigationHypotheses)) {
    for (const h of raw.investigationHypotheses) {
      if (h && typeof h === 'object' && typeof h.description === 'string') {
        investigationHypotheses.push({
          id: typeof h.id === 'string' ? h.id : `hyp-strat-${investigationHypotheses.length + 1}`,
          description: h.description.substring(0, 300),
          targetUrl: typeof h.targetUrl === 'string' ? h.targetUrl : (validCandidates[0]?.pageUrl || ''),
          confidence: ['high', 'medium', 'low'].includes(h.confidence) ? h.confidence : 'medium',
          supportingEvidence: typeof h.supportingEvidence === 'string' ? h.supportingEvidence.substring(0, 300) : '',
        });
      }
    }
  }

  // 4. Validate Focus
  const validFocuses = ['BREADTH', 'DEPTH', 'FAILURE_INVESTIGATION', 'RELEASE_VERIFICATION'] as const;
  const recommendedFocus = validFocuses.includes(raw.recommendedFocus)
    ? raw.recommendedFocus
    : recommendedMode === 'FAILURE_DRIVEN'
    ? 'FAILURE_INVESTIGATION'
    : recommendedMode === 'DEPTH_FIRST'
    ? 'DEPTH'
    : 'BREADTH';

  return {
    recommendedMode,
    selectedTargetIds,
    investigationHypotheses,
    strategyRationale:
      typeof raw.strategyRationale === 'string'
        ? raw.strategyRationale.substring(0, 600)
        : 'AI prioritized candidate targets based on current QA state and risk analysis.',
    recommendedFocus,
    suggestedStop: Boolean(raw.suggestedStop),
    stopReason: typeof raw.stopReason === 'string' ? raw.stopReason.substring(0, 300) : undefined,
  };
}

export function createFallbackRecommendation(
  validCandidates: TestTarget[],
  mode: StrategyMode,
  reason: string
): AIStrategyRecommendation {
  const topCandidateIds = validCandidates.slice(0, 3).map((c) => c.id);
  return {
    recommendedMode: mode,
    selectedTargetIds: topCandidateIds,
    investigationHypotheses: [],
    strategyRationale: `Deterministic Fallback: ${reason}. Selected top ranked candidate target(s).`,
    recommendedFocus: mode === 'FAILURE_DRIVEN' ? 'FAILURE_INVESTIGATION' : 'BREADTH',
    suggestedStop: validCandidates.length === 0,
    stopReason: validCandidates.length === 0 ? 'No viable candidates remaining.' : undefined,
  };
}
