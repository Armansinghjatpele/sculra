// ==============================================================================
// Sculra 10-Source Regression Target Generator (worker/src/change-intelligence/regression-targets.ts)
// ==============================================================================

import {
  RegressionCandidate,
  ChangeSnapshot,
  AffectedWorkflow,
  AffectedApi,
  AffectedRoute,
  EnvironmentSnapshot,
} from './types';
import { ProductModel } from '../product';
import { QASignalRecord } from '../history/types';

export interface GenerateRegressionTargetsInput {
  snapshot: ChangeSnapshot;
  affectedWorkflows: AffectedWorkflow[];
  affectedApis: AffectedApi[];
  affectedRoutes?: AffectedRoute[];
  criticalWorkflows?: any[];
  productModel?: ProductModel;
  historicalSignals?: QASignalRecord[];
  targetUrl?: string;
  hasVisualBaselineLookup?: (identifier: string) => boolean;
  environment?: EnvironmentSnapshot;
  branch?: string;
  commitSha?: string;
  deploymentId?: string;
}

export class RegressionTargetGenerator {
  /**
   * Discovers and synthesizes candidate regression targets across deterministic dimensions
   * including environment-specific failures, API contracts, and performance baselines.
   */
  static generateCandidates(input: GenerateRegressionTargetsInput): RegressionCandidate[] {
    const {
      snapshot,
      affectedWorkflows = [],
      affectedApis = [],
      affectedRoutes = [],
      criticalWorkflows = [],
      productModel,
      historicalSignals = [],
      targetUrl = input.environment?.targetUrl || 'http://localhost:3000',
      hasVisualBaselineLookup,
      environment,
      branch = snapshot?.headBranch || snapshot?.branch,
      commitSha = snapshot?.headCommit || snapshot?.commitSha,
      deploymentId = environment?.deploymentId,
    } = input;

    const candidates: RegressionCandidate[] = [];
    const seenIdentifiers = new Set<string>();

    const addCandidate = (candidate: RegressionCandidate) => {
      const key = `${candidate.source}:${candidate.domain}:${candidate.targetIdentifier}`;
      if (!seenIdentifiers.has(key)) {
        seenIdentifiers.add(key);
        candidates.push({
          ...candidate,
          environmentId: candidate.environmentId ?? (environment?.environmentId || undefined),
          branch: candidate.branch ?? (branch || undefined),
          commitSha: candidate.commitSha ?? (commitSha || undefined),
          deploymentId: candidate.deploymentId ?? (deploymentId || undefined),
          confidence: candidate.confidence ?? 'HIGH',
          evidenceReferences: candidate.evidenceReferences ?? [
            `source:${candidate.source}`,
            `target:${candidate.targetIdentifier}`,
            ...(commitSha ? [`commit:${commitSha.slice(0, 7)}`] : []),
            ...(environment?.environmentName ? [`env:${environment.environmentName}`] : []),
          ],
          recommendedDomains: candidate.recommendedDomains ?? [candidate.domain],
        });
      }
    };

    const hasAuthChanges = snapshot.classifications.some(
      (c) => c === 'AUTHENTICATION' || c === 'AUTHORIZATION' || c === 'SECURITY'
    );
    const hasUiChanges = snapshot.classifications.some(
      (c) => c === 'UI' || c === 'FORM' || c === 'NAVIGATION' || c === 'ROUTING'
    );
    const hasApiChanges = snapshot.classifications.includes('API');

    // --------------------------------------------------------------------------
    // Source 1: DIRECT_WORKFLOW (Product Model Workflows directly impacted)
    // --------------------------------------------------------------------------
    for (const wf of affectedWorkflows) {
      const isCritical = wf.criticality === 'CRITICAL';
      const isHigh = wf.criticality === 'HIGH';
      addCandidate({
        id: `rc-wf-${wf.workflowId || wf.workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        source: 'DIRECT_WORKFLOW',
        targetId: wf.workflowId || wf.workflowName,
        targetType: 'WORKFLOW',
        targetIdentifier: wf.workflowName,
        url: targetUrl,
        domain: 'JOURNEY',
        businessCriticality: isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : 'MEDIUM',
        priority: isCritical ? 95 : 85,
        reason: `Directly affected workflow: ${wf.reason}`,
      });
    }

    // --------------------------------------------------------------------------
    // Source 2: AFFECTED_API (Backend REST/GraphQL endpoints affected)
    // --------------------------------------------------------------------------
    for (const api of affectedApis) {
      const endpoint = api.path;
      const method = api.method || 'GET';
      const isAuthBoundary = hasAuthChanges || endpoint.includes('auth') || endpoint.includes('login');
      addCandidate({
        id: `rc-api-${method.toLowerCase()}-${endpoint.replace(/[^a-z0-9]+/g, '-')}`,
        source: 'AFFECTED_API',
        targetId: `${method} ${endpoint}`,
        targetType: 'API',
        targetIdentifier: `${method} ${endpoint}`,
        url: endpoint.startsWith('http') ? endpoint : `${targetUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`,
        domain: 'API',
        businessCriticality: isAuthBoundary ? 'HIGH' : 'MEDIUM',
        priority: isAuthBoundary ? 85 : 75,
        reason: `Affected API endpoint: ${api.reason}`,
      });
    }

    // --------------------------------------------------------------------------
    // Source 3: AFFECTED_ROUTE_OR_COMPONENT (Frontend UI routes & views)
    // --------------------------------------------------------------------------
    for (const route of affectedRoutes) {
      addCandidate({
        id: `rc-route-${route.route.replace(/[^a-z0-9]+/g, '-') || 'root'}`,
        source: 'AFFECTED_ROUTE_OR_COMPONENT',
        targetId: route.route,
        targetType: 'ROUTE',
        targetIdentifier: route.route,
        url: route.route.startsWith('http') ? route.route : `${targetUrl.replace(/\/$/, '')}${route.route.startsWith('/') ? '' : '/'}${route.route}`,
        domain: 'FUNCTIONAL',
        businessCriticality: route.route === '/' ? 'CRITICAL' : 'MEDIUM',
        priority: 75,
        reason: `Affected route: ${route.reason}`,
      });
    }

    // --------------------------------------------------------------------------
    // Source 4: CRITICAL_WORKFLOW (Business-critical workflows touching changed code)
    // --------------------------------------------------------------------------
    if (productModel && productModel.workflows) {
      for (const wf of productModel.workflows) {
        if (wf.criticality?.level === 'CRITICAL') {
          // Check if any step touches affected routes or APIs
          const stepMatches = wf.steps?.some((step) =>
            affectedRoutes.some((r) => step.pageUrl && step.pageUrl.includes(r.route))
          );
          if (stepMatches || hasAuthChanges) {
            addCandidate({
              id: `rc-crit-${wf.id || wf.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
              source: 'CRITICAL_WORKFLOW',
              targetId: wf.id || wf.name,
              targetType: 'WORKFLOW',
              targetIdentifier: wf.name,
              url: wf.steps?.[0]?.pageUrl || targetUrl,
              domain: 'JOURNEY',
              businessCriticality: 'CRITICAL',
              priority: 100,
              reason: `Business-critical workflow in affected surface: ${wf.name}`,
            });
          }
        }
      }
    }

    if (criticalWorkflows && criticalWorkflows.length > 0) {
      for (const cw of criticalWorkflows) {
        addCandidate({
          id: `rc-crit-direct-${cw.workflowId || cw.workflowName}`,
          source: 'CRITICAL_WORKFLOW',
          targetId: cw.workflowId || cw.workflowName,
          targetType: 'WORKFLOW',
          targetIdentifier: cw.entryRoute || cw.workflowName,
          url: targetUrl,
          domain: 'JOURNEY',
          businessCriticality: 'CRITICAL',
          priority: 100,
          reason: `Critical workflow target: ${cw.workflowName}`,
        });
      }
    }

    // --------------------------------------------------------------------------
    // Source 5: HISTORICAL_FAILURE (Previous failures on affected surfaces)
    // --------------------------------------------------------------------------
    const historicalFailures = historicalSignals.filter(
      (s) => s.signalType === 'NEW_REGRESSION' || s.signalType === 'STABLE_FAILURE'
    );
    for (const hf of historicalFailures) {
      const hfReason = hf.metadata?.reason || `${hf.signalType} on ${hf.targetIdentifier}`;
      addCandidate({
        id: `rc-hist-fail-${hf.targetIdentifier.replace(/[^a-z0-9]+/g, '-')}`,
        source: 'HISTORICAL_FAILURE',
        targetId: hf.targetIdentifier,
        targetType: 'HISTORICAL_FINDING',
        targetIdentifier: hf.targetIdentifier,
        domain: 'HISTORICAL',
        businessCriticality: 'HIGH',
        priority: 90,
        reason: `Historical failure detected on this surface: ${hfReason}`,
        historicalSignalId: hf.id,
      });
    }

    // --------------------------------------------------------------------------
    // Source 6: RECOVERED_REGRESSION (Defects that previously recovered, checking for re-break)
    // --------------------------------------------------------------------------
    const recoveredSignals = historicalSignals.filter((s) => s.signalType === 'RECOVERED_DEFECT');
    for (const rec of recoveredSignals) {
      const recReason = rec.metadata?.reason || `${rec.signalType} on ${rec.targetIdentifier}`;
      addCandidate({
        id: `rc-hist-rec-${rec.targetIdentifier.replace(/[^a-z0-9]+/g, '-')}`,
        source: 'RECOVERED_REGRESSION',
        targetId: rec.targetIdentifier,
        targetType: 'HISTORICAL_FINDING',
        targetIdentifier: rec.targetIdentifier,
        domain: 'HISTORICAL',
        businessCriticality: 'HIGH',
        priority: 85,
        reason: `Previously recovered defect: verifying no re-break on change. ${recReason}`,
        historicalSignalId: rec.id,
      });
    }

    // --------------------------------------------------------------------------
    // Source 7: FLAKY_OR_RECURRING (Intermittent or recurring defects in touched code)
    // --------------------------------------------------------------------------
    const flakySignals = historicalSignals.filter(
      (s) => s.signalType === 'RECURRING_DEFECT' || s.signalType === 'INTERMITTENT_TARGET'
    );
    for (const fl of flakySignals) {
      const flReason = fl.metadata?.reason || `${fl.signalType} on ${fl.targetIdentifier}`;
      addCandidate({
        id: `rc-hist-flaky-${fl.targetIdentifier.replace(/[^a-z0-9]+/g, '-')}`,
        source: 'FLAKY_OR_RECURRING',
        targetId: fl.targetIdentifier,
        targetType: 'HISTORICAL_FINDING',
        targetIdentifier: fl.targetIdentifier,
        domain: 'HISTORICAL',
        businessCriticality: 'MEDIUM',
        priority: 70,
        reason: `Recurring or intermittent history in touched surface: ${flReason}`,
        historicalSignalId: fl.id,
      });
    }

    // --------------------------------------------------------------------------
    // Source 8: SECURITY_AUTH_BOUNDARY (Security / Auth / RBAC changes)
    // --------------------------------------------------------------------------
    if (hasAuthChanges) {
      addCandidate({
        id: `rc-sec-auth-boundaries`,
        source: 'SECURITY_AUTH_BOUNDARY',
        targetId: 'auth-security-boundary',
        targetType: 'ROLE',
        targetIdentifier: 'Authentication & Session Guards',
        url: targetUrl,
        domain: 'SECURITY',
        businessCriticality: 'CRITICAL',
        priority: 95,
        reason: `Security or authentication files modified; verifying auth cookies, headers, and RBAC guards`,
      });
    }

    // --------------------------------------------------------------------------
    // Source 9: VISUAL_BASELINE (Visual regression candidates for changed UI)
    // --------------------------------------------------------------------------
    if (hasUiChanges) {
      for (const route of affectedRoutes) {
        const hasBaseline = hasVisualBaselineLookup ? hasVisualBaselineLookup(route.route) : false;
        addCandidate({
          id: `rc-vis-${route.route.replace(/[^a-z0-9]+/g, '-') || 'root'}`,
          source: 'VISUAL_BASELINE',
          targetId: route.route,
          targetType: 'ROUTE',
          targetIdentifier: `Visual: ${route.route}`,
          url: route.route.startsWith('http') ? route.route : `${targetUrl.replace(/\/$/, '')}${route.route.startsWith('/') ? '' : '/'}${route.route}`,
          domain: 'VISUAL',
          businessCriticality: 'MEDIUM',
          priority: 65,
          reason: hasBaseline
            ? `UI layout/styling changes observed; comparing against established visual baseline`
            : `UI styling changed; no visual baseline exists (NO_BASELINE)`,
          hasVisualBaseline: hasBaseline,
        });
      }
    }

    // --------------------------------------------------------------------------
    // Source 10: ACCESSIBILITY_SURFACE (WCAG 2.1 AA targets for changed UI)
    // --------------------------------------------------------------------------
    if (hasUiChanges) {
      for (const route of affectedRoutes) {
        addCandidate({
          id: `rc-a11y-${route.route.replace(/[^a-z0-9]+/g, '-') || 'root'}`,
          source: 'ACCESSIBILITY_SURFACE',
          targetId: route.route,
          targetType: 'ROUTE',
          targetIdentifier: `Accessibility: ${route.route}`,
          url: route.route.startsWith('http') ? route.route : `${targetUrl.replace(/\/$/, '')}${route.route.startsWith('/') ? '' : '/'}${route.route}`,
          domain: 'ACCESSIBILITY',
          businessCriticality: 'MEDIUM',
          priority: 70,
          reason: `Accessibility check for UI modifications on route ${route.route}`,
        });
      }
    }

    // --------------------------------------------------------------------------
    // Source 11: ENVIRONMENT_SPECIFIC_FAILURE (Environment-scoped historical signals)
    // --------------------------------------------------------------------------
    if (environment && (environment.environmentName || environment.environmentId)) {
      const envName = (environment.environmentName || '').toLowerCase();
      const envType = (environment.environmentType || '').toLowerCase();
      const envSignals = historicalSignals.filter((s) => {
        const sigEnv = (s.environment || '').toLowerCase();
        return (
          (envName && sigEnv === envName) ||
          (envType && sigEnv === envType) ||
          (environment.environmentId && s.metadata?.environmentId === environment.environmentId)
        );
      });

      for (const es of envSignals) {
        const esReason = es.metadata?.reason || `Historical defect in ${environment.environmentName || 'environment'}`;
        addCandidate({
          id: `rc-env-fail-${es.targetIdentifier.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          source: 'ENVIRONMENT_SPECIFIC_FAILURE',
          targetId: es.targetIdentifier,
          targetType: es.targetType === 'API' ? 'API' : 'ROUTE',
          targetIdentifier: es.targetIdentifier,
          url: es.targetIdentifier.startsWith('http') ? es.targetIdentifier : targetUrl,
          domain: es.targetType === 'API' ? 'API' : 'FUNCTIONAL',
          businessCriticality: es.severity === 'critical' ? 'CRITICAL' : 'HIGH',
          priority: es.severity === 'critical' ? 95 : 88,
          reason: `Environment-specific failure history on ${environment.environmentName || 'environment'}: ${esReason}`,
          historicalSignalId: es.id,
        });
      }
    }

    // --------------------------------------------------------------------------
    // Source 12: API_CONTRACT (Schema & Contract changes)
    // --------------------------------------------------------------------------
    if (hasApiChanges) {
      for (const api of affectedApis) {
        addCandidate({
          id: `rc-contract-${(api.method || 'GET').toLowerCase()}-${api.path.replace(/[^a-z0-9]+/g, '-')}`,
          source: 'API_CONTRACT',
          targetId: `contract:${api.method || 'GET'}:${api.path}`,
          targetType: 'API',
          targetIdentifier: `Contract: ${api.method || 'GET'} ${api.path}`,
          url: api.path.startsWith('http') ? api.path : `${targetUrl.replace(/\/$/, '')}${api.path.startsWith('/') ? '' : '/'}${api.path}`,
          domain: 'API',
          businessCriticality: 'HIGH',
          priority: 80,
          reason: `API contract & payload schema validation for ${api.path}: ${api.reason}`,
        });
      }
    }

    // --------------------------------------------------------------------------
    // Source 13: PERFORMANCE_BASELINE (Performance baseline comparisons on touched routes)
    // --------------------------------------------------------------------------
    if (snapshot.classifications.includes('PERFORMANCE') || hasUiChanges) {
      for (const route of affectedRoutes.slice(0, 3)) {
        addCandidate({
          id: `rc-perf-${route.route.replace(/[^a-z0-9]+/g, '-') || 'root'}`,
          source: 'PERFORMANCE_BASELINE',
          targetId: route.route,
          targetType: 'ROUTE',
          targetIdentifier: `Perf: ${route.route}`,
          url: route.route.startsWith('http') ? route.route : `${targetUrl.replace(/\/$/, '')}${route.route.startsWith('/') ? '' : '/'}${route.route}`,
          domain: 'PERFORMANCE',
          businessCriticality: 'MEDIUM',
          priority: 60,
          reason: `Performance audit for latency, bundle size, and Core Web Vitals on touched route ${route.route}`,
        });
      }
    }

    // --------------------------------------------------------------------------
    // Source 14: DEPLOYMENT_REGRESSION_SURFACE (Deployment-specific active target testing)
    // --------------------------------------------------------------------------
    if (deploymentId) {
      addCandidate({
        id: `rc-deployment-surface-${deploymentId.slice(0, 8)}`,
        source: 'DEPLOYMENT_REGRESSION_SURFACE',
        targetId: `deployment:${deploymentId}`,
        targetType: 'DEPLOYMENT',
        targetIdentifier: `Deployment Surface: ${deploymentId.slice(0, 8)}`,
        url: targetUrl,
        domain: 'FUNCTIONAL',
        businessCriticality: 'HIGH',
        priority: 89,
        reason: `Targeted regression surface for deployment ${deploymentId} on environment ${environment?.environmentName || 'configured environment'}`,
        deploymentId,
      });
    }

    // Sort descending by priority
    return candidates.sort((a, b) => b.priority - a.priority);
  }

  static generateTargets = RegressionTargetGenerator.generateCandidates;
}
