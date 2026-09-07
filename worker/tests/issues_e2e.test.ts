// ==============================================================================
// Sculra Deterministic Bug Detection & Issue Creation Live Playwright Test (worker/tests/issues_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserRunner } from '../src/runner';
import { createFixtureServer, FixtureServer } from './fixtures/app';

describe('Deterministic Bug Detection Live Execution', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  }, 30000);

  afterAll(async () => {
    if (fixture) {
      await fixture.close();
    }
  });

  it('detects real broken controls and runtime issues against local fixture, generating structured bug observations', async () => {
    const runner = new BrowserRunner('bug-detection-run-1', 'proj-qa-1', {
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
        enableResponsiveCaptures: false,
      },
    });

    const result = await runner.run(fixture.url);

    // 1. Result level assertions
    expect(result.status).toBe('failed'); // Marked failed due to deterministic functional bugs
    expect(result.bugObservations).toBeDefined();
    expect(result.bugObservations!.length).toBeGreaterThanOrEqual(1);

    // 2. Broken control detection verification
    const brokenControlBug = result.bugObservations!.find((b) => b.type === 'BROKEN_CONTROL');
    expect(brokenControlBug).toBeDefined();
    expect(brokenControlBug?.title).toContain('Broken control');
    expect(brokenControlBug?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(brokenControlBug?.reproductionSteps.length).toBeGreaterThanOrEqual(1);

    // Verify structured reproduction steps
    const lastStep = brokenControlBug!.reproductionSteps[brokenControlBug!.reproductionSteps.length - 1];
    expect(lastStep.action).toBe('CLICK');
    expect(lastStep.observedBehavior).toContain('zero state or DOM mutations');

    // 3. Expected validation does NOT create false-positive bug
    const formBugs = result.bugObservations!.filter((b) => b.type === 'FORM_VALIDATION_FAILURE');
    expect(formBugs.length).toBe(0);

    // 4. Safety skipped actions do NOT create bugs
    const skippedBugs = result.bugObservations!.filter(
      (b) => b.title.includes('Delete Account') || b.title.includes('password')
    );
    expect(skippedBugs.length).toBe(0);
  }, 90000);
});
