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
  authorization?: number;
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

// ==============================================================================
// Prompt 62: Deployment-Aware Regression Intelligence & Release Impact Models
// ==============================================================================

export type DeploymentLifecycleStatus =
  | 'RECEIVED'
  | 'VALIDATING'
  | 'DEPLOYING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type DeploymentSource =
  | 'VERCEL'
  | 'RAILWAY'
  | 'GITHUB'
  | 'CI'
  | 'MANUAL'
  | 'INTERNAL'
  | 'UNKNOWN';

export interface DeploymentEvidenceReference {
  kind: string;
  source: string;
  ref: string;
  description?: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface DeploymentSnapshot {
  deploymentId: string | null;
  projectId: string | null;
  organizationId: string | null;

  environmentId: string | null;
  environmentName: string | null;
  environmentType: EnvironmentType | null;

  deploymentStatus: DeploymentLifecycleStatus | null;
  deploymentUrl: string | null;

  commitSha: string | null;
  branch: string | null;

  previousDeploymentId: string | null;
  previousCommitSha: string | null;

  releaseId: string | null;
  releaseVersion: string | null;

  provider: string | null;

  startedAt: string | null;
  completedAt: string | null;

  source: DeploymentSource;
  confidence: number;
  evidence: DeploymentEvidenceReference[];
  metadata?: Record<string, any>;
}

export type CorrelationMethod =
  | 'explicit_deployment_release_link'
  | 'commit_match'
  | 'branch_match'
  | 'ci_workflow'
  | 'unresolved';

export type CorrelationStatus =
  | 'EXPLICIT'
  | 'COMMIT_MATCH'
  | 'BRANCH_MATCH'
  | 'AMBIGUOUS'
  | 'NOT_FOUND';

export interface DeploymentReleaseCorrelation {
  deploymentId: string | null;
  releaseId: string | null;
  releaseVersion: string | null;
  correlationMethod: CorrelationMethod;
  status: CorrelationStatus;
  confidence: number;
  evidence: DeploymentEvidenceReference[];
  timestamp: string;
  explanation: string;
}

export type ReleaseImpactStatus =
  | 'LOW_IMPACT'
  | 'MATERIAL_IMPACT'
  | 'HIGH_IMPACT'
  | 'INCONCLUSIVE';

export interface ReleaseImpact {
  releaseId: string | null;
  deploymentId: string | null;
  environmentId: string | null;

  changedAreaCount: number;
  affectedWorkflowCount: number;
  criticalWorkflowCount: number;

  newRegressionCount: number;
  recoveredCount: number;
  persistentFailureCount: number;
  unresolvedIssueCount: number;

  securityImpact: boolean | null;
  authenticationImpact: boolean | null;
  performanceImpact: boolean | null;
  accessibilityImpact: boolean | null;
  visualImpact: boolean | null;
  apiImpact: boolean | null;

  confidence: number;
  status: ReleaseImpactStatus;
  evidence: DeploymentEvidenceReference[];
  unknownFields: string[];
  calculatedAt: string;
}

export interface DeploymentChangeComparison {
  deploymentId: string | null;
  previousDeploymentId: string | null;
  currentCommitSha: string | null;
  previousCommitSha: string | null;
  status: 'ANALYZED' | 'INCONCLUSIVE' | 'IDENTICAL_COMMITS';
  reason: string;
  changedFilesCount: number;
  classifications: string[];
  affectedRoutes: string[];
  affectedApis: string[];
  affectedWorkflows: string[];
  criticalWorkflows: string[];
  confidence: number;
  evidence: DeploymentEvidenceReference[];
}

// ==============================================================================
// Prompt 63: Continuous Deployment QA Automation & Release Gate Enforcement Types
// ==============================================================================

export type DeploymentProcessingStatus =
  | 'RECEIVED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYABLE';

export interface DeploymentEvent {
  eventId: string;
  projectId: string | null;
  orgId: string | null;
  provider: string;
  providerEventId: string | null;
  deploymentId: string | null;
  environmentId: string | null;
  environmentName: string | null;
  environmentType: EnvironmentType | null;
  deploymentStatus: DeploymentLifecycleStatus;
  processingStatus?: DeploymentProcessingStatus;
  campaignId?: string | null;
  gateDecisionId?: string | null;
  commitSha: string | null;
  branch: string | null;
  repository: string | null;
  deploymentUrl: string | null;
  releaseId: string | null;
  occurredAt: string | null;
  receivedAt: string;
  source: DeploymentSource;
  confidence: number;
  rawMetadataReference?: Record<string, any>;
}

export type QATriggerType =
  | 'DEPLOYMENT_READY'
  | 'RELEASE_CREATED'
  | 'PR_MERGED'
  | 'PRODUCTION_DEPLOYMENT'
  | 'STAGING_DEPLOYMENT'
  | 'MANUAL'
  | 'SCHEDULED';

export type QATriggerStatus =
  | 'ELIGIBLE'
  | 'DEFERRED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'INELIGIBLE';

export interface QATriggerEligibility {
  eligible: boolean;
  status: QATriggerStatus;
  reasons: string[];
  missingFields: string[];
  evaluatedAt: string;
}

export interface QATriggerPolicy {
  id?: string;
  projectId: string;
  organizationId?: string | null;
  enabled: boolean;
  autoTriggerOnReady: boolean;
  targetEnvironments: string[];
  requireCommitSha: boolean;
  requireEnvironment: boolean;
  requireDeploymentId: boolean;
  allowedBranches?: string[];
  criticalOnlyOnDeploying?: boolean;
}

export type CampaignTriggerDecisionType =
  | 'RUN_FULL'
  | 'RUN_TARGETED'
  | 'RUN_CRITICAL_ONLY'
  | 'DEFER'
  | 'REVIEW'
  | 'DO_NOT_RUN';

export interface CampaignTriggerDecision {
  id: string;
  decision: CampaignTriggerDecisionType;
  campaignType: string;
  projectId: string;
  deploymentId: string | null;
  environmentId: string | null;
  selectedTargets: string[];
  skippedTargets: string[];
  deferredTargets: string[];
  reviewTargets: string[];
  reasons: string[];
  evidence: DeploymentEvidenceReference[];
  confidence: number;
  evaluatedAt: string;
}

export type ReleaseGateDimension =
  | 'FUNCTIONAL'
  | 'VISUAL'
  | 'RESPONSIVE'
  | 'SECURITY'
  | 'AUTHORIZATION'
  | 'API'
  | 'PERFORMANCE'
  | 'ACCESSIBILITY'
  | 'CRITICAL_WORKFLOW'
  | 'REGRESSION'
  | 'RELEASE_READINESS'
  | 'EVIDENCE_CONFIDENCE';

export type ReleaseGateSeverityHandling = 'BLOCK' | 'WARN' | 'IGNORE';

export type ReleaseGateDecisionType =
  | 'PASS'
  | 'BLOCK'
  | 'REVIEW'
  | 'INSUFFICIENT_EVIDENCE';

export interface ReleaseGateRule {
  dimension: ReleaseGateDimension;
  enabled: boolean;
  minScore?: number;
  maxRegressions?: number;
  maxCriticalIssues?: number;
  severityHandling: ReleaseGateSeverityHandling;
  environmentScope?: string[];
  workflowScope?: string[];
  requiredEvidence?: string[];
  requiresApproval?: boolean;
}

export interface ReleaseGatePolicy {
  id: string;
  projectId: string;
  organizationId?: string | null;
  name: string;
  version: string;
  isDefault: boolean;
  rules: ReleaseGateRule[];
  requireHumanApprovalOnReview: boolean;
  requireHumanApprovalOnWarn: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReleaseGateBlocker {
  dimension: ReleaseGateDimension;
  reason: string;
  severity: 'CRITICAL' | 'BLOCKER' | 'HIGH';
  evidenceRef?: string;
  metricValue?: number;
  threshold?: number;
}

export interface ReleaseGateWarning {
  dimension: ReleaseGateDimension;
  reason: string;
  evidenceRef?: string;
  metricValue?: number;
  threshold?: number;
}

export type DimensionEvaluationStatus =
  | 'MEASURED'
  | 'UNMEASURED'
  | 'FAILED'
  | 'PASSED'
  | 'NOT_APPLICABLE';

export interface DimensionEvaluation {
  dimension: ReleaseGateDimension;
  status: DimensionEvaluationStatus;
  score?: number | null;
  threshold?: number | null;
  violations?: string[];
  evidenceRef?: string | null;
}

export interface ReleaseGateDecision {
  id: string;
  releaseId: string | null;
  deploymentId: string | null;
  projectId: string;
  organizationId?: string | null;
  environmentId: string | null;
  policyId: string;
  policyVersion: string;
  decision: ReleaseGateDecisionType;
  blockers: ReleaseGateBlocker[];
  warnings: ReleaseGateWarning[];
  dimensionEvaluations?: Record<string, DimensionEvaluation>;
  missingEvidenceDimensions?: ReleaseGateDimension[];
  evidence: DeploymentEvidenceReference[];
  confidence: number;
  evaluatedAt: string;
  evaluatedBy: string;
  source: string;
}

export type ReleaseGateApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ReleaseGateApproval {
  id: string;
  decisionId: string;
  releaseId: string | null;
  deploymentId: string | null;
  projectId: string;
  organizationId: string | null;
  status: ReleaseGateApprovalStatus;
  requesterId: string;
  approverId: string | null;
  reason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  expiresAt: string;
}

export interface ReleaseGateOverride {
  id: string;
  decisionId: string;
  releaseId: string | null;
  deploymentId: string | null;
  projectId: string;
  organizationId: string | null;
  actorId: string;
  originalDecision: ReleaseGateDecisionType;
  overrideDecision: ReleaseGateDecisionType;
  reason: string;
  timestamp: string;
  policyVersion: string;
}

