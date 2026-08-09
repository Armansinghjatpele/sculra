// ==============================================================================
// Sculra Shared Configuration (shared/config/index.ts)
// ==============================================================================

export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free Trial',
    maxProjects: 1,
    maxTestRunsPerMonth: 10,
    maxMembers: 1,
    priceMonthly: 0,
  },
  starter: {
    name: 'Starter',
    maxProjects: 3,
    maxTestRunsPerMonth: 100,
    maxMembers: 3,
    priceMonthly: 49,
  },
  pro: {
    name: 'Professional',
    maxProjects: 10,
    maxTestRunsPerMonth: 1000,
    maxMembers: 10,
    priceMonthly: 199,
  },
  enterprise: {
    name: 'Enterprise',
    maxProjects: 999,
    maxTestRunsPerMonth: 99999,
    maxMembers: 999,
    priceMonthly: 999,
  },
} as const;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_FILE_SIZE_MB = 10;
export const SUPPORTED_LOCALES = ['en'] as const;

