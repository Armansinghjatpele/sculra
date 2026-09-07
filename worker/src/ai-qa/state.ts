// ==============================================================================
// Sculra Adaptive AI QA State Model (worker/src/ai-qa/state.ts)
// ==============================================================================
// Strongly typed domain models for tracking the evolving QA state across
// bounded adaptive reasoning iterations.

import { JourneyActionType } from '../journeys/types';
import { BugType } from '../issues/types';
import {
  AIQAPriority,
  AIQAStopReason,
  AIQABudget,
  SanitizedPageSummary,
  SanitizedIssueSummary,
  SanitizedJourneySummary,
  SanitizedObservationSummary,
  AIQAIssueAssessment,
  ActionRejectionReason,
} from './types';

export type HypothesisStatus = 'PENDING' | 'TESTING' | 'CONFIRMED' | 'DISPROVEN' | 'INCONCLUSIVE';

export interface TestedPageRecord {
  url: string;
  firstTestedIteration: number;
  lastTestedIteration: number;
  timesTested: number;
  status: 'PASSED' | 'FAILED' | 'PARTIAL';
}

export interface TestedInteractionRecord {
  selector: string;
  action: JourneyActionType;
  pageUrl: string;
  iteration: number;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
}

export interface TestedFormRecord {
  formSelectorOrAction: string;
  pageUrl: string;
  iteration: number;
  status: 'PASSED' | 'FAILED';
  fieldsTested: string[];
}

export interface TestedNavigationRecord {
  fromUrl: string;
  toUrl: string;
  iteration: number;
  status: 'PASSED' | 'FAILED';
}

export interface HypothesisRecord {
  id: string;
  description: string;
  targetUrl: string;
  suspectedBugType?: BugType;
  priority: AIQAPriority;
  supportingEvidence?: string;
  status: HypothesisStatus;
  confidence: 'high' | 'medium' | 'low';
  iterationFormulated: number;
  iterationTested?: number;
  outcomeReason?: string;
  relatedIssueIds?: string[];
}

export interface CoverageSummary {
  pages: { discovered: number; visited: number };
  forms: { discovered: number; exercised: number };
  buttons: { discovered: number; exercised: number };
  links: { discovered: number; exercised: number };
  navigationPaths: { discovered: number; exercised: number };
  apis?: { discovered: number; tested: number; failed: number; coverageRatio: number };
  hypotheses: {
    formulated: number;
    tested: number;
    confirmed: number;
    disproven: number;
    inconclusive: number;
  };
}

export interface UncoveredAreas {
  unvisitedPages: SanitizedPageSummary[];
  unexercisedForms: Array<{ pageUrl: string; formIndex: number; fieldsCount: number; fields: string[] }>;
  unexercisedButtons: Array<{ pageUrl: string; selector: string; text?: string; isPrimaryCta?: boolean }>;
  unexercisedLinks: Array<{ pageUrl: string; href: string; text?: string }>;
  unexercisedNavigationPaths: Array<{ fromUrl: string; toUrl: string }>;
}

export interface HighRiskArea {
  pageUrl: string;
  reason: string;
  riskLevel: 'critical' | 'high' | 'medium';
  relatedBugsCount: number;
  relatedObservationsCount: number;
}

export interface BlockedArea {
  pageUrl: string;
  reason: string;
  blockedAtIteration: number;
}

export interface AIQAStateSummary {
  iteration: number;
  coverage: CoverageSummary;
  uncoveredHighValueTargets: Array<{
    type: 'PAGE' | 'FORM' | 'BUTTON' | 'NAVIGATION';
    pageUrl: string;
    description: string;
    priority: AIQAPriority;
    targetSelector?: string;
  }>;
  highRiskAreas: HighRiskArea[];
  activeHypotheses: Array<{
    id: string;
    description: string;
    targetUrl: string;
    priority: AIQAPriority;
    status: HypothesisStatus;
  }>;
  recentFailures: Array<{
    iteration: number;
    pageUrl: string;
    actionDescription: string;
    error: string;
  }>;
  recentObservationsCount: number;
  remainingBudget: {
    remainingIterations: number;
    remainingActions: number;
    remainingCalls: number;
  };
}

/**
 * Complete internal evolving QA state across iterations.
 */
export interface AIQAState {
  testRunId: string;
  iteration: number;
  applicationMapSummary: {
    totalPages: number;
    totalForms: number;
    totalButtons: number;
    totalLinks: number;
  };
  testedPages: Map<string, TestedPageRecord>;
  testedInteractions: TestedInteractionRecord[];
  testedForms: TestedFormRecord[];
  testedNavigationPaths: TestedNavigationRecord[];
  testedViewports: string[];
  discoveredIssues: SanitizedIssueSummary[];
  confirmedIssues: AIQAIssueAssessment[];
  suspectedIssues: AIQAIssueAssessment[];
  failedJourneys: SanitizedJourneySummary[];
  successfulJourneys: SanitizedJourneySummary[];
  hypotheses: Map<string, HypothesisRecord>;
  rejectedPlans: Array<{ iteration: number; planId: string; rejections: ActionRejectionReason[] }>;
  uncoveredAreas: UncoveredAreas;
  highRiskAreas: HighRiskArea[];
  blockedAreas: BlockedArea[];
  recentObservations: SanitizedObservationSummary[];
  coverageSummary: CoverageSummary;
  remainingBudget: AIQABudget;
  terminationReason?: AIQAStopReason;
}
