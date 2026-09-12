// ==============================================================================
// Sculra Test Worker Type Definitions (worker/src/types.ts)
// ==============================================================================

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface ViewportConfig {
  width: number;
  height: number;
  name: 'desktop' | 'tablet' | 'mobile';
}

import {
  AuthenticationConfig,
  TestIdentity,
  AuthenticatedSession,
  RoleContext,
  AuthorizationCheckConfig,
  AuthorizationCheckResult,
  RoleComparisonResult,
} from './auth/types';

export interface RunnerOptions {
  browserType?: BrowserType;
  headless?: boolean;
  navigationTimeoutMs?: number;
  runTimeoutMs?: number;
  allowLocalhost?: boolean;
  enableDiscovery?: boolean;
  enableJourneys?: boolean;
  enableVisual?: boolean;
  enableAiQa?: boolean;
  aiQaConfig?: AIQAConfig;
  authConfig?: AuthenticationConfig;
  testIdentities?: TestIdentity[];
  authorizationChecks?: AuthorizationCheckConfig[];
  enableApiQa?: boolean;
  apiConfig?: import('./api-qa/types').ApiProjectConfig;
  apiLimits?: Partial<import('./api-qa/types').ApiExecutionLimits>;
  enableSecurityQa?: boolean;
  securityPolicy?: Partial<import('./security/types').SecurityPolicyConfig>;
  enablePerformanceQa?: boolean;
  performancePolicy?: Partial<import('./performance/types').PerformancePolicyConfig>;
  enableAccessibilityQa?: boolean;
  accessibilityPolicy?: Partial<import('./accessibility/types').AccessibilityPolicyConfig>;
  enableHistoricalAnalysis?: boolean;
  historicalPolicy?: Partial<import('./history/types').HistoricalPolicyConfig>;
  historicalRuns?: import('./history/types').HistoricalRun[];
  viewport?: {
    width: number;
    height: number;
  };
  discoveryLimits?: Partial<DiscoveryLimits>;
}

export interface CapturedConsoleError {
  message: string;
  url?: string;
  timestamp: string;
  location?: string;
}

export interface CapturedNetworkError {
  url: string;
  method: string;
  status?: number;
  resourceType?: string;
  errorText?: string;
  timestamp: string;
}

export interface CapturedScreenshot {
  title: string;
  buffer: Buffer;
  mimeType: string;
  storagePath?: string;
  timestamp: string;
  viewportName?: 'desktop' | 'tablet' | 'mobile';
}

export interface DiscoveredElement {
  type: 'button' | 'link' | 'input' | 'select' | 'checkbox' | 'radio' | 'navigation' | 'interactive';
  role?: string;
  accessibleName?: string;
  text?: string;
  tagName: string;
  href?: string;
  selector: string;
  sourcePage: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes?: Record<string, string>;
}

export interface DiscoveredFormField {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  selector: string;
}

export interface DiscoveredForm {
  id?: string;
  action?: string;
  method: string;
  fields: DiscoveredFormField[];
  submitSelector?: string;
  submitText?: string;
  sourcePage: string;
}

export interface DiscoveredLink {
  text: string;
  href: string;
  isInternal: boolean;
  sourcePage: string;
}

export interface DiscoveredPage {
  url: string;
  title: string;
  depth: number;
  sourceUrl?: string;
  screenshot?: CapturedScreenshot;
  elementsCount: number;
  elements: DiscoveredElement[];
  forms: DiscoveredForm[];
  links: DiscoveredLink[];
  consoleErrors: CapturedConsoleError[];
  networkErrors: CapturedNetworkError[];
  timestamp: string;
}

export interface ViewportCapture {
  viewport: ViewportConfig;
  pageUrl: string;
  title: string;
  screenshot?: CapturedScreenshot;
  layoutMetadata: {
    bodyWidth: number;
    bodyHeight: number;
    scrollWidth: number;
    scrollHeight: number;
  };
}

export interface ApplicationMap {
  startUrl: string;
  discoveredAt: string;
  totalPages: number;
  totalLinks: number;
  totalButtons: number;
  totalForms: number;
  totalInputs: number;
  pages: DiscoveredPage[];
  responsiveCaptures?: ViewportCapture[];
}

export interface DiscoveryLimits {
  maxPages: number;
  maxDepth: number;
  maxLinksPerPage: number;
  maxInteractionsPerPage: number;
  maxTotalDiscoveryTimeMs: number;
  viewports?: ViewportConfig[];
}

import { ResponsiveExecutionResult } from './visual/types';
import { AIQAPlan, AIQAResult, AIQAConfig } from './ai-qa/types';

export interface TestExecutionResult {
  status: 'passed' | 'failed' | 'cancelled';
  pageTitle?: string;
  finalUrl?: string;
  statusCode?: number;
  durationMs: number;
  consoleErrors: CapturedConsoleError[];
  networkErrors: CapturedNetworkError[];
  screenshots: CapturedScreenshot[];
  applicationMap?: ApplicationMap;
  journeyResults?: any[];
  bugObservations?: any[];
  visualResult?: ResponsiveExecutionResult;
  aiQaPlans?: AIQAPlan[];
  aiQaResults?: AIQAResult[];
  aiQaStateSummary?: import('./ai-qa/state').AIQAStateSummary;
  strategyDecisions?: import('./strategy/types').StrategyDecision[];
  strategyTargets?: import('./strategy/types').TestTarget[];
  productModel?: import('./product/types').ProductModel;
  productCoverage?: import('./product/types').CoverageAgainstProductModel;
  authenticatedSessions?: AuthenticatedSession[];
  roleContexts?: RoleContext[];
  authorizationResults?: AuthorizationCheckResult[];
  roleComparisons?: RoleComparisonResult[];
  apiEndpoints?: import('./api-qa/types').ApiEndpoint[];
  apiTestResults?: import('./api-qa/types').ApiTestResult[];
  apiObservations?: import('./api-qa/types').ApiResponseObservation[];
  apiCoverage?: import('./api-qa/types').ApiCoverageSummary;
  securityResult?: import('./security/types').SecurityScanResult;
  securityFindings?: import('./security/types').SecurityFinding[];
  securityCoverage?: import('./security/types').SecurityCoverageSummary;
  performanceResult?: import('./performance/types').PerformanceScanResult;
  performanceFindings?: import('./performance/types').PerformanceFinding[];
  performanceCoverage?: import('./performance/types').PerformanceCoverageSummary;
  accessibilityResult?: import('./accessibility/types').AccessibilityScanResult;
  accessibilityFindings?: import('./accessibility/types').AccessibilityFinding[];
  accessibilityCoverage?: import('./accessibility/types').AccessibilityCoverageSummary;
  historicalComparison?: import('./history/types').RunComparison;
  historicalSignals?: import('./history/types').QASignalRecord[];
  failureReason?: string;
}

export interface CancellationToken {
  isCancelled: boolean;
  onCancel?: () => void;
}

