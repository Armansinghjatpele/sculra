// ==============================================================================
// Sculra AI Release Analysis JSON Schema & Normalization (worker/src/release/schema.ts)
// ==============================================================================

import { AIReleaseAnalysis } from './types';

export const AI_RELEASE_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Executive overview summarizing release readiness and key observations.',
    },
    keyRisks: {
      type: 'array',
      items: { type: 'string' },
      description: 'The highest priority risks or potential regressions observed.',
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Validated stable areas and clean user journeys.',
    },
    evidenceGaps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Uncovered routes, missing baselines, or unexercised forms requiring verification.',
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concrete prioritized next steps before deployment or for follow-up testing.',
    },
    releaseExplanation: {
      type: 'string',
      description: 'Plain-English justification of the release recommendation based on deterministic evidence.',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'Confidence in this assessment given the available evidence scope.',
    },
  },
  required: [
    'summary',
    'keyRisks',
    'strengths',
    'evidenceGaps',
    'recommendedActions',
    'releaseExplanation',
    'confidence',
  ],
  additionalProperties: false,
} as const;

export function validateAndNormalizeReleaseAnalysis(raw: any): AIReleaseAnalysis {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Malformed AI release analysis: expected JSON object.');
  }

  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : 'Release readiness assessment complete.';
  const releaseExplanation =
    typeof raw.releaseExplanation === 'string'
      ? raw.releaseExplanation.trim()
      : 'Assessment determined based on deterministic test evidence.';

  const keyRisks = Array.isArray(raw.keyRisks)
    ? raw.keyRisks.filter((r: any) => typeof r === 'string' && r.trim().length > 0).map((r: string) => r.trim())
    : [];

  const strengths = Array.isArray(raw.strengths)
    ? raw.strengths.filter((s: any) => typeof s === 'string' && s.trim().length > 0).map((s: string) => s.trim())
    : [];

  const evidenceGaps = Array.isArray(raw.evidenceGaps)
    ? raw.evidenceGaps.filter((g: any) => typeof g === 'string' && g.trim().length > 0).map((g: string) => g.trim())
    : [];

  const recommendedActions = Array.isArray(raw.recommendedActions)
    ? raw.recommendedActions.filter((a: any) => typeof a === 'string' && a.trim().length > 0).map((a: string) => a.trim())
    : [];

  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low') {
    confidence = raw.confidence;
  }

  return {
    summary,
    keyRisks,
    strengths,
    evidenceGaps,
    recommendedActions,
    releaseExplanation,
    confidence,
  };
}
