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
export type ProjectSourceType = 'website' | 'github' | 'zip' | 'desktop' | 'api';
export type ProjectStatus = 'active' | 'archived' | 'paused';

export interface Project {
  id: string;
  organizationId?: string | null;
  name: string;
  slug?: string;
  description?: string;
  sourceType: ProjectSourceType;
  sourceUrl?: string;
  repositoryUrl?: string;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

// Test Runs Lifecycle
export type TestRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'needs_review';
export type TriggerType = 'manual' | 'github' | 'scheduled' | 'api' | 'future_ai_agent';

export interface TestRun {
  id: string;
  projectId: string;
  organizationId?: string | null;
  status: TestRunStatus;
  triggerType: TriggerType;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  overallScore?: number;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

// Test Evidence
export type TestEvidenceType = 'screenshot' | 'console_error' | 'network_error' | 'dom_snapshot' | 'navigation';

export interface TestEvidence {
  id: string;
  testRunId: string;
  projectId: string;
  type: TestEvidenceType;
  title: string;
  url?: string;
  message?: string;
  metadata?: Record<string, any>;
  storagePath?: string;
  createdAt: string;
}

// Structured Test Run Results
export interface TestRunResult {
  status: 'passed' | 'failed' | 'cancelled';
  pageTitle?: string;
  finalUrl?: string;
  statusCode?: number;
  durationMs: number;
  consoleErrors: number;
  networkErrors: number;
  screenshots: number;
  evidence: Omit<TestEvidence, 'id' | 'createdAt'>[];
  failureReason?: string;
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

/**
 * Generic API response envelope used across Sculra services.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
