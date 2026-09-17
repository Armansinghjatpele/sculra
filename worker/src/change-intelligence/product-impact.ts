// ==============================================================================
// Sculra Product Model Impact Analyzer (worker/src/change-intelligence/product-impact.ts)
// ==============================================================================

import { AffectedRoute, AffectedApi, AffectedWorkflow, ChangedFile, ImpactConfidence } from './types';
import { ProductModel } from '../product';

export interface ProductImpactInput {
  productModel?: ProductModel;
  affectedRoutes: AffectedRoute[];
  affectedApis: AffectedApi[];
  changedFiles: ChangedFile[];
}

/**
 * Maps code changes to business-critical workflows, features, and roles defined in the ProductModel.
 */
export function identifyProductImpact(input: ProductImpactInput): AffectedWorkflow[] {
  const { productModel, affectedRoutes, affectedApis, changedFiles } = input;
  if (!productModel || !productModel.workflows || productModel.workflows.length === 0) {
    return [];
  }

  const affectedWorkflows: AffectedWorkflow[] = [];
  const seenWorkflows = new Set<string>();

  const changedRoutesSet = new Set(affectedRoutes.map((r) => r.route.toLowerCase()));
  const changedApisSet = new Set(affectedApis.map((a) => a.path.toLowerCase()));

  // 1. Direct Workflow Step Matches (High Confidence)
  for (const wf of productModel.workflows) {
    const steps = wf.steps || [];
    for (const step of steps) {
      const stepUrl = (step.pageUrl || '').toLowerCase();

      // Check if step navigates to an affected route
      for (const cr of changedRoutesSet) {
        if (stepUrl === cr || stepUrl.endsWith(cr) || (cr !== '/' && stepUrl.includes(cr))) {
          if (!seenWorkflows.has(wf.id)) {
            seenWorkflows.add(wf.id);
            affectedWorkflows.push({
              workflowId: wf.id,
              workflowName: wf.name,
              criticality: wf.criticality?.level || 'MEDIUM',
              confidence: 'HIGH',
              reason: `Workflow step #${step.stepNumber} executes on changed route '${cr}'`,
            });
          }
          break;
        }
      }
    }
  }

  // 2. Feature & Semantic Matches via Product Features (Medium Confidence)
  const features = productModel.features || [];
  for (const feat of features) {
    let featureTouched = false;
    let matchedReason = '';

    // Check if feature's related routes match changed routes
    for (const r of feat.relatedRoutes || []) {
      if (changedRoutesSet.has(r.toLowerCase())) {
        featureTouched = true;
        matchedReason = `Feature '${feat.name}' operates on changed route '${r}'`;
        break;
      }
    }

    // Check if feature's name relates to changed files (e.g. checkout, auth)
    if (!featureTouched) {
      for (const cf of changedFiles) {
        const lowerPath = cf.path.toLowerCase();
        const featSlug = feat.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (featSlug.length > 3 && lowerPath.includes(featSlug)) {
          featureTouched = true;
          matchedReason = `Feature '${feat.name}' maps to changed file '${cf.path}'`;
          break;
        }
      }
    }

    if (featureTouched && feat.relatedWorkflowIds) {
      for (const wId of feat.relatedWorkflowIds) {
        if (!seenWorkflows.has(wId)) {
          const wf = productModel.workflows.find((w) => w.id === wId);
          if (wf) {
            seenWorkflows.add(wf.id);
            affectedWorkflows.push({
              workflowId: wf.id,
              workflowName: wf.name,
              criticality: wf.criticality?.level || feat.criticality?.level || 'MEDIUM',
              confidence: 'MEDIUM',
              reason: matchedReason,
            });
          }
        }
      }
    }
  }

  return affectedWorkflows;
}
