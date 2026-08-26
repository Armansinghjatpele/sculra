// ==============================================================================
// Sculra Reusable Demo Data Structures & Interfaces (frontend/lib/demoData.ts)
// ==============================================================================

export interface Project {
  id: string;
  name: string;
  type: 'website' | 'github' | 'zip' | 'desktop' | 'api';
  status: 'passed' | 'running' | 'failed' | 'needs_review';
  lastTestRun?: string;
  releaseScore: number;
  openIssuesCount: number;
  url?: string;
  repoUrl?: string;
  environment?: string;
  branch?: string;
}

export interface TestRun {
  id: string;
  projectId: string;
  projectName: string;
  status: 'passed' | 'running' | 'failed' | 'needs_review';
  issuesCount: number;
  releaseScore: number;
  durationMs: number;
  createdAt: string;
}

export interface Issue {
  id: string;
  projectId: string;
  projectName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detectedAt: string;
  status: 'open' | 'resolved' | 'ignored';
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
