// ==============================================================================
// Sculra Remediation End-to-End Test (worker/tests/remediation_e2e.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { RemediationAnalyzer } from '../src/remediation/analyzer';
import { BugObservation } from '../src/issues/types';
import { IssueManager } from '../src/issues/manager';

describe('Remediation End-to-End Pipeline', () => {
  it('executes full flow: QA failure observation -> IssueManager -> RemediationAnalyzer -> diagnosis & fix plan', async () => {
    // 1. Simulated QA failure observation
    const bug: BugObservation = {
      id: 'issue-checkout-fail',
      testRunId: 'run-e2e-1',
      projectId: 'proj-e2e',
      type: 'API_HTTP_5XX',
      severity: 'critical',
      confidence: 'high',
      status: 'open',
      title: 'Checkout API Failed with HTTP 500',
      summary: 'POST /api/checkout failed with payment intent error',
      description: 'Server returned 500 Internal Server Error during checkout submission',
      url: 'https://app.example.com/checkout',
      fingerprint: 'fp-e2e-checkout-500',
      timestamp: '2026-09-17T12:00:00Z',
      reproductionSteps: [
        {
          stepNumber: 1,
          action: 'CLICK',
          target: 'button[type="submit"]',
          url: 'https://app.example.com/checkout',
          expectedBehavior: 'Order confirmed with 200 OK',
          observedBehavior: 'Received HTTP 500 Internal Server Error',
        },
      ],
      metadata: {
        apiEndpoint: '/api/checkout',
        method: 'POST',
        statusCode: 500,
        stackTrace: 'Error: Failed to process transaction\n    at POST (app/api/checkout/route.ts:42:18)',
      },
    };

    // 2. IssueManager records the bug
    const issueManager = new IssueManager();
    const persistenceResult = await issueManager.persistBugs(
      null, // In-memory / null supabase simulation
      [bug],
      'run-e2e-1',
      'proj-e2e'
    );
    expect(persistenceResult.persistedCount).toBe(1);

    // 3. Source file context available in repository
    const fileMap = new Map<string, string>();
    fileMap.set(
      'app/api/checkout/route.ts',
      `
      import { processPayment } from '@/lib/payment';

      export async function POST(req: Request) {
        const body = await req.json();
        if (!body.paymentIntent) {
          throw new Error("Failed to process transaction: Missing payment intent");
        }
        return new Response(JSON.stringify({ success: true }));
      }
      `
    );

    // 4. Change intelligence result from Prompt 32
    const changeAnalysis = {
      commit_sha: 'commit-e2e-123',
      branch: 'feature/payment-v2',
      risk_score: 75,
      risk_level: 'HIGH',
      files: [
        {
          filePath: 'app/api/checkout/route.ts',
          status: 'modified',
          symbols: ['POST'],
          patch: '@@ -40,4 +40,5 @@ if (!body.paymentIntent) {',
        },
      ],
    };

    // 5. Historical QA memory from Prompt 28
    const historicalFindings = [
      {
        fingerprint: 'fp-e2e-checkout-500',
        type: 'NEW_REGRESSION',
        occurrenceCount: 2,
        firstSeenAt: '2026-09-16T12:00:00Z',
        lastSeenAt: '2026-09-17T12:00:00Z',
        targetUrl: 'https://app.example.com/checkout',
      },
    ];

    // 6. Remediation Analyzer executes end-to-end analysis
    const analyzer = new RemediationAnalyzer();
    const analysis = await analyzer.analyze({
      observation: bug as any,
      projectId: 'proj-e2e',
      testRunId: 'run-e2e-1',
      fileMap,
      changeAnalysis,
      historicalFindings,
    });

    // 7. Verify analysis outcome
    expect(analysis).toBeDefined();
    expect(analysis.status).toBe('DIAGNOSED');
    expect(analysis.fingerprint).toBe('fp-e2e-checkout-500');
    expect(analysis.confidence === 'HIGH' || analysis.confidence === 'VERY_HIGH').toBe(true);

    // Diagnosis verification
    expect(analysis.diagnosis.category).toBe('RECENT_CODE_CHANGE');
    expect(analysis.diagnosis.directLocations.length).toBeGreaterThan(0);
    expect(analysis.diagnosis.directLocations[0].filePath).toContain('app/api/checkout/route.ts');

    // Hypotheses verification
    expect(analysis.hypotheses.length).toBeGreaterThan(0);
    const supported = analysis.hypotheses.find((h) => h.status === 'SUPPORTED');
    expect(supported).toBeDefined();
    expect(supported?.category).toBe('RECENT_CODE_CHANGE');

    // Fix plan verification
    expect(analysis.fixPlan.steps.length).toBeGreaterThanOrEqual(2);
    expect(analysis.fixPlan.riskAssessment).not.toBe('SECURITY_RISK');
    expect(analysis.fixPlan.affectedFiles).toContain('app/api/checkout/route.ts');

    // Verification plan verification
    expect(analysis.verificationPlan.suggestedDomains).toContain('API');
    expect(analysis.verificationPlan.regressionTests.length).toBeGreaterThan(0);

    // Historical & change summaries
    expect(analysis.changeContextSummary.hasRelevantChanges).toBe(true);
    expect(analysis.historicalContextSummary.isRecentRegression).toBe(true);
  });
});
