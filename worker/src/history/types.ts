// ==============================================================================
// Sculra Cross-Run QA Intelligence & Historical QA Memory Models
// (worker/src/history/types.ts)
// ==============================================================================

import { BugSeverity } from '../issues/types';

export type HistoricalSignalType =
  | 'NEW_REGRESSION'
  | 'RECOVERED_DEFECT'
  | 'RECURRING_DEFECT'
  | 'STABLE_PASS'
  | 'STABLE_FAILURE'
  | 'INTERMITTENT_TARGET'
  | 'RELEASE_SCORE_DEGRADED'
  | 'RELEASE_SCORE_IMPROVED'
  | 'UNTESTED_CRITICAL_WORKFLOW'
  | 'PERFORMANCE_REGRESSION'
  | 'ACCESSIBILITY_REGRESSION'
  | 'SECURITY_REGRESSION'
  | 'API_REGRESSION'
  | 'VISUAL_REGRESSION';

export type StabilityState =
  | 'STABLE_PASS'
  | 'STABLE_FAILURE'
  | 'RECOVERED'
  | 'RECURRING'
  | 'INTERMITTENT'
  | 'INSUFFICIENT_HISTORY';

export type TrendDirection =
  | 'IMPROVING'
  | 'DEGRADING'
  | 'STABLE'
  | 'VOLATILE'
  | 'INSUFFICIENT_DATA';

export type FindingHistoricalStatus =
  | 'CURRENT'
  | 'HISTORICAL'
  | 'RECOVERED'
  | 'NOT_RETESTED'
  | 'RECURRING'
  | 'INTERMITTENT'
  | 'INCONCLUSIVE';

export interface HistoricalRun {
  testRunId: string;
  projectId: string;
  organizationId?: string | null;
  status: 'passed' | 'failed' | 'running' | 'queued' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  environment: string;
  branch?: string | null;
  commitRef?: string | null;
  targetUrl: string;
  overallScore?: number; // Real measured score or undefined (never fake)
  functionalityScore?: number;
  uiScore?: number;
  responsiveScore?: number;
  reliabilityScore?: number;
  coverageScore?: number;
  securityScore?: number;
  performanceScore?: number;
  accessibilityScore?: number;
  releaseRecommendation?: 'RELEASE' | 'RELEASE_WITH_CAUTION' | 'DO_NOT_RELEASE' | 'INSUFFICIENT_EVIDENCE';
  riskLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  blockersCount?: number;
  evidenceCount?: number;
  issueCount?: number;
  viewport?: string | { width: number; height: number };
  role?: string;
  findings?: HistoricalFinding[];
  targets?: HistoricalTarget[];
  coverage?: HistoricalCoverage;
  metrics?: Record<string, number>;
}

export interface HistoricalTarget {
  targetType: string;
  targetIdentifier: string;
  url?: string;
  selector?: string;
  tested: boolean;
  status: 'passed' | 'failed' | 'untested';
}

export interface HistoricalCoverage {
  pagesDiscovered: number;
  pagesTested: number;
  formsDiscovered: number;
  formsTested: number;
  buttonsDiscovered: number;
  buttonsTested: number;
  linksDiscovered: number;
  linksTested: number;
  apiEndpointsDiscovered?: number;
  apiEndpointsTested?: number;
  securityChecksCount?: number;
  performanceAuditsCount?: number;
  accessibilityChecksCount?: number;
  pages?: { ratio: number };
  forms?: { ratio: number };
  buttons?: { ratio: number };
  links?: { ratio: number };
  viewports?: { ratio: number };
}

export interface ComparableRun {
  run: HistoricalRun;
  compatibilityScore: number; // 0 - 100
  isCompatible: boolean;
  reasons: string[];
  incompatibilityReasons: string[];
}

export interface HistoricalFinding {
  id?: string;
  fingerprint: string;
  title: string;
  type: string;
  severity: BugSeverity;
  category: string;
  targetUrl: string;
  selector?: string;
  action?: string;
  errorSignature?: string;
  method?: string;
  role?: string;
  viewport?: string;
  firstSeenRunId?: string;
  lastSeenRunId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  consecutiveRunCount: number;
  historicalStatus: FindingHistoricalStatus;
  metadata?: Record<string, any>;
}

export interface RegressionEvent {
  id: string;
  fingerprint: string;
  findingType: string;
  title: string;
  severity: BugSeverity;
  category: 'functional' | 'visual' | 'responsive' | 'reliability' | 'security' | 'api' | 'performance' | 'accessibility';
  targetUrl: string;
  selector?: string;
  method?: string;
  role?: string;
  viewport?: string;
  workflowId?: string;
  workflowName?: string;
  businessCriticality?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  previousRunState: 'PASSED' | 'NOT_PRESENT';
  currentRunState: 'FAILED';
  detectedAt: string;
  evidenceRef?: string;
  previousValue?: string | number;
  observedValue?: string | number;
  thresholdValue?: string | number;
}

export interface RecoveryEvent {
  id: string;
  fingerprint: string;
  findingType: string;
  title: string;
  severity: BugSeverity;
  category: string;
  targetUrl: string;
  selector?: string;
  method?: string;
  role?: string;
  viewport?: string;
  workflowId?: string;
  previousRunState: 'FAILED';
  currentRunState: 'PASSED_RETESTED';
  reason: string;
  retestedEvidenceRef?: string;
  recoveredAt: string;
  consecutiveCleanRunsCount: number;
}

export interface RecurrenceEvent {
  id: string;
  fingerprint: string;
  findingType: string;
  title: string;
  severity: BugSeverity;
  category: string;
  targetUrl: string;
  selector?: string;
  occurrenceCount: number;
  consecutiveRunCount: number;
  totalCompatibleRuns: number;
  recurrenceRate: number; // 0.0 - 1.0
  firstSeenAt: string;
  lastSeenAt: string;
  stabilityState: 'RECURRING' | 'STABLE_FAILURE' | 'INTERMITTENT';
  environments: string[];
  viewports: string[];
  roles: string[];
}

export interface StabilitySignal {
  targetId: string;
  targetType: string;
  targetIdentifier: string;
  stability: StabilityState;
  passCount: number;
  failCount: number;
  totalEvaluations: number;
  flakeRate: number; // 0.0 - 1.0
  consecutivePassCount: number;
  consecutiveFailCount: number;
  lastOutcome: 'PASS' | 'FAIL' | 'UNTESTED';
  description: string;
  reasons: string[];
}

export interface CoverageTrend {
  dimension: 'pages' | 'forms' | 'buttons' | 'links' | 'viewports' | 'apis' | 'security' | 'accessibility';
  previousRatio?: number;
  currentRatio?: number;
  delta?: number;
  trendState: 'IMPROVING' | 'DEGRADING' | 'STABLE' | 'INSUFFICIENT_DATA';
}

export interface HistoricalMetricDelta {
  category: 'performance' | 'reliability' | 'security' | 'accessibility' | 'api' | 'release';
  metricName: string;
  previousValue?: number;
  currentValue?: number;
  unit?: string;
  delta?: number;
  percentChange?: number;
  direction: 'BETTER' | 'WORSE' | 'NEUTRAL' | 'NO_COMPARISON';
  isRegression: boolean;
  threshold?: number;
}

export interface HistoricalSummary {
  currentRunId: string;
  previousRunId?: string;
  isComparable: boolean;
  comparisonStatus: 'COMPARABLE' | 'BASELINE_MISSING' | 'NO_COMPARABLE_RUN' | 'INSUFFICIENT_DATA';
  scoreDelta?: number;
  releaseTrend: TrendDirection;
  newRegressionsCount: number;
  recoveredFindingsCount: number;
  recurringFindingsCount: number;
  notRetestedCount: number;
  unstableTargetsCount: number;
  totalTestedTargetsCount: number;
  narrativeSummary?: string;
}

export interface RunComparison {
  isComparable?: boolean;
  currentRun: HistoricalRun;
  previousComparableRun?: HistoricalRun;
  compatibleHistoryCount: number;
  summary: HistoricalSummary;
  regressions: RegressionEvent[];
  recoveries: RecoveryEvent[];
  recurrences: RecurrenceEvent[];
  notRetestedFindings: HistoricalFinding[];
  stabilitySignals: StabilitySignal[];
  coverageTrends: CoverageTrend[];
  metricDeltas: HistoricalMetricDelta[];
  generatedSignals: QASignalRecord[];
  aiInterpretation?: AIHistoricalSummary;
  durationMs: number;
}

export interface QASignalRecord {
  id?: string;
  projectId: string;
  organizationId?: string | null;
  testRunId: string;
  signalType: HistoricalSignalType;
  targetType: string;
  targetIdentifier: string;
  fingerprint?: string;
  severity: BugSeverity;
  confidence: 'high' | 'medium' | 'low';
  occurrenceCount: number;
  consecutiveCount: number;
  environment: string;
  viewport?: string;
  role?: string;
  metadata: Record<string, any>;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AIHistoricalSummary {
  executiveSummary: string;
  whatChanged: string[];
  whatDegraded: string[];
  whatImproved: string[];
  recurringConcerns: string[];
  recommendedNextActions: string[];
  confidence: 'high' | 'medium' | 'low';
}

export type { HistoricalPolicyConfig } from './policy';
