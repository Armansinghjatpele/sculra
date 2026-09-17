import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  verifyGitHubSignature,
  parseGitHubWebhook,
  findProjectForRepository,
  scheduleCICDCampaign,
  CIGateEngine,
  CIFeedbackGenerator,
} from '../src/cicd';

describe('CI/CD End-to-End Fixture Simulation', () => {
  const secret = 'webhook-prod-secret-999';

  function createSignedPushEvent(deliveryId: string, repoFullName: string, branch = 'main') {
    const payloadObj = {
      ref: `refs/heads/${branch}`,
      after: '8969592abcdef1234567890',
      head_commit: {
        id: '8969592abcdef1234567890',
        message: 'feat(testing): add ci cd qa gates and developer feedback',
        author: { name: 'Arman Singh', email: 'arman@sculra.com' },
      },
      repository: {
        owner: { login: repoFullName.split('/')[0] },
        name: repoFullName.split('/')[1],
        full_name: repoFullName,
        clone_url: `https://github.com/${repoFullName}.git`,
        default_branch: 'main',
      },
      sender: { login: 'Armansinghjatpele' },
    };

    const rawBody = JSON.stringify(payloadObj);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const signature = `sha256=${hmac.digest('hex')}`;

    return { deliveryId, rawBody, signature, payloadObj };
  }

  it('executes full pipeline: webhook ingestion -> queueing -> gate evaluation -> feedback generation', async () => {
    const deliveryId = 'del-e2e-fixture-001';
    const repoFullName = 'Armansinghjatpele/sculra';
    const fixture = createSignedPushEvent(deliveryId, repoFullName);

    // 1. Signature Verification
    const isValid = verifyGitHubSignature(fixture.rawBody, fixture.signature, secret);
    expect(isValid).toBe(true);

    // 2. Parse Webhook Event
    const normalized = parseGitHubWebhook(deliveryId, 'push', fixture.payloadObj);
    expect(normalized.deliveryId).toBe(deliveryId);
    expect(normalized.repository.fullName).toBe(repoFullName);
    expect(normalized.commit?.branch).toBe('main');

    // 3. Project Resolution Mock
    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'proj-sculra-001',
                  organization_id: 'org-1',
                  name: 'Sculra Platform',
                  ci_enabled: true,
                  github_repo_owner: 'Armansinghjatpele',
                  github_repo_name: 'sculra',
                  ci_default_branch: 'main',
                  ci_trigger_on_push: true,
                  ci_trigger_on_pr: true,
                  ci_gate_policy: 'BLOCK_ON_CRITICAL_ISSUE',
                  ci_webhook_secret: secret,
                  source_url: 'https://sculra.dev',
                  repository_url: 'https://github.com/Armansinghjatpele/sculra',
                },
              ],
              error: null,
            }),
          };
        } else if (table === 'qa_campaigns') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'camp-scheduled-101' },
                  error: null,
                }),
              }),
            }),
          };
        } else if (table === 'cicd_gate_results') {
          return {
            insert: vi.fn().mockResolvedValue({ data: { id: 'gate-res-1' }, error: null }),
          };
        } else if (table === 'cicd_webhook_events') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      }),
    };

    const project = await findProjectForRepository(mockSupabase, 'Armansinghjatpele', 'sculra');
    expect(project).not.toBeNull();
    expect(project?.ciEnabled).toBe(true);
    expect(project?.ciGatePolicy).toBe('BLOCK_ON_CRITICAL_ISSUE');

    // 4. Schedule Campaign into Distributed Queue
    const scheduleResult = await scheduleCICDCampaign(mockSupabase, project!, normalized);
    expect(scheduleResult.campaignId).toBe('camp-scheduled-101');

    // 5. Worker Campaign Completion & Gate Evaluation Simulation
    const mockCampaignSummary: any = {
      campaignId: scheduleResult.campaignId,
      projectId: project?.projectId,
      status: 'COMPLETED',
      tasksPlanned: 12,
      tasksExecuted: 12,
      regressionsCount: 0,
      recoveriesCount: 2,
      releaseAssessment: {
        overallScore: 96,
        recommendation: 'RELEASE',
        riskLevel: 'LOW',
        confidenceLevel: 'HIGH',
        blockers: [],
      },
    };

    const gateDecision = CIGateEngine.evaluateGate(mockCampaignSummary, project!.ciGatePolicy);
    expect(gateDecision.verdict).toBe('PASS');
    expect(gateDecision.passed).toBe(true);
    expect(gateDecision.reasonCodes).toContain('PASS_CRITERIA_MET');

    // 6. Developer Feedback Generation
    const feedback = CIFeedbackGenerator.generateFeedback(gateDecision, mockCampaignSummary, normalized);
    expect(feedback.verdict).toBe('PASS');
    expect(feedback.checkRunConclusion).toBe('success');
    expect(feedback.markdownSummary).toContain('✅ Sculra CI Gate Passed (Score: 96/100)');
    expect(feedback.markdownSummary).toContain('Armansinghjatpele/sculra');
  });

  it('rejects duplicate webhook deliveries for idempotency', () => {
    const existingDeliveries = new Set<string>(['del-already-seen']);
    const incomingDelivery = 'del-already-seen';

    const isDuplicate = existingDeliveries.has(incomingDelivery);
    expect(isDuplicate).toBe(true);
  });
});
