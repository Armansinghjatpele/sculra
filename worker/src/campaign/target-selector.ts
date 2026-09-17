// ==============================================================================
// Sculra Autonomous Target Selector & Prioritization (worker/src/campaign/target-selector.ts)
// ==============================================================================

import { CampaignTarget, CampaignDomain, CampaignConfig } from './types';
import { ApplicationMap } from '../types';
import { ProductModel } from '../product';
import { QASignalRecord } from '../history/types';
import { BugObservation } from '../issues/types';
import { ApiEndpoint } from '../api-qa/types';
import { ChangeAnalysisResult } from '../change-intelligence/types';

export interface TargetSelectorInput {
  targetUrl: string;
  config: CampaignConfig;
  applicationMap?: ApplicationMap;
  productModel?: ProductModel;
  historicalSignals?: QASignalRecord[];
  openIssues?: any[];
  apiEndpoints?: ApiEndpoint[];
  changeIntelligence?: ChangeAnalysisResult;
}

export class TargetSelector {
  /**
   * Selects and prioritizes the initial candidate targets across active domains.
   */
  static selectInitialTargets(input: TargetSelectorInput): CampaignTarget[] {
    const targets: CampaignTarget[] = [];
    const seenKeys = new Set<string>();

    const { targetUrl, config, applicationMap, productModel, historicalSignals = [], apiEndpoints = [], changeIntelligence } = input;
    const activeDomains = new Set(config.domains || []);

    // 1. Root Application Target
    const rootTarget: CampaignTarget = {
      id: 'target-root',
      type: 'PAGE',
      identifier: '/',
      url: targetUrl,
      businessCriticality: 'CRITICAL',
      strategyScore: 100,
    };
    targets.push(rootTarget);
    seenKeys.add('PAGE:/');

    // 2. Extract Targets from ProductModel (Workflows, Features, Protected Routes)
    if (productModel && productModel.workflows) {
      for (const wf of productModel.workflows) {
        const key = `WORKFLOW:${wf.id || wf.name}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const isCritical = wf.criticality?.level === 'CRITICAL';
          const isHigh = wf.criticality?.level === 'HIGH';
          targets.push({
            id: `target-wf-${wf.id || wf.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            type: 'WORKFLOW',
            identifier: wf.name,
            workflowId: wf.id,
            workflowName: wf.name,
            url: wf.steps?.[0]?.pageUrl || targetUrl,
            businessCriticality: isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : 'MEDIUM',
            strategyScore: isCritical ? 95 : 80,
          });
        }
      }
    }

    // 3. Extract Targets from ApplicationMap (Pages, Forms, Navigation)
    if (applicationMap && applicationMap.pages) {
      for (const page of applicationMap.pages) {
        const path = page.url ? this.extractPath(page.url, targetUrl) : '/';
        const key = `PAGE:${path}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          targets.push({
            id: `target-page-${path.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home'}`,
            type: 'PAGE',
            identifier: path,
            url: page.url,
            businessCriticality: path === '/' ? 'CRITICAL' : 'MEDIUM',
            strategyScore: 70,
          });
        }
      }
    }

    // 4. Extract API Targets
    if (activeDomains.has('API') && apiEndpoints.length > 0) {
      for (const ep of apiEndpoints) {
        const key = `API:${ep.method}:${ep.path}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const isAuth = !!(ep.isAuthorizationBoundary || ep.authenticatedObserved);
          targets.push({
            id: `target-api-${ep.method.toLowerCase()}-${ep.path.replace(/[^a-z0-9]+/g, '-')}`,
            type: 'API',
            identifier: `${ep.method} ${ep.path}`,
            method: ep.method,
            url: ep.path.startsWith('http') ? ep.path : `${targetUrl.replace(/\/$/, '')}${ep.path.startsWith('/') ? '' : '/'}${ep.path}`,
            businessCriticality: isAuth ? 'HIGH' : 'MEDIUM',
            strategyScore: isAuth ? 85 : 65,
          });
        }
      }
    }

    // 5. Correlate with Change Intelligence (Routes, Workflows, APIs directly affected)
    if (changeIntelligence) {
      const affectedRoutes = changeIntelligence.affectedRoutes || [];
      const affectedApis = changeIntelligence.affectedApis || [];
      const affectedWorkflows = changeIntelligence.affectedWorkflows || [];

      // Add affected routes as PAGE targets if not already present
      for (const item of affectedRoutes) {
        const route = item.route;
        const key = `PAGE:${route}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          targets.push({
            id: `target-page-change-${route.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root'}`,
            type: 'PAGE',
            identifier: route,
            url: route.startsWith('http') ? route : `${targetUrl.replace(/\/$/, '')}${route.startsWith('/') ? '' : '/'}${route}`,
            businessCriticality: 'HIGH',
            strategyScore: 85,
            isChangeAffected: true,
            changeType: 'DIRECT',
          });
        }
      }

      // Add affected APIs as API targets if active domain includes API and not already present
      if (activeDomains.has('API')) {
        for (const ep of affectedApis) {
          const method = ep.method || 'GET';
          const endpoint = ep.path;
          const key = `API:${method}:${endpoint}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            targets.push({
              id: `target-api-change-${method.toLowerCase()}-${endpoint.replace(/[^a-z0-9]+/g, '-')}`,
              type: 'API',
              identifier: `${method} ${endpoint}`,
              method: method,
              url: endpoint.startsWith('http') ? endpoint : `${targetUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`,
              businessCriticality: 'HIGH',
              strategyScore: 85,
              isChangeAffected: true,
              changeType: 'DIRECT',
            });
          }
        }
      }

      // Mark affected workflows and existing targets
      for (const target of targets) {
        const isAffectedRoute = affectedRoutes.some(
          (r) => r.route === target.identifier || target.identifier.includes(r.route) || (target.url && target.url.includes(r.route))
        );
        const isAffectedWf =
          target.type === 'WORKFLOW' &&
          affectedWorkflows.some(
            (w) => w.workflowName === target.workflowName || w.workflowId === target.workflowId
          );
        const isAffectedApi =
          target.type === 'API' &&
          affectedApis.some((a) => target.identifier.includes(a.path));

        if (isAffectedRoute || isAffectedWf || isAffectedApi) {
          target.isChangeAffected = true;
          target.changeType = isAffectedWf ? 'BUSINESS_CRITICAL' : 'DIRECT';
        }
      }
    }

    // 6. Correlate with Historical QA Memory Signals (Regressions, Recurrences, Flakiness)
    for (const target of targets) {
      const matchingSignals = historicalSignals.filter(
        (s) =>
          s.targetIdentifier === target.identifier ||
          s.targetIdentifier.includes(target.identifier) ||
          target.identifier.includes(s.targetIdentifier)
      );

      if (matchingSignals.length > 0) {
        target.historicalSignals = matchingSignals;
        target.isRecentRegression = matchingSignals.some((s) => s.signalType === 'NEW_REGRESSION' || s.signalType === 'REGRESSION' as any);
        target.isRecurringDefect = matchingSignals.some((s) => s.signalType === 'RECURRING_DEFECT' || s.signalType === 'RECURRING' as any);
        target.isFlaky = matchingSignals.some((s) => s.signalType === 'INTERMITTENT_TARGET' || s.signalType === 'INTERMITTENT' as any);
      }

      // Recompute deterministic score for each target
      target.strategyScore = this.computeTargetPriority(target);
    }

    // Sort descending by priority score
    targets.sort((a, b) => (b.strategyScore || 50) - (a.strategyScore || 50));

    return targets;
  }

  /**
   * Computes deterministic priority score (0 - 100) for a target.
   */
  static computeTargetPriority(target: CampaignTarget): number {
    let score = 50; // Base score

    // Business criticality
    if (target.businessCriticality === 'CRITICAL') score += 30;
    else if (target.businessCriticality === 'HIGH') score += 20;
    else if (target.businessCriticality === 'MEDIUM') score += 10;

    // Change intelligence impact bonus
    if (target.isChangeAffected) {
      if (target.changeType === 'BUSINESS_CRITICAL') score += 30;
      else if (target.changeType === 'SECURITY') score += 30;
      else score += 20;
    }

    // Historical QA memory signals
    if (target.isRecentRegression) score += 25; // High priority regression re-check
    if (target.isRecurringDefect) score += 15; // Persistent bug check
    if (target.isFlaky) score += 10; // Flakiness stabilization check

    // Protected / auth targets
    if (target.role && target.role !== 'ANONYMOUS') score += 10;

    return Math.min(100, Math.max(10, score));
  }

  /**
   * Creates an adaptive target in response to an observation or failure during campaign execution.
   */
  static createAdaptiveTargetFromObservation(
    observation: BugObservation,
    targetUrl: string,
    existingTargets: CampaignTarget[]
  ): CampaignTarget | null {
    const identifier = observation.selector || observation.url || observation.title;
    if (!identifier) return null;

    // Check if target already exists
    const exists = existingTargets.some(
      (t) => t.identifier === identifier || (t.url && t.url === observation.url)
    );
    if (exists) return null;

    const isCritical = observation.severity === 'critical';
    const isHigh = observation.severity === 'high';

    return {
      id: `target-adaptive-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: observation.selector ? 'SELECTOR' : 'PAGE',
      identifier: identifier,
      url: observation.url || targetUrl,
      selector: observation.selector,
      businessCriticality: isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : 'MEDIUM',
      strategyScore: isCritical ? 95 : isHigh ? 85 : 70,
      isRecentRegression: true, // Treat new runtime failure as regression candidate
    };
  }

  private static extractPath(url: string, baseUrl: string): string {
    try {
      const parsed = new URL(url);
      return parsed.pathname || '/';
    } catch {
      return url.replace(baseUrl, '') || '/';
    }
  }
}
