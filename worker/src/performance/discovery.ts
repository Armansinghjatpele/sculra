// ==============================================================================
// Sculra Performance Target Discovery Engine (worker/src/performance/discovery.ts)
// ==============================================================================
// Aggregates, bounds, and prioritizes representative performance measurement targets
// from business-critical workflows, authenticated role surfaces, crawl maps, and APIs.

import { PerformanceTarget, PerformancePolicyConfig } from './types';
import { ApplicationMap } from '../types';
import { ProductModel } from '../product/types';
import { RoleContext } from '../auth/types';
import { ApiEndpoint } from '../api-qa/types';
import { WorkerLogger } from '../logger';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';

export interface PerformanceDiscoveryParams {
  targetUrl: string;
  applicationMap?: ApplicationMap;
  productModel?: ProductModel;
  roleContexts?: RoleContext[];
  apiEndpoints?: ApiEndpoint[];
  explicitTargets?: Array<{ path: string; method?: string; workflowId?: string; isCritical?: boolean }>;
  policy?: PerformancePolicyConfig;
  logger?: WorkerLogger;
}

export class PerformanceTargetDiscovery {
  /**
   * Deterministically discovers and prioritizes representative targets for performance QA.
   */
  static discoverTargets(params: PerformanceDiscoveryParams): PerformanceTarget[] {
    const {
      targetUrl,
      applicationMap,
      productModel,
      roleContexts = [],
      apiEndpoints = [],
      explicitTargets = [],
      policy = DEFAULT_PERFORMANCE_POLICY,
      logger,
    } = params;

    const targetsMap = new Map<string, PerformanceTarget>();

    const addTarget = (target: PerformanceTarget) => {
      const key = `${target.type}:${target.method || 'GET'}:${target.path}:${target.role || 'ANY'}`;
      if (!targetsMap.has(key)) {
        targetsMap.set(key, target);
      } else {
        const existing = targetsMap.get(key)!;
        if (target.priority > existing.priority) {
          targetsMap.set(key, { ...existing, ...target, priority: target.priority });
        }
      }
    };

    // 1. Explicit Project Performance Targets (Highest manual priority)
    for (const exp of explicitTargets) {
      const path = exp.path.startsWith('/') ? exp.path : `/${exp.path}`;
      const url = new URL(path, targetUrl).toString();
      const isApi = path.startsWith('/api/');

      addTarget({
        id: `perf_exp_${isApi ? 'api' : 'page'}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        type: isApi ? 'API' : 'PAGE',
        path,
        url,
        method: (exp.method?.toUpperCase() as any) || 'GET',
        workflowId: exp.workflowId,
        isCritical: exp.isCritical ?? true,
        priority: 100,
        source: 'PROJECT_CONFIG',
        safeToTest: true,
        description: `Explicit performance target: ${path}`,
      });
    }

    // 2. Business-Critical Workflows & Features from ProductModel
    if (productModel) {
      for (const workflow of productModel.workflows || []) {
        const isCritical = workflow.criticality?.level === 'CRITICAL' || workflow.criticality?.level === 'HIGH';
        const priority = isCritical ? 95 : 80;

        // Entrypoint route
        if (workflow.entryPoint) {
          try {
            const parsed = new URL(workflow.entryPoint, targetUrl);
            addTarget({
              id: `perf_wf_entry_${workflow.id}_${parsed.pathname.replace(/[^a-zA-Z0-9]/g, '_')}`,
              type: 'PAGE',
              path: parsed.pathname,
              url: parsed.toString(),
              workflowId: workflow.id,
              role: workflow.roleName,
              isCritical,
              priority,
              source: 'PRODUCT_MODEL',
              safeToTest: true,
              description: `Workflow entrypoint for "${workflow.name}": ${parsed.pathname}`,
            });
          } catch {
            // Ignore malformed URL
          }
        }

        // Action steps in workflow
        for (const step of workflow.steps || []) {
          if (step.pageUrl) {
            try {
              const parsed = new URL(step.pageUrl, targetUrl);
              addTarget({
                id: `perf_wf_step_${workflow.id}_${step.stepNumber}`,
                type: 'PAGE',
                path: parsed.pathname,
                url: parsed.toString(),
                workflowId: workflow.id,
                role: workflow.roleName,
                isCritical,
                priority: priority - 5,
                source: 'PRODUCT_MODEL',
                safeToTest: true,
                description: `Workflow step on ${parsed.pathname} (${step.targetDescription || step.actionType})`,
              });
            } catch {
              // Ignore malformed URL
            }
          }
        }
      }
    }

    // 3. Authenticated Role Context Routes
    for (const rc of roleContexts) {
      const roleName = rc.roleName || 'AUTHENTICATED';
      for (const rUrl of rc.discoveredPageUrls || []) {
        try {
          const parsed = new URL(rUrl, targetUrl);
          addTarget({
            id: `perf_role_${roleName.toLowerCase()}_${parsed.pathname.replace(/[^a-zA-Z0-9]/g, '_')}`,
            type: 'PAGE',
            path: parsed.pathname,
            url: parsed.toString(),
            role: roleName,
            isCritical: roleName.toUpperCase() === 'ADMIN',
            priority: 85,
            source: 'AUTH_CONTEXT',
            safeToTest: true,
            description: `Authenticated role surface for ${roleName}: ${parsed.pathname}`,
          });
        } catch {
          // Ignore malformed URL
        }
      }
    }

    // 4. Discovered Pages from ApplicationMap
    if (applicationMap) {
      for (const page of applicationMap.pages || []) {
        try {
          const parsed = new URL(page.url, targetUrl);
          const path = parsed.pathname;
          const isHome = path === '/' || path === '';
          const isKeySection = path.includes('/dashboard') || path.includes('/pricing') || path.includes('/features');

          addTarget({
            id: `perf_page_${path.replace(/[^a-zA-Z0-9]/g, '_') || 'root'}`,
            type: 'PAGE',
            path,
            url: page.url,
            isCritical: isHome,
            priority: isHome ? 90 : isKeySection ? 75 : 65,
            source: 'DISCOVERY',
            safeToTest: true,
            description: `Discovered page: ${path}`,
          });
        } catch {
          // Ignore malformed URL
        }
      }
    }

    // 5. Safe API Endpoints
    for (const ep of apiEndpoints) {
      const isSafeMethod = ep.method === 'GET' || ep.method === 'HEAD' || ep.method === 'OPTIONS';
      if (isSafeMethod && !ep.requiresExplicitSafeConfig) {
        addTarget({
          id: `perf_api_${ep.method.toLowerCase()}_${ep.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'API',
          path: ep.path,
          url: ep.url,
          method: ep.method,
          isCritical: !!ep.isAuthorizationBoundary,
          priority: ep.isAuthorizationBoundary ? 70 : 60,
          source: ep.source === 'OPENAPI' ? 'OPENAPI' : 'DISCOVERY',
          safeToTest: true,
          description: `API endpoint target: ${ep.method} ${ep.path}`,
        });
      }
    }

    // Ensure root entrypoint is present
    if (!targetsMap.has('PAGE:GET:/:ANY')) {
      addTarget({
        id: 'perf_page_root',
        type: 'PAGE',
        path: '/',
        url: targetUrl,
        isCritical: true,
        priority: 90,
        source: 'DISCOVERY',
        safeToTest: true,
        description: 'Application root entrypoint',
      });
    }

    // Sort by priority descending and slice to policy limits
    const sorted = Array.from(targetsMap.values()).sort((a, b) => b.priority - a.priority);

    // Apply category caps
    const pages = sorted.filter((t) => t.type === 'PAGE').slice(0, policy.maxPerformancePages);
    const apis = sorted.filter((t) => t.type === 'API').slice(0, policy.maxPerformanceApis);
    const others = sorted.filter((t) => t.type !== 'PAGE' && t.type !== 'API');

    const result = [...pages, ...apis, ...others].slice(0, policy.maxPerformanceTargets);

    logger?.log('performance_targets_discovered', {
      total: result.length,
      pagesCount: pages.length,
      apisCount: apis.length,
    });

    return result;
  }
}
