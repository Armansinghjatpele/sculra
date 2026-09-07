// ==============================================================================
// Sculra Strict AI QA Plan JSON Schema & Runtime Validator (worker/src/ai-qa/schema.ts)
// ==============================================================================
// Strict JSON Schema compliant with OpenAI Structured Outputs (json_schema)
// and runtime validation to guarantee safe, deterministic parsing.

import { AIQAPlan, AIQAAction, AIQAHypothesis, AIQAExpectation, AIQAStopCondition } from './types';
import { AIProviderError } from './errors';
import { JourneyActionType } from '../journeys/types';

export const AI_QA_PLAN_JSON_SCHEMA = {
  name: 'ai_qa_plan',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      version: {
        type: 'string',
        enum: ['1.0'],
      },
      planId: {
        type: 'string',
      },
      iteration: {
        type: 'integer',
      },
      reasoningSummary: {
        type: 'string',
      },
      priority: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low'],
      },
      hypotheses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            description: { type: 'string' },
            targetUrl: { type: 'string' },
            suspectedBugType: {
              type: 'string',
              enum: [
                'NAVIGATION_FAILURE',
                'PAGE_LOAD_FAILURE',
                'HTTP_ERROR',
                'CONSOLE_ERROR',
                'NETWORK_ERROR',
                'CLICK_TIMEOUT',
                'CLICK_NO_OP',
                'ELEMENT_NOT_INTERACTABLE',
                'UNEXPECTED_NAVIGATION',
                'FORM_VALIDATION_FAILURE',
                'FORM_SUBMISSION_FAILURE',
                'BROKEN_CONTROL',
                'RUNTIME_EXCEPTION',
                'LAYOUT_DEFECT',
                'VISUAL_REGRESSION',
                'UNKNOWN_FUNCTIONAL_FAILURE',
                'NONE',
              ],
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
            },
          },
          required: ['id', 'description', 'targetUrl', 'suspectedBugType', 'confidence'],
          additionalProperties: false,
        },
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'NAVIGATE',
                'CLICK',
                'FILL',
                'SELECT',
                'CHECK',
                'UNCHECK',
                'PRESS',
                'WAIT_FOR_NAVIGATION',
                'ASSERT_VISIBLE',
                'ASSERT_URL',
                'ASSERT_TITLE',
                'VALIDATE_FORM',
              ],
            },
            targetDescription: { type: 'string' },
            pageUrl: { type: 'string' },
            selector: { type: ['string', 'null'] },
            value: { type: ['string', 'null'] },
            expected: {
              type: ['object', 'null'],
              properties: {
                url: { type: ['string', 'null'] },
                title: { type: ['string', 'null'] },
                text: { type: ['string', 'null'] },
                visibleSelector: { type: ['string', 'null'] },
              },
              required: ['url', 'title', 'text', 'visibleSelector'],
              additionalProperties: false,
            },
            timeoutMs: { type: ['integer', 'null'] },
          },
          required: [
            'id',
            'type',
            'targetDescription',
            'pageUrl',
            'selector',
            'value',
            'expected',
            'timeoutMs',
          ],
          additionalProperties: false,
        },
      },
      expectedOutcomes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            description: { type: 'string' },
            pageUrl: { type: ['string', 'null'] },
            expectedSelector: { type: ['string', 'null'] },
          },
          required: ['id', 'description', 'pageUrl', 'expectedSelector'],
          additionalProperties: false,
        },
      },
      stopConditions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'GOAL_ACHIEVED',
                'NO_USEFUL_ACTIONS',
                'UNRECOVERABLE_DEFECT',
                'BUDGET_LIMIT',
              ],
            },
            reason: { type: 'string' },
          },
          required: ['type', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: [
      'version',
      'planId',
      'iteration',
      'reasoningSummary',
      'priority',
      'hypotheses',
      'actions',
      'expectedOutcomes',
      'stopConditions',
    ],
    additionalProperties: false,
  },
};

/**
 * Validates and normalizes raw parsed JSON into a clean AIQAPlan.
 * Fails fast with AIProviderError if schema is invalid.
 */
export function validateAndNormalizeRawPlan(
  raw: any,
  providerName: string = 'openai'
): AIQAPlan {
  if (!raw || typeof raw !== 'object') {
    throw new AIProviderError(
      'Model response is not a valid JSON object.',
      'AI_PROVIDER_SCHEMA_ERROR',
      providerName
    );
  }

  if (raw.version !== '1.0') {
    throw new AIProviderError(
      `Invalid plan version: "${raw.version}". Expected "1.0".`,
      'AI_PROVIDER_SCHEMA_ERROR',
      providerName
    );
  }

  if (!raw.planId || typeof raw.planId !== 'string') {
    throw new AIProviderError(
      'Plan missing required string property "planId".',
      'AI_PROVIDER_SCHEMA_ERROR',
      providerName
    );
  }

  if (typeof raw.iteration !== 'number') {
    throw new AIProviderError(
      'Plan missing required numeric property "iteration".',
      'AI_PROVIDER_SCHEMA_ERROR',
      providerName
    );
  }

  if (!raw.reasoningSummary || typeof raw.reasoningSummary !== 'string') {
    throw new AIProviderError(
      'Plan missing required string property "reasoningSummary".',
      'AI_PROVIDER_SCHEMA_ERROR',
      providerName
    );
  }

  const validPriorities = ['critical', 'high', 'medium', 'low'];
  const priority = validPriorities.includes(raw.priority) ? raw.priority : 'medium';

  // Hypotheses
  const hypotheses: AIQAHypothesis[] = Array.isArray(raw.hypotheses)
    ? raw.hypotheses.map((h: any, i: number) => ({
        id: String(h.id || `hyp-${i + 1}`),
        description: String(h.description || ''),
        targetUrl: String(h.targetUrl || ''),
        suspectedBugType: h.suspectedBugType === 'NONE' ? undefined : h.suspectedBugType,
        confidence: ['high', 'medium', 'low'].includes(h.confidence) ? h.confidence : 'medium',
      }))
    : [];

  // Actions
  if (!Array.isArray(raw.actions)) {
    throw new AIProviderError(
      'Plan property "actions" must be an array.',
      'AI_PROVIDER_SCHEMA_ERROR',
      providerName
    );
  }

  const actions: AIQAAction[] = raw.actions.map((act: any, i: number) => {
    const actionId = String(act.id || `act-${i + 1}`);
    const type = act.type as JourneyActionType;
    const targetDescription = String(act.targetDescription || `Action ${type}`);
    const pageUrl = String(act.pageUrl || '');

    const expected = act.expected
      ? {
          url: act.expected.url || undefined,
          title: act.expected.title || undefined,
          text: act.expected.text || undefined,
          visibleSelector: act.expected.visibleSelector || undefined,
        }
      : undefined;

    return {
      id: actionId,
      type,
      targetDescription,
      pageUrl,
      selector: act.selector || undefined,
      value: act.value || undefined,
      expected,
      timeoutMs: typeof act.timeoutMs === 'number' ? act.timeoutMs : undefined,
    };
  });

  // Expected Outcomes
  const expectedOutcomes: AIQAExpectation[] = Array.isArray(raw.expectedOutcomes)
    ? raw.expectedOutcomes.map((exp: any, i: number) => ({
        id: String(exp.id || `exp-${i + 1}`),
        description: String(exp.description || ''),
        pageUrl: exp.pageUrl || undefined,
        expectedSelector: exp.expectedSelector || undefined,
      }))
    : [];

  // Stop Conditions
  const validStopTypes = ['GOAL_ACHIEVED', 'NO_USEFUL_ACTIONS', 'UNRECOVERABLE_DEFECT', 'BUDGET_LIMIT'];
  const stopConditions: AIQAStopCondition[] = Array.isArray(raw.stopConditions)
    ? raw.stopConditions
        .filter((sc: any) => validStopTypes.includes(sc.type))
        .map((sc: any) => ({
          type: sc.type,
          reason: String(sc.reason || 'Stop condition triggered'),
        }))
    : [];

  return {
    version: '1.0',
    planId: raw.planId,
    iteration: raw.iteration,
    reasoningSummary: raw.reasoningSummary,
    priority,
    hypotheses,
    actions,
    expectedOutcomes,
    stopConditions,
  };
}
