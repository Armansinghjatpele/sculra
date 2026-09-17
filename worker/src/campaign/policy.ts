// ==============================================================================
// Sculra Autonomous QA Campaign Policy & Budget Defaults (worker/src/campaign/policy.ts)
// ==============================================================================

import { CampaignConfig, CampaignBudget, CampaignDomain, CampaignObjective } from './types';

export interface CampaignPolicyConfig {
  maxDurationSeconds: number;
  maxTasks: number;
  maxConcurrentTasks: number;
  maxDiscoveryTargets: number;
  maxAdaptiveInsertions: number;
  maxRetries: number;
  maxEvidenceLinksPerTask: number;
  defaultDomains: CampaignDomain[];
  defaultViewports: string[];
  defaultRoles: string[];
}

export const DEFAULT_CAMPAIGN_POLICY: CampaignPolicyConfig = {
  maxDurationSeconds: 600, // 10 minutes maximum per campaign
  maxTasks: 100, // Bound task graph to max 100 tasks
  maxConcurrentTasks: 4, // Max concurrency
  maxDiscoveryTargets: 100, // Max discovery scope
  maxAdaptiveInsertions: 50, // Max adaptive reactive tasks
  maxRetries: 2, // Max retry on intermittent/timeout
  maxEvidenceLinksPerTask: 20, // Bound evidence links per task
  defaultDomains: [
    'DISCOVERY',
    'PRODUCT',
    'STRATEGY' as any,
    'FUNCTIONAL',
    'JOURNEY',
    'API',
    'SECURITY',
    'ACCESSIBILITY',
    'VISUAL',
    'PERFORMANCE',
    'HISTORICAL',
    'RELEASE',
  ],
  defaultViewports: ['desktop', 'tablet', 'mobile'],
  defaultRoles: ['ANONYMOUS'],
};

export function createCampaignBudget(config: Partial<CampaignConfig> = {}): CampaignBudget {
  const maxDuration = Math.min(
    Math.max(config.maxDurationSeconds || DEFAULT_CAMPAIGN_POLICY.maxDurationSeconds, 30),
    1800 // Hard cap at 30 min
  );
  const maxTasks = Math.min(
    Math.max(config.maxTasks !== undefined ? config.maxTasks : DEFAULT_CAMPAIGN_POLICY.maxTasks, 1),
    300 // Hard cap
  );
  const maxConcurrency = Math.min(
    Math.max(config.maxConcurrentTasks || DEFAULT_CAMPAIGN_POLICY.maxConcurrentTasks, 1),
    8 // Hard cap
  );

  return {
    maxDurationSeconds: maxDuration,
    maxTasks: maxTasks,
    maxConcurrentTasks: maxConcurrency,
    maxAdaptiveInsertions: DEFAULT_CAMPAIGN_POLICY.maxAdaptiveInsertions,
    maxRetries: DEFAULT_CAMPAIGN_POLICY.maxRetries,
    maxEvidenceLinksPerTask: DEFAULT_CAMPAIGN_POLICY.maxEvidenceLinksPerTask,
    elapsedSeconds: 0,
    tasksExecuted: 0,
    tasksRemaining: maxTasks,
    adaptiveInsertionsCount: 0,
  };
}

export function normalizeCampaignDomains(domains?: CampaignDomain[]): CampaignDomain[] {
  if (!domains || domains.length === 0) {
    return [
      'DISCOVERY',
      'PRODUCT',
      'FUNCTIONAL',
      'JOURNEY',
      'API',
      'SECURITY',
      'ACCESSIBILITY',
      'VISUAL',
      'PERFORMANCE',
      'HISTORICAL',
      'RELEASE',
    ];
  }

  const unique = Array.from(new Set(domains.map((d) => d.toUpperCase() as CampaignDomain)));
  return unique;
}

export function getObjectiveDefaultDomains(objective: CampaignObjective): CampaignDomain[] {
  switch (objective) {
    case 'smoke':
      return ['DISCOVERY', 'PRODUCT', 'FUNCTIONAL', 'JOURNEY', 'RELEASE'];
    case 'regression':
      return ['DISCOVERY', 'PRODUCT', 'FUNCTIONAL', 'JOURNEY', 'API', 'HISTORICAL', 'RELEASE'];
    case 'security_audit':
      return ['DISCOVERY', 'PRODUCT', 'API', 'SECURITY', 'AUTHORIZATION', 'RELEASE'];
    case 'accessibility_audit':
      return ['DISCOVERY', 'PRODUCT', 'ACCESSIBILITY', 'RESPONSIVE', 'RELEASE'];
    case 'performance_audit':
      return ['DISCOVERY', 'PRODUCT', 'PERFORMANCE', 'RELIABILITY', 'API', 'RELEASE'];
    case 'full_suite':
    case 'release_readiness':
    case 'custom':
    default:
      return [
        'DISCOVERY',
        'PRODUCT',
        'FUNCTIONAL',
        'JOURNEY',
        'API',
        'SECURITY',
        'AUTHORIZATION',
        'ACCESSIBILITY',
        'VISUAL',
        'RESPONSIVE',
        'PERFORMANCE',
        'RELIABILITY',
        'HISTORICAL',
        'RELEASE',
      ];
  }
}
