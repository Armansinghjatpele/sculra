import { describe, it, expect } from 'vitest';
import { CIGateEngine } from '../src/cicd/gate';
import { CIFeedbackGenerator } from '../src/cicd/feedback';
import { CampaignSummary } from '../src/campaign/types';

describe('CI/CD Gate Engine & Feedback Tests', () => {
  const baseSummary: CampaignSummary = {
    campaignId: 'camp-123',
    projectId: 'proj-456',
    status: 'COMPLETED',
    objective: 'release_readiness',
    startedAt: '2026-09-17T10:00:00Z',
    completedAt: '2026-09-17T10:05:00Z',
    durationMs: 300000,
    domainsExecuted: ['discovery', 'journey', 'visual', 'release'],
    domainsUnavailable: [],
    tasksPlanned: 10,
    tasksExecuted: 10,
    tasksPassed: 10,
    tasksFailed: 0,
    tasksBlocked: 0,
    tasksSkipped: 0,
    criticalWorkflowsTested: 3,
    criticalWorkflowsUntested: 0,
    newIssuesCount: 0,
    regressionsCount: 0,
    recoveriesCount: 1,
    recurringDefectsCount: 0,
    unstableTargetsCount: 0,
    evidenceCount: 15,
    coverageSummary: {
      taskCoveragePct: 100,
      domainCoveragePct: 100,
      pagesCovered: 5,
      apisCovered: 4,
      workflowsCovered: 3,
      rolesCovered: 1,
      viewportsCovered: 2,
    },
    terminationReason: 'ALL_TASKS_COMPLETED',
    releaseAssessment: {
      testRunId: 'tr-1',
      projectId: 'proj-456',
      scoringVersion: '1.0',
      overallScore: 94,
      scores: {
        overall: 94,
        functional: 95,
        visual: 92,
        responsive: 95,
        reliability: 96,
        coverage: 92,
      },
      recommendation: 'RELEASE',
      riskLevel: 'LOW',
      confidenceLevel: 'HIGH',
      blockers: [],
      breakdown: {} as any,
      evaluatedAt: '2026-09-17T10:05:00Z',
    },
  };

  describe('1. Policy: BLOCK_ON_CRITICAL_ISSUE', () => {
    it('passes when no critical blockers exist', () => {
      const decision = CIGateEngine.evaluateGate(baseSummary, 'BLOCK_ON_CRITICAL_ISSUE');
      expect(decision.verdict).toBe('PASS');
      expect(decision.passed).toBe(true);
      expect(decision.reasonCodes).toContain('PASS_CRITERIA_MET');
      expect(decision.criticalFindingsCount).toBe(0);
    });

    it('fails when critical blocker is present', () => {
      const failingSummary: CampaignSummary = {
        ...baseSummary,
        releaseAssessment: {
          ...baseSummary.releaseAssessment!,
          overallScore: 68,
          recommendation: 'DO_NOT_RELEASE',
          riskLevel: 'CRITICAL',
          blockers: [
            {
              id: 'b-1',
              title: 'Checkout Payment Failed (500)',
              reason: 'Payment API returns 500 on valid card submission',
              category: 'functional',
              severity: 'critical',
              evidenceSummary: 'POST /api/pay responded with HTTP 500',
            },
          ],
        },
      };

      const decision = CIGateEngine.evaluateGate(failingSummary, 'BLOCK_ON_CRITICAL_ISSUE');
      expect(decision.verdict).toBe('FAIL');
      expect(decision.passed).toBe(false);
      expect(decision.reasonCodes).toContain('CRITICAL_BLOCKER_DETECTED');
      expect(decision.reasonCodes).toContain('RECOMMENDATION_DO_NOT_RELEASE');
      expect(decision.criticalFindingsCount).toBe(1);
    });
  });

  describe('2. Policy: STRICT', () => {
    it('passes with high score and zero defects', () => {
      const decision = CIGateEngine.evaluateGate(baseSummary, 'STRICT', { minScoreThreshold: 85 });
      expect(decision.verdict).toBe('PASS');
      expect(decision.passed).toBe(true);
    });

    it('fails if regressions are detected', () => {
      const regSummary: CampaignSummary = {
        ...baseSummary,
        regressionsCount: 1,
      };
      const decision = CIGateEngine.evaluateGate(regSummary, 'STRICT');
      expect(decision.verdict).toBe('FAIL');
      expect(decision.reasonCodes).toContain('NEW_REGRESSION_DETECTED');
    });

    it('fails if score is below min threshold', () => {
      const lowScoreSummary: CampaignSummary = {
        ...baseSummary,
        releaseAssessment: {
          ...baseSummary.releaseAssessment!,
          overallScore: 78,
        },
      };
      const decision = CIGateEngine.evaluateGate(lowScoreSummary, 'STRICT', { minScoreThreshold: 80 });
      expect(decision.verdict).toBe('FAIL');
      expect(decision.reasonCodes).toContain('SCORE_BELOW_THRESHOLD');
    });
  });

  describe('3. Policy: PERMISSIVE', () => {
    it('tolerates small number of critical findings under threshold', () => {
      const summaryWithOneIssue: CampaignSummary = {
        ...baseSummary,
        releaseAssessment: {
          ...baseSummary.releaseAssessment!,
          recommendation: 'RELEASE_WITH_CAUTION',
          blockers: [
            {
              id: 'b-1',
              title: 'Minor auth session token expiry notice',
              reason: 'Session warning displayed late',
              category: 'functional',
              severity: 'critical',
              evidenceSummary: 'Late display',
            },
          ],
        },
      };

      const decision = CIGateEngine.evaluateGate(summaryWithOneIssue, 'PERMISSIVE', { maxCriticalIssues: 2 });
      expect(decision.verdict).toBe('PASS');
      expect(decision.passed).toBe(true);
    });
  });

  describe('4. Policy: BLOCK_ON_REGRESSION', () => {
    it('fails on regression even if score is high', () => {
      const regSummary: CampaignSummary = {
        ...baseSummary,
        regressionsCount: 2,
      };
      const decision = CIGateEngine.evaluateGate(regSummary, 'BLOCK_ON_REGRESSION');
      expect(decision.verdict).toBe('FAIL');
      expect(decision.reasonCodes).toContain('NEW_REGRESSION_DETECTED');
      expect(decision.regressionCount).toBe(2);
    });
  });

  describe('5. Edge Cases & Special States', () => {
    it('emits INSUFFICIENT_EVIDENCE when confidence is low or zero tasks executed', () => {
      const lowConfidenceSummary: CampaignSummary = {
        ...baseSummary,
        tasksExecuted: 0,
        releaseAssessment: {
          ...baseSummary.releaseAssessment!,
          confidenceLevel: 'INSUFFICIENT',
          recommendation: 'INSUFFICIENT_EVIDENCE',
        },
      };
      const decision = CIGateEngine.evaluateGate(lowConfidenceSummary);
      expect(decision.verdict).toBe('INSUFFICIENT_EVIDENCE');
      expect(decision.reasonCodes).toContain('INSUFFICIENT_EVIDENCE_COVERAGE');
    });

    it('emits CANCELLED when execution was aborted by user', () => {
      const cancelledSummary: CampaignSummary = {
        ...baseSummary,
        status: 'CANCELLED',
        terminationReason: 'CANCELLED_BY_USER',
      };
      const decision = CIGateEngine.evaluateGate(cancelledSummary);
      expect(decision.verdict).toBe('CANCELLED');
      expect(decision.reasonCodes).toContain('EXECUTION_CANCELLED');
    });

    it('emits ERROR when summary is null', () => {
      const decision = CIGateEngine.evaluateGate(null);
      expect(decision.verdict).toBe('ERROR');
      expect(decision.reasonCodes).toContain('EXECUTION_ERROR');
    });
  });

  describe('6. Developer Feedback Synthesis', () => {
    it('formats passing feedback with markdown table and GitHub check run status', () => {
      const decision = CIGateEngine.evaluateGate(baseSummary, 'BLOCK_ON_CRITICAL_ISSUE');
      const feedback = CIFeedbackGenerator.generateFeedback(decision, baseSummary, {
        deliveryId: 'del-101',
        provider: 'github',
        eventType: 'push',
        repository: { owner: 'acme', name: 'web', fullName: 'acme/web' },
        commit: {
          sha: '1234567890abcdef',
          shortSha: '1234567',
          message: 'Add responsive cart page',
          branch: 'main',
        },
        receivedAt: new Date().toISOString(),
      });

      expect(feedback.verdict).toBe('PASS');
      expect(feedback.checkRunConclusion).toBe('success');
      expect(feedback.headline).toContain('Sculra CI Gate Passed');
      expect(feedback.markdownSummary).toContain('### 📌 Commit Context');
      expect(feedback.markdownSummary).toContain('`1234567`');
      expect(feedback.markdownSummary).toContain('| **Release Readiness Score** |');
      expect(feedback.structuredDetails.overallScore).toBe(94);
    });

    it('formats failing feedback with blockers list and failure conclusion', () => {
      const failingSummary: CampaignSummary = {
        ...baseSummary,
        releaseAssessment: {
          ...baseSummary.releaseAssessment!,
          overallScore: 55,
          recommendation: 'DO_NOT_RELEASE',
          blockers: [
            {
              id: 'b-1',
              title: 'Crash on Cart Submit',
              reason: 'Uncaught TypeError in checkout.js',
              category: 'functional',
              severity: 'critical',
              evidenceSummary: 'TypeError',
            },
          ],
        },
      };

      const decision = CIGateEngine.evaluateGate(failingSummary, 'BLOCK_ON_CRITICAL_ISSUE');
      const feedback = CIFeedbackGenerator.generateFeedback(decision, failingSummary);

      expect(feedback.verdict).toBe('FAIL');
      expect(feedback.checkRunConclusion).toBe('failure');
      expect(feedback.markdownSummary).toContain('### 🚨 Critical Gate Blockers');
      expect(feedback.markdownSummary).toContain('Crash on Cart Submit');
      expect(feedback.structuredDetails.blockers.length).toBe(1);
    });
  });
});
