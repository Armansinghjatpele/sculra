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
    | 'release_report';
  title: string;
  url?: string;
  message?: string;
  metadata?: Record<string, any>;
  storagePath?: string;
  createdAt: string;
}

export interface ReleaseBlocker {
  id: string;
  title: string;
  reason: string;
  category: 'functional' | 'visual' | 'responsive' | 'reliability';
  severity: 'critical' | 'high';
  evidenceSummary: string;
  relatedIssueFingerprints?: string[];
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
