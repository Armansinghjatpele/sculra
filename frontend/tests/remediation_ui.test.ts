import { describe, it, expect, vi } from 'vitest';
import { getIssueRemediationAnalysis, getProjectRemediationAnalyses } from '../services/db';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-123');

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => {
      const createBuilder = (table: string) => {
        const builder: any = {
          _table: table,
          select: vi.fn().mockImplementation(() => builder),
          insert: vi.fn().mockImplementation(() => builder),
          update: vi.fn().mockImplementation(() => builder),
          eq: vi.fn().mockImplementation(() => builder),
          order: vi.fn().mockImplementation(() => builder),
          limit: vi.fn().mockImplementation(() => builder),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'rem-123',
              project_id: 'proj-123',
              issue_id: 'issue-456',
              fingerprint: 'fp-test-123',
              status: 'DIAGNOSED',
              confidence: 'HIGH',
              diagnosis: {
                summary: 'Checkout handler missing payment intent branch',
                category: 'RECENT_CODE_CHANGE',
                status: 'DIAGNOSED',
                confidence: 'HIGH',
                directLocations: [{ filePath: 'app/api/checkout/route.ts', line: 42 }],
                explanation: 'Validated against runtime stack trace and recent commit diff',
                limitations: [],
                provenanceTrail: ['DIRECT_QA_EVIDENCE', 'CHANGED_CODE'],
              },
              hypotheses: [
                {
                  id: 'h1',
                  category: 'RECENT_CODE_CHANGE',
                  statement: 'Payment intent missing from validation',
                  status: 'SUPPORTED',
                  confidence: 'HIGH',
                  supportingEvidenceIds: ['ev-1'],
                  contradictingEvidenceIds: [],
                  filePaths: ['app/api/checkout/route.ts'],
                  symbols: ['POST'],
                  sourceReferences: ['DIRECT_QA_EVIDENCE'],
                },
              ],
              fix_plan: {
                summary: 'Handle missing payment intent in checkout route',
                affectedFiles: ['app/api/checkout/route.ts'],
                affectedSymbols: ['POST'],
                steps: [
                  {
                    stepNumber: 1,
                    description: 'Inspect app/api/checkout/route.ts',
                    action: 'INSPECT',
                    rationale: 'Verify payment intent check',
                  },
                ],
                expectedBehavior: 'Returns 400 Bad Request when payment intent is missing',
                riskAssessment: 'LOW',
                requiredTests: ['POST /api/checkout valid payload', 'POST /api/checkout missing intent'],
              },
              verification_plan: {
                suggestedDomains: ['API', 'FUNCTIONAL'],
                existingTargets: ['/api/checkout'],
                regressionTests: ['POST /api/checkout with valid payment fixture'],
              },
              created_at: '2026-09-17T12:00:00Z',
              updated_at: '2026-09-17T12:00:00Z',
            },
            error: null,
          }),
          then: (resolve: any) => {
            if (table === 'issue_remediation_analyses') {
              resolve({
                data: [
                  {
                    id: 'rem-123',
                    project_id: 'proj-123',
                    issue_id: 'issue-456',
                    fingerprint: 'fp-test-123',
                    status: 'DIAGNOSED',
                    confidence: 'HIGH',
                    diagnosis: {
                      summary: 'Checkout handler missing payment intent branch',
                      category: 'RECENT_CODE_CHANGE',
                      status: 'DIAGNOSED',
                      confidence: 'HIGH',
                      directLocations: [],
                      explanation: 'Validated',
                      limitations: [],
                      provenanceTrail: [],
                    },
                    hypotheses: [],
                    fix_plan: {
                      summary: 'Fix handler',
                      affectedFiles: [],
                      affectedSymbols: [],
                      steps: [],
                      expectedBehavior: '200 OK',
                      riskAssessment: 'LOW',
                      requiredTests: [],
                    },
                    verification_plan: {
                      suggestedDomains: ['API'],
                      existingTargets: ['/api/checkout'],
                      regressionTests: [],
                    },
                    created_at: '2026-09-17T12:00:00Z',
                    updated_at: '2026-09-17T12:00:00Z',
                  },
                ],
                error: null,
              });
            } else {
              resolve({ data: [], error: null });
            }
          },
        };
        return builder;
      };

      return {
        from: vi.fn((table: string) => createBuilder(table)),
      };
    }),
  };
});

describe('Remediation UI & DB Integration Tests', () => {
  it('fetches single issue remediation analysis with correct diagnosis and fix plan', async () => {
    const analysis = await getIssueRemediationAnalysis('mock-token', 'issue-456');

    expect(analysis).toBeDefined();
    expect(analysis?.id).toBe('rem-123');
    expect(analysis?.status).toBe('DIAGNOSED');
    expect(analysis?.confidence).toBe('HIGH');
    expect(analysis?.diagnosis.summary).toContain('payment intent');
    expect(analysis?.fixPlan.affectedFiles).toContain('app/api/checkout/route.ts');
    expect(analysis?.verificationPlan.suggestedDomains).toContain('API');
  });

  it('fetches project remediation analyses list', async () => {
    const list = await getProjectRemediationAnalyses('mock-token', 'proj-123');

    expect(list.length).toBe(1);
    expect(list[0].id).toBe('rem-123');
    expect(list[0].status).toBe('DIAGNOSED');
    expect(list[0].projectId).toBe('proj-123');
  });
});
