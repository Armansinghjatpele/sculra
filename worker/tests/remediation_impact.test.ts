// ==============================================================================
// Sculra Remediation Impact & Hypothesis Tests (worker/tests/remediation_impact.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { RemediationCandidateGenerator } from '../src/remediation/candidate-generator';
import { HypothesisValidator } from '../src/remediation/hypothesis-validator';
import { ConfidenceCalculator } from '../src/remediation/confidence';
import { FixPlanner } from '../src/remediation/fix-plan';
import { VerificationPlanner } from '../src/remediation/verification-plan';
import { AIOutputValidator } from '../src/remediation/ai-validator';
import { FailureObservation, CodeContext, ChangeContext, HistoricalContext, RootCauseEvidence, RootCauseHypothesis } from '../src/remediation/types';

describe('Remediation Impact & Hypothesis Tests', () => {
  const mockObservation: FailureObservation = {
    url: 'https://app.example.com/checkout',
    apiEndpoint: '/api/checkout',
    httpMethod: 'POST',
    statusCode: 500,
    errorMessage: 'Payment gateway rejected charge with invalid intent',
    timestamp: '2026-09-17T12:00:00Z',
    fingerprint: 'fp-checkout-500',
    bugType: 'API_HTTP_5XX',
    severity: 'critical',
  };

  const mockEvidence: RootCauseEvidence[] = [
    {
      id: 'ev-failure-primary',
      provenance: 'DIRECT_QA_EVIDENCE',
      title: 'Observed 500',
      statement: 'POST /api/checkout returned HTTP 500',
      observedFact: true,
      observedAt: '2026-09-17T12:00:00Z',
    },
    {
      id: 'ev-network-failure',
      provenance: 'NETWORK_EVIDENCE',
      title: 'Network 500',
      statement: 'Endpoint: POST /api/checkout Status: 500',
      observedFact: true,
      observedAt: '2026-09-17T12:00:00Z',
    },
  ];

  const mockCodeContext: CodeContext = {
    files: [
      {
        path: 'app/api/checkout/route.ts',
        content: 'export async function POST(req: Request) { /* checkout handler */ }',
        source: 'ROUTE_HANDLER',
        confidence: 0.9,
        language: 'typescript',
        sizeBytes: 150,
        lineCount: 10,
      },
    ],
    symbols: [
      {
        name: 'POST',
        kind: 'route_handler',
        filePath: 'app/api/checkout/route.ts',
        exported: true,
      },
    ],
    importGraph: [],
    isPartial: false,
    totalBytes: 150,
  };

  describe('Deterministic Candidate Generation', () => {
    it('generates RECENT_CODE_CHANGE candidate when failure matches modified handler', () => {
      const changeContext: ChangeContext = {
        commitSha: 'commit-abc123',
        hasRelevantCodeChange: true,
        relevantChanges: [
          {
            file: 'app/api/checkout/route.ts',
            changeType: 'MODIFIED',
            commitSha: 'commit-abc123',
            additions: 10,
            deletions: 2,
            relationship: 'DIRECT_CHANGE',
            affectedSymbols: ['POST'],
          },
        ],
      };

      const historyContext: HistoricalContext = {
        isHistorical: true,
        isRecurring: false,
        isRecentRegression: false,
        totalOccurrences: 1,
        consecutiveFailures: 1,
        stabilityState: 'CURRENT_FAILURE',
        previousOccurrences: [],
        similarFingerprints: [],
      };

      const candidates = RemediationCandidateGenerator.generateCandidates(
        mockObservation,
        mockEvidence,
        mockCodeContext,
        changeContext,
        historyContext
      );

      expect(candidates.length).toBeGreaterThan(0);
      const recentChange = candidates.find((c) => c.category === 'RECENT_CODE_CHANGE');
      expect(recentChange).toBeDefined();
      expect(recentChange?.filePaths).toContain('app/api/checkout/route.ts');
      expect(recentChange?.symbols).toContain('POST');
      expect(recentChange?.confidence).toBe('HIGH');
    });

    it('generates CORS configuration candidate when network error mentions CORS', () => {
      const corsObs: FailureObservation = {
        ...mockObservation,
        networkError: 'Access to fetch at https://api.example.com has been blocked by CORS policy',
      };

      const emptyChanges: ChangeContext = { hasRelevantCodeChange: false, relevantChanges: [] };
      const emptyHistory: HistoricalContext = {
        isHistorical: true,
        isRecurring: false,
        isRecentRegression: false,
        totalOccurrences: 1,
        consecutiveFailures: 1,
        stabilityState: 'CURRENT_FAILURE',
        previousOccurrences: [],
        similarFingerprints: [],
      };

      const candidates = RemediationCandidateGenerator.generateCandidates(
        corsObs,
        mockEvidence,
        mockCodeContext,
        emptyChanges,
        emptyHistory
      );

      const corsCand = candidates.find((c) => c.category === 'CONFIGURATION');
      expect(corsCand).toBeDefined();
      expect(corsCand?.statement).toContain('CORS');
    });
  });

  describe('Hypothesis Validator & Contradiction Filtering', () => {
    it('rejects hypothesis that is contradicted by the empirical timeline', () => {
      const navFailure: FailureObservation = {
        url: 'https://app.example.com/checkout',
        bugType: 'NAVIGATION_FAILURE',
        errorMessage: 'Navigation to page timed out before request was made',
        timestamp: '2026-09-17T12:00:00Z',
        fingerprint: 'fp-nav-timeout',
        severity: 'critical',
      };

      const contradictedHypothesis: RootCauseHypothesis = {
        id: 'hypo-1',
        category: 'API_CONTRACT',
        statement: 'Payment API returned 500 error causing page crash',
        status: 'CANDIDATE',
        confidence: 'HIGH',
        supportingEvidenceIds: ['ev-failure-primary'],
        contradictingEvidenceIds: [],
        filePaths: [],
        symbols: [],
        sourceReferences: ['AI_INFERENCE'],
      };

      const emptyChanges: ChangeContext = { hasRelevantCodeChange: false, relevantChanges: [] };
      const emptyHistory: HistoricalContext = {
        isHistorical: true,
        isRecurring: false,
        isRecentRegression: false,
        totalOccurrences: 1,
        consecutiveFailures: 1,
        stabilityState: 'CURRENT_FAILURE',
        previousOccurrences: [],
        similarFingerprints: [],
      };

      const validated = HypothesisValidator.validateHypotheses(
        [contradictedHypothesis],
        navFailure,
        mockEvidence,
        mockCodeContext,
        emptyChanges,
        emptyHistory
      );

      expect(validated[0].status).toBe('REJECTED');
      expect(validated[0].rejectionReason).toContain('navigation failed prior to any API network call');
    });
  });

  describe('Deterministic Confidence Calculator', () => {
    it('computes HIGH/VERY_HIGH confidence when direct evidence, stack trace, and code change align', () => {
      const changeContext: ChangeContext = {
        commitSha: 'commit-123',
        hasRelevantCodeChange: true,
        relevantChanges: [{ file: 'app/api/checkout/route.ts', changeType: 'MODIFIED', commitSha: 'c1', additions: 5, deletions: 1, relationship: 'DIRECT_CHANGE' }],
      };

      const historyContext: HistoricalContext = {
        isHistorical: true,
        isRecurring: true,
        isRecentRegression: true,
        totalOccurrences: 3,
        consecutiveFailures: 2,
        stabilityState: 'RECURRING',
        previousOccurrences: [],
        similarFingerprints: [],
      };

      const supportedHypo: RootCauseHypothesis = {
        id: 'h1',
        category: 'RECENT_CODE_CHANGE',
        statement: 'Recent change caused payment failure',
        status: 'SUPPORTED',
        confidence: 'HIGH',
        supportingEvidenceIds: ['ev-failure-primary', 'ev-network-failure'],
        contradictingEvidenceIds: [],
        filePaths: ['app/api/checkout/route.ts'],
        symbols: ['POST'],
        sourceReferences: ['DIRECT_QA_EVIDENCE', 'CHANGED_CODE'],
      };

      const conf = ConfidenceCalculator.evaluate(
        mockObservation,
        supportedHypo,
        mockCodeContext,
        changeContext,
        historyContext
      );

      expect(conf.level === 'HIGH' || conf.level === 'VERY_HIGH').toBe(true);
      expect(conf.score).toBeGreaterThanOrEqual(60);
      expect(conf.positiveFactors.length).toBeGreaterThan(2);
    });

    it('penalizes confidence when context is partial or evidence is missing', () => {
      const partialCodeContext: CodeContext = {
        ...mockCodeContext,
        isPartial: true,
        partialReason: 'Limit exceeded',
      };

      const emptyChanges: ChangeContext = { hasRelevantCodeChange: false, relevantChanges: [] };
      const emptyHistory: HistoricalContext = {
        isHistorical: true,
        isRecurring: false,
        isRecentRegression: false,
        totalOccurrences: 1,
        consecutiveFailures: 1,
        stabilityState: 'CURRENT_FAILURE',
        previousOccurrences: [],
        similarFingerprints: [],
      };

      const conf = ConfidenceCalculator.evaluate(
        { ...mockObservation, errorMessage: undefined, statusCode: undefined },
        undefined,
        partialCodeContext,
        emptyChanges,
        emptyHistory
      );

      expect(conf.score).toBeLessThan(60);
      expect(conf.negativeFactors.some((f) => f.includes('Partial code context'))).toBe(true);
    });
  });

  describe('Fix Plan Safety & Verification Planning', () => {
    it('detects SECURITY_RISK if a proposed fix recommends disabling auth or bypassing security', () => {
      const unsafePlan = {
        summary: 'Bypass authorization to fix 403',
        affectedFiles: ['auth.ts'],
        affectedSymbols: [],
        steps: [
          {
            stepNumber: 1,
            description: 'Disable auth checks on the checkout endpoint to allow access',
            action: 'UPDATE_LOGIC' as const,
            rationale: 'Temporary workaround',
          },
        ],
        expectedBehavior: 'Endpoint returns 200',
        riskAssessment: 'LOW' as const,
        requiredTests: [],
      };

      const audited = FixPlanner.auditPlanSafety(unsafePlan);
      expect(audited.riskAssessment).toBe('SECURITY_RISK');
      expect(audited.securityHazards?.length).toBeGreaterThan(0);
    });

    it('generates verification plan mapping failure to API and FUNCTIONAL domains', () => {
      const plan = VerificationPlanner.generateVerificationPlan(
        { category: 'RECENT_CODE_CHANGE' } as any,
        mockObservation
      );

      expect(plan.suggestedDomains).toContain('API');
      expect(plan.suggestedDomains).toContain('FUNCTIONAL');
      expect(plan.existingTargets).toContain('https://app.example.com/checkout');
      expect(plan.regressionTests.length).toBeGreaterThan(0);
    });
  });

  describe('AI Output Validator', () => {
    it('strips hallucinated files, symbols, and evidence IDs from raw AI response', () => {
      const rawAi = {
        diagnosis: {
          summary: 'Database connection failed',
          category: 'DATABASE',
          confidence: 'HIGH',
          status: 'DIAGNOSED',
          explanation: 'Connection timeout on non-existent file',
        },
        hypotheses: [
          {
            statement: 'Bug in payment handler',
            category: 'RECENT_CODE_CHANGE',
            status: 'SUPPORTED',
            confidence: 'HIGH',
            supportingEvidenceIds: ['ev-failure-primary', 'fake-evidence-id-999'],
            contradictingEvidenceIds: [],
            filePaths: ['app/api/checkout/route.ts', 'hallucinated/phantom/file.ts'],
            symbols: ['POST', 'phantomSymbol'],
          },
        ],
        fixPlan: {
          summary: 'Fix payment handler',
          steps: [],
        },
        verificationPlan: {
          qaDomains: ['API'],
          targets: ['https://app.example.com/checkout', 'https://fake-target.com'],
          tests: ['Run test'],
        },
      };

      const validated = AIOutputValidator.validate(
        rawAi,
        mockCodeContext,
        mockEvidence,
        ['https://app.example.com/checkout']
      );

      expect(validated.wasGroundingAdjusted).toBe(true);
      expect(validated.hypotheses[0].filePaths).toContain('app/api/checkout/route.ts');
      expect(validated.hypotheses[0].filePaths).not.toContain('hallucinated/phantom/file.ts');
      expect(validated.hypotheses[0].symbols).toContain('POST');
      expect(validated.hypotheses[0].symbols).not.toContain('phantomSymbol');
      expect(validated.hypotheses[0].supportingEvidenceIds).toContain('ev-failure-primary');
      expect(validated.hypotheses[0].supportingEvidenceIds).not.toContain('fake-evidence-id-999');
      expect(validated.verificationPlan.existingTargets).toContain('https://app.example.com/checkout');
      expect(validated.verificationPlan.existingTargets).not.toContain('https://fake-target.com');
    });
  });
});
