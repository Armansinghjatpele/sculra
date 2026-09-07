// ==============================================================================
// Sculra Product Model Builder & Version Comparison (worker/src/product/model.ts)
// ==============================================================================

import { ApplicationMap } from '../types';
import { JourneyResult } from '../journeys/types';
import { BugObservation } from '../issues/types';
import { AIQAProvider } from '../ai-qa/provider';
import { WorkerLogger } from '../logger';
import { CancellationToken } from '../types';
import {
  ProductModel,
  ApplicationProfile,
  ApplicationType,
  CoverageAgainstProductModel,
  ProductModelComparison,
  ProductEngineOptions,
  ApplicationProfileTypeMatch,
} from './types';
import { ProductEvidenceExtractor } from './evidence';
import { SemanticPageClassifier } from './classifier';
import { FeatureDiscoveryEngine } from './features';
import { RoleDiscoveryEngine } from './roles';
import { WorkflowDiscoveryEngine } from './workflows';
import { BusinessCriticalityEvaluator } from './criticality';
import { ProductGraph } from './graph';
import { ProductAnalyzer } from './analyzer';
import { ProductModelValidator } from './validator';

export class ProductModelBuilder {
  /**
   * Constructs the full grounded ProductModel from discovery, execution evidence, and optional AI enhancement.
   */
  public static async build(options: {
    testRunId: string;
    targetUrl: string;
    applicationMap?: ApplicationMap;
    journeyResults?: JourneyResult[];
    bugObservations?: BugObservation[];
    provider?: AIQAProvider;
    logger?: WorkerLogger;
    engineOptions?: ProductEngineOptions;
    cancellationToken?: CancellationToken;
  }): Promise<ProductModel> {
    const {
      testRunId,
      targetUrl,
      applicationMap,
      journeyResults = [],
      bugObservations = [],
      provider,
      logger,
      engineOptions = {},
      cancellationToken,
    } = options;

    logger?.log('product_model_started', { testRunId, targetUrl });

    // 1. Extract Grounded Product Evidence
    const evidence = ProductEvidenceExtractor.extractEvidence({
      targetUrl,
      applicationMap,
      journeyResults,
      bugObservations,
    });

    // 2. Classify Semantic Pages
    const pages = applicationMap?.pages || [];
    const pageClassifications = SemanticPageClassifier.classifyAllPages(pages, targetUrl);

    // 3. Discover Features
    const features = FeatureDiscoveryEngine.discoverFeatures(pages, pageClassifications);

    // 4. Discover Roles
    const roles = RoleDiscoveryEngine.discoverRoles(pages, pageClassifications, features);

    // 5. Discover Workflows
    const workflows = WorkflowDiscoveryEngine.discoverWorkflows({
      targetUrl,
      applicationMap,
      classifications: pageClassifications,
      features,
      roles,
      journeyResults,
      bugObservations,
    });

    // 6. Refine Criticality of Features & Workflows
    for (const feat of features) {
      const matchingPages = pages.filter((p) => feat.relatedPages.includes(p.url));
      if (matchingPages.length > 0) {
        let maxPageCriticality = 0;
        for (const p of matchingPages) {
          const c = BusinessCriticalityEvaluator.evaluatePageCriticality({
            page: p,
            classification: pageClassifications.find((cl) => cl.pageUrl === p.url),
            workflows,
            bugObservations,
          });
          maxPageCriticality = Math.max(maxPageCriticality, c.score);
        }
        feat.criticality.score = Math.max(feat.criticality.score, maxPageCriticality);
        feat.criticality.level = BusinessCriticalityEvaluator.scoreToLevel(feat.criticality.score);
      }
    }

    // 7. Derive Application Profile
    const applicationProfile = this.deriveApplicationProfile(targetUrl, pages, pageClassifications, features);

    // 8. Optional AI Product Understanding Enhancement
    if (engineOptions.enableAiEnhancement !== false && provider && !cancellationToken?.isCancelled) {
      try {
        const analyzer = new ProductAnalyzer({ provider, logger });
        const aiResult = await analyzer.analyze({
          testRunId,
          targetUrl,
          applicationProfile,
          classifications: pageClassifications,
          features,
          workflows,
          roles,
          cancellationToken,
        });

        if (!aiResult.isFallback && aiResult.recommendation) {
          if (aiResult.recommendation.refinedApplicationType) {
            applicationProfile.primaryType = aiResult.recommendation.refinedApplicationType;
          }

          // Incorporate additional validated workflows if discovered
          if (aiResult.recommendation.additionalWorkflows) {
            for (const aw of aiResult.recommendation.additionalWorkflows) {
              if (!workflows.some((w) => w.name.toLowerCase() === aw.name.toLowerCase())) {
                const score = aw.criticality === 'CRITICAL' ? 95 : aw.criticality === 'HIGH' ? 80 : 50;
                workflows.push({
                  id: `wf-ai-${workflows.length + 1}`,
                  name: aw.name,
                  goal: aw.goal,
                  roleName: aw.roleName,
                  steps: aw.steps.map((s, sIdx) => ({
                    id: `step-ai-${sIdx + 1}`,
                    stepNumber: sIdx + 1,
                    actionType: s.action as any,
                    pageUrl: s.route,
                    targetDescription: s.targetDescription,
                    expectedTransition: s.expectedTransition,
                    evidence: ['AI workflow hypothesis grounded in route trace.'],
                    confidence: aw.confidence,
                  })),
                  entryPoint: aw.entryRoute,
                  exitPoint: aw.exitRoute,
                  relatedFeatureIds: [],
                  relatedRoutes: [aw.entryRoute, aw.exitRoute],
                  confidence: aw.confidence,
                  evidence: ['AI workflow recommendation.'],
                  criticality: {
                    score,
                    level: aw.criticality,
                    reasons: [`Hypothesized user flow with ${aw.criticality} business priority.`],
                    evidence: ['AI structural reasoning.'],
                    confidence: aw.confidence,
                  },
                  status: 'HYPOTHESIZED',
                  executionStatus: 'UNTESTED',
                });
              }
            }
          }
        }
      } catch (aiErr: any) {
        logger?.warn('ai_product_model_enhancement_error', { message: aiErr.message });
      }
    }

    // 9. Build Product Knowledge Graph & Relationships
    const graph = new ProductGraph(roles, workflows, features, pageClassifications);
    const relationships = graph.getRelationships();

    // 10. Compute Product Model Coverage
    const coverage = this.calculateCoverage(features, workflows, roles);

    const model: ProductModel = {
      id: `prod-model-${testRunId}`,
      version: '1.0',
      generatedAt: new Date().toISOString(),
      testRunId,
      targetUrl,
      applicationProfile,
      pageClassifications,
      features,
      roles,
      workflows,
      relationships,
      evidence,
      coverage,
    };

    // 11. Validate Model Referential Integrity
    const validatedModel = ProductModelValidator.validateAndNormalize(model);

    logger?.log('product_model_completed', {
      testRunId,
      featuresCount: validatedModel.features.length,
      workflowsCount: validatedModel.workflows.length,
      rolesCount: validatedModel.roles.length,
      totalCoverageRatio: validatedModel.coverage.workflowCoverageRatio,
    });

    return validatedModel;
  }

  /**
   * Deterministically infers ApplicationProfile from pages, categories, and routes.
   */
  private static deriveApplicationProfile(
    targetUrl: string,
    pages: any[],
    classifications: any[],
    features: any[]
  ): ApplicationProfile {
    const typeMatches: ApplicationProfileTypeMatch[] = [];
    const allPaths = pages.map((p) => {
      try {
        return new URL(p.url).pathname.toLowerCase();
      } catch {
        return p.url.toLowerCase();
      }
    });

    const hasAuth = classifications.some((c) => c.category === 'LOGIN' || c.category === 'SIGN_UP' || c.category === 'AUTH');
    const hasDashboard = classifications.some((c) => c.category === 'DASHBOARD' || c.category === 'ANALYTICS');
    const hasBilling = classifications.some((c) => c.category === 'CHECKOUT' || c.category === 'PAYMENT' || c.category === 'CART');
    const hasProjects = allPaths.some((p) => p.includes('/project') || p.includes('/workspace'));
    const hasAdmin = classifications.some((c) => c.category === 'ADMIN') || allPaths.some((p) => p.includes('/admin'));

    if (hasAuth && hasDashboard && hasBilling) {
      typeMatches.push({
        type: 'SaaS',
        confidence: 0.95,
        evidence: ['Authentication, Dashboard metrics, and Subscription billing flows detected.'],
      });
    }

    if (hasProjects) {
      typeMatches.push({
        type: 'project management',
        confidence: 0.85,
        evidence: ['Project/Workspace management routes discovered.'],
      });
    }

    if (hasBilling && classifications.some((c) => c.category === 'CART')) {
      typeMatches.push({
        type: 'ecommerce',
        confidence: 0.88,
        evidence: ['Shopping cart and checkout flows detected.'],
      });
    }

    if (hasDashboard) {
      typeMatches.push({
        type: 'dashboard',
        confidence: 0.9,
        evidence: ['Interactive telemetry and dashboard views present.'],
      });
    }

    if (hasAdmin) {
      typeMatches.push({
        type: 'admin application',
        confidence: 0.8,
        evidence: ['Administration consoles and member management routes present.'],
      });
    }

    if (typeMatches.length === 0) {
      typeMatches.push({
        type: 'SaaS',
        confidence: 0.6,
        evidence: ['General web application architecture.'],
      });
    }

    typeMatches.sort((a, b) => b.confidence - a.confidence);

    const majorSections = Array.from(
      new Set(
        allPaths
          .map((p) => p.split('/').filter(Boolean)[0])
          .filter(Boolean)
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      )
    );

    return {
      applicationTypes: typeMatches,
      primaryType: typeMatches[0].type,
      detectedDomains: [targetUrl],
      authenticationPresent: hasAuth,
      multiRoleSignals: hasAdmin,
      majorSections,
      confidence: typeMatches[0].confidence,
      evidenceReferences: typeMatches[0].evidence,
    };
  }

  /**
   * Calculates deterministic coverage metrics against the product model.
   */
  private static calculateCoverage(
    features: any[],
    workflows: any[],
    roles: any[]
  ): CoverageAgainstProductModel {
    const totalFeatures = features.length;
    const totalWorkflows = workflows.length;
    const totalRoles = roles.length;

    const testedWorkflows = workflows.filter((w) => w.executionStatus === 'TESTED').length;
    const partiallyTestedWorkflows = workflows.filter((w) => w.executionStatus === 'PARTIALLY_TESTED').length;
    const untestedWorkflows = workflows.filter((w) => w.executionStatus === 'UNTESTED').length;
    const criticalWorkflowsWithFailures = workflows.filter(
      (w) => w.executionStatus === 'FAILED' && (w.criticality.level === 'CRITICAL' || w.criticality.level === 'HIGH')
    ).length;

    const testedFeatures = features.filter((f) => {
      return workflows.some(
        (w) => w.relatedFeatureIds.includes(f.id) && (w.executionStatus === 'TESTED' || w.executionStatus === 'PARTIALLY_TESTED')
      );
    }).length;

    const highCriticalityWorkflows = workflows.filter(
      (w) => w.criticality.level === 'CRITICAL' || w.criticality.level === 'HIGH'
    );
    const highCriticalityWorkflowsTested = highCriticalityWorkflows.filter((w) => w.executionStatus === 'TESTED').length;
    const highCriticalityWorkflowsUntested = highCriticalityWorkflows.filter((w) => w.executionStatus === 'UNTESTED').length;

    const rolesWithTestedWorkflows = roles.filter((r) =>
      workflows.some((w) => (w.roleId === r.id || w.roleName === r.name) && w.executionStatus === 'TESTED')
    ).length;

    return {
      totalFeatures,
      testedFeatures,
      untestedFeatures: Math.max(0, totalFeatures - testedFeatures),
      featureCoverageRatio: totalFeatures > 0 ? testedFeatures / totalFeatures : 1.0,
      totalWorkflows,
      testedWorkflows,
      partiallyTestedWorkflows,
      untestedWorkflows,
      workflowCoverageRatio: totalWorkflows > 0 ? (testedWorkflows + 0.5 * partiallyTestedWorkflows) / totalWorkflows : 1.0,
      totalRoles,
      rolesWithTestedWorkflows,
      highCriticalityWorkflowsTotal: highCriticalityWorkflows.length,
      highCriticalityWorkflowsTested,
      highCriticalityWorkflowsUntested,
      criticalWorkflowsWithFailures,
    };
  }

  /**
   * Compares two product models to identify structural, workflow, or criticality shifts between test runs.
   */
  public static compareModels(oldModel: ProductModel, newModel: ProductModel): ProductModelComparison {
    const oldFeatureIds = new Set(oldModel.features.map((f) => f.id));
    const newFeatureIds = new Set(newModel.features.map((f) => f.id));

    const addedFeatures = newModel.features.filter((f) => !oldFeatureIds.has(f.id)).map((f) => f.name);
    const removedFeatures = oldModel.features.filter((f) => !newFeatureIds.has(f.id)).map((f) => f.name);

    const changedWorkflows: ProductModelComparison['changedWorkflows'] = [];
    const oldWfMap = new Map(oldModel.workflows.map((w) => [w.id, w]));

    for (const nWf of newModel.workflows) {
      const oWf = oldWfMap.get(nWf.id);
      if (!oWf) {
        changedWorkflows.push({ id: nWf.id, name: nWf.name, change: 'ADDED', details: 'New workflow discovered' });
      } else if (oWf.steps.length !== nWf.steps.length) {
        changedWorkflows.push({
          id: nWf.id,
          name: nWf.name,
          change: 'STEPS_CHANGED',
          details: `Steps count changed from ${oWf.steps.length} to ${nWf.steps.length}`,
        });
      } else if (oWf.criticality.level !== nWf.criticality.level) {
        changedWorkflows.push({
          id: nWf.id,
          name: nWf.name,
          change: 'CRITICALITY_CHANGED',
          details: `Criticality shifted from ${oWf.criticality.level} (${oWf.criticality.score}) to ${nWf.criticality.level} (${nWf.criticality.score})`,
        });
      }
    }

    const changedCriticality: ProductModelComparison['changedCriticality'] = [];
    for (const nFeat of newModel.features) {
      const oFeat = oldModel.features.find((f) => f.id === nFeat.id);
      if (oFeat && Math.abs(oFeat.criticality.score - nFeat.criticality.score) >= 10) {
        changedCriticality.push({
          entityId: nFeat.id,
          entityType: 'FEATURE',
          oldScore: oFeat.criticality.score,
          newScore: nFeat.criticality.score,
        });
      }
    }

    const oldRoleNames = new Set(oldModel.roles.map((r) => r.name.toLowerCase()));
    const changedRoles = newModel.roles.filter((r) => !oldRoleNames.has(r.name.toLowerCase())).map((r) => r.name);

    return {
      addedFeatures,
      removedFeatures,
      changedWorkflows,
      changedCriticality,
      changedRoles,
    };
  }
}
