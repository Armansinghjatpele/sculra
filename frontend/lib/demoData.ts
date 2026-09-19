// ==============================================================================
// Sculra Reusable Demo Data Structures & Interfaces (frontend/lib/demoData.ts)
// ==============================================================================

export interface Project {
  id: string;
  name: string;
  type: 'website' | 'github' | 'zip' | 'desktop' | 'api';
  status: 'passed' | 'running' | 'failed' | 'needs_review';
  lastTestRun?: string;
  releaseScore: number | null;
  openIssuesCount: number;
  url?: string;
  repoUrl?: string;
  environment?: string;
  branch?: string;
  createdAt?: string;
  ciEnabled?: boolean;
  githubRepoOwner?: string;
  githubRepoName?: string;
  ciDefaultBranch?: string;
  ciTriggerOnPush?: boolean;
  ciTriggerOnPr?: boolean;
  ciGatePolicy?: 'BLOCK_ON_CRITICAL_ISSUE' | 'STRICT' | 'PERMISSIVE' | 'BLOCK_ON_REGRESSION';
  ciWebhookSecret?: string;
  fixAgentPolicy?: ProjectFixPolicy;
}

export type FixAgentMode = 'PLAN_ONLY' | 'DRY_RUN' | 'APPLY_AND_VERIFY' | 'CREATE_PR';

export interface ProjectFixPolicy {
  fixAgentEnabled: boolean;
  fixAgentMode: FixAgentMode;
  fixAllowedPaths: string[];
  fixBlockedPaths: string[];
  fixMaxFilesChanged: number;
  fixMaxDiffLines: number;
  fixAllowedTestCommands: string[];
  fixRequireHumanApproval: boolean;
  fixAutoPrEnabled: boolean;
  fixBranchPrefix: string;
}

export interface CICDWebhookEvent {
  id: string;
  deliveryId: string;
  provider: string;
  eventType: string;
  projectId: string;
  repository: string;
  commitSha?: string;
  pullRequestNumber?: number;
  status: 'RECEIVED' | 'PROCESSING' | 'SCHEDULED' | 'IGNORED' | 'FAILED' | 'COMPLETED';
  campaignId?: string;
  errorCode?: string;
  receivedAt: string;
  processedAt?: string;
}

export interface CICDGateResult {
  id: string;
  campaignId?: string;
  testRunId?: string;
  projectId: string;
  commitSha?: string;
  pullRequestNumber?: number;
  branch?: string;
  gateVerdict: 'PASS' | 'FAIL' | 'INSUFFICIENT_EVIDENCE' | 'ERROR' | 'CANCELLED';
  gatePolicy: string;
  releaseVerdict?: string;
  reasonCodes: string[];
  criticalFindingsCount: number;
  regressionCount: number;
  evidenceStatus: string;
  summaryMarkdown?: string;
  feedbackJson?: Record<string, any>;
  createdAt: string;
}

export type TestRunStatus = 'passed' | 'running' | 'failed' | 'needs_review' | 'queued' | 'cancelled';

export interface TestRun {
  id: string;
  projectId: string;
  projectName: string;
  status: TestRunStatus;
  issuesCount: number;
  releaseScore: number | null;
  durationMs: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  url?: string;
  environment?: string;
  branch?: string;
}

export interface TestEvidence {
  id: string;
  testRunId: string;
  projectId: string;
  type:
    | 'screenshot'
    | 'console_error'
    | 'network_error'
    | 'dom_snapshot'
    | 'navigation'
    | 'application_map'
    | 'discovered_page'
    | 'responsive_capture'
    | 'journey_result'
    | 'journey_step'
    | 'action_trace'
    | 'observation'
    | 'visual_comparison'
    | 'responsive_observation'
    | 'visual_snapshot'
    | 'visual_baseline'
    | 'ai_qa_plan'
    | 'ai_qa_result'
    | 'ai_qa_state_summary'
    | 'ai_qa_stop'
    | 'strategy_decision'
    | 'test_target_selected'
    | 'strategy_stop'
    | 'product_model'
    | 'product_workflow'
    | 'product_feature'
    | 'product_role'
    | 'product_criticality'
    | 'product_coverage'
    | 'authenticated_session'
    | 'role_context'
    | 'authorization_check'
    | 'unauthorized_access'
    | 'role_difference'
    | 'api_endpoint'
    | 'api_request'
    | 'api_response'
    | 'api_coverage_summary'
    | 'api_authorization_check'
    | 'api_failure'
    | 'api_contract'
    | 'security_summary'
    | 'security_finding'
    | 'security_header_check'
    | 'security_cookie_check'
    | 'security_cors_check'
    | 'security_redirect_check'
    | 'security_exposure_check'
    | 'security_auth_check'
    | 'performance_summary'
    | 'performance_finding'
    | 'performance_navigation'
    | 'performance_web_vitals'
    | 'performance_network'
    | 'performance_resource'
    | 'performance_action'
    | 'performance_reliability'
    | 'performance_regression'
    | 'accessibility_summary'
    | 'accessibility_finding'
    | 'accessibility_check'
    | 'accessibility_keyboard'
    | 'accessibility_contrast'
    | 'accessibility_touch_target'
    | 'accessibility_form'
    | 'accessibility_heading'
    | 'accessibility_landmark'
    | 'accessibility_dialog'
    | 'historical_summary'
    | 'regression_event'
    | 'recovery_event'
    | 'recurrence_event'
    | 'stability_signal'
    | 'trend_snapshot'
    | 'coverage_trend'
    | 'historical_comparison'
    | 'release_report'
    | 'campaign_plan'
    | 'campaign_progress'
    | 'campaign_correlation'
    | 'campaign_summary'
    | 'campaign_stop'
    | 'campaign_task_result';
  title: string;
  url?: string;
  message?: string;
  metadata?: Record<string, any>;
  storagePath?: string;
  createdAt: string;
}

export type CampaignObjective =
  | 'FULL_REGRESSION'
  | 'SMOKE'
  | 'RELEASE_GATE'
  | 'SECURITY_SWEEP'
  | 'PERFORMANCE_AUDIT'
  | 'ACCESSIBILITY_AUDIT'
  | 'TARGETED_RETEST'
  | 'EXPLORATORY';

export type CampaignStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT'
  | 'BUDGET_EXHAUSTED';

export type CampaignStage =
  | 'DISCOVERY_MAPPING'
  | 'SURFACE_VERIFICATION'
  | 'DEEP_ENGINE_AUDITS'
  | 'HISTORICAL_CORRELATION'
  | 'RELEASE_EVALUATION';

export type CampaignTaskStatus =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export type CampaignDomain =
  | 'discovery'
  | 'product'
  | 'strategy'
  | 'journey'
  | 'visual'
  | 'auth'
  | 'api'
  | 'security'
  | 'performance'
  | 'accessibility'
  | 'historical'
  | 'release';

export interface CampaignConfig {
  name: string;
  objective: CampaignObjective;
  enabledDomains: CampaignDomain[];
  targetUrl: string;
  targetRole?: string;
  budget: {
    maxDurationSeconds: number;
    maxTasks: number;
    maxParallelStages: number;
    maxRetriesPerTask: number;
  };
  adaptiveInsertion: boolean;
  minReleaseScoreThreshold?: number;
  environment?: string;
  branch?: string;
  commitHash?: string;
}

export interface CampaignBudgetProgress {
  durationSeconds: { current: number; max: number; exhausted: boolean };
  tasks: { totalPlanned: number; completed: number; running: number; failed: number; skipped: number; max: number; exhausted: boolean };
  retries: { count: number; maxPerTask: number };
  overallExhausted: boolean;
  exhaustionReason?: string;
}

export interface CampaignProgress {
  campaignId: string;
  status: CampaignStatus;
  currentStage: CampaignStage;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
  percentComplete: number;
  elapsedDurationMs: number;
  coverage: {
    pagesDiscovered: number;
    pagesTested: number;
    endpointsDiscovered: number;
    endpointsTested: number;
    criticalWorkflowsTotal: number;
    criticalWorkflowsTested: number;
    rolesTested: number;
    domainCoveragePercentage: Record<CampaignDomain, number>;
  };
  budget: CampaignBudgetProgress;
  releaseReadinessStatus?: 'RELEASE' | 'RELEASE_WITH_CAUTION' | 'DO_NOT_RELEASE' | 'INSUFFICIENT_EVIDENCE';
  latestReleaseScore?: number;
}

export interface CampaignTask {
  id: string;
  campaignId: string;
  taskKey: string;
  stage: CampaignStage;
  domain: CampaignDomain;
  status: CampaignTaskStatus;
  priority: number;
  target?: {
    type: 'PAGE' | 'API' | 'WORKFLOW' | 'ROLE' | 'GLOBAL';
    identifier: string;
    criticality?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    metadata?: Record<string, any>;
  };
  dependencies: string[];
  retryCount: number;
  maxRetries: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  observationsCount: number;
  issuesDetected: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CrossDomainCorrelation {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  contributingDomains: CampaignDomain[];
  rootCauseHypothesis: string;
  evidenceLinks: Array<{ evidenceId: string; domain: CampaignDomain; title: string; summary: string }>;
  suggestedAction: string;
}

export interface CampaignSummary {
  campaignId: string;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalTasksPlanned: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  domainCoverage: Record<CampaignDomain, number>;
  criticalWorkflowsTested: number;
  criticalWorkflowsTotal: number;
  issuesSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byDomain: Record<CampaignDomain, number>;
  };
  crossDomainCorrelations: CrossDomainCorrelation[];
  releaseReadiness: {
    verdict: 'RELEASE' | 'RELEASE_WITH_CAUTION' | 'DO_NOT_RELEASE' | 'INSUFFICIENT_EVIDENCE';
    overallScore?: number;
    blockersCount: number;
    blockers: Array<{ id: string; title: string; reason: string; category: string; severity: string }>;
    riskLevel: string;
    confidenceLevel: string;
    recommendations: string[];
  };
  aiExecutiveNarrative?: {
    overview: string;
    keyHighlights: string[];
    criticalConcerns: string[];
    recommendedNextSteps: string[];
    summaryRiskAssessment: string;
  };
}

export interface Campaign {
  id: string;
  projectId: string;
  organizationId?: string | null;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  currentStage: CampaignStage;
  config: CampaignConfig;
  budgetStatus: Record<string, any>;
  progressSnapshot: CampaignProgress;
  summary?: CampaignSummary;
  overallScore?: number;
  releaseVerdict?: 'RELEASE' | 'RELEASE_WITH_CAUTION' | 'DO_NOT_RELEASE' | 'INSUFFICIENT_EVIDENCE';
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QASignalRecord {
  id: string;
  projectId: string;
  organizationId?: string | null;
  testRunId: string;
  signalType:
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
  targetType: string;
  targetIdentifier: string;
  fingerprint?: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: 'high' | 'medium' | 'low';
  occurrenceCount: number;
  consecutiveCount: number;
  environment?: string;
  viewport?: string | null;
  role?: string | null;
  metadata?: Record<string, any>;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface ReleaseBlocker {
  id: string;
  title: string;
  reason: string;
  category: 'functional' | 'visual' | 'responsive' | 'reliability' | 'security' | 'api' | 'performance' | 'accessibility';
  severity: 'critical' | 'high';
  evidenceSummary: string;
  relatedIssueFingerprints?: string[];
}

export interface ChangeAnalysis {
  id: string;
  projectId: string;
  campaignId?: string | null;
  commitSha: string;
  baseSha?: string | null;
  branch?: string | null;
  pullRequestNumber?: number | null;
  changeCount: number;
  additionsCount: number;
  deletionsCount: number;
  riskScore: number;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  analysisStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'NOT_AVAILABLE';
  classifications?: string[];
  summary?: {
    headline?: string;
    markdownSummary?: string;
    riskScore?: number;
    riskLevel?: string;
  };
  impactGraph?: any;
  metadata?: any;
  createdAt: string;
}

export interface ScoreDeduction {
  category: string;
  points: number;
  reason: string;
  evidenceRef?: string;
}

export interface ReleaseScore {
  id: string;
  testRunId: string;
  projectId: string;
  organizationId?: string | null;
  overallScore: number;
  functionalityScore: number;
  uiScore: number;
  responsiveScore: number;
  reliabilityScore: number;
  coverageScore: number;
  securityScore?: number;
  performanceScore?: number;
  accessibilityScore?: number;
  recommendation: 'RELEASE' | 'RELEASE_WITH_CAUTION' | 'DO_NOT_RELEASE' | 'INSUFFICIENT_EVIDENCE';
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  scoringVersion: string;
  blockersCount: number;
  breakdown?: any;
  blockers?: ReleaseBlocker[];
  aiAnalysis?: {
    summary: string;
    keyRisks: string[];
    strengths: string[];
    evidenceGaps: string[];
    recommendedActions: string[];
    releaseExplanation: string;
    confidence: 'high' | 'medium' | 'low';
  };
  createdAt: string;
}

export interface StructuredReproductionStep {
  stepNumber: number;
  action: string;
  target: string;
  url: string;
  expectedBehavior: string;
  observedBehavior: string;
  selector?: string;
}

export interface Issue {
  id: string;
  projectId: string;
  projectName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  detectedAt: string;
  status: 'open' | 'resolved' | 'ignored';
  fingerprint?: string;
  occurrenceCount?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  reproductionSteps?: StructuredReproductionStep[];
  metadata?: Record<string, any>;
  remediation?: RemediationAnalysis | null;
  remediations?: FixRemediation[];
  latestFixRemediation?: FixRemediation | null;
}

export interface BugDiagnosis {
  summary: string;
  category: string;
  status: 'NOT_ANALYZED' | 'ANALYZING' | 'DIAGNOSED' | 'PARTIAL' | 'INSUFFICIENT_EVIDENCE' | 'FAILED';
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  directLocations: Array<{ filePath: string; line?: number; functionName?: string }>;
  explanation: string;
  limitations: string[];
  provenanceTrail: string[];
}

export interface RootCauseHypothesis {
  id: string;
  category: string;
  statement: string;
  status: 'CANDIDATE' | 'SUPPORTED' | 'WEAKLY_SUPPORTED' | 'REJECTED' | 'UNRESOLVED';
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  filePaths: string[];
  symbols: string[];
  sourceReferences: string[];
  affectedTarget?: string;
  affectedCode?: string;
  rejectionReason?: string;
}

export interface FixStep {
  stepNumber: number;
  description: string;
  targetFile?: string;
  targetSymbol?: string;
  action: 'INSPECT' | 'HANDLE_ERROR' | 'VALIDATE_INPUT' | 'UPDATE_LOGIC' | 'ADD_TEST' | 'REVERT_CHANGE';
  rationale: string;
  safetyNotes?: string;
}

export interface FixPlan {
  summary: string;
  affectedFiles: string[];
  affectedSymbols: string[];
  steps: FixStep[];
  expectedBehavior: string;
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH' | 'SECURITY_RISK';
  securityHazards?: string[];
  requiredTests: string[];
}

export interface VerificationPlan {
  suggestedDomains: string[];
  existingTargets: string[];
  regressionTests: string[];
}

export interface RemediationAnalysis {
  id: string;
  organizationId?: string;
  projectId: string;
  issueId: string;
  campaignId?: string;
  testRunId?: string;
  fingerprint: string;
  analysisVersion: number;
  status: 'NOT_ANALYZED' | 'ANALYZING' | 'DIAGNOSED' | 'PARTIAL' | 'INSUFFICIENT_EVIDENCE' | 'FAILED';
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  diagnosis: BugDiagnosis;
  hypotheses: RootCauseHypothesis[];
  fixPlan: FixPlan;
  verificationPlan: VerificationPlan;
  codeContextSummary?: {
    filesRetrieved: number;
    symbolsIdentified: number;
    isPartial: boolean;
    partialReason?: string;
  };
  changeContextSummary?: {
    commitSha?: string;
    hasRelevantChanges: boolean;
    relationship: string;
  };
  historicalContextSummary?: {
    isRecurring: boolean;
    isRecentRegression: boolean;
    totalOccurrences: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type FixAgentState =
  | 'INITIAL'
  | 'AUTHORIZED'
  | 'PLAN_VALIDATED'
  | 'CONTEXT_RETRIEVED'
  | 'PATCH_GENERATED'
  | 'PATCH_VALIDATED'
  | 'WORKSPACE_INITIALIZED'
  | 'BASELINE_RUN'
  | 'PATCH_APPLIED'
  | 'TESTS_RUN'
  | 'DIFF_REVIEWED'
  | 'BRANCH_COMMITTED'
  | 'BRANCH_PUSHED'
  | 'PR_OPENED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ROLLED_BACK';

export type FixBaselineStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'NOT_RUN' | 'ERROR';
export type FixVerificationStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'NOT_RUN' | 'ERROR';

export interface PatchEdit {
  filePath: string;
  action: 'MODIFY' | 'CREATE' | 'DELETE';
  originalCode?: string;
  replacementCode?: string;
  contextBefore?: string;
  contextAfter?: string;
}

export interface StructuredPatch {
  summary: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  edits: PatchEdit[];
}

export interface DiffReviewResult {
  passed: boolean;
  additions: number;
  deletions: number;
  filesChanged: number;
  unauthorizedModifications: string[];
  syntaxViolations: string[];
  secretLeaksDetected: string[];
  comments: string[];
}

export interface TestCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export interface FixVerificationResult {
  baselineStatus: FixBaselineStatus;
  verificationStatus: FixVerificationStatus;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  commandResults: TestCommandResult[];
  regressionDetected: boolean;
  failureReason?: string;
}

export interface FixRemediation {
  id: string;
  organizationId?: string;
  projectId: string;
  issueId: string;
  remediationAnalysisId?: string;
  mode: FixAgentMode;
  status: FixAgentState;
  branchName?: string;
  baseBranch?: string;
  commitSha?: string;
  patchUnified?: string;
  patchStructured?: StructuredPatch;
  filesChanged?: string[];
  linesAdded: number;
  linesRemoved: number;
  baselineStatus: FixBaselineStatus;
  verificationStatus: FixVerificationStatus;
  verificationResults?: FixVerificationResult;
  diffReviewResults?: DiffReviewResult;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
  pullRequestStatus?: 'NONE' | 'OPEN' | 'MERGED' | 'CLOSED';
  humanApproved?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  errorMessage?: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;
  executionTimeMs: number;
  aiModel?: string;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface FixEvidence {
  id: string;
  remediationId: string;
  evidenceType: 'BASELINE_LOG' | 'VERIFICATION_LOG' | 'DIFF' | 'STATIC_ANALYSIS' | 'TEST_OUTPUT' | 'ROLLBACK_LOG';
  content: string;
  structuredData?: Record<string, any>;
  filePath?: string;
  fileLine?: number;
  createdAt: string;
}

export interface AIInsight {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  type: 'alert' | 'system' | 'report';
}

// ------------------------------------------------------------------------------
// Placeholder mock datasets
// ------------------------------------------------------------------------------

export const mockProjects: Project[] = [
  { id: 'proj-1', name: 'Sculra Landing Page', type: 'website', status: 'passed', lastTestRun: '10 minutes ago', releaseScore: 96, openIssuesCount: 0, url: 'https://sculra.com' },
  { id: 'proj-2', name: 'sculra-monorepo', type: 'github', status: 'needs_review', lastTestRun: '2 hours ago', releaseScore: 82, openIssuesCount: 3, repoUrl: 'https://github.com/Sculra/sculra' },
  { id: 'proj-3', name: 'React 19 Sandbox Bundle', type: 'zip', status: 'failed', lastTestRun: '1 day ago', releaseScore: 58, openIssuesCount: 7 },
  { id: 'proj-4', name: 'Desktop App Electron Wrapper', type: 'desktop', status: 'running', lastTestRun: 'Just now', releaseScore: 90, openIssuesCount: 1 },
];

export const mockTestRuns: TestRun[] = [
  { id: 'run-1', projectId: 'proj-1', projectName: 'Sculra Landing Page', status: 'passed', issuesCount: 0, releaseScore: 96, durationMs: 45000, createdAt: '10m ago' },
  { id: 'run-2', projectId: 'proj-2', projectName: 'sculra-monorepo', status: 'needs_review', issuesCount: 3, releaseScore: 82, durationMs: 125000, createdAt: '2h ago' },
  { id: 'run-3', projectId: 'proj-3', projectName: 'React 19 Sandbox Bundle', status: 'failed', issuesCount: 7, releaseScore: 58, durationMs: 82000, createdAt: '1d ago' },
  { id: 'run-4', projectId: 'proj-4', projectName: 'Desktop App Electron Wrapper', status: 'running', issuesCount: 1, releaseScore: 90, durationMs: 18000, createdAt: 'Just now' },
];

export const mockTestEvidence: TestEvidence[] = [
  {
    id: 'ev-1',
    testRunId: 'run-1',
    projectId: 'proj-1',
    type: 'screenshot',
    title: 'Initial Viewport Capture — Sculra',
    url: 'https://sculra.com',
    message: '',
    storagePath: 'screenshots/run-1/screenshot_1.png',
    createdAt: '10m ago',
    metadata: { width: 1280, height: 720 },
  },
  {
    id: 'ev-2',
    testRunId: 'run-1',
    projectId: 'proj-1',
    type: 'navigation',
    title: 'Initial Page Navigation',
    url: 'https://sculra.com',
    message: 'Sculra — Autonomous AI QA Engineer',
    createdAt: '10m ago',
    metadata: { statusCode: 200, pageTitle: 'Sculra — Autonomous AI QA Engineer', durationMs: 1200 },
  },
];

export const mockIssues: Issue[] = [
  { id: 'iss-1', projectId: 'proj-2', projectName: 'sculra-monorepo', severity: 'high', title: 'Missing HttpOnly flag in session cookie', detectedAt: '2h ago', status: 'open' },
  { id: 'iss-2', projectId: 'proj-2', projectName: 'sculra-monorepo', severity: 'medium', title: 'Contrast ratio fails WCAG AA on Secondary Button', detectedAt: '2h ago', status: 'open' },
  { id: 'iss-3', projectId: 'proj-3', projectName: 'React 19 Sandbox Bundle', severity: 'critical', title: 'Unhandled API gateway connection timeout (504)', detectedAt: '1d ago', status: 'open' },
  { id: 'iss-4', projectId: 'proj-4', projectName: 'Desktop App Electron Wrapper', severity: 'low', title: 'Deprecated electron-updater library package referenced', detectedAt: 'Just now', status: 'open' },
];

export const mockAIInsights: AIInsight[] = [
  { id: 'ins-1', message: '3 issues appear related to the latest GitHub branch deployment.', severity: 'warning', timestamp: '2 hours ago' },
  { id: 'ins-2', message: 'Visual alignment regression detected on Pricing grid cards.', severity: 'critical', timestamp: '1 day ago' },
];

export const mockNotifications: Notification[] = [
  { id: 'not-1', title: 'Critical Security Sweep Failed', description: 'Sculra monorepo contains a leaked test variable in api config.', read: false, createdAt: '10m ago', type: 'alert' },
  { id: 'not-2', title: 'Performance Audit Complete', description: 'React 19 Sandbox bundle load score is 94/100.', read: true, createdAt: '1d ago', type: 'report' },
];

export const mockCampaigns: Campaign[] = [
  {
    id: 'camp-1',
    projectId: 'proj-1',
    name: 'Production Release Gate Campaign',
    objective: 'RELEASE_GATE',
    status: 'COMPLETED',
    currentStage: 'RELEASE_EVALUATION',
    overallScore: 96,
    releaseVerdict: 'RELEASE',
    config: {
      name: 'Production Release Gate Campaign',
      objective: 'RELEASE_GATE',
      enabledDomains: ['discovery', 'product', 'strategy', 'journey', 'visual', 'auth', 'api', 'security', 'performance', 'accessibility', 'historical', 'release'],
      targetUrl: 'https://sculra.com',
      budget: {
        maxDurationSeconds: 600,
        maxTasks: 20,
        maxParallelStages: 1,
        maxRetriesPerTask: 1,
      },
      adaptiveInsertion: true,
      minReleaseScoreThreshold: 85,
    },
    budgetStatus: {
      durationSeconds: { current: 185, max: 600, exhausted: false },
      tasks: { totalPlanned: 12, completed: 12, running: 0, failed: 0, skipped: 0, max: 20, exhausted: false },
      retries: { count: 0, maxPerTask: 1 },
      overallExhausted: false,
    },
    progressSnapshot: {
      campaignId: 'camp-1',
      status: 'COMPLETED',
      currentStage: 'RELEASE_EVALUATION',
      activeTasks: 0,
      completedTasks: 12,
      failedTasks: 0,
      totalTasks: 12,
      percentComplete: 100,
      elapsedDurationMs: 185000,
      coverage: {
        pagesDiscovered: 8,
        pagesTested: 8,
        endpointsDiscovered: 6,
        endpointsTested: 6,
        criticalWorkflowsTotal: 4,
        criticalWorkflowsTested: 4,
        rolesTested: 2,
        domainCoveragePercentage: {
          discovery: 100,
          product: 100,
          strategy: 100,
          journey: 100,
          visual: 100,
          auth: 100,
          api: 100,
          security: 100,
          performance: 100,
          accessibility: 100,
          historical: 100,
          release: 100,
        },
      },
      budget: {
        durationSeconds: { current: 185, max: 600, exhausted: false },
        tasks: { totalPlanned: 12, completed: 12, running: 0, failed: 0, skipped: 0, max: 20, exhausted: false },
        retries: { count: 0, maxPerTask: 1 },
        overallExhausted: false,
      },
      releaseReadinessStatus: 'RELEASE',
      latestReleaseScore: 96,
    },
    summary: {
      campaignId: 'camp-1',
      name: 'Production Release Gate Campaign',
      objective: 'RELEASE_GATE',
      status: 'COMPLETED',
      startedAt: '10m ago',
      completedAt: '7m ago',
      durationMs: 185000,
      totalTasksPlanned: 12,
      tasksCompleted: 12,
      tasksFailed: 0,
      tasksSkipped: 0,
      domainCoverage: {
        discovery: 100,
        product: 100,
        strategy: 100,
        journey: 100,
        visual: 100,
        auth: 100,
        api: 100,
        security: 100,
        performance: 100,
        accessibility: 100,
        historical: 100,
        release: 100,
      },
      criticalWorkflowsTested: 4,
      criticalWorkflowsTotal: 4,
      issuesSummary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        byDomain: {
          discovery: 0,
          product: 0,
          strategy: 0,
          journey: 0,
          visual: 0,
          auth: 0,
          api: 0,
          security: 0,
          performance: 0,
          accessibility: 0,
          historical: 0,
          release: 0,
        },
      },
      crossDomainCorrelations: [],
      releaseReadiness: {
        verdict: 'RELEASE',
        overallScore: 96,
        blockersCount: 0,
        blockers: [],
        riskLevel: 'LOW',
        confidenceLevel: 'HIGH',
        recommendations: ['Build meets quality and safety standards for deployment.'],
      },
      aiExecutiveNarrative: {
        overview: 'Autonomous QA campaign completed with 100% stage pass rate and zero blocking regressions.',
        keyHighlights: ['All 4 critical workflows passed verification', 'No visual or responsive regressions detected', 'Zero API 5xx errors recorded'],
        criticalConcerns: [],
        recommendedNextSteps: ['Proceed with staged production rollout.'],
        summaryRiskAssessment: 'Low risk release candidate with high verification confidence.',
      },
    },
    startedAt: '10m ago',
    completedAt: '7m ago',
    createdAt: '10m ago',
    updatedAt: '7m ago',
  },
];

export const mockCampaignTasks: CampaignTask[] = [
  {
    id: 'task-1',
    campaignId: 'camp-1',
    taskKey: 'stage_1_discovery_mapping',
    stage: 'DISCOVERY_MAPPING',
    domain: 'discovery',
    status: 'COMPLETED',
    priority: 100,
    target: { type: 'GLOBAL', identifier: 'https://sculra.com', criticality: 'CRITICAL' },
    dependencies: [],
    retryCount: 0,
    maxRetries: 1,
    startedAt: '10m ago',
    completedAt: '9m ago',
    durationMs: 45000,
    observationsCount: 8,
    issuesDetected: 0,
    createdAt: '10m ago',
  },
  {
    id: 'task-2',
    campaignId: 'camp-1',
    taskKey: 'stage_2_surface_journeys',
    stage: 'SURFACE_VERIFICATION',
    domain: 'journey',
    status: 'COMPLETED',
    priority: 90,
    target: { type: 'WORKFLOW', identifier: 'wf-checkout-primary', criticality: 'CRITICAL' },
    dependencies: ['stage_1_discovery_mapping'],
    retryCount: 0,
    maxRetries: 1,
    startedAt: '9m ago',
    completedAt: '8m ago',
    durationMs: 35000,
    observationsCount: 5,
    issuesDetected: 0,
    createdAt: '10m ago',
  },
];

export const mockFixRemediations: FixRemediation[] = [
  {
    id: 'fix-1',
    projectId: 'proj-1',
    issueId: 'iss-1',
    mode: 'CREATE_PR',
    status: 'PR_OPENED',
    branchName: 'sculra/fix/iss-1/null-pointer-cart',
    baseBranch: 'main',
    commitSha: 'a1b2c3d4e5f678901234567890abcdef12345678',
    patchUnified: `--- a/src/cart/calculate.ts\n+++ b/src/cart/calculate.ts\n@@ -12,4 +12,7 @@\n-  return items.reduce((sum, item) => sum + item.price, 0);\n+  if (!items || !Array.isArray(items)) {\n+    return 0;\n+  }\n+  return items.reduce((sum, item) => sum + (item.price || 0), 0);`,
    patchStructured: {
      summary: 'Safely guard against null or undefined cart items in calculation',
      filesChanged: 1,
      additions: 4,
      deletions: 1,
      edits: [
        {
          filePath: 'src/cart/calculate.ts',
          action: 'MODIFY',
          originalCode: '  return items.reduce((sum, item) => sum + item.price, 0);',
          replacementCode: '  if (!items || !Array.isArray(items)) {\n    return 0;\n  }\n  return items.reduce((sum, item) => sum + (item.price || 0), 0);',
        },
      ],
    },
    filesChanged: ['src/cart/calculate.ts'],
    linesAdded: 4,
    linesRemoved: 1,
    baselineStatus: 'FAILED',
    verificationStatus: 'PASSED',
    verificationResults: {
      baselineStatus: 'FAILED',
      verificationStatus: 'PASSED',
      testsRun: 6,
      testsPassed: 6,
      testsFailed: 0,
      commandResults: [
        {
          command: 'npm test -- src/cart/calculate.test.ts',
          exitCode: 0,
          stdout: 'PASS src/cart/calculate.test.ts\n  ✓ calculates total correctly\n  ✓ handles null items gracefully\n',
          stderr: '',
          durationMs: 1420,
          timedOut: false,
        },
      ],
      regressionDetected: false,
    },
    diffReviewResults: {
      passed: true,
      additions: 4,
      deletions: 1,
      filesChanged: 1,
      unauthorizedModifications: [],
      syntaxViolations: [],
      secretLeaksDetected: [],
      comments: ['Diff adheres to project policy and cleanly addresses root cause without security regressions.'],
    },
    pullRequestNumber: 42,
    pullRequestUrl: 'https://github.com/Armansinghjatpele/sculra/pull/42',
    pullRequestStatus: 'OPEN',
    humanApproved: false,
    retryCount: 0,
    maxRetries: 2,
    executionTimeMs: 14500,
    aiModel: 'gpt-4o',
    tokenUsage: { promptTokens: 1200, completionTokens: 320, totalTokens: 1520 },
    createdAt: '15m ago',
    updatedAt: '12m ago',
    completedAt: '12m ago',
  },
];

// ==============================================================================
// Autonomous Observability, Explainability & Control Center Types & Demo Data
// ==============================================================================

export type ActorType =
  | 'CAMPAIGN_ENGINE'
  | 'STRATEGY_ENGINE'
  | 'DISCOVERY_AGENT'
  | 'EXECUTION_WORKER'
  | 'RCA_ENGINE'
  | 'REMEDIATION_AGENT'
  | 'VERIFICATION_RUNNER'
  | 'CI_CD_GATE'
  | 'HUMAN_OPERATOR'
  | 'SYSTEM';

export type EventSource =
  | 'CAMPAIGN'
  | 'WORKER'
  | 'SCHEDULER'
  | 'REMEDIATION'
  | 'GATE'
  | 'UI';

export type FactCategory =
  | 'OBSERVED_FACT'
  | 'INFERRED_CONCLUSION'
  | 'AI_HYPOTHESIS'
  | 'RECOMMENDATION'
  | 'ACTION'
  | 'ACTION_RESULT'
  | 'HUMAN_DECISION';

export type ConfidenceLevel =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INSUFFICIENT_EVIDENCE';

export type AutonomousEventType =
  | 'CAMPAIGN_STARTED'
  | 'CAMPAIGN_COMPLETED'
  | 'CAMPAIGN_FAILED'
  | 'TASK_SCHEDULED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_SKIPPED'
  | 'DISCOVERY_STARTED'
  | 'DISCOVERY_COMPLETED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_COMPLETED'
  | 'OBSERVATION_CAPTURED'
  | 'EVIDENCE_RECORDED'
  | 'ISSUE_DETECTED'
  | 'STRATEGY_DECIDED'
  | 'TARGET_SELECTED'
  | 'TARGET_SKIPPED'
  | 'RCA_STARTED'
  | 'RCA_DIAGNOSED'
  | 'FIX_PLAN_GENERATED'
  | 'FIX_APPLIED'
  | 'FIX_VERIFIED'
  | 'PR_CREATED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'POLICY_BLOCKED'
  | 'HEALTH_HEARTBEAT';

export type SkipReason =
  | 'NO_CHANGES_DETECTED'
  | 'BUDGET_EXHAUSTED'
  | 'ENVIRONMENT_UNAVAILABLE'
  | 'PREREQUISITE_FAILED'
  | 'FLAKY_QUARANTINED'
  | 'LOW_RISK_PATH'
  | 'RATE_LIMIT_BACKOFF'
  | 'UNAUTHORIZED_BRANCH'
  | 'POLICY_VIOLATION'
  | 'DUPLICATE_EXECUTION'
  | 'USER_PAUSED';

export type DecisionType =
  | 'TARGET_SELECTION'
  | 'TARGET_SKIP'
  | 'PRIORITIZATION'
  | 'FLAKY_QUARANTINE'
  | 'REMEDIATION_TRIGGER'
  | 'PR_GENERATION'
  | 'GATE_VERDICT'
  | 'CIRCUIT_BREAKER_TRIGGER';

export interface AutonomousEvent {
  id: string;
  projectId: string;
  campaignId?: string;
  taskId?: string;
  testRunId?: string;
  issueId?: string;
  remediationId?: string;
  approvalId?: string;
  actorType: ActorType;
  actorId?: string;
  eventSource: EventSource;
  eventType: AutonomousEventType;
  factCategory: FactCategory;
  headline: string;
  reason?: string;
  confidence?: ConfidenceLevel;
  confidenceScore?: number;
  evidenceIds?: string[];
  metadata?: Record<string, any>;
  skipReason?: SkipReason;
  createdAt: string;
}

export interface DecisionRecord {
  id: string;
  projectId: string;
  campaignId?: string;
  decisionType: DecisionType;
  factCategory: FactCategory;
  headline: string;
  why: string;
  whyNow?: string;
  target?: string;
  actionTaken?: string;
  nextAction?: string;
  alternativesConsidered?: string[];
  skipReason?: SkipReason;
  confidence: ConfidenceLevel;
  confidenceScore?: number;
  evidenceIds: string[];
  policyChecks?: Array<{ rule: string; passed: boolean; details?: string }>;
  actorType: ActorType;
  actorId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export type HumanApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUPERSEDED';

export interface HumanApprovalRecord {
  id: string;
  projectId: string;
  remediationId: string;
  sourceSha: string;
  fixPlanVersion: number;
  status: HumanApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  decisionReason?: string;
  diffSummary?: {
    filesChanged: number;
    additions: number;
    deletions: number;
    files: string[];
  };
  patchUnified?: string;
  issueId?: string;
  issueTitle?: string;
  verificationPassed?: boolean;
  securityChecksPassed?: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceNode {
  id: string;
  type: 'CAMPAIGN' | 'TASK' | 'TEST_RUN' | 'OBSERVATION' | 'EVIDENCE' | 'ISSUE' | 'RCA' | 'FIX_PLAN' | 'PATCH' | 'VERIFICATION' | 'PR' | 'APPROVAL';
  factCategory: FactCategory;
  label: string;
  description?: string;
  status?: string;
  confidence?: ConfidenceLevel;
  timestamp: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface EvidenceEdge {
  from: string;
  to: string;
  relationship: 'TRIGGERED' | 'PRODUCED' | 'DETECTED' | 'DIAGNOSED' | 'GENERATED' | 'VERIFIED' | 'REQUIRED_BY' | 'EXPLAINS';
}

export interface EvidenceGraph {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}

export interface AutonomousHealthMetrics {
  activeCampaignsCount: number;
  queuedTasksCount: number;
  runningTasksCount: number;
  completedTasksLast24h: number;
  failedTasksLast24h: number;
  skippedTasksLast24h: number;
  pendingApprovalsCount: number;
  avgTaskDurationMs: number;
  lastEventTimestamp: string | null;
  healthy: boolean;
}

export const mockAutonomousEvents: AutonomousEvent[] = [
  {
    id: 'evt-101',
    projectId: 'proj-1',
    campaignId: 'camp-1',
    taskId: 'task-1',
    actorType: 'CAMPAIGN_ENGINE',
    actorId: 'engine-orchestrator',
    eventSource: 'CAMPAIGN',
    eventType: 'CAMPAIGN_STARTED',
    factCategory: 'ACTION',
    headline: 'Campaign camp-1 initialized for target https://sculra-demo.vercel.app',
    reason: 'Triggered by scheduled interval across responsive and security suites',
    confidence: 'HIGH',
    confidenceScore: 0.98,
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: 'evt-102',
    projectId: 'proj-1',
    campaignId: 'camp-1',
    actorType: 'STRATEGY_ENGINE',
    actorId: 'strat-prioritizer',
    eventSource: 'CAMPAIGN',
    eventType: 'STRATEGY_DECIDED',
    factCategory: 'INFERRED_CONCLUSION',
    headline: 'Prioritized /checkout over /blog based on historical failure rate (80% vs 0%)',
    reason: 'Checkout route experienced recent regressions and contains revenue-critical checkout journey',
    confidence: 'HIGH',
    confidenceScore: 0.94,
    evidenceIds: ['obs-cart-1'],
    createdAt: new Date(Date.now() - 28 * 60000).toISOString(),
  },
  {
    id: 'evt-103',
    projectId: 'proj-1',
    campaignId: 'camp-1',
    taskId: 'task-2',
    actorType: 'STRATEGY_ENGINE',
    actorId: 'strat-prioritizer',
    eventSource: 'CAMPAIGN',
    eventType: 'TARGET_SKIPPED',
    factCategory: 'INFERRED_CONCLUSION',
    headline: 'Skipped legacy analytics journey due to quarantine policy',
    reason: 'Target has 4 consecutive non-reproducible timeouts across recent runs',
    confidence: 'HIGH',
    confidenceScore: 0.9,
    skipReason: 'FLAKY_QUARANTINED',
    evidenceIds: ['ev-flaky-9'],
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
  },
  {
    id: 'evt-104',
    projectId: 'proj-1',
    campaignId: 'camp-1',
    taskId: 'task-1',
    testRunId: 'run-1',
    actorType: 'EXECUTION_WORKER',
    actorId: 'worker-node-1',
    eventSource: 'WORKER',
    eventType: 'OBSERVATION_CAPTURED',
    factCategory: 'OBSERVED_FACT',
    headline: 'Uncaught TypeError: Cannot read properties of undefined (reading "price")',
    reason: 'Observed runtime exception thrown during item count recalculation',
    confidence: 'HIGH',
    confidenceScore: 1.0,
    evidenceIds: ['ev-1', 'ev-2'],
    metadata: { route: '/cart', domElement: '#cart-total' },
    createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
  },
  {
    id: 'evt-105',
    projectId: 'proj-1',
    campaignId: 'camp-1',
    issueId: 'iss-1',
    actorType: 'RCA_ENGINE',
    actorId: 'rca-diagnoser',
    eventSource: 'WORKER',
    eventType: 'RCA_DIAGNOSED',
    factCategory: 'AI_HYPOTHESIS',
    headline: 'Probable cause: empty cart item payload missing price property in calculate.ts',
    reason: 'Model mapped stack trace in calculate.ts:12 to recent commit a1b2c3d',
    confidence: 'MEDIUM',
    confidenceScore: 0.85,
    evidenceIds: ['ev-1', 'ev-2'],
    metadata: { sourceFile: 'src/cart/calculate.ts', line: 12 },
    createdAt: new Date(Date.now() - 16 * 60000).toISOString(),
  },
  {
    id: 'evt-106',
    projectId: 'proj-1',
    remediationId: 'fix-1',
    issueId: 'iss-1',
    actorType: 'REMEDIATION_AGENT',
    actorId: 'coder-agent',
    eventSource: 'REMEDIATION',
    eventType: 'FIX_VERIFIED',
    factCategory: 'ACTION_RESULT',
    headline: 'Deterministic patch verified clean with zero test regressions',
    reason: '6 unit tests passed against isolated git worktree with 0 lint violations',
    confidence: 'HIGH',
    confidenceScore: 0.99,
    evidenceIds: ['ev-test-pass'],
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: 'evt-107',
    projectId: 'proj-1',
    remediationId: 'fix-1',
    approvalId: 'appr-1',
    actorType: 'REMEDIATION_AGENT',
    actorId: 'coder-agent',
    eventSource: 'REMEDIATION',
    eventType: 'APPROVAL_REQUESTED',
    factCategory: 'RECOMMENDATION',
    headline: 'Human approval requested for automated Pull Request generation',
    reason: 'Project policy mandates human operator review prior to opening PR',
    confidence: 'HIGH',
    confidenceScore: 1.0,
    metadata: { branch: 'sculra/fix/iss-1/null-pointer-cart', filesChanged: 1 },
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
  },
];

export const mockDecisions: DecisionRecord[] = [
  {
    id: 'dec-1',
    projectId: 'proj-1',
    campaignId: 'camp-1',
    decisionType: 'PRIORITIZATION',
    factCategory: 'INFERRED_CONCLUSION',
    headline: 'Prioritize /checkout and /auth flows over informational routes',
    why: 'Checkout and authentication workflows have direct business impact and 2 open regressions in prior runs.',
    whyNow: 'Campaign schedule allocation is 15 minutes; high-severity paths must run before budget exhaustion.',
    target: '/checkout',
    actionTaken: 'Enqueued checkout journey at priority rank 1',
    nextAction: 'Launch mobile and desktop visual regression checks',
    alternativesConsidered: ['Execute full breadth-first site crawl', 'Run security port scan first'],
    confidence: 'HIGH',
    confidenceScore: 0.94,
    evidenceIds: ['obs-cart-1'],
    policyChecks: [
      { rule: 'EXECUTION_BUDGET_RESPECTED', passed: true, details: 'Estimated duration 4m within 15m window' },
      { rule: 'RISK_SCORE_THRESHOLD', passed: true, details: 'Target risk score 88 >= 50' },
    ],
    actorType: 'STRATEGY_ENGINE',
    actorId: 'strat-prioritizer',
    createdAt: new Date(Date.now() - 28 * 60000).toISOString(),
  },
  {
    id: 'dec-2',
    projectId: 'proj-1',
    campaignId: 'camp-1',
    decisionType: 'TARGET_SKIP',
    factCategory: 'INFERRED_CONCLUSION',
    headline: 'Skip legacy analytics journey',
    why: 'Analytics endpoint has shown intermittent socket timeouts without code changes in the last 5 builds.',
    whyNow: 'Quarantine policy requires 3 clean baseline passes before re-admitting quarantined targets.',
    target: '/analytics/tracking',
    actionTaken: 'Marked journey as SKIPPED with reason FLAKY_QUARANTINED',
    nextAction: 'Schedule off-peak diagnostic probe to verify endpoint stability',
    alternativesConsidered: ['Run with 3 retries', 'Run in background thread'],
    skipReason: 'FLAKY_QUARANTINED',
    confidence: 'HIGH',
    confidenceScore: 0.9,
    evidenceIds: ['ev-flaky-9'],
    policyChecks: [
      { rule: 'FLAKY_QUARANTINE_ENABLED', passed: true, details: 'Project has flaky quarantine policy active' },
    ],
    actorType: 'STRATEGY_ENGINE',
    actorId: 'strat-prioritizer',
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
  },
  {
    id: 'dec-3',
    projectId: 'proj-1',
    decisionType: 'REMEDIATION_TRIGGER',
    factCategory: 'INFERRED_CONCLUSION',
    headline: 'Trigger Autonomous Remediation for Null Pointer in cart calculation',
    why: 'Crash is deterministic with 100% reproduction rate and isolated single-file stack trace.',
    whyNow: 'Bug severity is HIGH and affects user checkout completion.',
    target: 'src/cart/calculate.ts',
    actionTaken: 'Dispatched remediation agent with plan-and-verify workflow',
    nextAction: 'Await local verification test results in isolated worktree',
    alternativesConsidered: ['File manual issue without code generation', 'Quarantine checkout flow'],
    confidence: 'HIGH',
    confidenceScore: 0.96,
    evidenceIds: ['ev-1', 'ev-2'],
    policyChecks: [
      { rule: 'AUTO_FIX_ALLOWED', passed: true, details: 'Policy allows automated fix for high-reproduction crashes' },
      { rule: 'ALLOWED_PATHS_MATCH', passed: true, details: 'File src/cart/calculate.ts is inside permitted paths' },
    ],
    actorType: 'RCA_ENGINE',
    actorId: 'rca-diagnoser',
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
];

export const mockApprovals: HumanApprovalRecord[] = [
  {
    id: 'appr-1',
    projectId: 'proj-1',
    remediationId: 'fix-1',
    sourceSha: 'a1b2c3d4e5f678901234567890abcdef12345678',
    fixPlanVersion: 1,
    status: 'PENDING',
    requestedBy: 'Sculra Remediation Agent',
    requestedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    expiresAt: new Date(Date.now() + 23 * 3600000).toISOString(), // 23h remaining
    issueId: 'iss-1',
    issueTitle: 'Uncaught TypeError in calculate.ts on empty cart items',
    diffSummary: {
      filesChanged: 1,
      additions: 4,
      deletions: 1,
      files: ['src/cart/calculate.ts'],
    },
    patchUnified: `--- a/src/cart/calculate.ts\n+++ b/src/cart/calculate.ts\n@@ -12,4 +12,7 @@\n-  return items.reduce((sum, item) => sum + item.price, 0);\n+  if (!items || !Array.isArray(items)) {\n+    return 0;\n+  }\n+  return items.reduce((sum, item) => sum + (item.price || 0), 0);`,
    verificationPassed: true,
    securityChecksPassed: true,
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
  },
];

export const mockEvidenceGraph: EvidenceGraph = {
  nodes: [
    {
      id: 'node-camp-1',
      type: 'CAMPAIGN',
      factCategory: 'ACTION',
      label: 'Campaign camp-1',
      description: 'Scheduled Autonomous Campaign',
      status: 'RUNNING',
      confidence: 'HIGH',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    },
    {
      id: 'node-task-1',
      type: 'TASK',
      factCategory: 'ACTION',
      label: 'Task task-1 (Functional)',
      description: 'Run checkout verification journey',
      status: 'COMPLETED',
      confidence: 'HIGH',
      timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    },
    {
      id: 'node-ev-1',
      type: 'OBSERVATION',
      factCategory: 'OBSERVED_FACT',
      label: 'Console Error: TypeError',
      description: 'Cannot read properties of undefined (reading "price")',
      status: 'CAPTURED',
      confidence: 'HIGH',
      timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
    },
    {
      id: 'node-iss-1',
      type: 'ISSUE',
      factCategory: 'OBSERVED_FACT',
      label: 'Issue #1: Cart Crash',
      description: 'High-severity crash during price calculation',
      status: 'OPEN',
      confidence: 'HIGH',
      timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
    },
    {
      id: 'node-rca-1',
      type: 'RCA',
      factCategory: 'AI_HYPOTHESIS',
      label: 'Root Cause Hypothesis',
      description: 'Missing null guard in calculate.ts:12',
      status: 'DIAGNOSED',
      confidence: 'MEDIUM',
      timestamp: new Date(Date.now() - 16 * 60000).toISOString(),
    },
    {
      id: 'node-fix-1',
      type: 'PATCH',
      factCategory: 'ACTION_RESULT',
      label: 'Candidate Patch',
      description: 'Array guard + fallback price reduction',
      status: 'VERIFIED',
      confidence: 'HIGH',
      timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    },
    {
      id: 'node-appr-1',
      type: 'APPROVAL',
      factCategory: 'RECOMMENDATION',
      label: 'Human Approval Request',
      description: 'Awaiting operator review to submit PR',
      status: 'PENDING',
      confidence: 'HIGH',
      timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
    },
  ],
  edges: [
    { from: 'node-camp-1', to: 'node-task-1', relationship: 'TRIGGERED' },
    { from: 'node-task-1', to: 'node-ev-1', relationship: 'PRODUCED' },
    { from: 'node-ev-1', to: 'node-iss-1', relationship: 'DETECTED' },
    { from: 'node-iss-1', to: 'node-rca-1', relationship: 'DIAGNOSED' },
    { from: 'node-rca-1', to: 'node-fix-1', relationship: 'GENERATED' },
    { from: 'node-fix-1', to: 'node-appr-1', relationship: 'REQUIRED_BY' },
  ],
};

