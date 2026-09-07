// ==============================================================================
// Sculra Multi-Iteration Adaptive AI QA Orchestration Tests (worker/tests/ai_qa_adaptive.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { AIQAOrchestrator } from '../src/ai-qa/orchestrator';
import { MockAIQAProvider } from '../src/ai-qa/mock-provider';
import { ApplicationMap, CancellationToken } from '../src/types';
import { Browser } from 'playwright';

// Create a mock Playwright Browser for fast unit/integration testing
function createMockBrowser(options: { failOnCall?: number } = {}): Browser {
  let callCount = 0;
  let currentUrl = 'http://127.0.0.1:3000';
  return {
    newContext: async () => ({
      newPage: async () => {
        const pageObj: any = {
          setDefaultNavigationTimeout: () => {},
          setDefaultTimeout: () => {},
          on: (_event: string, _cb: any) => pageObj,
          off: (_event: string, _cb: any) => pageObj,
          removeListener: (_event: string, _cb: any) => pageObj,
          goto: async (url: string) => {
            currentUrl = url;
            return { status: () => 200 };
          },
          title: async () => 'Test Page',
          url: () => currentUrl,
          content: async () => '<html><body><h1>Test Page</h1></body></html>',
          screenshot: async () => Buffer.from('mock-png'),
          waitForTimeout: async () => {},
          locator: () => {
            const loc: any = {
              count: async () => 1,
              first: () => loc,
              waitFor: async () => {},
              click: async () => {
                callCount++;
                if (options.failOnCall === callCount) {
                  throw new Error(`Simulated element click failure on call ${callCount}`);
                }
              },
              fill: async () => {},
              selectOption: async () => {},
              check: async () => {},
              uncheck: async () => {},
              press: async () => {},
              isVisible: async () => true,
            };
            return loc;
          },
          getByRole: () => pageObj.locator(),
          getByLabel: () => pageObj.locator(),
          getByPlaceholder: () => pageObj.locator(),
          evaluate: async (fn: any) => {
            if (typeof fn === 'function') return 100;
            return { formFound: true, requiredCount: 0, invalidCount: 0 };
          },
          close: async () => {},
        };
        return pageObj;
      },
      close: async () => {},
    }),
    close: async () => {},
  } as unknown as Browser;
}

describe('Adaptive AI QA Multi-Iteration Loop', () => {
  const mockAppMap: ApplicationMap = {
    startUrl: 'http://127.0.0.1:3000',
    discoveredAt: new Date().toISOString(),
    totalPages: 3,
    totalLinks: 3,
    totalButtons: 4,
    totalForms: 1,
    totalInputs: 2,
    pages: [
      {
        url: 'http://127.0.0.1:3000',
        title: 'Home Page',
        depth: 0,
        elementsCount: 2,
        elements: [
          { type: 'button', role: 'button', text: 'Get Started', selector: '#get-started', isInteractive: true },
        ],
        forms: [],
        links: [
          { href: 'http://127.0.0.1:3000/pricing', text: 'Pricing', isInternal: true },
        ],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
      {
        url: 'http://127.0.0.1:3000/pricing',
        title: 'Pricing Page',
        depth: 1,
        elementsCount: 1,
        elements: [
          { type: 'button', role: 'button', text: 'Choose Pro', selector: '#pro-plan', isInteractive: true },
        ],
        forms: [],
        links: [],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
      {
        url: 'http://127.0.0.1:3000/signup',
        title: 'Registration Page',
        depth: 1,
        elementsCount: 2,
        elements: [
          { type: 'button', role: 'button', text: 'Submit', selector: '#submit-btn', isInteractive: true },
        ],
        forms: [
          {
            action: '/api/register',
            method: 'POST',
            fields: [
              { name: 'email', type: 'email', required: true, selector: 'input[name="email"]' },
            ],
          },
        ],
        links: [],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  it('adapts across iterations and covers uncovered application routes', async () => {
    const mockBrowser = createMockBrowser();
    const provider = new MockAIQAProvider();

    const orchestrator = new AIQAOrchestrator(mockBrowser, 'http://127.0.0.1:3000', {
      provider,
      config: {
        enabled: true,
        maxIterations: 3,
        maxCalls: 5,
        maxTotalActions: 30,
      },
      allowLocalhost: true,
    });

    const output = await orchestrator.execute(
      'run-adaptive-1',
      'proj-1',
      'org-1',
      mockAppMap
    );

    expect(output.iterationsCount).toBe(3);
    expect(output.plans.length).toBe(3);
    expect(output.results.length).toBe(3);

    // Iteration 1 tested Home, Iteration 2 tested Pricing, Iteration 3 tested Signup
    expect(output.plans[0].actions[0].pageUrl).toContain('http://127.0.0.1:3000');
    expect(output.plans[1].actions[0].pageUrl).toContain('http://127.0.0.1:3000/pricing');
    expect(output.plans[2].actions[0].pageUrl).toContain('http://127.0.0.1:3000/signup');

    // Verify coverage summary
    expect(output.stateSummary).toBeDefined();
    expect(output.stateSummary?.coverage.pages.visited).toBe(3);
    expect(output.finalStopReason).toBe('BUDGET_EXHAUSTED');
  });

  it('performs failure-driven exploration when a previous iteration encounters an error', async () => {
    const mockBrowser = createMockBrowser({ failOnCall: 1 });

    const provider = new MockAIQAProvider();
    const orchestrator = new AIQAOrchestrator(mockBrowser, 'http://127.0.0.1:3000', {
      provider,
      config: {
        enabled: true,
        maxIterations: 2,
      },
      allowLocalhost: true,
    });

    const output = await orchestrator.execute(
      'run-adaptive-failure',
      'proj-1',
      undefined,
      mockAppMap
    );

    expect(output.plans.length).toBe(2);
    // Iteration 1 encountered a step failure
    expect(output.results[0].executedJourney?.actionsFailed).toBe(1);
    expect(['FAILED', 'PARTIAL'].includes(output.results[0].executedJourney?.status || '')).toBe(true);

    // Iteration 2 noticed the failure and formulated an adaptive investigation plan
    expect(output.plans[1].reasoningSummary).toContain('Adaptive Investigation');
    expect(output.plans[1].hypotheses[0].description).toContain('Investigating whether');
  });

  it('stops immediately when user cancellation is requested', async () => {
    const mockBrowser = createMockBrowser();
    const provider = new MockAIQAProvider();

    const cancellationToken: CancellationToken = {
      isCancelled: false,
    };

    const orchestrator = new AIQAOrchestrator(mockBrowser, 'http://127.0.0.1:3000', {
      provider,
      config: {
        enabled: true,
        maxIterations: 3,
      },
      allowLocalhost: true,
    });

    // Cancel after 1 iteration
    cancellationToken.isCancelled = true;

    const output = await orchestrator.execute(
      'run-adaptive-cancel',
      'proj-1',
      undefined,
      mockAppMap,
      [],
      [],
      cancellationToken
    );

    expect(output.finalStopReason).toBe('CANCELLED');
    expect(output.plans.length).toBe(0);
  });
});
