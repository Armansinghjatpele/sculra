// ==============================================================================
// Sculra Strict AI Product Understanding JSON Schema (worker/src/product/schema.ts)
// ==============================================================================

import {
  AIProductUnderstandingRecommendation,
  ProductAnalysisContext,
  ApplicationType,
  CriticalityLevel,
  ProductRelationshipType,
} from './types';

export const AI_PRODUCT_UNDERSTANDING_JSON_SCHEMA = {
  name: 'ai_product_understanding',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      refinedApplicationType: {
        type: 'string',
        enum: [
          'SaaS',
          'marketplace',
          'ecommerce',
          'dashboard',
          'CRM',
          'project management',
          'analytics',
          'education',
          'finance',
          'developer tool',
          'content platform',
          'admin application',
          'unknown',
        ],
        description: 'Refined high-level classification of the application category.',
      },
      additionalFeatures: {
        type: 'array',
        description: 'High-level product capabilities inferred from evidence.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Concise feature capability name.' },
            description: { type: 'string', description: 'Brief description of the capability.' },
            category: { type: 'string', description: 'Functional category.' },
            relatedRoutes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Observed route URLs belonging to this feature.',
            },
            confidence: { type: 'number', description: 'Confidence between 0.0 and 1.0.' },
            criticality: {
              type: 'string',
              enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
              description: 'Criticality level for the feature.',
            },
          },
          required: ['name', 'description', 'category', 'relatedRoutes', 'confidence', 'criticality'],
          additionalProperties: false,
        },
      },
      additionalWorkflows: {
        type: 'array',
        description: 'Multi-step user workflows supported by the application.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Descriptive workflow name.' },
            goal: { type: 'string', description: 'User objective.' },
            roleName: { type: 'string', description: 'Target user role.' },
            entryRoute: { type: 'string', description: 'Starting route URL.' },
            exitRoute: { type: 'string', description: 'Finishing route URL.' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['NAVIGATE', 'CLICK', 'FILL', 'SELECT', 'SUBMIT'],
                    description: 'Safe user action type.',
                  },
                  route: { type: 'string', description: 'Page URL for this step.' },
                  targetDescription: { type: 'string', description: 'Description of the target element.' },
                  expectedTransition: { type: 'string', description: 'Expected outcome.' },
                },
                required: ['action', 'route', 'targetDescription', 'expectedTransition'],
                additionalProperties: false,
              },
            },
            confidence: { type: 'number', description: 'Confidence between 0.0 and 1.0.' },
            criticality: {
              type: 'string',
              enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
              description: 'Criticality of this workflow.',
            },
          },
          required: ['name', 'goal', 'roleName', 'entryRoute', 'exitRoute', 'steps', 'confidence', 'criticality'],
          additionalProperties: false,
        },
      },
      roleHypotheses: {
        type: 'array',
        description: 'Hypothesized user roles based on observed features.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Role name.' },
            rationale: { type: 'string', description: 'Evidence-grounded rationale.' },
            confidence: { type: 'number', description: 'Confidence between 0.0 and 1.0.' },
            capabilities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Observed or hypothesized capabilities.',
            },
          },
          required: ['name', 'rationale', 'confidence', 'capabilities'],
          additionalProperties: false,
        },
      },
      suggestedRelationships: {
        type: 'array',
        description: 'Relationships connecting known features, roles, and workflows.',
        items: {
          type: 'object',
          properties: {
            fromId: { type: 'string', description: 'Source entity ID.' },
            toId: { type: 'string', description: 'Destination entity ID.' },
            relationshipType: {
              type: 'string',
              enum: ['EXECUTES', 'ENABLES', 'CONTAINS', 'NAVIGATES_TO', 'DEPENDS_ON', 'AFFECTS'],
              description: 'Type of relationship.',
            },
            rationale: { type: 'string', description: 'Why this relationship holds.' },
          },
          required: ['fromId', 'toId', 'relationshipType', 'rationale'],
          additionalProperties: false,
        },
      },
    },
    required: [
      'refinedApplicationType',
      'additionalFeatures',
      'additionalWorkflows',
      'roleHypotheses',
      'suggestedRelationships',
    ],
    additionalProperties: false,
  },
};

/**
 * Validates and normalizes AI product understanding recommendations against known context.
 * Strips unknown/hallucinated routes or entity IDs.
 */
export function validateAndNormalizeProductUnderstanding(
  raw: any,
  context: ProductAnalysisContext
): AIProductUnderstandingRecommendation {
  if (!raw || typeof raw !== 'object') {
    return createFallbackProductUnderstanding(context);
  }

  const validRoutesSet = new Set<string>(context.pageSummaries.map((p) => p.url.replace(/\/$/, '')));
  const knownFeatureIds = new Set<string>(context.discoveredFeatures.map((f) => f.id));
  const knownRoleNames = new Set<string>(context.candidateRoles.map((r) => r.name.toLowerCase()));

  // 1. Refined App Type
  const validAppTypes: ApplicationType[] = [
    'SaaS',
    'marketplace',
    'ecommerce',
    'dashboard',
    'CRM',
    'project management',
    'analytics',
    'education',
    'finance',
    'developer tool',
    'content platform',
    'admin application',
    'unknown',
  ];
  const refinedApplicationType: ApplicationType = validAppTypes.includes(raw.refinedApplicationType)
    ? raw.refinedApplicationType
    : context.applicationProfile.primaryType;

  // 2. Additional Features
  const additionalFeatures: AIProductUnderstandingRecommendation['additionalFeatures'] = [];
  if (Array.isArray(raw.additionalFeatures)) {
    for (const f of raw.additionalFeatures) {
      if (!f || typeof f.name !== 'string') continue;
      // Filter related routes to only known routes
      const validRelatedRoutes = (Array.isArray(f.relatedRoutes) ? f.relatedRoutes : [])
        .map((r: any) => String(r).replace(/\/$/, ''))
        .filter((r: string) => validRoutesSet.has(r));

      if (validRelatedRoutes.length > 0) {
        additionalFeatures.push({
          name: f.name.substring(0, 100),
          description: String(f.description || '').substring(0, 300),
          category: String(f.category || 'Capability').substring(0, 50),
          relatedRoutes: validRelatedRoutes,
          confidence: Math.max(0.1, Math.min(1.0, Number(f.confidence) || 0.7)),
          criticality: (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(f.criticality)
            ? f.criticality
            : 'MEDIUM') as CriticalityLevel,
        });
      }
    }
  }

  // 3. Additional Workflows
  const additionalWorkflows: AIProductUnderstandingRecommendation['additionalWorkflows'] = [];
  if (Array.isArray(raw.additionalWorkflows)) {
    for (const w of raw.additionalWorkflows) {
      if (!w || typeof w.name !== 'string') continue;
      const entryNorm = String(w.entryRoute || '').replace(/\/$/, '');
      const exitNorm = String(w.exitRoute || '').replace(/\/$/, '');

      // Verify entry and exit routes exist in discovered pages
      if (validRoutesSet.has(entryNorm) && validRoutesSet.has(exitNorm)) {
        const validSteps = (Array.isArray(w.steps) ? w.steps : [])
          .filter((s: any) => s && validRoutesSet.has(String(s.route || '').replace(/\/$/, '')))
          .map((s: any) => ({
            action: (['NAVIGATE', 'CLICK', 'FILL', 'SELECT', 'SUBMIT'].includes(s.action)
              ? s.action
              : 'NAVIGATE') as any,
            route: String(s.route),
            targetDescription: String(s.targetDescription || '').substring(0, 150),
            expectedTransition: String(s.expectedTransition || '').substring(0, 150),
          }));

        if (validSteps.length >= 2) {
          additionalWorkflows.push({
            name: w.name.substring(0, 120),
            goal: String(w.goal || '').substring(0, 250),
            roleName: String(w.roleName || 'User').substring(0, 80),
            entryRoute: String(w.entryRoute),
            exitRoute: String(w.exitRoute),
            steps: validSteps,
            confidence: Math.max(0.1, Math.min(1.0, Number(w.confidence) || 0.7)),
            criticality: (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(w.criticality)
              ? w.criticality
              : 'HIGH') as CriticalityLevel,
          });
        }
      }
    }
  }

  // 4. Role Hypotheses
  const roleHypotheses: AIProductUnderstandingRecommendation['roleHypotheses'] = [];
  if (Array.isArray(raw.roleHypotheses)) {
    for (const r of raw.roleHypotheses) {
      if (!r || typeof r.name !== 'string') continue;
      roleHypotheses.push({
        name: r.name.substring(0, 60),
        rationale: String(r.rationale || '').substring(0, 300),
        confidence: Math.max(0.1, Math.min(1.0, Number(r.confidence) || 0.6)),
        capabilities: (Array.isArray(r.capabilities) ? r.capabilities : []).map((c: any) => String(c).substring(0, 150)),
      });
    }
  }

  // 5. Suggested Relationships
  const suggestedRelationships: AIProductUnderstandingRecommendation['suggestedRelationships'] = [];
  if (Array.isArray(raw.suggestedRelationships)) {
    for (const rel of raw.suggestedRelationships) {
      if (!rel || !rel.fromId || !rel.toId) continue;
      suggestedRelationships.push({
        fromId: String(rel.fromId),
        toId: String(rel.toId),
        relationshipType: (['EXECUTES', 'ENABLES', 'CONTAINS', 'NAVIGATES_TO', 'DEPENDS_ON', 'AFFECTS'].includes(
          rel.relationshipType
        )
          ? rel.relationshipType
          : 'DEPENDS_ON') as ProductRelationshipType,
        rationale: String(rel.rationale || '').substring(0, 200),
      });
    }
  }

  return {
    refinedApplicationType,
    additionalFeatures,
    additionalWorkflows,
    roleHypotheses,
    suggestedRelationships,
  };
}

/**
 * Creates safe deterministic fallback recommendations.
 */
export function createFallbackProductUnderstanding(
  context: ProductAnalysisContext
): AIProductUnderstandingRecommendation {
  return {
    refinedApplicationType: context.applicationProfile.primaryType,
    additionalFeatures: [],
    additionalWorkflows: [],
    roleHypotheses: [],
    suggestedRelationships: [],
  };
}
