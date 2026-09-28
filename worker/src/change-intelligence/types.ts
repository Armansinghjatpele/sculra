// ==============================================================================
// Sculra Code Change Intelligence Domain Models (worker/src/change-intelligence/types.ts)
// ==============================================================================

export type ChangeType =
  | 'ADDED'
  | 'MODIFIED'
  | 'DELETED'
  | 'RENAMED'
  | 'COPIED'
  | 'UNKNOWN';

export type ChangeSizeCategory = 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE';

export type ChangeClassification =
  | 'UI'
  | 'ROUTING'
  | 'API'
  | 'DATABASE'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'PAYMENT'
  | 'FORM'
  | 'SEARCH'
  | 'NAVIGATION'
  | 'PERFORMANCE'
  | 'ACCESSIBILITY'
  | 'SECURITY'
  | 'CONFIGURATION'
  | 'DEPENDENCY'
  | 'TEST'
  | 'TEST_ONLY'
  | 'INFRASTRUCTURE'
  | 'DOCUMENTATION'
  | 'UNKNOWN';

export type ImpactConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export type ImpactTargetType =
  | 'ROUTE'
  | 'API'
  | 'FEATURE'
  | 'WORKFLOW'
  | 'ROLE'
  | 'QA_TARGET'
  | 'HISTORICAL_FINDING'
  | 'FILE'
  | 'FUNCTION'
  | 'COMPONENT'
  | 'ENVIRONMENT'
  | 'HISTORICAL_ISSUE'
  | 'PREVIOUS_RUN'
  | 'SYMBOL'
  | 'BRANCH'
  | 'COMMIT'
  | 'DEPLOYMENT';

export type ImpactRelationshipType =
  | 'DIRECT_IMPACT'
  | 'TRANSITIVE_IMPACT'
  | 'HISTORICAL_ASSOCIATION'
  | 'UNKNOWN';

export interface ChangeHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
  header?: string;
}

export interface ChangedFile {
  path: string;
  previousPath?: string;
  status: ChangeType;
  additions: number;
  deletions: number;
  changes: number;
  hunks: ChangeHunk[];
  isBinary: boolean;
  isGeneratedOrMinified: boolean;
  isLockfile: boolean;
  isDocumentation: boolean;
  classifications: ChangeClassification[];
  patch?: string;
}

export interface ChangeSet {
  id: string;
  commitSha: string;
  baseSha?: string;
  branch?: string;
  pullRequestNumber?: number;
  files: ChangedFile[];
  totalAdditions: number;
  totalDeletions: number;
  sizeCategory: ChangeSizeCategory;
  isPartial: boolean;
  partialReason?: string;
  createdAt: string;
}

export interface ImpactNode {
  id: string;
  type: ImpactTargetType | 'FILE' | 'SYMBOL' | 'BRANCH' | 'COMMIT' | 'ENVIRONMENT' | 'DEPLOYMENT';
  name: string;
  metadata?: Record<string, any>;
}

export interface ImpactEdge {
  sourceId: string;
  targetId: string;
  relationship:
    | 'MODIFIES'
    | 'IMPORTS'
    | 'SERVES'
    | 'CALLS'
    | 'PART_OF'
    | 'AFFECTS'
    | 'USED_BY'
    | 'COVERS'
    | 'FAILED_BEFORE'
    | 'CHANGED'
    | 'IMPLEMENTS'
    | 'DEPENDS_ON'
    | 'TESTED_BY'
    | 'RECOVERED_BEFORE'
    | 'BASE_COMMIT'
    | 'HEAD_COMMIT'
    | 'CHANGED_FILE'
    | 'CHANGED_SYMBOL'
    | 'AFFECTED_ROUTE'
    | 'AFFECTED_API'
    | 'AFFECTED_WORKFLOW'
    | 'AFFECTED_QA_TARGET'
    | 'AFFECTED_ENVIRONMENT'
    | 'DEPLOYED_TO'
    | 'DEPLOYED_COMMIT';
  reason: string;
  confidence: ImpactConfidence;
  source: string;
}

export interface ImpactGraph {
  nodes: Record<string, ImpactNode>;
  edges: ImpactEdge[];
  nodeCount: number;
  edgeCount: number;
  isTruncated: boolean;
}

export interface ChangeRiskFactor {
  factor: string;
  scoreAdjustment: number;
  reason: string;
}

export interface ChangeRisk {
  score: number; // 0 - 100
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  factors: ChangeRiskFactor[];
  explanation: string;
}

export type ChangeAnalysisStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'NOT_AVAILABLE';

export interface AffectedWorkflow {
  workflowId: string;
  workflowName: string;
  criticality: string;
  confidence: ImpactConfidence;
  reason: string;
}

export interface AffectedApi {
  path: string;
  method?: string;
  confidence: ImpactConfidence;
  reason: string;
}

export interface AffectedRoute {
  route: string;
  confidence: ImpactConfidence;
  reason: string;
}

export interface RecommendedDomain {
  domain: string;
  priority: number;
  reason: string;
}

export interface StrategyBoost {
  targetId: string;
  boostType:
    | 'CHANGE_DIRECT'
    | 'CHANGE_TRANSITIVE'
    | 'CHANGE_HISTORICAL'
    | 'CHANGE_BUSINESS_CRITICAL'
    | 'CHANGE_SECURITY';
  priorityBonus: number;
  reason: string;
}

export interface ChangeAnalysisResult {
  id: string;
  projectId: string;
  campaignId?: string;
  commitSha: string;
  baseSha?: string;
  branch?: string;
  pullRequestNumber?: number;
  status: ChangeAnalysisStatus;
  changeSet: ChangeSet;
  classifications: ChangeClassification[];
  impactGraph: ImpactGraph;
  risk: ChangeRisk;
  affectedWorkflows: AffectedWorkflow[];
  affectedApis: AffectedApi[];
  affectedRoutes: AffectedRoute[];
  recommendedDomains: RecommendedDomain[];
  strategyBoosts: StrategyBoost[];
  summary?: {
    headline: string;
    markdownSummary: string;
    riskScore: number;
    riskLevel: string;
  };
  isPartial?: boolean;
  analyzedAt: string;
  durationMs: number;
  snapshot?: ChangeSnapshot;
  decisions?: ChangeDecision[];
  regressionCandidates?: RegressionCandidate[];
}

// ==============================================================================
// Canonical Prompt 60 Change-Aware Regression Intelligence Models
// ==============================================================================

export type ChangeSource = 'GIT' | 'PR' | 'MANUAL' | 'CI';

export type EnvironmentType = 'DEVELOPMENT' | 'STAGING' | 'PREVIEW' | 'PRODUCTION' | 'CUSTOM';

export interface EnvironmentSnapshot {
  environmentId: string | null;
  environmentName: string | null;
  environmentType: EnvironmentType | null;
  projectId: string;
  organizationId?: string | null;
  targetUrl: string;
  branch?: string | null;
  commitSha?: string | null;
  deploymentId?: string | null;
  releaseId?: string | null;
  capturedAt: string;
  source: 'PROJECT_ENVIRONMENT' | 'DEPLOYMENT' | 'RELEASE' | 'CAMPAIGN_CONFIG' | 'MANUAL';
  availability: 'ONLINE' | 'DEGRADED' | 'UNREACHABLE' | 'UNKNOWN';
  metadata?: Record<string, any>;
}

export interface ChangeSnapshot {
  id: string;
  commitSha: string;
  baseSha?: string;
  branch?: string;
  pullRequestNumber?: number;
  source: ChangeSource;
  files: ChangedFile[];
  totalAdditions: number;
  totalDeletions: number;
  sizeCategory: ChangeSizeCategory;
  classifications: ChangeClassification[];
  isDocumentationOnly: boolean;
  isTestOnly: boolean;
  isPartial?: boolean;
  partialReason?: string;
  createdAt: string;
  // Prompt 61 Cross-Branch Extensions
  baseBranch?: string;
  headBranch?: string;
  baseCommit?: string;
  headCommit?: string;
  renamedFiles?: Array<{ oldPath: string; newPath: string }>;
  changedSymbols?: string[];
  changedRoutes?: string[];
  changedApis?: string[];
  changedDatabaseAreas?: string[];
  changedAuthAreas?: string[];
  changedConfigurations?: string[];
  changedDependencies?: string[];
  impactGraph?: ImpactGraph;
}

export type RegressionCandidateSource =
  | 'DIRECT_WORKFLOW'
  | 'AFFECTED_API'
  | 'AFFECTED_ROUTE_OR_COMPONENT'
  | 'CRITICAL_WORKFLOW'
  | 'HISTORICAL_FAILURE'
  | 'RECOVERED_REGRESSION'
  | 'FLAKY_OR_RECURRING'
  | 'SECURITY_AUTH_BOUNDARY'
  | 'VISUAL_BASELINE'
  | 'ACCESSIBILITY_SURFACE'
  | 'API_CONTRACT'
  | 'PERFORMANCE_BASELINE'
  | 'ENVIRONMENT_SPECIFIC_FAILURE'
  | 'DEPLOYMENT_REGRESSION_SURFACE';

export interface RegressionCandidate {
  id: string;
  source: RegressionCandidateSource;
  targetId: string;
  targetType: ImpactTargetType;
  targetIdentifier: string;
  url?: string;
  domain: string;
  businessCriticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priority: number;
  reason: string;
  historicalSignalId?: string;
  hasVisualBaseline?: boolean;
  requiresRole?: string;
  metadata?: Record<string, any>;
  // Prompt 61 Environment & Evidence Extensions
  environmentId?: string;
  branch?: string;
  commitSha?: string;
  deploymentId?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  evidenceReferences?: string[];
  recommendedDomains?: string[];
}

export type ChangeDecisionType = 'TEST' | 'SKIP' | 'DEFER' | 'REVIEW';

export type SkipReasonCode =
  | 'DOCS_ONLY'
  | 'UNTOUCHED'
  | 'NO_HISTORICAL_RISK'
  | 'DEFERRED_CAPACITY'
  | 'LOWER_PRIORITY'
  | 'UNSUPPORTED_SURFACE'
  | 'ALREADY_COVERED'
  | 'AUTH_REQUIRED'
  | 'POLICY_BLOCKED'
  | 'DEPLOYMENT_IN_PROGRESS'
  | 'DEPLOYMENT_FAILED';

export interface ChangeDecision {
  id: string;
  candidateId: string;
  targetIdentifier: string;
  targetType: string;
  domain: string;
  decision: ChangeDecisionType;
  priority: number;
  reason: string;
  skipReason?: SkipReasonCode;
  criticalOverride?: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];
  createdAt: string;
  metadata?: Record<string, any>;
  // Prompt 61 / 61A Environment & Safe Test Reuse Extensions
  environmentId?: string | null;
  environmentName?: string | null;
  branch?: string | null;
  deploymentId?: string | null;
  deploymentStatus?: string | null;
  reuseClassification?: 'REUSE' | 'RERUN' | 'DEFER' | 'REVIEW';
  reuseJustification?: string;
  reusedEvidenceRef?: string;
}

export type ChangeRegressionClassification =
  | 'NEW_FAILURE'
  | 'REGRESSION'
  | 'RECOVERED'
  | 'PERSISTING_FAILURE'
  | 'UNCHANGED_PASS'
  | 'UNCHANGED_FAILURE'
  | 'INCONCLUSIVE';

export interface TargetRegressionComparison {
  targetIdentifier: string;
  targetType: string;
  domain: string;
  baselineRunId?: string;
  baselineStatus: 'PASSED' | 'FAILED' | 'UNTESTED' | 'NO_BASELINE';
  currentStatus: 'PASSED' | 'FAILED' | 'ERROR' | 'SKIPPED';
  classification: ChangeRegressionClassification;
  isAffectedByChange: boolean;
  reason: string;
  evidenceRefs?: string[];
  visualBaselineFound?: boolean;
  // Prompt 61 / 61A Cross-Branch & Environment Context
  baseBranch?: string | null;
  headBranch?: string | null;
  baseCommit?: string | null;
  headCommit?: string | null;
  environmentId?: string | null;
  environmentName?: string | null;
  deploymentId?: string | null;
  previousDeploymentId?: string | null;
}

export interface RegressionComparisonResult {
  comparedAt: string;
  baselineRunId?: string;
  currentRunId?: string;
  deploymentId?: string | null;
  previousDeploymentId?: string | null;
  totalCompared: number;
  regressionsCount: number;
  recoveriesCount: number;
  persistingFailuresCount: number;
  newFailuresCount: number;
  unchangedPassCount: number;
  unchangedFailuresCount: number;
  inconclusiveCount: number;
  targets: TargetRegressionComparison[];
}

// ==============================================================================
// Canonical Prompt 61 Multi-Environment & Cross-Branch Regression Models
// ==============================================================================

export type EnvironmentComparisonClassification =
  | 'SAME_BEHAVIOR'
  | 'ENVIRONMENT_SPECIFIC_FAILURE'
  | 'ENVIRONMENT_SPECIFIC_RECOVERY'
  | 'CROSS_ENVIRONMENT_REGRESSION'
  | 'CROSS_ENVIRONMENT_RECOVERY'
  | 'CONFIGURATION_DRIFT'
  | 'DEPLOYMENT_DRIFT'
  | 'VERSION_DRIFT'
  | 'INCONCLUSIVE';

export interface TargetEnvironmentObservation {
  targetIdentifier: string;
  targetType: string;
  domain: string;
  environmentId: string | null;
  environmentName: string | null;
  environmentType: EnvironmentType | null;
  branch?: string | null;
  commitSha?: string | null;
  status: 'PASSED' | 'FAILED' | 'ERROR' | 'SKIPPED' | 'UNTESTED';
  findingsCount: number;
  observationsCount: number;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface TargetEnvironmentComparison {
  targetIdentifier: string;
  targetType: string;
  domain: string;
  baseEnvironment: EnvironmentSnapshot;
  targetEnvironment: EnvironmentSnapshot;
  baseObservation?: TargetEnvironmentObservation;
  targetObservation?: TargetEnvironmentObservation;
  classification: EnvironmentComparisonClassification;
  reason: string;
  evidenceRefs: string[];
  driftDetails?: {
    type: 'CONFIGURATION_DRIFT' | 'DEPLOYMENT_DRIFT' | 'VERSION_DRIFT';
    description: string;
    keysChanged?: string[];
  };
}

export interface EnvironmentComparisonResult {
  comparedAt: string;
  baseEnvironment: EnvironmentSnapshot;
  targetEnvironment: EnvironmentSnapshot;
  totalTargetsCompared: number;
  sameBehaviorCount: number;
  environmentSpecificFailuresCount: number;
  environmentSpecificRecoveriesCount: number;
  crossEnvironmentRegressionsCount: number;
  crossEnvironmentRecoveriesCount: number;
  configurationDriftCount: number;
  deploymentDriftCount: number;
  versionDriftCount: number;
  inconclusiveCount: number;
  driftDetected: boolean;
  driftTypes: Array<'CONFIGURATION_DRIFT' | 'DEPLOYMENT_DRIFT' | 'VERSION_DRIFT'>;
  targets: TargetEnvironmentComparison[];
}

export interface BranchComparisonResult {
  comparedAt: string;
  baseBranch: string | null;
  headBranch: string | null;
  baseCommit?: string;
  headCommit?: string;
  changedFilesCount: number;
  affectedAreas: string[];
  regressionsCount: number;
  recoveriesCount: number;
  targetComparisons: TargetRegressionComparison[];
}
