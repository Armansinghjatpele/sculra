// ==============================================================================
// Sculra Deterministic User Journey End-to-End Live Playwright Test (worker/tests/journeys_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserRunner } from '../src/runner';
import { createFixtureServer, FixtureServer } from './fixtures/app';
import { CancellationToken } from '../src/types';

describe('Deterministic User Journey Live Execution', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  }, 30000);

  afterAll(async () => {
    if (fixture) {
      await fixture.close();
    }
  });

  it('executes discovery and plans & runs safe user journeys against local fixture', async () => {
    const runner = new BrowserRunner('journey-test-run-1', 'proj-1', {
      allowLocalhost: true,
      enableDiscovery: true,
      enableJourneys: true,
      headless: true,
      navigationTimeoutMs: 15000,
      runTimeoutMs: 60000,
      discoveryLimits: {
        maxPages: 5,
        maxDepth: 2,
        maxLinksPerPage: 10,
        maxElementsPerPage: 20,
        enableResponsiveCaptures: false, // keep test fast
      },
    });

    const result = await runner.run(fixture.url);

    // 1. Runner level assertions
    expect(result.status).toBe('passed');
    expect(result.applicationMap).toBeDefined();
    expect(result.applicationMap?.totalPages).toBeGreaterThanOrEqual(3);

    // 2. Journey level assertions
    expect(result.journeyResults).toBeDefined();
    expect(result.journeyResults!.length).toBeGreaterThanOrEqual(3);

    const categories = result.journeyResults!.map((j) => j.category);
    expect(categories).toContain('navigation');
    expect(categories).toContain('interaction');
    expect(categories).toContain('form');

    // 3. Navigation journey verification
    const navJourney = result.journeyResults!.find((j) => j.category === 'navigation');
    expect(navJourney).toBeDefined();
    expect(navJourney!.status).toBe('PASSED');
    expect(navJourney!.steps.length).toBeGreaterThanOrEqual(3);
    expect(navJourney!.pagesVisited.length).toBeGreaterThanOrEqual(2);

    // 4. Interaction journey verification (including broken no-op detection)
    const intJourney = result.journeyResults!.find((j) => j.category === 'interaction');
    expect(intJourney).toBeDefined();
    expect(intJourney!.steps.length).toBeGreaterThan(0);

    // Verify broken button no-op observation
    const noOpObs = intJourney!.observations.find((o) => o.type === 'CLICK_NO_OP');
    expect(noOpObs).toBeDefined();
    expect(noOpObs?.message).toContain('zero state or DOM mutations');

    // 5. Form usability & validation journey verification
    const formJourneys = result.journeyResults!.filter((j) => j.category === 'form');
    expect(formJourneys.length).toBeGreaterThanOrEqual(1);
    const allValidationObs = formJourneys
      .flatMap((j) => j.observations)
      .filter((o) => o.type === 'FORM_VALIDATION_FAILURE');
    expect(allValidationObs.length).toBeGreaterThanOrEqual(1);
    expect(allValidationObs.some((o) => (o.metadata?.requiredCount ?? 0) >= 1)).toBe(true);

    // 6. Screenshots collected
    expect(result.screenshots.length).toBeGreaterThan(0);
    const journeyScreenshots = result.screenshots.filter((s) => s.title.includes('Journey'));
    expect(journeyScreenshots.length).toBeGreaterThan(0);
  }, 90000);

  it('respects cancellation tokens during journey execution', async () => {
    const token: CancellationToken = { isCancelled: true };
    const runner = new BrowserRunner('cancelled-journey-run', 'proj-1', {
      allowLocalhost: true,
      enableDiscovery: true,
      enableJourneys: true,
    });

    const result = await runner.run(fixture.url, token);
    expect(result.status).toBe('cancelled');
  });
});
