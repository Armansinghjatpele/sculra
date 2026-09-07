// ==============================================================================
// Sculra User Journey Type Definitions (worker/src/journeys/types.ts)
// ==============================================================================

import {
  ViewportConfig,
  CapturedConsoleError,
  CapturedNetworkError,
  CapturedScreenshot,
  ApplicationMap,
} from '../types';

export type JourneyActionType =
  | 'NAVIGATE'
  | 'CLICK'
  | 'FILL'
  | 'SELECT'
  | 'CHECK'
  | 'UNCHECK'
  | 'PRESS'
  | 'WAIT_FOR_NAVIGATION'
  | 'ASSERT_VISIBLE'
  | 'ASSERT_URL'
  | 'ASSERT_TITLE'
  | 'VALIDATE_FORM';

export type StepResultStatus =
  | 'PASSED'
  | 'FAILED'
  | 'SKIPPED'
  | 'BLOCKED'
  | 'TIMEOUT'
  | 'NO_OP';

export type ObservationType =
  | 'NAVIGATION_FAILURE'
  | 'CONSOLE_ERROR'
  | 'NETWORK_FAILURE'
  | 'CLICK_TIMEOUT'
  | 'CLICK_NO_OP'
  | 'FORM_VALIDATION_FAILURE'
  | 'UNEXPECTED_NAVIGATION'
  | 'ELEMENT_NOT_INTERACTABLE'
  | 'PAGE_LOAD_FAILURE'
  | 'SKIPPED_DANGEROUS_ACTION'
  | 'SKIPPED_SENSITIVE_FIELD'
  | 'SKIPPED_EXTERNAL_ORIGIN';

export interface JourneyStep {
  id: string;
  pageUrl: string;
  action: JourneyActionType;
  targetDescription: string;
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

export interface JourneyObservation {
  type: ObservationType;
  message: string;
  severity: 'info' | 'warning' | 'error';
  pageUrl: string;
  selector?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface JourneyStepExecution {
  stepId: string;
  action: JourneyActionType;
  targetDescription: string;
  selector?: string;
  status: StepResultStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  beforeUrl: string;
  afterUrl: string;
  value?: string;
  error?: string;
  screenshot?: CapturedScreenshot;
  screenshotStoragePath?: string;
  screenshotPublicUrl?: string;
  consoleErrors: CapturedConsoleError[];
  networkErrors: CapturedNetworkError[];
  observations: JourneyObservation[];
}

export interface Journey {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'interaction' | 'form' | 'responsive';
  startUrl: string;
  steps: JourneyStep[];
  maxSteps?: number;
  timeoutMs?: number;
  viewport?: ViewportConfig;
}

export interface JourneyResult {
  journeyId: string;
  name: string;
  category: string;
  status: 'PASSED' | 'FAILED' | 'PARTIAL' | 'CANCELLED';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  viewport: ViewportConfig;
  steps: JourneyStepExecution[];
  observations: JourneyObservation[];
  pagesVisited: string[];
  actionsAttempted: number;
  actionsPassed: number;
  actionsFailed: number;
  actionsSkipped: number;
}

export interface JourneyLimits {
  maxJourneys: number;
  maxStepsPerJourney: number;
  maxActionsPerPage: number;
  maxNavigationDepth: number;
  maxJourneyTimeMs: number;
  maxActionTimeMs: number;
  maxPageWaitMs: number;
}

export interface IJourneyPlanner {
  plan(applicationMap: ApplicationMap, limits?: Partial<JourneyLimits>): Promise<Journey[]>;
}
