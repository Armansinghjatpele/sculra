// ==============================================================================
// Sculra Autonomous QA Control Plane & Campaign Domain Types (worker/src/campaign/types.ts)
// ==============================================================================

import { ApplicationMap, CapturedScreenshot, CapturedConsoleError, CapturedNetworkError } from '../types';
import { ProductModel } from '../product';
import { StrategyDecision } from '../strategy/types';
import { QASignalRecord, RunComparison, HistoricalMetricDelta } from '../history/types';
import { ReleaseAssessment } from '../release/types';
import { SecurityFinding, SecurityCoverageSummary } from '../security/types';
import { PerformanceFinding, PerformanceCoverageSummary } from '../performance/types';
import { AccessibilityFinding, AccessibilityCoverageSummary } from '../accessibility/types';
import { ApiEndpoint, ApiTestResult, ApiCoverageSummary } from '../api-qa/types';
import { JourneyResult } from '../journeys/types';
import { BugObservation } from '../issues/types';
import { RoleContext, AuthenticatedSession, AuthorizationCheckResult } from '../auth/types';

export type QACampaignStatus =
  | 'QUEUED'
  | 'PLANNING'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'CANCELLING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'NEEDS_REVIEW';

export type CampaignDomain =
  | 'DISCOVERY'
  | 'PRODUCT'
  | 'FUNCTIONAL'
  | 'JOURNEY'
  | 'API'
  | 'SECURITY'
  | 'AUTHORIZATION'
  | 'ACCESSIBILITY'
  | 'VISUAL'
  | 'RESPONSIVE'
  | 'PERFORMANCE'
  | 'RELIABILITY'
  | 'HISTORICAL'
  | 'RELEASE';

export type CampaignObjective =
  | 'release_readiness'
  | 'smoke'
  | 'regression'
  | 'full_suite'
  | 'security_audit'
  | 'accessibility_audit'
  | 'performance_audit'
  | 'custom';

export type CampaignTaskStatus =
  | 'QUEUED'
  | 'PENDING_DEPENDENCIES'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'BLOCKED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'NOT_AVAILABLE';

export type CampaignTerminationReason =
  | 'GOAL_SATISFIED'
  | 'ALL_TASKS_COMPLETED'
  | 'BUDGET_EXHAUSTED'
  | 'TIME_LIMIT_REACHED'
  | 'CANCELLED_BY_USER'
  | 'CRITICAL_BLOCKER_THRESHOLD'
  | 'EXECUTION_FAILED'
  | 'INSUFFICIENT_EVIDENCE';

export interface CampaignConfig {
  objective: CampaignObjective;
  domains: CampaignDomain[];
  environment?: string;
  branch?: string;
  viewports?: string[]; // e.g. ['desktop', 'tablet', 'mobile']
  roles?: string[]; // e.g. ['ANONYMOUS', 'MEMBER', 'ADMIN']
  maxDurationSeconds?: number;
  maxTasks?: number;
  maxConcurrentTasks?: number;
  targetUrl?: string;
  authConfig?: any;
  securityPolicy?: any;
  performancePolicy?: any;
  accessibilityPolicy?: any;
  historicalPolicy?: any;
  allowLocalhost?: boolean;
  commitSha?: string;
  baseSha?: string;
  pullRequestNumber?: number;
  gitChanges?: any;
  changeIntelligence?: any;
}

export interface CampaignBudget {
  maxDurationSeconds: number;
  maxTasks: number;
  maxConcurrentTasks: number;
  maxAdaptiveInsertions: number;
  maxRetries: number;
  maxEvidenceLinksPerTask: number;
  elapsedSeconds: number;
  tasksExecuted: number;
  tasksRemaining: number;
  adaptiveInsertionsCount: number;
}

export interface CampaignTarget {
  id: string;
  type: string; // 'PAGE' | 'API' | 'WORKFLOW' | 'SELECTOR' | 'HEADER' | 'COOKIE' | 'AUTH_ROUTE'
  identifier: string; // URL path, selector, endpoint method:path, workflow ID
  url?: string;
  method?: string;
  selector?: string;
  role?: string;
  viewport?: string;
  workflowId?: string;
  workflowName?: string;
  businessCriticality?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  historicalSignals?: QASignalRecord[];
  strategyScore?: number;
  isRecentRegression?: boolean;
  isRecurringDefect?: boolean;
  isFlaky?: boolean;
  isChangeAffected?: boolean;
  changeType?: 'DIRECT' | 'TRANSITIVE' | 'BUSINESS_CRITICAL' | 'SECURITY' | 'HISTORICAL';
}

export interface CampaignTask {
  id: string;
  campaignId: string;
  taskType: string;
  domain: CampaignDomain;
  target: CampaignTarget;
  priority: number; // 0 - 100
  reason: string; // Human & machine-readable explanation of why this task was scheduled
  dependencies: string[]; // Prerequisite task IDs or domain prerequisites
  estimatedCostMs?: number;
  requiredRole?: string;
  requiredViewport?: string;
  status: CampaignTaskStatus;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  result?: CampaignTaskResult;
}

export interface CampaignTaskResult {
  taskId: string;
  status: CampaignTaskStatus;
  target: CampaignTarget;
  domain: CampaignDomain;
  findings: any[];
  evidence: any[];
  observations: BugObservation[];
  durationMs: number;
  error?: string;
  coverage?: {
    pagesEvaluated?: number;
    actionsExecuted?: number;
    endpointsChecked?: number;
    rulesAudited?: number;
  };
  metadata?: Record<string, any>;
}

export interface CampaignObservation {
  id: string;
  timestamp: string;
  domain: CampaignDomain;
  taskId?: string;
  targetIdentifier: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  correlatedEvidenceIds?: string[];
  metadata?: Record<string, any>;
}

export interface CampaignEvidenceLink {
  evidenceId: string;
  taskId: string;
  domain: CampaignDomain;
  targetIdentifier: string;
  type: string;
  title: string;
  url?: string;
  relatedFindingId?: string;
  relatedIssueFingerprint?: string;
  relatedSignalId?: string;
}

export interface CampaignProgress {
  completedTasks: number;
  runningTasks: number;
  queuedTasks: number;
  blockedTasks: number;
  skippedTasks: number;
  totalTasks: number;
  taskCoveragePct: number;
  domainCoveragePct: number;
  domainsStatus: Record<CampaignDomain, 'PENDING' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'NOT_AVAILABLE' | 'SKIPPED'>;
  criticalWorkflowCoveragePct?: number;
  criticalWorkflowCoverage: {
    total: number;
    tested: number;
    untested: number;
    passed: number;
    failed: number;
    blocked: number;
  };
}

export interface CampaignState {
  campaignId: string;
  projectId: string;
  organizationId?: string;
  status: QACampaignStatus;
  objective: CampaignObjective;
  config: CampaignConfig;
  budget: CampaignBudget;
  startedAt?: string;
  completedAt?: string;
  tasks: Map<string, CampaignTask>;
  executedTaskResults: Map<string, CampaignTaskResult>;
  testedTargets: Set<string>;
  queuedTargets: Set<string>;
  runningTargets: Set<string>;
  passedTargets: Set<string>;
  failedTargets: Set<string>;
  blockedTargets: Set<string>;
  skippedTargets: Set<string>;
  cancelledTargets: Set<string>;
  regressedTargets: Set<string>;
  recoveredTargets: Set<string>;
  unstableTargets: Set<string>;
  domainsExecuted: Set<CampaignDomain>;
  domainsUnavailable: Set<CampaignDomain>;
  observations: CampaignObservation[];
  evidenceLinks: CampaignEvidenceLink[];
  applicationMap?: ApplicationMap;
  productModel?: ProductModel;
  strategyDecisions: StrategyDecision[];
  historicalSignals: QASignalRecord[];
  historicalComparison?: RunComparison;
  releaseAssessment?: ReleaseAssessment;
  roleContexts: RoleContext[];
  authenticatedSessions: AuthenticatedSession[];
  authorizationChecks: AuthorizationCheckResult[];
  securityFindings: SecurityFinding[];
  securityCoverage?: SecurityCoverageSummary;
  performanceFindings: PerformanceFinding[];
  performanceCoverage?: PerformanceCoverageSummary;
  accessibilityFindings: AccessibilityFinding[];
  accessibilityCoverage?: AccessibilityCoverageSummary;
  apiEndpoints: ApiEndpoint[];
  apiResponses: ApiTestResult[];
  apiCoverage?: ApiCoverageSummary;
  journeyResults: JourneyResult[];
  bugObservations: BugObservation[];
  consoleErrors: CapturedConsoleError[];
  networkErrors: CapturedNetworkError[];
  screenshots: CapturedScreenshot[];
  changeIntelligence?: any;
  terminationReason?: CampaignTerminationReason;
  terminationDetails?: string;
}

export interface CampaignSummary {
  campaignId: string;
  projectId: string;
  organizationId?: string;
  status: QACampaignStatus;
  objective: CampaignObjective;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  domainsExecuted: CampaignDomain[];
  domainsUnavailable: CampaignDomain[];
  tasksPlanned: number;
  tasksExecuted: number;
  tasksPassed: number;
  tasksFailed: number;
  tasksBlocked: number;
  tasksSkipped: number;
  criticalWorkflowsTested: number;
  criticalWorkflowsUntested: number;
  newIssuesCount: number;
  regressionsCount: number;
  recoveriesCount: number;
  recurringDefectsCount: number;
  unstableTargetsCount: number;
  evidenceCount: number;
  coverageSummary: {
    taskCoveragePct: number;
    domainCoveragePct: number;
    pagesCovered: number;
    apisCovered: number;
    workflowsCovered: number;
    rolesCovered: number;
    viewportsCovered: number;
  };
  terminationReason: CampaignTerminationReason;
  releaseAssessment?: ReleaseAssessment;
  historicalScoreDeltas?: HistoricalMetricDelta[];
  aiExecutiveSummary?: string;
  changeIntelligence?: {
    riskScore: number;
    riskLevel: string;
    changeCount: number;
    additionsCount: number;
    deletionsCount: number;
    affectedRoutes: string[];
    affectedWorkflows: string[];
    affectedApis: string[];
    recommendedDomains: string[];
    isPartial: boolean;
    status: string;
    summaryMarkdown?: string;
  };
}

export interface CampaignRecord {
  id: string;
  project_id: string;
  organization_id?: string;
  test_run_id?: string;
  status: QACampaignStatus;
  objective: CampaignObjective;
  configuration: CampaignConfig;
  budget: CampaignBudget;
  state: Partial<CampaignState>;
  summary: Partial<CampaignSummary>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
}

export interface CampaignTaskRecord {
  id: string;
  campaign_id: string;
  project_id: string;
  organization_id?: string;
  task_type: string;
  target_type: string;
  target_identifier: string;
  status: CampaignTaskStatus;
  priority: number;
  reason: string;
  dependencies: string[];
  result?: CampaignTaskResult;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}
