// ==============================================================================
// Sculra Business Criticality Evaluator Tests (worker/tests/product_criticality.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { BusinessCriticalityEvaluator } from '../src/product/criticality';
import { DiscoveredPage } from '../types';
import { ProductWorkflow } from '../src/product/types';

describe('BusinessCriticalityEvaluator', () => {
  const basePage: DiscoveredPage = {
    url: 'http://127.0.0.1:3000/pricing',
    title: 'Pricing & Plans',
    depth: 1,
    elementsCount: 2,
    elements: [],
    forms: [],
    links: [],
    consoleErrors: [],
    networkErrors: [],
    timestamp: new Date().toISOString(),
  };

  it('1. awards highest criticality score to payment, billing, and checkout routes', () => {
    const checkoutPage: DiscoveredPage = {
      ...basePage,
      url: 'http://127.0.0.1:3000/checkout',
      title: 'Checkout & Payment',
    };

    const assessment = BusinessCriticalityEvaluator.evaluatePageCriticality({
      page: checkoutPage,
      classification: {
        pageUrl: checkoutPage.url,
        category: 'PAYMENT',
        confidence: 0.9,
        evidence: [],
        source: 'DETERMINISTIC',
        depth: 1,
      },
    });

    expect(assessment.score).toBeGreaterThanOrEqual(75);
    expect(assessment.level).toMatch(/CRITICAL|HIGH/);
    expect(assessment.reasons.some((r) => r.toLowerCase().includes('revenue') || r.toLowerCase().includes('checkout'))).toBe(true);
  });

  it('2. evaluates authentication gateways with high/critical priority', () => {
    const authPage: DiscoveredPage = {
      ...basePage,
      url: 'http://127.0.0.1:3000/login',
      title: 'Sign In',
    };

    const assessment = BusinessCriticalityEvaluator.evaluatePageCriticality({
      page: authPage,
      classification: {
        pageUrl: authPage.url,
        category: 'LOGIN',
        confidence: 0.95,
        evidence: [],
        source: 'DETERMINISTIC',
        depth: 1,
      },
    });

    expect(assessment.score).toBeGreaterThanOrEqual(65);
    expect(assessment.reasons.some((r) => r.toLowerCase().includes('authentication'))).toBe(true);
  });

  it('3. increases criticality when multiple workflows depend on the route', () => {
    const dashboardPage: DiscoveredPage = {
      ...basePage,
      url: 'http://127.0.0.1:3000/dashboard',
      title: 'Workspace Dashboard',
    };

    const mockWorkflows: ProductWorkflow[] = [
      { id: 'w1', name: 'Wf1', goal: '', steps: [{ pageUrl: 'http://127.0.0.1:3000/dashboard' } as any], entryPoint: '', exitPoint: '', relatedFeatureIds: [], relatedRoutes: [], confidence: 1, evidence: [], criticality: { score: 80, level: 'HIGH', reasons: [], evidence: [], confidence: 1 }, status: 'OBSERVED', executionStatus: 'TESTED' },
      { id: 'w2', name: 'Wf2', goal: '', steps: [{ pageUrl: 'http://127.0.0.1:3000/dashboard' } as any], entryPoint: '', exitPoint: '', relatedFeatureIds: [], relatedRoutes: [], confidence: 1, evidence: [], criticality: { score: 80, level: 'HIGH', reasons: [], evidence: [], confidence: 1 }, status: 'OBSERVED', executionStatus: 'TESTED' },
      { id: 'w3', name: 'Wf3', goal: '', steps: [{ pageUrl: 'http://127.0.0.1:3000/dashboard' } as any], entryPoint: '', exitPoint: '', relatedFeatureIds: [], relatedRoutes: [], confidence: 1, evidence: [], criticality: { score: 80, level: 'HIGH', reasons: [], evidence: [], confidence: 1 }, status: 'OBSERVED', executionStatus: 'TESTED' },
    ];

    const assessment = BusinessCriticalityEvaluator.evaluatePageCriticality({
      page: dashboardPage,
      classification: {
        pageUrl: dashboardPage.url,
        category: 'DASHBOARD',
        confidence: 0.9,
        evidence: [],
        source: 'DETERMINISTIC',
        depth: 1,
      },
      workflows: mockWorkflows,
    });

    expect(assessment.score).toBeGreaterThanOrEqual(75);
    expect(assessment.reasons.some((r) => r.toLowerCase().includes('nexus') || r.toLowerCase().includes('workflows'))).toBe(true);
  });

  it('4. strictly bounds criticality score between 0 and 100', () => {
    const extremePage: DiscoveredPage = {
      ...basePage,
      url: 'http://127.0.0.1:3000/checkout/vip/admin/pay',
      forms: [
        {
          action: '',
          method: 'POST',
          sourcePage: '',
          fields: Array(10).fill({ name: 'f', type: 'text', required: true, selector: 'input' }),
        },
      ],
    };

    const assessment = BusinessCriticalityEvaluator.evaluatePageCriticality({
      page: extremePage,
      classification: { pageUrl: extremePage.url, category: 'PAYMENT', confidence: 1, evidence: [], source: 'DETERMINISTIC', depth: 1 },
      bugObservations: [{ type: 'HTTP_500_SERVER_ERROR' as any, pageUrl: extremePage.url, severity: 'critical', title: 'Fatal Crash', description: '', timestamp: '' }],
    });

    expect(assessment.score).toBeLessThanOrEqual(100);
    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.level).toBe('CRITICAL');
  });
});
