// ==============================================================================
// Sculra Fix Agent End-to-End Integration Tests (worker/tests/fix_agent_e2e.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  FixAgentOrchestrator,
  FixRequest,
  ProjectFixPolicy,
  TestRunner,
} from '../src/fix-agent';
import { RemediationAnalysis } from '../src/remediation/types';

describe('Prompt 34: Autonomous Safe Fix Agent — E2E Integration Tests', () => {
  it('executes full pipeline with database persistence and PR creation', async () => {
    let callCount = 0;
    const persistedRemediations: any[] = [];
    const persistedEvidence: any[] = [];

    // Mock Supabase client
    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'fix_remediations') {
          return {
            upsert: async (record: any) => {
              persistedRemediations.push(record);
              return { data: record, error: null };
            },
          };
        }
        if (table === 'fix_evidence') {
          return {
            insert: async (records: any[]) => {
              persistedEvidence.push(...records);
              return { data: records, error: null };
            },
          };
        }
        return {};
      },
    };

    const testRunner = new TestRunner(async (command) => {
      callCount++;
      if (callCount === 1) {
        return {
          command,
          exitCode: 1,
          durationMs: 15,
          passed: false,
          stdoutSnippet: 'FAIL: Unhandled exception in user service',
          stderrSnippet: '',
          timedOut: false,
        };
      }
      return {
        command,
        exitCode: 0,
        durationMs: 10,
        passed: true,
        stdoutSnippet: 'PASS: User service handles empty query cleanly',
        stderrSnippet: '',
        timedOut: false,
      };
    });

    const fileMap = new Map<string, string>([
      [
        'src/services/userService.ts',
        [
          'export function findUser(id?: string) {',
          '  if (!id) return null;',
          '  return { id, name: "Alice" };',
          '}',
        ].join('\n'),
      ],
    ]);

    const diagnosis: RemediationAnalysis = {
      id: 'analysis-e2e',
      projectId: 'proj-e2e',
      issueId: 'iss-e2e',
      fingerprint: 'fp-e2e',
      analysisVersion: 1,
      status: 'DIAGNOSED',
      confidence: 'VERY_HIGH',
      diagnosis: {
        summary: 'Null pointer in findUser service',
        category: 'RUNTIME_EXCEPTION',
        status: 'DIAGNOSED',
        confidence: 'VERY_HIGH',
        directLocations: [{ filePath: 'src/services/userService.ts', line: 2 }],
        explanation: 'User query throws when id parameter is undefined',
        limitations: [],
        provenanceTrail: ['RUNTIME_ERROR_STACK'],
      },
      hypotheses: [],
      fixPlan: {
        summary: 'Guard user id parameter',
        affectedFiles: ['src/services/userService.ts'],
        affectedSymbols: ['findUser'],
        steps: [
          {
            stepNumber: 1,
            action: 'VALIDATE_INPUT',
            targetFile: 'src/services/userService.ts',
            targetSymbol: 'findUser',
            description: 'Validate id parameter',
            rationale: 'Prevent null pointer exception',
          },
        ],
        expectedBehavior: 'Returns null safely when id is undefined',
        riskAssessment: 'LOW',
        requiredTests: ['npm test -- tests/user.test.ts'],
      },
      verificationPlan: {
        suggestedDomains: ['API'],
        existingTargets: ['/users'],
        regressionTests: ['tests/user.test.ts'],
      },
      codeContextSummary: { filesRetrieved: 1, symbolsIdentified: 1, isPartial: false },
      changeContextSummary: { hasRelevantChanges: false, relationship: 'NO_KNOWN_CHANGE_RELATIONSHIP' },
      historicalContextSummary: { isRecurring: false, isRecentRegression: false, totalOccurrences: 1 },
      telemetry: { provider: 'test', model: 'test', latencyMs: 1, aiRequestCount: 0, deterministicFallback: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orchestrator = new FixAgentOrchestrator({
      supabaseClient: mockSupabase,
      testRunner,
    });

    const policy: ProjectFixPolicy = {
      fix_agent_enabled: true,
      fix_agent_mode: 'CREATE_PR',
      fix_agent_allowed_branches: ['main'],
      fix_agent_max_files: 5,
      fix_agent_max_diff_lines: 100,
      fix_agent_max_test_commands: 3,
      fix_agent_allow_dependency_changes: false,
      fix_agent_allow_config_changes: false,
      fix_agent_allow_database_changes: false,
      fix_agent_allow_auth_changes: false,
      fix_agent_allow_security_sensitive_changes: false,
      fix_agent_require_pr: true,
      fix_agent_auto_verify: true,
      fix_agent_allowed_paths: ['src/**'],
      fix_agent_blocked_paths: ['.env*'],
    };

    const req: FixRequest = {
      projectId: 'proj-e2e',
      issueId: 'iss-e2e',
      repoOwner: 'org-sculra',
      repoName: 'e2e-repo',
      sourceCommitSha: 'sha-e2e-1234567',
      targetBranch: 'main',
      requestedMode: 'CREATE_PR',
      requesterUserId: 'clerk-user-admin',
      remediationAnalysis: diagnosis,
      metadata: {
        fileMap,
        customTestCommands: ['npm test -- tests/user.test.ts'],
        customPRHandler: async (opts: any, title: string, body: string) => {
          return {
            prNumber: 99,
            prUrl: 'https://github.com/org-sculra/e2e-repo/pull/99',
            branchName: opts.branchName,
            headSha: opts.sourceSha,
            title,
            body,
            createdAt: new Date().toISOString(),
          };
        },
      },
    };

    const result = await orchestrator.remediate(req, policy);

    expect(result.status).toBe('PR_CREATED');
    expect(result.prNumber).toBe(99);
    expect(result.verificationStatus).toBe('VERIFIED_FIXED');
    expect(result.baselineStatus).toBe('BASELINE_REPRODUCED');
    expect(result.changedFiles).toEqual(['src/services/userService.ts']);

    // Check DB persistence
    expect(persistedRemediations.length).toBe(1);
    const persisted = persistedRemediations[0];
    expect(persisted.id).toBe(result.id);
    expect(persisted.pr_number).toBe(99);
    expect(persisted.status).toBe('PR_CREATED');
    expect(persisted.verification_status).toBe('VERIFIED_FIXED');

    // Check evidence chain
    expect(persistedEvidence.length).toBeGreaterThanOrEqual(4);
    const evidenceTypes = persistedEvidence.map((e) => e.type);
    expect(evidenceTypes).toContain('patch_generated');
    expect(evidenceTypes).toContain('baseline_reproduction');
    expect(evidenceTypes).toContain('patch_applied');
    expect(evidenceTypes).toContain('diff_review');
    expect(evidenceTypes).toContain('verification_result');
    expect(evidenceTypes).toContain('pr_created');
  });
});
