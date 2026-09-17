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

