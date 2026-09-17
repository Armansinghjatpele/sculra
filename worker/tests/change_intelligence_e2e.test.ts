import { describe, it, expect } from 'vitest';
import { ChangeIntelligenceAnalyzer } from '../src/change-intelligence/analyzer';
import { TargetSelector } from '../src/campaign/target-selector';
import { CIGateEngine } from '../src/cicd/gate';
import { CIFeedbackGenerator } from '../src/cicd/feedback';
import { ProductModel } from '../src/product';
import { CampaignSummary } from '../src/campaign/types';

describe('Change Intelligence End-to-End Pipeline Tests', () => {
  const mockProductModel: ProductModel = {
    projectId: 'proj-e2e-1',
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    workflows: [
      {
        id: 'wf-checkout-critical',
        name: 'Express Checkout Flow',
        criticality: { level: 'CRITICAL', score: 95, businessImpact: 'Direct payment processing' },
        steps: [
          { stepNumber: 1, action: 'navigate', pageUrl: 'https://app.example.com/checkout' },
          { stepNumber: 2, action: 'fill_billing', pageUrl: 'https://app.example.com/checkout' },
          { stepNumber: 3, action: 'submit_order', pageUrl: 'https://app.example.com/checkout/confirmation' },
        ],
      },
    ],
    features: [
      {
        id: 'feat-payments',
        name: 'Stripe Payment Gateway',
        description: 'Handles credit card and Apple Pay processing',
        criticality: 'CRITICAL',
        relatedRoutes: ['/checkout', '/api/checkout'],
      },
    ],
    roles: [],
    inferredRules: [],
  };

  const sampleWebhookFiles = [
    {
      filename: 'app/api/checkout/route.ts',
      status: 'MODIFIED' as const,
      additions: 45,
      deletions: 12,
      changes: 57,
      patch: `
@@ -15,5 +15,12 @@ export async function POST(req: NextRequest) {
   const session = await auth();
+  if (!session) {
+    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
+  }
+  const paymentIntent = await stripe.paymentIntents.create({
+    amount: req.body.amount,
+    currency: 'usd',
+  });
   return NextResponse.json({ success: true });
 }
`,
    },
    {
      filename: 'app/(shop)/checkout/page.tsx',
      status: 'MODIFIED' as const,
      additions: 25,
      deletions: 5,
      changes: 30,
      patch: `
@@ -20,4 +20,9 @@ export default function CheckoutPage() {
   const [loading, setLoading] = useState(false);
+  const handlePay = async () => {
+    setLoading(true);
+    await fetch('/api/checkout', { method: 'POST' });
+    setLoading(false);
+  };
   return <button onClick={handlePay}>Pay Now</button>;
 }
`,
    },
  ];

  it('executes the full Change Intelligence pipeline deterministically without AI dependency', async () => {
    // 1. Instantiate Analyzer
    const analyzer = new ChangeIntelligenceAnalyzer();

    // 2. Run Change Intelligence Analysis
    const analysis = await analyzer.analyze({
      projectId: 'proj-e2e-1',
      campaignId: 'camp-e2e-1',
      commitSha: 'fa47c9b819203a4b5c6d7e8f90123456789abcde',
      baseSha: '0123456789abcdef0123456789abcdef01234567',
      branch: 'feature/checkout-hardening',
      pullRequestNumber: 42,
      webhookPayloadFiles: sampleWebhookFiles,
      productModel: mockProductModel,
      recentRegressions: [
        {
          fingerprint: 'reg-checkout-500',
          targetUrl: 'https://app.example.com/checkout',
          title: '500 Internal Server Error on checkout submit',
          severity: 'critical',
          detectedAt: new Date().toISOString(),
        },
      ],
    });

    // Verify Analysis Model
    expect(analysis.status).toBe('COMPLETED');
    expect(analysis.commitSha).toBe('fa47c9b819203a4b5c6d7e8f90123456789abcde');
    expect(analysis.changeSet.files.length).toBe(2);
    expect(analysis.changeSet.totalAdditions).toBe(70);
    expect(analysis.changeSet.totalDeletions).toBe(17);

    // Verify Semantic Classifications
    expect(analysis.classifications).toContain('API');
    expect(analysis.classifications).toContain('ROUTING');
    expect(analysis.classifications).toContain('UI');

    // Verify Impact Graph & Route/API/Workflow mappings
    expect(analysis.affectedRoutes.some((r) => r.route === '/checkout')).toBe(true);
    expect(analysis.affectedApis.some((a) => a.path === '/api/checkout' && a.method === 'POST')).toBe(true);
    expect(analysis.affectedWorkflows.some((w) => w.workflowName === 'Express Checkout Flow')).toBe(true);

    // Verify Deterministic Risk Score
    expect(analysis.risk.score).toBeGreaterThanOrEqual(60); // High or Critical due to payment & critical workflow
    expect(['CRITICAL', 'HIGH']).toContain(analysis.risk.level);
    expect(analysis.risk.factors.length).toBeGreaterThan(0);

    // Verify Recommended Domains and Strategy Boosts
    expect(analysis.recommendedDomains.length).toBeGreaterThan(0);
    expect(analysis.strategyBoosts.length).toBeGreaterThan(0);

    // 3. Campaign Target Prioritization Integration
    const targets = TargetSelector.selectInitialTargets({
      targetUrl: 'https://app.example.com',
      config: {
        objective: 'regression',
        domains: ['API', 'JOURNEY', 'FUNCTIONAL'],
      },
      productModel: mockProductModel,
      changeIntelligence: analysis,
    });

    expect(targets.length).toBeGreaterThan(0);
    const checkoutTarget = targets.find((t) => t.identifier === '/checkout' || t.url?.includes('/checkout'));
    expect(checkoutTarget).toBeDefined();
    expect(checkoutTarget?.isChangeAffected).toBe(true);
    expect(checkoutTarget?.strategyScore).toBeGreaterThanOrEqual(80);

    // 4. Campaign Summary Generation with Change Intelligence Metadata
    const summary: CampaignSummary = {
      campaignId: 'camp-e2e-1',
      projectId: 'proj-e2e-1',
      status: 'COMPLETED',
      objective: 'regression',
      startedAt: '2026-09-17T11:00:00Z',
      completedAt: '2026-09-17T11:04:00Z',
      durationMs: 240000,
      domainsExecuted: ['API', 'JOURNEY', 'FUNCTIONAL'],
      domainsUnavailable: [],
      tasksPlanned: 8,
      tasksExecuted: 8,
      tasksPassed: 8,
      tasksFailed: 0,
      tasksBlocked: 0,
      tasksSkipped: 0,
      criticalWorkflowsTested: 1,
      criticalWorkflowsUntested: 0,
      newIssuesCount: 0,
      regressionsCount: 0,
      recoveriesCount: 1,
      recurringDefectsCount: 0,
      unstableTargetsCount: 0,
      evidenceCount: 12,
      coverageSummary: {
        taskCoveragePct: 100,
        domainCoveragePct: 100,
        pagesCovered: 2,
        apisCovered: 1,
        workflowsCovered: 1,
        rolesCovered: 1,
        viewportsCovered: 1,
      },
      terminationReason: 'ALL_TASKS_COMPLETED',
      releaseAssessment: {
        testRunId: 'tr-e2e-1',
        projectId: 'proj-e2e-1',
        scoringVersion: '1.0',
        overallScore: 95,
        scores: { overall: 95, functional: 96, api: 95 },
        recommendation: 'RELEASE',
        riskLevel: 'LOW',
        confidenceLevel: 'HIGH',
        blockers: [],
        breakdown: {} as any,
        evaluatedAt: '2026-09-17T11:04:00Z',
      },
      changeIntelligence: {
        riskScore: analysis.risk.score,
        riskLevel: analysis.risk.level,
        changeCount: analysis.changeSet.files.length,
        additionsCount: analysis.changeSet.totalAdditions,
        deletionsCount: analysis.changeSet.totalDeletions,
        affectedRoutes: analysis.affectedRoutes.map((r) => r.route),
        affectedWorkflows: analysis.affectedWorkflows.map((w) => w.workflowName),
        affectedApis: analysis.affectedApis.map((a) => `${a.method || 'GET'} ${a.path}`),
        recommendedDomains: analysis.recommendedDomains.map((d) => d.domain),
        isPartial: false,
        status: analysis.status,
      },
    };

    // 5. CI Gate Evaluation
    const gateDecision = CIGateEngine.evaluateGate(summary, 'BLOCK_ON_CRITICAL_ISSUE');
    expect(gateDecision.verdict).toBe('PASS');
    expect(gateDecision.overallScore).toBe(95);

    // 6. Developer Feedback Synthesis
    const feedback = CIFeedbackGenerator.generateFeedback(gateDecision, summary, {
      deliveryId: 'del-e2e-1',
      provider: 'github',
      eventType: 'pull_request',
      repository: { owner: 'acme', name: 'app', fullName: 'acme/app' },
      commit: {
        sha: analysis.commitSha,
        shortSha: analysis.commitSha.slice(0, 7),
        message: 'fix: harden checkout flow with authorization checks',
        branch: 'feature/checkout-hardening',
      },
      pullRequest: {
        number: 42,
        title: 'Harden checkout flow',
        headSha: analysis.commitSha,
        headBranch: 'feature/checkout-hardening',
        baseBranch: 'main',
        sender: 'developer',
      },
      receivedAt: '2026-09-17T11:00:00Z',
    });

    expect(feedback.verdict).toBe('PASS');
    expect(feedback.checkRunConclusion).toBe('success');

    // Verify Developer Markdown Report includes Change Intelligence
    expect(feedback.markdownSummary).toContain('Code Change Intelligence & Impact');
    expect(feedback.markdownSummary).toContain(`Risk Score**: **${analysis.risk.score}/100`);
    expect(feedback.markdownSummary).toContain('/checkout');
    expect(feedback.markdownSummary).toContain('Express Checkout Flow');
    expect(feedback.markdownSummary).toContain('POST /api/checkout');

    // Verify Structured Details
    expect(feedback.structuredDetails.changeIntelligence).toBeDefined();
    expect(feedback.structuredDetails.changeIntelligence?.riskScore).toBe(analysis.risk.score);
    expect(feedback.structuredDetails.changeIntelligence?.affectedWorkflows).toContain('Express Checkout Flow');
  });
});
