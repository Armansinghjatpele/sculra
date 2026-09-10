// ==============================================================================
// Sculra AI QA Prioritization & Autonomous Test Strategy Engine (worker/src/strategy/types.ts)
// ==============================================================================
// Strongly typed domain models for test target representation, deterministic prioritization,
// strategy modes, bounded strategy budgets, and AI strategy reasoning.

import { JourneyActionType } from '../journeys/types';
import { BugType, BugSeverity } from '../issues/types';
import { AIQAPriority } from '../ai-qa/types';
import { HypothesisRecord, CoverageSummary } from '../ai-qa/state';

export type TestTargetType =
  | 'PAGE'
  | 'LINK'
  | 'BUTTON'
  | 'FORM'
  | 'INPUT'
  | 'SELECT'
  | 'NAVIGATION_PATH'
  | 'RESPONSIVE_VIEW'
  | 'PREVIOUS_FAILURE'
  | 'SUSPECTED_ISSUE'
  | 'VISUAL_AREA'
  | 'INTERACTION_CLUSTER'
  // Prompt 24: API Target Types
  | 'API_ENDPOINT'
  | 'API_AUTHORIZATION'
  | 'API_CONTRACT'
  | 'API_FAILURE'
  | 'API_REGRESSION'
  // Prompt 25: Security Target Types
  | 'SECURITY_ROUTE'
  | 'SECURITY_API'
  | 'AUTHORIZATION_BOUNDARY'
  | 'SECURITY_HEADER'
  | 'SECURITY_COOKIE'
  | 'CORS_TARGET'
  | 'REDIRECT_TARGET'
  | 'SENSITIVE_DATA_TARGET'
  | 'SECURITY_REGRESSION'
  // Prompt 26: Performance & Reliability Target Types
  | 'PERFORMANCE_PAGE'
  | 'PERFORMANCE_API'
  | 'PERFORMANCE_WORKFLOW'
  | 'PERFORMANCE_ACTION'
  | 'PERFORMANCE_RESOURCE'
  | 'PERFORMANCE_REGRESSION'
  | 'PERFORMANCE_RELIABILITY'
  // Prompt 27: Accessibility & Inclusive UX Target Types
  | 'ACCESSIBILITY_PAGE'
  | 'ACCESSIBILITY_FORM'
  | 'ACCESSIBILITY_DIALOG'
  | 'ACCESSIBILITY_KEYBOARD'
  | 'ACCESSIBILITY_FOCUS'
  | 'ACCESSIBILITY_CONTRAST'
  | 'ACCESSIBILITY_SEMANTICS'
  | 'ACCESSIBILITY_RESPONSIVE'
  | 'ACCESSIBILITY_MOTION'
  | 'ACCESSIBILITY_TOUCH_TARGET'
  | 'ACCESSIBILITY_REGRESSION';

export type TestTargetStatus =
  | 'PENDING'
  | 'SELECTED'
  | 'EXECUTED'
  | 'SKIPPED'
  | 'FAILED'
  | 'COOLDOWN';

export type StrategyMode =
  | 'BREADTH_FIRST'
  | 'DEPTH_FIRST'
  | 'FAILURE_DRIVEN'
  | 'REGRESSION_FOCUSED'
  | 'RELEASE_GAP';

export type TargetSource =
  | 'DISCOVERY'
  | 'FAILURE_INVESTIGATION'
  | 'HYPOTHESIS'
  | 'COVERAGE_GAP'
  | 'REGRESSION'
  | 'RESPONSIVE'
  | 'API_DISCOVERY'
  | 'API_CONTRACT'
  | 'SECURITY_DISCOVERY'
  | 'SECURITY_REGRESSION'
  | 'ACCESSIBILITY_DISCOVERY'
  | 'ACCESSIBILITY_REGRESSION';

export interface TestTarget {
  id: string;
  targetType: TestTargetType;
  pageUrl: string;
  selector?: string;
  action?: JourneyActionType;
  value?: string;
  viewportName?: 'desktop' | 'tablet' | 'mobile' | string;
  priorityScore: number; // Bounded 0 - 100
  priorityLevel: AIQAPriority;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  coverageValue: number; // 0 - 100
  reasons: string[]; // Human-readable deterministic explanations
  dependencies: string[]; // Prerequisite target IDs (e.g. page visit before form fill)
  source: TargetSource;
  status: TestTargetStatus;
  estimatedCost: number; // 1 to 5 cost factor
  evidenceCount: number;
  attemptsCount: number;
  lastAttemptedIteration?: number;
  hypothesisId?: string;
  relatedIssueFingerprint?: string;
  productFeatureId?: string;
  workflowId?: string;
  roleId?: string;
  authenticated?: boolean;
  isAuthorizationBoundary?: boolean;
  criticalityScore?: number;
  criticalityLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  productReason?: string;
  metadata?: Record<string, any>;
}

export interface StrategyBudget {
  maxIterations: number;
  currentIteration: number;
  remainingIterations: number;
  maxTargets: number;
  targetsExecuted: number;
  maxDeepInvestigationDepth: number;
  maxRetries: number;
  maxTargetsPerPage: number;
  maxStrategyCalls: number;
  strategyCallsMade: number;
}

export type StrategyStopReason =
  | 'STRATEGY_BUDGET_EXHAUSTED'
  | 'GOAL_ACHIEVED'
  | 'NO_VIABLE_TARGETS'
  | 'ALL_TARGETS_COVERED'
  | 'CRITICAL_BLOCKER_FOUND'
  | 'CANCELLED'
  | 'PROVIDER_FAILURE';

export interface AIStrategyHypothesis {
  id: string;
  description: string;
  targetUrl: string;
  confidence: 'high' | 'medium' | 'low';
  supportingEvidence: string;
}

export interface AIStrategyRecommendation {
  recommendedMode: StrategyMode;
  selectedTargetIds: string[];
  investigationHypotheses: AIStrategyHypothesis[];
  strategyRationale: string;
  recommendedFocus: 'BREADTH' | 'DEPTH' | 'FAILURE_INVESTIGATION' | 'RELEASE_VERIFICATION';
  suggestedStop: boolean;
  stopReason?: string;
}

export interface DeterministicTargetRanking {
  targetId: string;
  score: number;
  reasons: string[];
}

export interface StrategyDecision {
  iteration: number;
  mode: StrategyMode;
  selectedTargets: TestTarget[];
  deterministicRankings: DeterministicTargetRanking[];
  aiRecommendation?: AIStrategyRecommendation;
  budgetRemaining: {
    iterations: number;
    targets: number;
    calls: number;
  };
  isFallback: boolean;
  fallbackReason?: string;
  evaluatedAt: string;
}

export interface StrategyAnalysisContext {
  testRunId: string;
  targetUrl: string;
  currentMode: StrategyMode;
  iteration: number;
  budget: StrategyBudget;
  candidates: Array<{
    id: string;
    targetType: TestTargetType;
    pageUrl: string;
    selector?: string;
    priorityScore: number;
    riskLevel: string;
    reasons: string[];
  }>;
  stateSummary?: {
    coverage: CoverageSummary;
    highRiskAreas: Array<{ pageUrl: string; reason: string; riskLevel: string }>;
    recentFailures: Array<{ pageUrl: string; selector?: string; error: string }>;
    activeHypotheses: Array<{ id: string; description: string; targetUrl: string }>;
  };
  releaseRisk?: {
    overallScore?: number;
    blockersCount?: number;
    confidenceLevel?: string;
  };
  untrustedPageDataNotice: string;
}

export interface StrategyEngineOptions {
  maxIterations?: number;
  maxTargets?: number;
  maxRetries?: number;
  maxTargetsPerPage?: number;
  maxStrategyCalls?: number;
  allowLocalhost?: boolean;
}
