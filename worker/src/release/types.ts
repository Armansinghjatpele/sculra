// ==============================================================================
// Sculra AI Release Readiness & QA Intelligence Models (worker/src/release/types.ts)
// ==============================================================================

export const RELEASE_SCORING_VERSION = '1.0';

export type EvidenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export type ReleaseRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type ReleaseRecommendation =
  | 'RELEASE'
  | 'RELEASE_WITH_CAUTION'
  | 'DO_NOT_RELEASE'
  | 'INSUFFICIENT_EVIDENCE';

export interface ReleaseBlocker {
  id: string;
  title: string;
  reason: string;
  category: 'functional' | 'visual' | 'responsive' | 'reliability' | 'security' | 'api' | 'performance' | 'accessibility';
  severity: 'critical' | 'high';
  evidenceSummary: string;
  relatedIssueFingerprints?: string[];
}

export interface CategoryScores {
  overall: number;
  functional: number;
  visual: number;
  responsive: number;
  reliability: number;
  coverage: number;
  security?: number;
  api?: number;
  performance?: number;
  accessibility?: number;
}

export interface ScoreDeduction {
  category: 'functional' | 'visual' | 'responsive' | 'reliability' | 'coverage' | 'security' | 'api' | 'performance' | 'accessibility';
  points: number;
  reason: string;
  evidenceRef?: string;
}

export interface HistoricalScoreComparison {
  previousScore?: number;
  currentScore: number;
  change?: number;
  previousTestRunId?: string;
  previousCreatedAt?: string;
}

export interface ScoreBreakdown {
  categoryWeights: {
    functional: number;
    visual: number;
    responsive: number;
    reliability: number;
    coverage: number;
    security?: number;
    api?: number;
    performance?: number;
    accessibility?: number;
  };
  functional: {
    base: number;
    final: number;
    deductions: ScoreDeduction[];
    confirmedIssuesCount: number;
    suspectedIssuesCount: number;
    failedJourneysCount: number;
  };
  visual: {
    base: number;
    final: number;
    deductions: ScoreDeduction[];
    regressionsCount: number;
    missingBaselinesCount: number;
  };
  responsive: {
    base: number;
    final: number;
    deductions: ScoreDeduction[];
    viewportsTested: number;
    overflowCount: number;
    clippingCount: number;
    overlapCount: number;
  };
  reliability: {
    base: number;
    final: number;
    deductions: ScoreDeduction[];
    consoleErrorsCount: number;
    networkErrorsCount: number;
    actionFailureRate: number;
  };
  coverage: {
    final: number;
    pages: { discovered: number; visited: number; ratio: number };
    forms: { discovered: number; exercised: number; ratio: number };
    buttons: { discovered: number; exercised: number; ratio: number };
    links: { discovered: number; exercised: number; ratio: number };
    viewports: { tested: number; total: number; ratio: number };
  };
  security?: {
    base: number;
    final: number;
    deductions: ScoreDeduction[];
    criticalFindingsCount: number;
    highFindingsCount: number;
    mediumFindingsCount: number;
    authViolationsCount: number;
    secretExposuresCount: number;
  };
  performance?: {
    base: number;
    final: number;
    deductions: ScoreDeduction[];
    slowPagesCount: number;
    slowApisCount: number;
    regressionsCount: number;
    reliabilityFailuresCount: number;
  };
  accessibility?: {
    base: number;
    final: number;
    deductions: ScoreDeduction[];
    criticalFindingsCount: number;
    highFindingsCount: number;
    mediumFindingsCount: number;
    keyboardTrapsCount: number;
    contrastFailuresCount: number;
  };
  historicalComparison?: HistoricalScoreComparison;
}

export interface AIReleaseAnalysis {
  summary: string;
  keyRisks: string[];
  strengths: string[];
  evidenceGaps: string[];
  recommendedActions: string[];
  releaseExplanation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ReleaseAssessment {
  testRunId: string;
  projectId: string;
  organizationId?: string;
  scoringVersion: string;
  overallScore: number;
  scores: CategoryScores;
  recommendation: ReleaseRecommendation;
  riskLevel: ReleaseRiskLevel;
  confidenceLevel: EvidenceConfidence;
  blockers: ReleaseBlocker[];
  breakdown: ScoreBreakdown;
  aiAnalysis?: AIReleaseAnalysis;
  evaluatedAt: string;
}

// ==============================================================================
// Prompt 38: Release Orchestration, Environment Management & Deployment-Aware QA
// ==============================================================================

export type EnvironmentType = 'DEVELOPMENT' | 'STAGING' | 'PREVIEW' | 'PRODUCTION' | 'CUSTOM';

export type EnvironmentStatus = 'ACTIVE' | 'INACTIVE' | 'UNREACHABLE' | 'MISCONFIGURED' | 'AUTH_REQUIRED';

export type EnvironmentHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE' | 'AUTH_REQUIRED' | 'MISCONFIGURED' | 'UNKNOWN';

export interface ProjectEnvironment {
  id: string;
  organizationId?: string | null;
  projectId: string;
  sourceId?: string | null;
  name: string;
  slug: string;
  type: EnvironmentType;
  baseUrl: string;
  branch?: string | null;
  commitSha?: string | null;
  status: EnvironmentStatus;
  isProduction: boolean;
  healthStatus: EnvironmentHealthStatus;
  lastHealthCheckAt?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type DeploymentStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';

export type DeploymentTrigger = 'GITHUB_PUSH' | 'GITHUB_PR' | 'MANUAL' | 'WEBHOOK' | 'API' | 'UNKNOWN';

export interface DeploymentRecord {
  id: string;
  organizationId?: string | null;
  projectId: string;
  environmentId: string;
  sourceId?: string | null;
  commitSha: string;
  branch?: string | null;
  deploymentUrl?: string | null;
  provider: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  idempotencyKey?: string | null;
  metadata?: Record<string, any>;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export type ReleaseStatus = 'DRAFT' | 'CANDIDATE' | 'TESTING' | 'READY' | 'BLOCKED' | 'RELEASED' | 'ABANDONED';

export interface ReleaseRecord {
  id: string;
  organizationId?: string | null;
  projectId: string;
  environmentId: string;
  deploymentId?: string | null;
  sourceId?: string | null;
  version: string;
  commitSha: string;
  branch?: string | null;
  status: ReleaseStatus;
  previousReleaseId?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type ReleasePolicyLevel = 'PERMISSIVE' | 'STANDARD' | 'STRICT' | 'SMOKE_ONLY' | 'FULL' | 'CUSTOM';

export type ReleaseGateKey =
  | 'CRITICAL_ISSUES'
  | 'REGRESSIONS'
  | 'SECURITY'
  | 'ACCESSIBILITY'
  | 'PERFORMANCE'
  | 'VISUAL'
  | 'API'
  | 'FUNCTIONAL'
  | 'RELIABILITY'
  | 'EVIDENCE_COMPLETENESS';

export type ReleaseGateStatus = 'PASS' | 'FAIL' | 'WARN' | 'NOT_MEASURED' | 'INSUFFICIENT_EVIDENCE';

export interface ReleaseGateEvaluation {
  gate: ReleaseGateKey;
  status: ReleaseGateStatus;
  reason: string;
  evidenceRefs: string[];
  metricValue?: number | string;
}

export type ReleaseCheckStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INSUFFICIENT_EVIDENCE';

export interface ReleaseCheckRecord {
  id: string;
  organizationId?: string | null;
  projectId: string;
  releaseId: string;
  campaignId?: string | null;
  policyLevel: ReleasePolicyLevel;
  status: ReleaseCheckStatus;
  overallScore?: number | null;
  releaseDecision?: ReleaseRecommendation | null;
  gates: ReleaseGateEvaluation[];
  evidenceSummary: Record<string, any>;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export type ReleaseDecisionAction = 'APPROVE' | 'BLOCK' | 'REQUEST_RETEST';

export interface ReleaseDecisionRecord {
  id: string;
  organizationId?: string | null;
  projectId: string;
  releaseId: string;
  decision: ReleaseDecisionAction;
  decidedBy: string;
  decidedByRole: string;
  notes?: string | null;
  decidedAt: string;
  createdAt: string;
}

export type RegressionClassification =
  | 'NEW_REGRESSION'
  | 'RECOVERED'
  | 'RECURRING'
  | 'STABLE'
  | 'NOT_RETESTED'
  | 'INSUFFICIENT_HISTORY';

export interface ReleaseIssueCorrelation {
  issueId: string;
  title: string;
  severity: string;
  classification: RegressionClassification;
  firstObservedCommit?: string;
  confirmedInDeploymentId?: string;
  causedByCommit?: boolean;
  explanation: string;
}

