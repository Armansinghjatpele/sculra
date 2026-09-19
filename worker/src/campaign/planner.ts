// ==============================================================================
// Sculra Autonomous Campaign Planner (worker/src/campaign/planner.ts)
// ==============================================================================

import {
  CampaignTask,
  CampaignTarget,
  CampaignConfig,
  CampaignDomain,
} from './types';
import { TargetSelector } from './target-selector';
import { SourceCapability } from '../sources/types';

export class AutonomousCampaignPlanner {
  /**
   * Plans the initial ordered task graph for a campaign.
   */
  static planCampaign(
    campaignId: string,
    targetUrl: string,
    config: CampaignConfig,
    initialTargets: CampaignTarget[],
    customCapabilities?: SourceCapability[]
  ): CampaignTask[] {
    const tasks: CampaignTask[] = [];
    const activeDomains = new Set(config.domains || []);
    const capabilities = customCapabilities || config.capabilities;

    const isCapUnavailable = (key: string) => {
      if (!capabilities) return false;
      const cap = capabilities.find((c) => c.key === key);
      return cap?.state === 'UNAVAILABLE';
    };

    let taskIndex = 0;
    const createTaskId = (domain: string, targetSlug: string) =>
      `task-${domain.toLowerCase()}-${targetSlug}-${++taskIndex}`;

    // 1. Stage 1: Discovery Task (Always required if DISCOVERY is active or needed by other domains)
    let discoveryTaskId: string | undefined;
    if (activeDomains.has('DISCOVERY')) {
      discoveryTaskId = createTaskId('discovery', 'root');
      const browserUnavailable = isCapUnavailable('DOM_DISCOVERY') || isCapUnavailable('BROWSER_NAVIGATION');
      tasks.push({
        id: discoveryTaskId,
        campaignId,
        taskType: 'APPLICATION_DISCOVERY',
        domain: 'DISCOVERY',
        target: {
          id: 'target-discovery-root',
          type: 'PAGE',
          identifier: '/',
          url: targetUrl,
          businessCriticality: 'CRITICAL',
          strategyScore: 100,
        },
        priority: 100,
        reason: browserUnavailable
          ? 'Application discovery skipped: DOM/browser navigation capability unavailable on source surface'
          : 'Initial surface discovery to map application pages, forms, and routes',
        dependencies: [],
        status: browserUnavailable ? 'SKIPPED' : 'QUEUED',
        skipReason: browserUnavailable ? 'UNSUPPORTED_SURFACE' : undefined,
        retryCount: 0,
      });
    }

    // 2. Stage 2: Product Understanding Task
    let productTaskId: string | undefined;
    if (activeDomains.has('PRODUCT')) {
      productTaskId = createTaskId('product', 'model');
      tasks.push({
        id: productTaskId,
        campaignId,
        taskType: 'PRODUCT_MODEL_BUILDER',
        domain: 'PRODUCT',
        target: {
          id: 'target-product-model',
          type: 'PRODUCT_MODEL',
          identifier: 'Application Product Architecture',
          url: targetUrl,
          businessCriticality: 'CRITICAL',
          strategyScore: 95,
        },
        priority: 95,
        reason: 'Extract business-critical workflows, features, and user roles from discovery surface',
        dependencies: discoveryTaskId ? [discoveryTaskId] : [],
        status: 'QUEUED',
        retryCount: 0,
      });
    }

    // 3. Stage 3: Auth & Role Context
    let authTaskId: string | undefined;
    if (activeDomains.has('AUTHORIZATION') && config.roles && config.roles.length > 0) {
      authTaskId = createTaskId('auth', 'roles');
      tasks.push({
        id: authTaskId,
        campaignId,
        taskType: 'AUTHENTICATED_SESSION_SETUP',
        domain: 'AUTHORIZATION',
        target: {
          id: 'target-auth-setup',
          type: 'AUTH_ROUTE',
          identifier: 'Role Context Setup',
          url: targetUrl,
          businessCriticality: 'HIGH',
          strategyScore: 90,
        },
        priority: 90,
        reason: 'Establish authenticated session contexts and verify role boundaries',
        dependencies: discoveryTaskId ? [discoveryTaskId] : [],
        status: 'QUEUED',
        retryCount: 0,
      });
    }

    // Prerequisite for execution domains
    const basePrereqs: string[] = [];
    if (discoveryTaskId) basePrereqs.push(discoveryTaskId);
    if (productTaskId) basePrereqs.push(productTaskId);

    // 4. Stage 4: User Journey & Functional Testing Tasks
    if (activeDomains.has('FUNCTIONAL') || activeDomains.has('JOURNEY')) {
      // Create task for root / primary flows
      const domain: CampaignDomain = activeDomains.has('FUNCTIONAL') ? 'FUNCTIONAL' : 'JOURNEY';
      const funcUnavailable = isCapUnavailable('FUNCTIONAL_TESTING') || isCapUnavailable('BROWSER_NAVIGATION');
      
      // Workflows from targets
      const workflowTargets = initialTargets.filter((t) => t.type === 'WORKFLOW');
      if (workflowTargets.length > 0) {
        for (const wfTarget of workflowTargets) {
          tasks.push({
            id: createTaskId('journey', wfTarget.id),
            campaignId,
            taskType: 'USER_JOURNEY_EXECUTION',
            domain,
            target: wfTarget,
            priority: TargetSelector.computeTargetPriority(wfTarget),
            reason: funcUnavailable
              ? `User journey skipped: functional testing capability unavailable on source surface`
              : `Execute deterministic user journey for workflow "${wfTarget.identifier}" (${wfTarget.businessCriticality || 'STANDARD'} priority)`,
            dependencies: [...basePrereqs],
            status: funcUnavailable ? 'SKIPPED' : 'QUEUED',
            skipReason: funcUnavailable ? 'UNSUPPORTED_SURFACE' : undefined,
            retryCount: 0,
          });
        }
      } else {
        // Default core journey task
        tasks.push({
          id: createTaskId('journey', 'core'),
          campaignId,
          taskType: 'USER_JOURNEY_EXECUTION',
          domain,
          target: {
            id: 'target-journey-core',
            type: 'PAGE',
            identifier: 'Core User Journeys',
            url: targetUrl,
            businessCriticality: 'CRITICAL',
            strategyScore: 85,
          },
          priority: 85,
          reason: funcUnavailable
            ? 'Core user journeys skipped: functional testing capability unavailable on source surface'
            : 'Exercise primary navigation, interactive controls, and form usability flows',
          dependencies: [...basePrereqs],
          status: funcUnavailable ? 'SKIPPED' : 'QUEUED',
          skipReason: funcUnavailable ? 'UNSUPPORTED_SURFACE' : undefined,
          retryCount: 0,
        });
      }
    }

    // 5. Stage 5: API QA Tasks
    if (activeDomains.has('API')) {
      const apiUnavailable = isCapUnavailable('API_TESTING');
      const apiTargets = initialTargets.filter((t) => t.type === 'API');
      if (apiTargets.length > 0) {
        for (const apiTarget of apiTargets) {
          tasks.push({
            id: createTaskId('api', apiTarget.id),
            campaignId,
            taskType: 'API_ENDPOINT_AUDIT',
            domain: 'API',
            target: apiTarget,
            priority: TargetSelector.computeTargetPriority(apiTarget),
            reason: apiUnavailable
              ? `API audit skipped: API testing capability unavailable on source surface`
              : `Audit API endpoint contract, status, and payload on "${apiTarget.identifier}"`,
            dependencies: discoveryTaskId ? [discoveryTaskId] : [],
            status: apiUnavailable ? 'SKIPPED' : 'QUEUED',
            skipReason: apiUnavailable ? 'UNSUPPORTED_SURFACE' : undefined,
            retryCount: 0,
          });
        }
      } else {
        // Generic API suite task
        tasks.push({
          id: createTaskId('api', 'suite'),
          campaignId,
          taskType: 'API_ENDPOINT_AUDIT',
          domain: 'API',
          target: {
            id: 'target-api-suite',
            type: 'API',
            identifier: 'Discovered API Endpoints',
            url: targetUrl,
            businessCriticality: 'MEDIUM',
            strategyScore: 75,
          },
          priority: 75,
          reason: apiUnavailable
            ? 'API testing skipped: API testing capability unavailable on source surface'
            : 'Audit discovered backend REST API endpoints and contract responses',
          dependencies: discoveryTaskId ? [discoveryTaskId] : [],
          status: apiUnavailable ? 'SKIPPED' : 'QUEUED',
          skipReason: apiUnavailable ? 'UNSUPPORTED_SURFACE' : undefined,
          retryCount: 0,
        });
      }
    }

    // 6. Stage 6: Security & Authorization QA Task
    if (activeDomains.has('SECURITY')) {
      tasks.push({
        id: createTaskId('security', 'scan'),
        campaignId,
        taskType: 'SECURITY_VULNERABILITY_SWEEP',
        domain: 'SECURITY',
        target: {
          id: 'target-security-sweep',
          type: 'SECURITY_POLICY',
          identifier: 'Security Headers, Cookies, CORS & Secret Exposure',
          url: targetUrl,
          businessCriticality: 'CRITICAL',
          strategyScore: 85,
        },
        priority: 85,
        reason: 'Audit security headers (CSP, HSTS), cookie flags, CORS policies, sensitive data leaks, and authorization guards',
        dependencies: discoveryTaskId ? [discoveryTaskId] : [],
        status: 'QUEUED',
        retryCount: 0,
      });
    }

    // 7. Stage 7: Accessibility & Inclusive UX Task
    if (activeDomains.has('ACCESSIBILITY')) {
      const a11yUnavailable = isCapUnavailable('ACCESSIBILITY_TESTING') || isCapUnavailable('BROWSER_NAVIGATION');
      tasks.push({
        id: createTaskId('a11y', 'wcag'),
        campaignId,
        taskType: 'ACCESSIBILITY_AUDIT',
        domain: 'ACCESSIBILITY',
        target: {
          id: 'target-a11y-audit',
          type: 'ACCESSIBILITY_POLICY',
          identifier: 'WCAG 2.1 AA Compliance & Inclusive UX',
          url: targetUrl,
          businessCriticality: 'HIGH',
          strategyScore: 80,
        },
        priority: 80,
        reason: a11yUnavailable
          ? 'Accessibility audit skipped: accessibility testing capability unavailable on source surface'
          : 'Audit keyboard focus navigation, color contrast ratios, form labels, ARIA landmarks, and touch target scaling',
        dependencies: [...basePrereqs],
        status: a11yUnavailable ? 'SKIPPED' : 'QUEUED',
        skipReason: a11yUnavailable ? 'UNSUPPORTED_SURFACE' : undefined,
        retryCount: 0,
      });
    }

    // 8. Stage 8: Visual & Responsive QA Task
    if (activeDomains.has('VISUAL') || activeDomains.has('RESPONSIVE')) {
      const domain: CampaignDomain = activeDomains.has('VISUAL') ? 'VISUAL' : 'RESPONSIVE';
      const visualUnavailable =
        isCapUnavailable('VISUAL_TESTING') ||
        isCapUnavailable('RESPONSIVE_TESTING') ||
        isCapUnavailable('BROWSER_NAVIGATION');
      tasks.push({
        id: createTaskId('visual', 'responsive'),
        campaignId,
        taskType: 'VISUAL_RESPONSIVE_AUDIT',
        domain,
        target: {
          id: 'target-visual-audit',
          type: 'VIEWPORT',
          identifier: 'Responsive Viewports (Desktop, Tablet, Mobile)',
          url: targetUrl,
          businessCriticality: 'MEDIUM',
          strategyScore: 70,
        },
        priority: 70,
        reason: visualUnavailable
          ? 'Visual/responsive audit skipped: visual/responsive testing capability unavailable on source surface'
          : 'Audit responsive layout stability, visual clipping, overflow, and component alignment across viewports',
        dependencies: discoveryTaskId ? [discoveryTaskId] : [],
        status: visualUnavailable ? 'SKIPPED' : 'QUEUED',
        skipReason: visualUnavailable ? 'UNSUPPORTED_SURFACE' : undefined,
        retryCount: 0,
      });
    }

    // 9. Stage 9: Performance & Reliability QA Task
    if (activeDomains.has('PERFORMANCE') || activeDomains.has('RELIABILITY')) {
      const domain: CampaignDomain = activeDomains.has('PERFORMANCE') ? 'PERFORMANCE' : 'RELIABILITY';
      const perfUnavailable =
        isCapUnavailable('PERFORMANCE_TESTING') || isCapUnavailable('BROWSER_NAVIGATION');
      tasks.push({
        id: createTaskId('perf', 'vitals'),
        campaignId,
        taskType: 'PERFORMANCE_AUDIT',
        domain,
        target: {
          id: 'target-perf-audit',
          type: 'PERFORMANCE_METRIC',
          identifier: 'Core Web Vitals & Navigation Timings',
          url: targetUrl,
          businessCriticality: 'HIGH',
          strategyScore: 75,
        },
        priority: 75,
        reason: perfUnavailable
          ? 'Performance audit skipped: performance testing capability unavailable on source surface'
          : 'Benchmark Core Web Vitals (LCP, CLS, INP, FCP, TTFB), asset payloads, and load reliability',
        dependencies: [...basePrereqs],
        status: perfUnavailable ? 'SKIPPED' : 'QUEUED',
        skipReason: perfUnavailable ? 'UNSUPPORTED_SURFACE' : undefined,
        retryCount: 0,
      });
    }

    // 10. Stage 10: Historical QA Memory & Regression Analysis
    let historicalTaskId: string | undefined;
    if (activeDomains.has('HISTORICAL')) {
      historicalTaskId = createTaskId('history', 'regression');
      tasks.push({
        id: historicalTaskId,
        campaignId,
        taskType: 'HISTORICAL_REGRESSION_ANALYSIS',
        domain: 'HISTORICAL',
        target: {
          id: 'target-history-analysis',
          type: 'HISTORICAL_BASELINE',
          identifier: 'Cross-Run QA Memory & Flakiness Index',
          url: targetUrl,
          businessCriticality: 'HIGH',
          strategyScore: 90,
        },
        priority: 90,
        reason: 'Compare findings and metrics against compatible dimensional baselines to identify regressions, recoveries, and flakiness',
        dependencies: [], // Scheduler enforces it runs after test execution
        status: 'QUEUED',
        retryCount: 0,
      });
    }

    // 11. Stage 11: Release Readiness Assessment (Always final task)
    if (activeDomains.has('RELEASE')) {
      tasks.push({
        id: createTaskId('release', 'readiness'),
        campaignId,
        taskType: 'RELEASE_READINESS_EVALUATION',
        domain: 'RELEASE',
        target: {
          id: 'target-release-scorer',
          type: 'RELEASE_GATE',
          identifier: 'Deterministic Release Readiness Scorer',
          url: targetUrl,
          businessCriticality: 'CRITICAL',
          strategyScore: 100,
        },
        priority: 100,
        reason: 'Synthesize all multi-domain evidence, evaluate 10 deterministic release blockers, and issue release recommendation',
        dependencies: [], // Scheduler enforces it runs as the very last task
        status: 'QUEUED',
        retryCount: 0,
      });
    }

    // Sort tasks in initial scheduling order: highest priority first, with DAG dependencies respected
    return tasks;
  }
}
