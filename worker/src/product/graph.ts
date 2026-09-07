// ==============================================================================
// Sculra Product Knowledge Graph & Impact Tracer (worker/src/product/graph.ts)
// ==============================================================================

import {
  ProductModel,
  ProductRelationship,
  ProductRole,
  ProductWorkflow,
  ProductFeature,
  SemanticPageClassification,
  CriticalityLevel,
} from './types';

export interface FailureImpactAnalysis {
  pageUrl: string;
  affectedFeatures: ProductFeature[];
  affectedWorkflows: ProductWorkflow[];
  affectedRoles: ProductRole[];
  maxCriticalityLevel: CriticalityLevel;
  maxCriticalityScore: number;
  impactSummary: string;
}

export class ProductGraph {
  private relationships: ProductRelationship[] = [];

  constructor(
    private roles: ProductRole[] = [],
    private workflows: ProductWorkflow[] = [],
    private features: ProductFeature[] = [],
    private classifications: SemanticPageClassification[] = []
  ) {
    this.buildRelationships();
  }

  /**
   * Constructs all deterministic relationships between product entities.
   */
  private buildRelationships(): void {
    const rels: ProductRelationship[] = [];
    let relCounter = 1;

    const addRel = (
      fromType: 'ROLE' | 'WORKFLOW' | 'FEATURE' | 'PAGE' | 'CONTROL',
      fromId: string,
      toType: 'ROLE' | 'WORKFLOW' | 'FEATURE' | 'PAGE' | 'CONTROL',
      toId: string,
      relType: any,
      evidence: string
    ) => {
      rels.push({
        id: `rel-${relCounter++}`,
        fromType,
        fromId,
        toType,
        toId,
        relationshipType: relType,
        confidence: 0.95,
        evidence: [evidence],
      });
    };

    // 1. Role -> Workflow (EXECUTES)
    for (const role of this.roles) {
      for (const wf of this.workflows) {
        if (wf.roleId === role.id || wf.roleName === role.name) {
          addRel('ROLE', role.id, 'WORKFLOW', wf.id, 'EXECUTES', `Role "${role.name}" executes workflow "${wf.name}"`);
        }
      }
    }

    // 2. Workflow -> Feature (ENABLES)
    for (const wf of this.workflows) {
      for (const featId of wf.relatedFeatureIds) {
        addRel('WORKFLOW', wf.id, 'FEATURE', featId, 'ENABLES', `Workflow "${wf.name}" exercises feature "${featId}"`);
      }
    }

    // 3. Feature -> Page (CONTAINS)
    for (const feat of this.features) {
      for (const pageUrl of feat.relatedPages) {
        addRel('FEATURE', feat.id, 'PAGE', pageUrl, 'CONTAINS', `Feature "${feat.name}" contains page "${pageUrl}"`);
      }
    }

    // 4. Workflow -> Page (NAVIGATES_TO)
    for (const wf of this.workflows) {
      for (const step of wf.steps) {
        addRel('WORKFLOW', wf.id, 'PAGE', step.pageUrl, 'NAVIGATES_TO', `Workflow "${wf.name}" step ${step.stepNumber} visits ${step.pageUrl}`);
      }
    }

    this.relationships = rels;
  }

  public getRelationships(): ProductRelationship[] {
    return this.relationships;
  }

  /**
   * Given a failing page URL and optional selector, traces the impact up to features, workflows, and roles.
   */
  public traceFailureImpact(pageUrl: string, selector?: string, bugType?: string): FailureImpactAnalysis {
    const normUrl = pageUrl.replace(/\/$/, '');

    // 1. Identify affected workflows
    const affectedWorkflows = this.workflows.filter((wf) =>
      wf.steps.some(
        (s) =>
          s.pageUrl.replace(/\/$/, '') === normUrl &&
          (!selector || !s.targetSelector || s.targetSelector.includes(selector) || selector.includes(s.targetSelector))
      )
    );

    // 2. Identify affected features
    const affectedFeatureIds = new Set<string>();
    for (const wf of affectedWorkflows) {
      for (const fid of wf.relatedFeatureIds) {
        affectedFeatureIds.add(fid);
      }
    }
    for (const feat of this.features) {
      if (feat.relatedPages.some((p) => p.replace(/\/$/, '') === normUrl)) {
        affectedFeatureIds.add(feat.id);
      }
    }
    const affectedFeatures = this.features.filter((f) => affectedFeatureIds.has(f.id));

    // 3. Identify affected roles
    const affectedRoleIds = new Set<string>();
    for (const wf of affectedWorkflows) {
      if (wf.roleId) affectedRoleIds.add(wf.roleId);
    }
    const affectedRoles = this.roles.filter((r) => affectedRoleIds.has(r.id));

    // 4. Compute highest criticality
    let maxCriticalityScore = 0;
    for (const wf of affectedWorkflows) {
      maxCriticalityScore = Math.max(maxCriticalityScore, wf.criticality.score);
    }
    for (const feat of affectedFeatures) {
      maxCriticalityScore = Math.max(maxCriticalityScore, feat.criticality.score);
    }

    const maxCriticalityLevel: CriticalityLevel =
      maxCriticalityScore >= 90
        ? 'CRITICAL'
        : maxCriticalityScore >= 70
        ? 'HIGH'
        : maxCriticalityScore >= 45
        ? 'MEDIUM'
        : 'LOW';

    const impactSummary = affectedWorkflows.length > 0
      ? `Failure affects ${affectedWorkflows.length} business workflow(s) (${affectedWorkflows.map((w) => w.name).join(', ')}) across ${affectedRoles.length} role(s).`
      : affectedFeatures.length > 0
      ? `Failure affects feature capability "${affectedFeatures.map((f) => f.name).join(', ')}".`
      : `Isolated failure on route ${pageUrl}.`;

    return {
      pageUrl,
      affectedFeatures,
      affectedWorkflows,
      affectedRoles,
      maxCriticalityLevel,
      maxCriticalityScore,
      impactSummary,
    };
  }
}
