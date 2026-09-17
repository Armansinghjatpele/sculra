// ==============================================================================
// Sculra CI/CD QA Gates & Developer Feedback Loop Types (worker/src/cicd/types.ts)
// ==============================================================================

export type CIProvider = 'github' | 'gitlab' | 'generic';

export type CIEventType = 'push' | 'pull_request' | 'ping' | 'manual';

export type CIGateVerdict =
  | 'PASS'
  | 'FAIL'
  | 'INSUFFICIENT_EVIDENCE'
  | 'ERROR'
  | 'CANCELLED';

export type CIGatePolicy =
  | 'BLOCK_ON_CRITICAL_ISSUE'
  | 'STRICT'
  | 'PERMISSIVE'
  | 'BLOCK_ON_REGRESSION';

export type CIGateReasonCode =
  | 'PASS_CRITERIA_MET'
  | 'CRITICAL_SECURITY_ISSUE'
  | 'CRITICAL_BLOCKER_DETECTED'
  | 'HIGH_SEVERITY_FINDING'
  | 'NEW_REGRESSION_DETECTED'
  | 'SCORE_BELOW_THRESHOLD'
  | 'RECOMMENDATION_DO_NOT_RELEASE'
  | 'RECOMMENDATION_CAUTION_EXCEEDED'
  | 'INSUFFICIENT_EVIDENCE_COVERAGE'
  | 'EXECUTION_CANCELLED'
  | 'EXECUTION_ERROR'
  | 'MAX_ATTEMPTS_EXCEEDED';

export interface RepositoryIdentity {
  owner: string;
  name: string;
  fullName: string;
  cloneUrl?: string;
  htmlUrl?: string;
  defaultBranch?: string;
}

export interface CommitIdentity {
  sha: string;
  shortSha: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
  branch?: string;
  url?: string;
}

export interface PullRequestIdentity {
  number: number;
  title: string;
  headSha: string;
  headBranch: string;
  baseBranch: string;
  sender: string;
  url?: string;
}

export interface NormalizedCIEvent {
  deliveryId: string;
  provider: CIProvider;
  eventType: CIEventType;
  action?: string;
  repository: RepositoryIdentity;
  commit?: CommitIdentity;
  pullRequest?: PullRequestIdentity;
  sender?: string;
  receivedAt: string;
  rawPayloadTruncated?: boolean;
}

export interface ProjectCIConfig {
  projectId: string;
  organizationId?: string | null;
  name?: string;
  ciEnabled: boolean;
  githubRepoOwner?: string | null;
  githubRepoName?: string | null;
  ciDefaultBranch: string;
  ciTriggerOnPush: boolean;
  ciTriggerOnPr: boolean;
  ciGatePolicy: CIGatePolicy;
  ciWebhookSecret?: string | null;
  targetUrl?: string;
  sourceUrl?: string;
  repositoryUrl?: string;
}

export interface CIGateEvaluationOptions {
  minScoreThreshold?: number;
  allowCaution?: boolean;
  maxCriticalIssues?: number;
  maxRegressions?: number;
  requireHighConfidence?: boolean;
}

export interface CIGateBlocker {
  id: string;
  title: string;
  severity: string;
  reason: string;
}

export interface CIGateDecision {
  verdict: CIGateVerdict;
  gatePolicy: CIGatePolicy;
  passed: boolean;
  releaseVerdict?: string;
  overallScore: number | null; // Real score or null; never fabricated
  reasonCodes: CIGateReasonCode[];
  summaryMessage: string;
  criticalFindingsCount: number;
  highFindingsCount: number;
  regressionCount: number;
  recoveriesCount: number;
  evidenceStatus: 'SUFFICIENT' | 'INSUFFICIENT' | 'NO_DATA';
  blockers: CIGateBlocker[];
  regressions: string[];
  evaluatedAt: string;
}

export interface CIFeedbackDomainScore {
  domain: string;
  score?: number;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  notes?: string;
}

export interface CIFeedbackStructuredDetails {
  verdict: CIGateVerdict;
  overallScore: number | null;
  releaseVerdict?: string;
  policy: CIGatePolicy;
  commitSha?: string;
  branch?: string;
  pullRequestNumber?: number;
  domains: CIFeedbackDomainScore[];
  blockers: CIGateBlocker[];
  regressions: string[];
  reasons: CIGateReasonCode[];
  dashboardUrl?: string;
}

export interface CIFeedback {
  verdict: CIGateVerdict;
  headline: string;
  markdownSummary: string;
  structuredDetails: CIFeedbackStructuredDetails;
  checkRunStatus?: 'completed';
  checkRunConclusion?: 'success' | 'failure' | 'neutral' | 'action_required' | 'cancelled';
}

export interface WebhookProcessingResult {
  accepted: boolean;
  statusCode: number;
  deliveryId: string;
  status: 'RECEIVED' | 'PROCESSING' | 'SCHEDULED' | 'IGNORED' | 'FAILED' | 'COMPLETED';
  campaignId?: string;
  reason?: string;
  error?: string;
}
