// ==============================================================================
// Sculra Shared Type Definitions (shared/types/index.ts)
// ==============================================================================

// User Profile Definitions
export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Tenant Organization Definitions
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Membership Mapping (RBAC)
export type MemberRole = 'owner' | 'admin' | 'member';

export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: MemberRole;
  createdAt: string;
  updatedAt: string;
}

// Project Definitions
export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

// Test Runs
export type TestRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
export type TriggerType = 'manual' | 'webhook' | 'schedule';

export interface TestRun {
  id: string;
  projectId: string;
  status: TestRunStatus;
  triggerType: TriggerType;
  commitHash?: string;
  releaseVersion?: string;
  score?: number;
  createdAt: string;
  finishedAt?: string;
}

// Test Step
export type ActionType = 'click' | 'type' | 'navigate' | 'assert' | 'hover';
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface TestStep {
  id: string;
  testRunId: string;
  orderIndex: number;
  actionType: ActionType;
  description: string;
  status: StepStatus;
  durationMs: number;
  errorMessage?: string;
  createdAt: string;
}

// Bug Reports
export type BugSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BugStatus = 'open' | 'fixed' | 'ignored' | 'duplicate';

export interface Bug {
  id: string;
  testRunId: string;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  stepsToReproduce?: string[];
  aiAnalysis?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Billing Details
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive';

export interface BillingDetails {
  id: string;
  organizationId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd?: string;
  createdAt: string;
  updatedAt: string;
}

