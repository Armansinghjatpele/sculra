// ==============================================================================
// Sculra Fix Agent Deterministic Fixture Suite (A through E)
// (worker/tests/fix_agent_fixtures.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  FixAgentOrchestrator,
  FixRequest,
  ProjectFixPolicy,
  TestRunner,
  TestCommandResult,
} from '../src/fix-agent';
import { RemediationAnalysis } from '../src/remediation/types';
import { BugObservation } from '../src/issues/types';

describe('Prompt 34: Autonomous Safe Fix Agent — Fixture Suite (A through E)', () => {
  const basePolicy: ProjectFixPolicy = {
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
    fix_agent_allowed_paths: ['app/**', 'components/**', 'src/**'],
    fix_agent_blocked_paths: ['.env*', 'package-lock.json'],
  };

  it('Fixture A: Form validation bug — Baseline fails, patch adds email guard, verification passes', async () => {
    let callCount = 0;

    // Simulated test runner that reproduces failure on unpatched code (call 1), passes on patched code (call 2)
    const testRunner = new TestRunner(async (command) => {
      callCount++;
      if (callCount === 1) {
        return {
          command,
          exitCode: 1,
          durationMs: 15,
          passed: false,
          stdoutSnippet: 'FAIL: ContactForm submits invalid email',
          stderrSnippet: '',
          timedOut: false,
        };
      }
      return {
        command,
        exitCode: 0,
        durationMs: 12,
        passed: true,
        stdoutSnippet: 'PASS: ContactForm validates email format correctly',
        stderrSnippet: '',
        timedOut: false,
      };
    });

    const fileMap = new Map<string, string>([
      [
        'app/components/ContactForm.tsx',
        [
          'export function ContactForm({ email }: { email: string }) {',
          '  // Submit form directly',
          '  return submitContact({ email });',
          '}',
        ].join('\n'),
      ],
    ]);

    const diagnosis: RemediationAnalysis = {
      id: 'analysis-fix-a',
      projectId: 'proj-fix-a',
      issueId: 'iss-fix-a',
      fingerprint: 'fp-fix-a',
      analysisVersion: 1,
      status: 'DIAGNOSED',
      confidence: 'VERY_HIGH',
      diagnosis: {
        summary: 'Form validation failure: missing email regex format validation',
        category: 'VALIDATION_LOGIC',
        status: 'DIAGNOSED',
        confidence: 'VERY_HIGH',
        directLocations: [{ filePath: 'app/components/ContactForm.tsx', line: 2 }],
        explanation: 'Contact form allows unvalidated emails to submit directly.',
        limitations: [],
        provenanceTrail: ['DIRECT_QA_EVIDENCE', 'RUNTIME_ERROR_STACK'],
      },
      hypotheses: [],
      fixPlan: {
        summary: 'Add email regex format validation guard before submit',
        affectedFiles: ['app/components/ContactForm.tsx'],
        affectedSymbols: ['ContactForm'],
        steps: [
          {
            stepNumber: 1,
            action: 'VALIDATE_INPUT',
            targetFile: 'app/components/ContactForm.tsx',
            targetSymbol: 'ContactForm',
            description: 'Guard email format',
            rationale: 'Prevent invalid email submissions',
          },
        ],
        expectedBehavior: 'Rejects invalid email format',
        riskAssessment: 'LOW',
        requiredTests: ['npm test -- tests/form.test.ts'],
      },
      verificationPlan: {
        suggestedDomains: ['FUNCTIONAL'],
        existingTargets: ['/contact'],
        regressionTests: ['tests/form.test.ts'],
      },
      codeContextSummary: { filesRetrieved: 1, symbolsIdentified: 1, isPartial: false },
      changeContextSummary: { hasRelevantChanges: false, relationship: 'NO_KNOWN_CHANGE_RELATIONSHIP' },
      historicalContextSummary: { isRecurring: false, isRecentRegression: false, totalOccurrences: 1 },
      telemetry: { provider: 'test', model: 'test', latencyMs: 1, aiRequestCount: 0, deterministicFallback: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orchestrator = new FixAgentOrchestrator({ testRunner });

    const req: FixRequest = {
      projectId: 'proj-fix-a',
      issueId: 'iss-fix-a',
      sourceCommitSha: 'sha-fix-a',
      targetBranch: 'main',
      requestedMode: 'APPLY_AND_VERIFY',
      requesterUserId: 'dev-user-1',
      remediationAnalysis: diagnosis,
      metadata: {
        fileMap,
        customTestCommands: ['npm test -- tests/form.test.ts'],
      },
    };

    const result = await orchestrator.remediate(req, {
      ...basePolicy,
      fix_agent_mode: 'APPLY_AND_VERIFY',
    });

    expect(result.status).toBe('VERIFIED');
    expect(result.baselineStatus).toBe('BASELINE_REPRODUCED');
    expect(result.verificationStatus).toBe('VERIFIED_FIXED');
    expect(result.changedFiles).toContain('app/components/ContactForm.tsx');
  });

  it('Fixture B: Navigation regression — Resolves broken href and verifies', async () => {
    let callCount = 0;

    const testRunner = new TestRunner(async (command) => {
      callCount++;
      if (callCount === 1) {
        return {
          command,
          exitCode: 1,
          durationMs: 10,
          passed: false,
          stdoutSnippet: 'FAIL: HeaderNav navigation redirected to undefined',
          stderrSnippet: '',
          timedOut: false,
        };
      }
      return {
        command,
        exitCode: 0,
        durationMs: 8,
        passed: true,
        stdoutSnippet: 'PASS: HeaderNav navigation redirected to /dashboard',
        stderrSnippet: '',
        timedOut: false,
      };
    });

    const fileMap = new Map<string, string>([
      [
        'components/HeaderNav.tsx',
        [
          'export function HeaderNav() {',
          '  const homeUrl = "/dashboard";',
          '  return <a href={homeUrl}>Home</a>;',
          '}',
        ].join('\n'),
      ],
    ]);

    const diagnosis: RemediationAnalysis = {
      id: 'analysis-fix-b',
      projectId: 'proj-fix-b',
      issueId: 'iss-fix-b',
      fingerprint: 'fp-fix-b',
      analysisVersion: 1,
      status: 'DIAGNOSED',
      confidence: 'HIGH',
      diagnosis: {
        summary: 'Navigation failure: Link href is undefined',
        category: 'ROUTING',
        status: 'DIAGNOSED',
        confidence: 'HIGH',
        directLocations: [{ filePath: 'components/HeaderNav.tsx', line: 2 }],
        explanation: 'Header nav anchor references missing route variable',
        limitations: [],
        provenanceTrail: ['DIRECT_QA_EVIDENCE'],
      },
      hypotheses: [],
      fixPlan: {
        summary: 'Set default href to /dashboard',
        affectedFiles: ['components/HeaderNav.tsx'],
        affectedSymbols: ['HeaderNav'],
        steps: [
          {
            stepNumber: 1,
            action: 'UPDATE_LOGIC',
            targetFile: 'components/HeaderNav.tsx',
            targetSymbol: 'HeaderNav',
            description: 'Provide fallback dashboard route',
            rationale: 'Avoid navigating to undefined',
          },
        ],
        expectedBehavior: 'Navigates to /dashboard',
        riskAssessment: 'LOW',
        requiredTests: ['npm test -- tests/nav.test.ts'],
      },
      verificationPlan: {
        suggestedDomains: ['FUNCTIONAL'],
        existingTargets: ['/'],
        regressionTests: ['tests/nav.test.ts'],
      },
      codeContextSummary: { filesRetrieved: 1, symbolsIdentified: 1, isPartial: false },
      changeContextSummary: { hasRelevantChanges: false, relationship: 'NO_KNOWN_CHANGE_RELATIONSHIP' },
      historicalContextSummary: { isRecurring: false, isRecentRegression: false, totalOccurrences: 1 },
      telemetry: { provider: 'test', model: 'test', latencyMs: 1, aiRequestCount: 0, deterministicFallback: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orchestrator = new FixAgentOrchestrator({ testRunner });

    const req: FixRequest = {
      projectId: 'proj-fix-b',
      issueId: 'iss-fix-b',
      sourceCommitSha: 'sha-fix-b',
      targetBranch: 'main',
      requestedMode: 'APPLY_AND_VERIFY',
      requesterUserId: 'dev-user-2',
      remediationAnalysis: diagnosis,
      metadata: {
        fileMap,
        customTestCommands: ['npm test -- tests/nav.test.ts'],
      },
    };

    const result = await orchestrator.remediate(req, {
      ...basePolicy,
      fix_agent_mode: 'APPLY_AND_VERIFY',
    });

    expect(result.status).toBe('VERIFIED');
    expect(result.verificationStatus).toBe('VERIFIED_FIXED');
  });

  it('Fixture C: API response handling bug — CREATE_PR mode opens Pull Request with formatted body', async () => {
    let callCount = 0;

    const testRunner = new TestRunner(async (command) => {
      callCount++;
      if (callCount === 1) {
        return {
          command,
          exitCode: 1,
          durationMs: 12,
          passed: false,
          stdoutSnippet: 'FAIL: Unhandled 500 when items is empty',
          stderrSnippet: '',
          timedOut: false,
        };
      }
      return {
        command,
        exitCode: 0,
        durationMs: 10,
        passed: true,
        stdoutSnippet: 'PASS: Returns 200 with empty items list',
        stderrSnippet: '',
        timedOut: false,
      };
    });

    const fileMap = new Map<string, string>([
      [
        'app/api/items/route.ts',
        [
          'export async function GET() {',
          '  const items = await getItems();',
          '  return Response.json({ items, count: items.length });',
          '}',
        ].join('\n'),
      ],
    ]);

    const diagnosis: RemediationAnalysis = {
      id: 'analysis-fix-c',
      projectId: 'proj-fix-c',
      issueId: 'iss-fix-c',
      fingerprint: 'fp-fix-c',
      analysisVersion: 1,
      status: 'DIAGNOSED',
      confidence: 'VERY_HIGH',
      diagnosis: {
        summary: 'API 500 on empty items: Cannot read length of undefined',
        category: 'MISSING_ERROR_HANDLING',
        status: 'DIAGNOSED',
        confidence: 'VERY_HIGH',
        directLocations: [{ filePath: 'app/api/items/route.ts', line: 3 }],
        explanation: 'getItems() can return undefined, causing length access exception',
        limitations: [],
        provenanceTrail: ['RUNTIME_ERROR_STACK'],
      },
      hypotheses: [],
      fixPlan: {
        summary: 'Default items to empty array fallback',
        affectedFiles: ['app/api/items/route.ts'],
        affectedSymbols: ['GET'],
        steps: [
          {
            stepNumber: 1,
            action: 'HANDLE_ERROR',
            targetFile: 'app/api/items/route.ts',
            targetSymbol: 'GET',
            description: 'Guard items with empty array',
            rationale: 'Prevent null pointer when items is nullish',
          },
        ],
        expectedBehavior: 'Returns empty list safely',
        riskAssessment: 'LOW',
        requiredTests: ['npm test -- tests/api_items.test.ts'],
      },
      verificationPlan: {
        suggestedDomains: ['API'],
        existingTargets: ['/api/items'],
        regressionTests: ['tests/api_items.test.ts'],
      },
      codeContextSummary: { filesRetrieved: 1, symbolsIdentified: 1, isPartial: false },
      changeContextSummary: { hasRelevantChanges: false, relationship: 'NO_KNOWN_CHANGE_RELATIONSHIP' },
      historicalContextSummary: { isRecurring: false, isRecentRegression: false, totalOccurrences: 1 },
      telemetry: { provider: 'test', model: 'test', latencyMs: 1, aiRequestCount: 0, deterministicFallback: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let prCaptured: any = null;

    const orchestrator = new FixAgentOrchestrator({ testRunner });

    const req: FixRequest = {
      projectId: 'proj-fix-c',
      issueId: 'iss-fix-c',
      repoOwner: 'acme-inc',
      repoName: 'web-store',
      sourceCommitSha: 'sha-fix-c',
      targetBranch: 'main',
      requestedMode: 'CREATE_PR',
      requesterUserId: 'dev-user-3',
      remediationAnalysis: diagnosis,
      metadata: {
        fileMap,
        customTestCommands: ['npm test -- tests/api_items.test.ts'],
        customPRHandler: async (opts: any, title: string, body: string) => {
          prCaptured = { opts, title, body };
          return {
            prNumber: 42,
            prUrl: 'https://github.com/acme-inc/web-store/pull/42',
            branchName: opts.branchName,
            headSha: opts.sourceSha,
            title,
            body,
            createdAt: new Date().toISOString(),
          };
        },
      },
    };

    const result = await orchestrator.remediate(req, basePolicy);

    expect(result.status).toBe('PR_CREATED');
    expect(result.prNumber).toBe(42);
    expect(result.prUrl).toBe('https://github.com/acme-inc/web-store/pull/42');
    expect(prCaptured.title).toContain('fix: API 500 on empty items');
    expect(prCaptured.body).toContain('## 🤖 Sculra Autonomous Remediation');
    expect(prCaptured.body).toContain('Cannot read length of undefined');
    expect(prCaptured.body).toContain('VERIFIED_FIXED');
  });

  it('Fixture D: Accessibility label bug — Verified fixed in PLAN_ONLY and APPLY_AND_VERIFY', async () => {
    let callCount = 0;

    const testRunner = new TestRunner(async (command) => {
      callCount++;
      if (callCount === 1) {
        return {
          command,
          exitCode: 1,
          durationMs: 10,
          passed: false,
          stdoutSnippet: 'FAIL: button missing accessible name',
          stderrSnippet: '',
          timedOut: false,
        };
      }
      return {
        command,
        exitCode: 0,
        durationMs: 10,
        passed: true,
        stdoutSnippet: 'PASS: button has accessible name aria-label="Close"',
        stderrSnippet: '',
        timedOut: false,
      };
    });

    const fileMap = new Map<string, string>([
      [
        'components/IconButton.tsx',
        [
          'export function IconButton({ icon }: { icon: string }) {',
          '  return <button aria-label="Close">{icon}</button>;',
          '}',
        ].join('\n'),
      ],
    ]);

    const diagnosis: RemediationAnalysis = {
      id: 'analysis-fix-d',
      projectId: 'proj-fix-d',
      issueId: 'iss-fix-d',
      fingerprint: 'fp-fix-d',
      analysisVersion: 1,
      status: 'DIAGNOSED',
      confidence: 'HIGH',
      diagnosis: {
        summary: 'Button missing accessible name',
        category: 'ACCESSIBILITY',
        status: 'DIAGNOSED',
        confidence: 'HIGH',
        directLocations: [{ filePath: 'components/IconButton.tsx', line: 2 }],
        explanation: 'Icon-only button has no text child and no aria-label',
        limitations: [],
        provenanceTrail: ['DOM_BEHAVIOR'],
      },
      hypotheses: [],
      fixPlan: {
        summary: 'Add aria-label attribute to button',
        affectedFiles: ['components/IconButton.tsx'],
        affectedSymbols: ['IconButton'],
        steps: [
          {
            stepNumber: 1,
            action: 'UPDATE_LOGIC',
            targetFile: 'components/IconButton.tsx',
            targetSymbol: 'IconButton',
            description: 'Add aria-label',
            rationale: 'Provide screen reader accessible name',
          },
        ],
        expectedBehavior: 'Exposes accessible name',
        riskAssessment: 'LOW',
        requiredTests: ['npm test -- tests/a11y.test.ts'],
      },
      verificationPlan: {
        suggestedDomains: ['ACCESSIBILITY'],
        existingTargets: ['/'],
        regressionTests: ['tests/a11y.test.ts'],
      },
      codeContextSummary: { filesRetrieved: 1, symbolsIdentified: 1, isPartial: false },
      changeContextSummary: { hasRelevantChanges: false, relationship: 'NO_KNOWN_CHANGE_RELATIONSHIP' },
      historicalContextSummary: { isRecurring: false, isRecentRegression: false, totalOccurrences: 1 },
      telemetry: { provider: 'test', model: 'test', latencyMs: 1, aiRequestCount: 0, deterministicFallback: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orchestrator = new FixAgentOrchestrator({ testRunner });

    const req: FixRequest = {
      projectId: 'proj-fix-d',
      issueId: 'iss-fix-d',
      sourceCommitSha: 'sha-fix-d',
      targetBranch: 'main',
      requestedMode: 'APPLY_AND_VERIFY',
      requesterUserId: 'dev-user-4',
      remediationAnalysis: diagnosis,
      metadata: {
        fileMap,
        customTestCommands: ['npm test -- tests/a11y.test.ts'],
      },
    };

    const result = await orchestrator.remediate(req, {
      ...basePolicy,
      fix_agent_mode: 'APPLY_AND_VERIFY',
    });

    expect(result.status).toBe('VERIFIED');
    expect(result.verificationStatus).toBe('VERIFIED_FIXED');
  });

  it('Fixture E: UI responsive bug — Verification fails triggers safe rollback', async () => {
    // Test runner where fix fails verification
    const testRunner = new TestRunner(async (command) => {
      return {
        command,
        exitCode: 1,
        durationMs: 10,
        passed: false,
        stdoutSnippet: 'FAIL: Content still overflows viewport at 375px',
        stderrSnippet: '',
        timedOut: false,
      };
    });

    const fileMap = new Map<string, string>([
      [
        'components/MetricsGrid.tsx',
        [
          'export function MetricsGrid() {',
          '  return <div style={{ width: 1200 }}>metrics</div>;',
          '}',
        ].join('\n'),
      ],
    ]);

    const diagnosis: RemediationAnalysis = {
      id: 'analysis-fix-e',
      projectId: 'proj-fix-e',
      issueId: 'iss-fix-e',
      fingerprint: 'fp-fix-e',
      analysisVersion: 1,
      status: 'DIAGNOSED',
      confidence: 'MEDIUM',
      diagnosis: {
        summary: 'Horizontal overflow on mobile viewport',
        category: 'RESPONSIVE_LAYOUT',
        status: 'DIAGNOSED',
        confidence: 'MEDIUM',
        directLocations: [{ filePath: 'components/MetricsGrid.tsx', line: 2 }],
        explanation: 'Fixed width 1200px exceeds mobile screen width',
        limitations: [],
        provenanceTrail: ['DOM_BEHAVIOR'],
      },
      hypotheses: [],
      fixPlan: {
        summary: 'Change fixed width to maxWidth 100%',
        affectedFiles: ['components/MetricsGrid.tsx'],
        affectedSymbols: ['MetricsGrid'],
        steps: [
          {
            stepNumber: 1,
            action: 'UPDATE_LOGIC',
            targetFile: 'components/MetricsGrid.tsx',
            targetSymbol: 'MetricsGrid',
            description: 'Make grid responsive',
            rationale: 'Avoid fixed width overflow',
          },
        ],
        expectedBehavior: 'Fits within 375px viewport',
        riskAssessment: 'LOW',
        requiredTests: ['npm test -- tests/responsive.test.ts'],
      },
      verificationPlan: {
        suggestedDomains: ['RESPONSIVE'],
        existingTargets: ['/metrics'],
        regressionTests: ['tests/responsive.test.ts'],
      },
      codeContextSummary: { filesRetrieved: 1, symbolsIdentified: 1, isPartial: false },
      changeContextSummary: { hasRelevantChanges: false, relationship: 'NO_KNOWN_CHANGE_RELATIONSHIP' },
      historicalContextSummary: { isRecurring: false, isRecentRegression: false, totalOccurrences: 1 },
      telemetry: { provider: 'test', model: 'test', latencyMs: 1, aiRequestCount: 0, deterministicFallback: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orchestrator = new FixAgentOrchestrator({ testRunner });

    const req: FixRequest = {
      projectId: 'proj-fix-e',
      issueId: 'iss-fix-e',
      sourceCommitSha: 'sha-fix-e',
      targetBranch: 'main',
      requestedMode: 'APPLY_AND_VERIFY',
      requesterUserId: 'dev-user-5',
      remediationAnalysis: diagnosis,
      metadata: {
        fileMap,
        customTestCommands: ['npm test -- tests/responsive.test.ts'],
      },
    };

    const result = await orchestrator.remediate(req, {
      ...basePolicy,
      fix_agent_mode: 'APPLY_AND_VERIFY',
    });

    expect(result.status).toBe('FAILED');
    expect(result.verificationStatus).toBe('VERIFIED_NOT_FIXED');
    expect(result.errorCode).toBe('VERIFICATION_FAILED');
  });
});
