// ==============================================================================
// Sculra Product Analyzer & Schema Validation Tests (worker/tests/product_analyzer.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { validateAndNormalizeProductUnderstanding, createFallbackProductUnderstanding } from '../src/product/schema';
import { ProductAnalyzer } from '../src/product/analyzer';
import { MockAIQAProvider } from '../src/ai-qa/mock-provider';
import { ProductAnalysisContext } from '../src/product/types';

describe('ProductAnalyzer & Schema Guardrails', () => {
  const mockContext: ProductAnalysisContext = {
    testRunId: 'run-test-1',
    targetUrl: 'http://127.0.0.1:3000',
    applicationProfile: {
      applicationTypes: [{ type: 'SaaS', confidence: 0.9, evidence: [] }],
      primaryType: 'SaaS',
      detectedDomains: ['http://127.0.0.1:3000'],
      authenticationPresent: true,
      multiRoleSignals: true,
      majorSections: ['Dashboard', 'Projects'],
      confidence: 0.9,
      evidenceReferences: [],
    },
    pageSummaries: [
      { url: 'http://127.0.0.1:3000/', title: 'Home', category: 'LANDING', headings: ['Welcome'], buttonsCount: 1, formsCount: 0, linksCount: 2 },
      { url: 'http://127.0.0.1:3000/dashboard', title: 'Dashboard', category: 'DASHBOARD', headings: ['Metrics'], buttonsCount: 2, formsCount: 0, linksCount: 3 },
      { url: 'http://127.0.0.1:3000/projects/new', title: 'New Project', category: 'CREATE', headings: ['Create'], buttonsCount: 1, formsCount: 1, linksCount: 0 },
    ],
    discoveredFeatures: [
      { id: 'feat-auth', name: 'Authentication', routes: ['http://127.0.0.1:3000/login'], criticality: 'CRITICAL' },
    ],
    candidateWorkflows: [],
    candidateRoles: [{ id: 'role-visitor', name: 'Visitor', evidence: [] }],
    untrustedNotice: 'NOTICE',
  };

  it('1. validates and normalizes valid AI product recommendations', () => {
    const rawAiOutput = {
      refinedApplicationType: 'project management',
      additionalFeatures: [
        {
          name: 'Project Creation Wizard',
          description: 'Multi-step project initiation flow.',
          category: 'Core Workflow',
          relatedRoutes: ['http://127.0.0.1:3000/projects/new'],
          confidence: 0.95,
          criticality: 'HIGH',
        },
      ],
      additionalWorkflows: [
        {
          name: 'Quick Project Setup',
          goal: 'Create and initialize a new workspace project',
          roleName: 'Member',
          entryRoute: 'http://127.0.0.1:3000/',
          exitRoute: 'http://127.0.0.1:3000/projects/new',
          steps: [
            { action: 'NAVIGATE', route: 'http://127.0.0.1:3000/', targetDescription: 'Home', expectedTransition: 'Visit' },
            { action: 'NAVIGATE', route: 'http://127.0.0.1:3000/projects/new', targetDescription: 'Form', expectedTransition: 'Open form' },
          ],
          confidence: 0.9,
          criticality: 'HIGH',
        },
      ],
      roleHypotheses: [],
      suggestedRelationships: [],
    };

    const validated = validateAndNormalizeProductUnderstanding(rawAiOutput, mockContext);

    expect(validated.refinedApplicationType).toBe('project management');
    expect(validated.additionalFeatures?.length).toBe(1);
    expect(validated.additionalWorkflows?.length).toBe(1);
    expect(validated.additionalWorkflows?.[0].steps.length).toBe(2);
  });

  it('2. strictly strips hallucinated routes and invalid steps from AI suggestions', () => {
    const rawAiWithHallucinations = {
      refinedApplicationType: 'SaaS',
      additionalFeatures: [
        {
          name: 'Fake Feature',
          description: '',
          category: '',
          relatedRoutes: ['http://127.0.0.1:3000/imaginary-route-999', 'http://127.0.0.1:3000/fake-payment'],
          confidence: 0.9,
          criticality: 'HIGH',
        },
      ],
      additionalWorkflows: [
        {
          name: 'Fake Workflow',
          goal: 'Do something on non-existent page',
          roleName: 'Alien',
          entryRoute: 'http://127.0.0.1:3000/non-existent-page',
          exitRoute: 'http://127.0.0.1:3000/another-fake-page',
          steps: [{ action: 'CLICK', route: 'http://127.0.0.1:3000/non-existent-page', targetDescription: '', expectedTransition: '' }],
          confidence: 0.9,
          criticality: 'HIGH',
        },
      ],
      roleHypotheses: [],
      suggestedRelationships: [],
    };

    const validated = validateAndNormalizeProductUnderstanding(rawAiWithHallucinations, mockContext);

    // Strips fake feature because no valid routes remain
    expect(validated.additionalFeatures?.length).toBe(0);
    // Strips fake workflow because entry/exit routes are not in discovered pages
    expect(validated.additionalWorkflows?.length).toBe(0);
  });

  it('3. gracefully falls back to deterministic context when AI fails or errors', async () => {
    const brokenProvider = {
      metadata: { name: 'broken', model: 'fail', isDeterministicMock: false },
      generatePlan: async () => ({} as any),
      analyzeProductUnderstanding: async () => {
        throw new Error('API Rate Limit Exceeded');
      },
    };

    const analyzer = new ProductAnalyzer({ provider: brokenProvider as any, timeoutMs: 1000 });
    const result = await analyzer.analyze({
      testRunId: 'run-err-1',
      targetUrl: mockContext.targetUrl,
      applicationProfile: mockContext.applicationProfile,
      classifications: [],
      features: [],
      workflows: [],
      roles: [],
    });

    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toContain('Rate Limit');
    expect(result.recommendation.refinedApplicationType).toBe('SaaS');
  });

  it('4. executes product analysis cleanly with MockAIQAProvider', async () => {
    const mockProvider = new MockAIQAProvider();
    const analyzer = new ProductAnalyzer({ provider: mockProvider });

    const result = await analyzer.analyze({
      testRunId: 'run-mock-1',
      targetUrl: mockContext.targetUrl,
      applicationProfile: mockContext.applicationProfile,
      classifications: [
        { pageUrl: 'http://127.0.0.1:3000/', category: 'LANDING', confidence: 1, evidence: [], source: 'DETERMINISTIC', depth: 0 },
        { pageUrl: 'http://127.0.0.1:3000/dashboard', category: 'DASHBOARD', confidence: 1, evidence: [], source: 'DETERMINISTIC', depth: 1 },
      ],
      features: [],
      workflows: [],
      roles: [],
    });

    expect(result.isFallback).toBe(false);
    expect(result.recommendation.additionalWorkflows?.length).toBeGreaterThanOrEqual(1);
  });
});
