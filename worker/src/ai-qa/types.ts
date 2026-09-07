// ==============================================================================
// Sculra AI QA Orchestration Foundation Types (worker/src/ai-qa/types.ts)
// ==============================================================================
// Strongly typed domain models for provider-agnostic AI QA planning,
// context building, safety validation, and bounded execution.

import { JourneyActionType, JourneyObservation, StepResultStatus, JourneyResult } from '../journeys/types';
import { ApplicationMap, ViewportConfig, CapturedScreenshot } from '../types';
import { BugObservation, BugType, BugSeverity } from '../issues/types';

export type AIQAPriority = 'critical' | 'high' | 'medium' | 'low';

export type AIQAIssueConfidence = 'CONFIRMED' | 'SUSPECTED';

export type AIQAStopReason =
  | 'BUDGET_EXHAUSTED'
  | 'NO_FURTHER_ACTIONS'
  | 'ALL_ACTIONS_REJECTED'
  | 'CANCELLED'
  | 'TERMINAL_FAILURE'
  | 'GOAL_ACHIEVED';

// -----------------------------------------------------------------------------
// 1. Context Models (Sanitized, Untrusted Data Explicitly Flagged)
// -----------------------------------------------------------------------------

export interface SanitizedPageSummary {
  url: string;
  title: string;
  depth: number;
  interactiveElementsCount: number;
  formsCount: number;
  linksCount: number;
  sampleElements: Array<{
    type: string;
    text?: string;
    selector: string;
    isPrimaryCta?: boolean;
  }>;
  sampleForms: Array<{
    action?: string;
    method: string;
    fieldsCount: number;
    fields: Array<{
      name: string;
      type: string;
      label?: string;
      placeholder?: string;
      required: boolean;
      selector: string;
    }>;
  }>;
}

export interface SanitizedIssueSummary {
  fingerprint: string;
  type: BugType;
  severity: BugSeverity;
  title: string;
  pageUrl: string;
  selector?: string;
  occurrenceCount: number;
}

export interface SanitizedJourneySummary {
  journeyId: string;
  name: string;
  status: 'PASSED' | 'FAILED' | 'PARTIAL' | 'CANCELLED';
  durationMs: number;
  actionsPassed: number;
  actionsFailed: number;
  observationsCount: number;
}

export interface SanitizedObservationSummary {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  pageUrl: string;
  selector?: string;
  timestamp: string;
}

export interface AIQAPlanSummary {
  planId: string;
  iteration: number;
  reasoningSummary: string;
  priority: AIQAPriority;
  actionsCount: number;
  hypothesesCount: number;
}

export interface AIQAResultSummary {
  iteration: number;
  planId: string;
  status: 'PASSED' | 'FAILED' | 'PARTIAL' | 'CANCELLED';
  approvedActionsCount: number;
  rejectedActionsCount: number;
  observationsCount: number;
  stopReason?: AIQAStopReason;
}

export interface AIQABudget {
  maxIterations: number;
  currentIteration: number;
  remainingIterations: number;
  maxCalls: number;
  callsMade: number;
  maxTotalActions: number;
  actionsExecuted: number;
  maxAiTimeMs: number;
  elapsedTimeMs: number;
  maxActionsPerJourney: number;
}

/**
 * Structured, sanitized context supplied to an AIQAProvider.
 * CRITICAL: Must NEVER contain credentials, tokens, cookies, auth headers, or raw secrets.
 */
export interface AIQAContext {
  testRunId: string;
  projectId: string;
  organizationId?: string;
  targetUrl: string;
  scopeOrigin: string;
  discoveredPages: SanitizedPageSummary[];
  existingIssues: SanitizedIssueSummary[];
  previousJourneys: SanitizedJourneySummary[];
  recentObservations: SanitizedObservationSummary[];
  previousPlans: AIQAPlanSummary[];
  previousResults: AIQAResultSummary[];
  iteration: number;
  budget: AIQABudget;
  untrustedPageDataNotice: string;
}

// -----------------------------------------------------------------------------
// 2. Structured AI QA Plan Schema
// -----------------------------------------------------------------------------

export interface AIQAHypothesis {
  id: string;
  description: string;
  targetUrl: string;
  suspectedBugType?: BugType;
  confidence: 'high' | 'medium' | 'low';
}

export interface AIQAAction {
  id: string;
  type: JourneyActionType;
  targetDescription: string;
  pageUrl: string;
  selector?: string;
  value?: string;
  expected?: {
    url?: string;
    title?: string;
    text?: string;
    visibleSelector?: string;
  };
  timeoutMs?: number;
}

export interface AIQAExpectation {
  id: string;
  description: string;
  pageUrl?: string;
  expectedSelector?: string;
}

export interface AIQAStopCondition {
  type: 'GOAL_ACHIEVED' | 'NO_USEFUL_ACTIONS' | 'UNRECOVERABLE_DEFECT' | 'BUDGET_LIMIT';
  reason: string;
}

/**
 * Validatable Structured Output produced by AIQAProvider.
 */
export interface AIQAPlan {
  version: '1.0';
  planId: string;
  iteration: number;
  reasoningSummary: string;
  priority: AIQAPriority;
  hypotheses: AIQAHypothesis[];
  actions: AIQAAction[];
  expectedOutcomes: AIQAExpectation[];
  stopConditions: AIQAStopCondition[];
}

// -----------------------------------------------------------------------------
// 3. Validation & Execution Result Models
// -----------------------------------------------------------------------------

export interface ActionRejectionReason {
  actionId: string;
  actionType: JourneyActionType;
  targetDescription: string;
  reason: string;
  ruleViolated:
    | 'UNALLOWLISTED_ACTION'
    | 'DANGEROUS_ACTION'
    | 'SENSITIVE_FIELD'
    | 'CROSS_ORIGIN'
    | 'SSRF_SECURITY_VIOLATION'
    | 'INVALID_URL'
    | 'BUDGET_EXCEEDED'
    | 'MISSING_SELECTOR';
}

export interface AIQAValidationResult {
  approved: boolean;
  sanitizedPlan: AIQAPlan;
  approvedActions: AIQAAction[];
  rejectedActions: ActionRejectionReason[];
  validationErrors: string[];
}

export interface AIQAIssueAssessment {
  type: BugType;
  title: string;
  confidence: AIQAIssueConfidence;
  pageUrl: string;
  selector?: string;
  details: string;
  observationReference?: string;
}

export interface AIQAResult {
  testRunId: string;
  projectId: string;
  iteration: number;
  planId: string;
  provider: string;
  model: string;
  approvedActions: AIQAAction[];
  rejectedActions: ActionRejectionReason[];
  executedJourney?: JourneyResult;
  discoveredObservations: JourneyObservation[];
  evidenceIds: string[];
  issuesIdentified: AIQAIssueAssessment[];
  stopReason: AIQAStopReason;
  durationMs: number;
  tokenUsage?: {
    estimatedInputTokens: number | null;
    estimatedOutputTokens: number | null;
  };
  createdAt: string;
}

// -----------------------------------------------------------------------------
// 4. Provider Abstraction Metadata
// -----------------------------------------------------------------------------

export interface AIQAProviderMetadata {
  name: string;
  model: string;
  isDeterministicMock: boolean;
}

// -----------------------------------------------------------------------------
// 5. Configuration & Constants
// -----------------------------------------------------------------------------

export interface AIQAConfig {
  enabled: boolean;
  provider?: string;
  maxIterations?: number;
  maxCalls?: number;
  maxJourneysPerRun?: number;
  maxActionsPerJourney?: number;
  maxTotalActions?: number;
  maxAiTimeMs?: number;
}

export const DEFAULT_AI_QA_CONFIG: Required<AIQAConfig> = {
  enabled: true,
  provider: 'mock-deterministic',
  maxIterations: 3,
  maxCalls: 5,
  maxJourneysPerRun: 5,
  maxActionsPerJourney: 10,
  maxTotalActions: 30,
  maxAiTimeMs: 60000,
};
