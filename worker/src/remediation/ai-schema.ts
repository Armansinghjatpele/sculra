// ==============================================================================
// Sculra AI Remediation Structured Output Schema
// (worker/src/remediation/ai-schema.ts)
// ==============================================================================

export const AI_REMEDIATION_JSON_SCHEMA = {
  name: 'ai_root_cause_analysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      diagnosis: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          category: {
            type: 'string',
            enum: [
              'RECENT_CODE_CHANGE',
              'REGRESSION',
              'RUNTIME_EXCEPTION',
              'INVALID_STATE',
              'MISSING_ERROR_HANDLING',
              'VALIDATION_LOGIC',
              'AUTHENTICATION',
              'AUTHORIZATION',
              'API_CONTRACT',
              'DATABASE',
              'NETWORK',
              'ROUTING',
              'UI_STATE',
              'DOM',
              'RESPONSIVE_LAYOUT',
              'ACCESSIBILITY',
              'PERFORMANCE',
              'DEPENDENCY',
              'CONFIGURATION',
              'UNKNOWN',
            ],
          },
          confidence: {
            type: 'string',
            enum: ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'],
          },
          status: {
            type: 'string',
            enum: ['DIAGNOSED', 'PARTIAL', 'INSUFFICIENT_EVIDENCE', 'FAILED'],
          },
          explanation: { type: 'string' },
        },
        required: ['summary', 'category', 'confidence', 'status', 'explanation'],
        additionalProperties: false,
      },
      hypotheses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            statement: { type: 'string' },
            category: {
              type: 'string',
              enum: [
                'RECENT_CODE_CHANGE',
                'REGRESSION',
                'RUNTIME_EXCEPTION',
                'INVALID_STATE',
                'MISSING_ERROR_HANDLING',
                'VALIDATION_LOGIC',
                'AUTHENTICATION',
                'AUTHORIZATION',
                'API_CONTRACT',
                'DATABASE',
                'NETWORK',
                'ROUTING',
                'UI_STATE',
                'DOM',
                'RESPONSIVE_LAYOUT',
                'ACCESSIBILITY',
                'PERFORMANCE',
                'DEPENDENCY',
                'CONFIGURATION',
                'UNKNOWN',
              ],
            },
            status: {
              type: 'string',
              enum: ['CANDIDATE', 'SUPPORTED', 'WEAKLY_SUPPORTED', 'REJECTED', 'UNRESOLVED'],
            },
            confidence: {
              type: 'string',
              enum: ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'],
            },
            supportingEvidenceIds: {
              type: 'array',
              items: { type: 'string' },
            },
            contradictingEvidenceIds: {
              type: 'array',
              items: { type: 'string' },
            },
            filePaths: {
              type: 'array',
              items: { type: 'string' },
            },
            symbols: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [
            'statement',
            'category',
            'status',
            'confidence',
            'supportingEvidenceIds',
            'contradictingEvidenceIds',
            'filePaths',
            'symbols',
          ],
          additionalProperties: false,
        },
      },
      fixPlan: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stepNumber: { type: 'integer' },
                description: { type: 'string' },
                targetFile: { type: 'string' },
                action: {
                  type: 'string',
                  enum: ['INSPECT', 'HANDLE_ERROR', 'VALIDATE_INPUT', 'UPDATE_LOGIC', 'ADD_TEST', 'REVERT_CHANGE'],
                },
                rationale: { type: 'string' },
              },
              required: ['stepNumber', 'description', 'targetFile', 'action', 'rationale'],
              additionalProperties: false,
            },
          },
        },
        required: ['summary', 'steps'],
        additionalProperties: false,
      },
      verificationPlan: {
        type: 'object',
        properties: {
          qaDomains: {
            type: 'array',
            items: { type: 'string' },
          },
          targets: {
            type: 'array',
            items: { type: 'string' },
          },
          tests: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['qaDomains', 'targets', 'tests'],
        additionalProperties: false,
      },
    },
    required: ['diagnosis', 'hypotheses', 'fixPlan', 'verificationPlan'],
    additionalProperties: false,
  },
};
