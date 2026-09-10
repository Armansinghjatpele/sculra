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
  category: 'functional' | 'visual' | 'responsive' | 'reliability' | 'security' | 'api';
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
}

export interface ScoreDeduction {
  category: 'functional' | 'visual' | 'responsive' | 'reliability' | 'coverage' | 'security' | 'api';
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
