// ==============================================================================
// Sculra AI Root Cause Analysis & Remediation Types (worker/src/remediation/types.ts)
// ==============================================================================

import { BugObservation, BugSeverity } from '../issues/types';
import { CampaignDomain } from '../campaign/types';

export type DiagnosisStatus =
  | 'NOT_ANALYZED'
  | 'ANALYZING'
  | 'DIAGNOSED'
  | 'PARTIAL'
  | 'INSUFFICIENT_EVIDENCE'
  | 'FAILED';

export type DiagnosisConfidence =
  | 'VERY_LOW'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'VERY_HIGH';

export type RootCauseHypothesisStatus =
  | 'CANDIDATE'
  | 'SUPPORTED'
  | 'WEAKLY_SUPPORTED'
  | 'REJECTED'
  | 'UNRESOLVED';

export type HypothesisCategory =
  | 'RECENT_CODE_CHANGE'
  | 'REGRESSION'
  | 'RUNTIME_EXCEPTION'
  | 'INVALID_STATE'
  | 'MISSING_ERROR_HANDLING'
  | 'VALIDATION_LOGIC'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'API_CONTRACT'
  | 'DATABASE'
  | 'NETWORK'
  | 'ROUTING'
  | 'UI_STATE'
  | 'DOM'
  | 'RESPONSIVE_LAYOUT'
  | 'ACCESSIBILITY'
  | 'PERFORMANCE'
  | 'DEPENDENCY'
  | 'CONFIGURATION'
  | 'UNKNOWN';

export type SourceProvenance =
  | 'DIRECT_QA_EVIDENCE'
  | 'RUNTIME_ERROR_STACK'
  | 'NETWORK_EVIDENCE'
  | 'DOM_BEHAVIOR'
  | 'CHANGED_CODE'
  | 'STATIC_CODE_RELATIONSHIP'
  | 'HISTORICAL_QA_EVIDENCE'
  | 'PRODUCT_MODEL'
  | 'AI_INFERENCE';

export type ChangeRelationship =
  | 'DIRECT_CHANGE'
  | 'TRANSITIVE_CHANGE'
  | 'HISTORICAL_CHANGE_ASSOCIATION'
  | 'NO_KNOWN_CHANGE_RELATIONSHIP'
  | 'UNKNOWN';

export type FixRiskAssessment = 'LOW' | 'MEDIUM' | 'HIGH' | 'SECURITY_RISK';

/**
 * Normalized failure observation representing an empirical failure fact.
 */
export interface FailureObservation {
  issueId?: string;
  testRunId?: string;
  campaignId?: string;
  projectId?: string;
  url: string;
  route?: string;
  apiEndpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  selector?: string;
  action?: string;
  errorMessage?: string;
  stackTrace?: string;
  consoleError?: string;
  networkError?: string;
  screenshotRef?: string;
  viewport?: string;
  role?: string;
  timestamp: string;
  fingerprint: string;
  bugType: string;
  severity: BugSeverity;
  sourceObservation?: BugObservation;
}

/**
 * Parsed stack trace frame.
 */
export interface StackTraceFrame {
  filePath: string;
  line: number;
  column?: number;
  functionName?: string;
  methodName?: string;
  moduleName?: string;
  raw: string;
  isRuntimeLocation: boolean;
  sourceMapped?: boolean;
  originalFilePath?: string;
  originalLine?: number;
  originalColumn?: number;
}

/**
 * Code context file retrieved strictly read-only.
 */
export interface RelevantFile {
  path: string;
  content: string;
  source: 'STACK_TRACE' | 'CHANGED_FILE' | 'ROUTE_HANDLER' | 'API_HANDLER' | 'IMPORTED_MODULE' | 'PRODUCT_MODEL' | 'HISTORICAL';
  confidence: number;
  language: string;
  sizeBytes: number;
  lineCount: number;
}

/**
 * Relevant code symbol discovered in code context.
 */
export interface RelevantSymbol {
  name: string;
  kind: 'function' | 'method' | 'class' | 'route_handler' | 'component' | 'variable';
  filePath: string;
  line?: number;
  exported: boolean;
}

/**
 * Code context bundle.
 */
export interface CodeContext {
  files: RelevantFile[];
  symbols: RelevantSymbol[];
  importGraph: Array<{ from: string; to: string }>;
  isPartial: boolean;
  partialReason?: string;
  totalBytes: number;
}

/**
 * Relevant change context from Prompt 32 Change Intelligence.
 */
export interface RelevantChange {
  file: string;
  changeType: 'ADDED' | 'MODIFIED' | 'DELETED';
  commitSha: string;
  author?: string;
  message?: string;
  diffSnippet?: string;
  additions: number;
  deletions: number;
  relationship: ChangeRelationship;
  affectedSymbols?: string[];
  affectedRoutes?: string[];
}

/**
 * Change context bundle.
 */
export interface ChangeContext {
  commitSha?: string;
  baseSha?: string;
  pullRequestNumber?: number;
  branch?: string;
  relevantChanges: RelevantChange[];
  riskScore?: number;
  riskLevel?: string;
  hasRelevantCodeChange: boolean;
}

/**
 * Historical failure occurrence.
 */
export interface HistoricalOccurrence {
  testRunId: string;
  observedAt: string;
  fingerprint: string;
  url?: string;
  errorMessage?: string;
}

/**
 * Historical context bundle from Prompt 28 Historical QA Memory.
 */
export interface HistoricalContext {
  isHistorical: true; // Strictly labeled
  isRecurring: boolean;
  isRecentRegression: boolean;
  totalOccurrences: number;
  consecutiveFailures: number;
  lastSeenRunId?: string;
  stabilityState: string;
  previousOccurrences: HistoricalOccurrence[];
  similarFingerprints: string[];
}

/**
 * Root-cause evidence record with strict source provenance.
 */
export interface RootCauseEvidence {
  id: string;
  provenance: SourceProvenance;
  title: string;
  statement: string;
  observedFact: boolean;
  payload?: Record<string, any>;
  observedAt: string;
}

/**
 * Root cause hypothesis tested against facts.
 */
export interface RootCauseHypothesis {
  id: string;
  category: HypothesisCategory;
  statement: string;
  status: RootCauseHypothesisStatus;
  confidence: DiagnosisConfidence;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  filePaths: string[];
  symbols: string[];
  sourceReferences: SourceProvenance[];
  affectedTarget?: string;
  affectedCode?: string;
  rejectionReason?: string;
}

/**
 * Grounded diagnosis of the bug.
 */
export interface BugDiagnosis {
  summary: string;
  category: HypothesisCategory;
  status: DiagnosisStatus;
  confidence: DiagnosisConfidence;
  directLocations: Array<{ filePath: string; line?: number; functionName?: string }>;
  explanation: string;
  limitations: string[];
  provenanceTrail: SourceProvenance[];
}

/**
 * Structured step in a grounded fix plan.
 */
export interface FixStep {
  stepNumber: number;
  description: string;
  targetFile?: string;
  targetSymbol?: string;
  action: 'INSPECT' | 'HANDLE_ERROR' | 'VALIDATE_INPUT' | 'UPDATE_LOGIC' | 'ADD_TEST' | 'REVERT_CHANGE';
  rationale: string;
  safetyNotes?: string;
}

/**
 * Grounded fix plan.
 */
export interface FixPlan {
  summary: string;
  affectedFiles: string[];
  affectedSymbols: string[];
  steps: FixStep[];
  expectedBehavior: string;
  riskAssessment: FixRiskAssessment;
  securityHazards?: string[];
  requiredTests: string[];
}

/**
 * Verification plan mapping diagnosis to QA domains and existing targets.
 */
export interface VerificationPlan {
  suggestedDomains: CampaignDomain[];
  existingTargets: string[];
  regressionTests: string[];
}

/**
 * Full master remediation analysis.
 */
export interface RemediationAnalysis {
  id: string;
  organizationId?: string;
  projectId: string;
  issueId: string;
  campaignId?: string;
  testRunId?: string;
  fingerprint: string;
  analysisVersion: number;
  status: DiagnosisStatus;
  confidence: DiagnosisConfidence;
  diagnosis: BugDiagnosis;
  hypotheses: RootCauseHypothesis[];
  fixPlan: FixPlan;
  verificationPlan: VerificationPlan;
  codeContextSummary: {
    filesRetrieved: number;
    symbolsIdentified: number;
    isPartial: boolean;
    partialReason?: string;
  };
  changeContextSummary: {
    commitSha?: string;
    hasRelevantChanges: boolean;
    relationship: ChangeRelationship;
  };
  historicalContextSummary: {
    isRecurring: boolean;
    isRecentRegression: boolean;
    totalOccurrences: number;
  };
  telemetry: {
    provider: string;
    model: string;
    latencyMs: number;
    tokensUsed?: number;
    aiRequestCount: number;
    deterministicFallback: boolean;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Context passed into RemediationAnalyzer.
 */
export interface RemediationAnalysisContext {
  observation: FailureObservation;
  projectId: string;
  organizationId?: string;
  campaignId?: string;
  testRunId?: string;
  fileMap?: Map<string, string>; // In-memory or pre-fetched source file map
  sourceMaps?: Map<string, string>; // Source map content map
  changeAnalysis?: any;
  historicalRuns?: any[];
  historicalFindings?: any[];
  productModel?: any;
  githubToken?: string;
  repoOwner?: string;
  repoName?: string;
}
