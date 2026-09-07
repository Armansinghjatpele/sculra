// ==============================================================================
// Sculra Product Model Validator (worker/src/product/validator.ts)
// ==============================================================================

import { ProductModel, ProductWorkflow, ProductFeature, ProductRole, ProductRelationship } from './types';

export class ProductModelValidator {
  /**
   * Validates and normalizes referential integrity of a ProductModel.
   */
  public static validateAndNormalize(model: ProductModel): ProductModel {
    const knownPages = new Set(model.pageClassifications.map((p) => p.pageUrl.replace(/\/$/, '')));
    const knownFeatureIds = new Set(model.features.map((f) => f.id));
    const knownRoleIds = new Set(model.roles.map((r) => r.id));
    const knownWorkflowIds = new Set(model.workflows.map((w) => w.id));

    // 1. Validate & Clamp Features
    const validatedFeatures: ProductFeature[] = model.features.map((f) => {
      const validPages = f.relatedPages.filter((p) => knownPages.has(p.replace(/\/$/, '')));
      const validWorkflows = f.relatedWorkflowIds.filter((w) => knownWorkflowIds.has(w));

      return {
        ...f,
        relatedPages: validPages.length > 0 ? validPages : f.relatedPages,
        relatedWorkflowIds: validWorkflows,
        confidence: Math.max(0.1, Math.min(1.0, f.confidence || 0.8)),
        criticality: {
          ...f.criticality,
          score: Math.max(0, Math.min(100, f.criticality.score || 50)),
          confidence: Math.max(0.1, Math.min(1.0, f.criticality.confidence || 0.8)),
        },
      };
    });

    // 2. Validate & Clamp Workflows
    const validatedWorkflows: ProductWorkflow[] = model.workflows.map((w) => {
      const validSteps = w.steps.map((s, idx) => ({
        ...s,
        stepNumber: idx + 1,
        confidence: Math.max(0.1, Math.min(1.0, s.confidence || 0.8)),
      }));

      // A workflow cannot be marked CONFIRMED unless executionStatus is TESTED
      let status = w.status;
      if (status === 'CONFIRMED' && w.executionStatus !== 'TESTED') {
        status = 'INFERRED';
      }

      return {
        ...w,
        steps: validSteps,
        relatedFeatureIds: w.relatedFeatureIds.filter((f) => knownFeatureIds.has(f)),
        confidence: Math.max(0.1, Math.min(1.0, w.confidence || 0.8)),
        criticality: {
          ...w.criticality,
          score: Math.max(0, Math.min(100, w.criticality.score || 50)),
          confidence: Math.max(0.1, Math.min(1.0, w.criticality.confidence || 0.8)),
        },
        status,
      };
    });

    // 3. Validate & Clamp Roles
    const validatedRoles: ProductRole[] = model.roles.map((r) => ({
      ...r,
      confidence: Math.max(0.1, Math.min(1.0, r.confidence || 0.8)),
      relatedFeatureIds: r.relatedFeatureIds.filter((f) => knownFeatureIds.has(f)),
      relatedWorkflowIds: r.relatedWorkflowIds.filter((w) => knownWorkflowIds.has(w)),
    }));

    // 4. Validate Relationships
    const validatedRelationships: ProductRelationship[] = model.relationships.filter((rel) => {
      if (!rel.fromId || !rel.toId) return false;
      return true;
    });

    return {
      ...model,
      features: validatedFeatures,
      workflows: validatedWorkflows,
      roles: validatedRoles,
      relationships: validatedRelationships,
    };
  }
}
