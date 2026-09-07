// ==============================================================================
// Sculra Deterministic User Journey Unit Tests (worker/tests/journeys.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  isDangerousAction,
  isSensitiveField,
  getDeterministicFieldValue,
  DeterministicJourneyPlanner,
  formatJourneyTrace,
  generateMarkdownTrace,
  JourneyResult,
} from '../src/journeys';
import { ApplicationMap } from '../src/types';

describe('Deterministic Safety Policy', () => {
  describe('isDangerousAction', () => {
    it('identifies destructive deletion and account actions as dangerous', () => {
      expect(isDangerousAction('Delete Account').dangerous).toBe(true);
      expect(isDangerousAction('permanently remove project').dangerous).toBe(true);
      expect(isDangerousAction('Wipe all test data').dangerous).toBe(true);
      expect(isDangerousAction('Cancel subscription immediately').dangerous).toBe(true);
      expect(isDangerousAction('Deactivate account').dangerous).toBe(true);
    });

    it('identifies authentication termination as dangerous', () => {
      expect(isDangerousAction('Log out').dangerous).toBe(true);
      expect(isDangerousAction('Sign Out').dangerous).toBe(true);
      expect(isDangerousAction('deauth session').dangerous).toBe(true);
    });

    it('identifies monetary and checkout transactions as dangerous', () => {
      expect(isDangerousAction('Purchase now').dangerous).toBe(true);
      expect(isDangerousAction('Checkout $99').dangerous).toBe(true);
      expect(isDangerousAction('Pay Invoice').dangerous).toBe(true);
      expect(isDangerousAction('Transfer funds').dangerous).toBe(true);
      expect(isDangerousAction('Submit Payment').dangerous).toBe(true);
    });

    it('identifies production deploy and external publishing as dangerous', () => {
      expect(isDangerousAction('Publish to Production').dangerous).toBe(true);
      expect(isDangerousAction('Deploy release').dangerous).toBe(true);
      expect(isDangerousAction('Send broadcast email').dangerous).toBe(true);
    });

    it('allows safe interactive actions', () => {
      expect(isDangerousAction('Explore Features').dangerous).toBe(false);
      expect(isDangerousAction('Submit Feedback').dangerous).toBe(false);
      expect(isDangerousAction('Next Step').dangerous).toBe(false);
      expect(isDangerousAction('Open Documentation').dangerous).toBe(false);
      expect(isDangerousAction('Toggle Dark Mode').dangerous).toBe(false);
      expect(isDangerousAction('Search').dangerous).toBe(false);
    });
  });

  describe('isSensitiveField', () => {
    it('identifies password and secret fields as sensitive', () => {
      expect(isSensitiveField({ type: 'password' }).sensitive).toBe(true);
      expect(isSensitiveField({ name: 'current_password' }).sensitive).toBe(true);
      expect(isSensitiveField({ placeholder: 'Enter your passcode' }).sensitive).toBe(true);
      expect(isSensitiveField({ label: 'PIN' }).sensitive).toBe(true);
      expect(isSensitiveField({ name: 'api_key' }).sensitive).toBe(true);
      expect(isSensitiveField({ name: 'auth_token' }).sensitive).toBe(true);
      expect(isSensitiveField({ name: 'secret_key' }).sensitive).toBe(true);
    });

    it('identifies payment and banking fields as sensitive', () => {
      expect(isSensitiveField({ name: 'card_number' }).sensitive).toBe(true);
      expect(isSensitiveField({ placeholder: 'CVV' }).sensitive).toBe(true);
      expect(isSensitiveField({ label: 'Security Code' }).sensitive).toBe(true);
      expect(isSensitiveField({ name: 'bank_account' }).sensitive).toBe(true);
      expect(isSensitiveField({ name: 'routing_number' }).sensitive).toBe(true);
    });

    it('identifies government ID and SSN fields as sensitive', () => {
      expect(isSensitiveField({ name: 'ssn' }).sensitive).toBe(true);
      expect(isSensitiveField({ label: 'Social Security Number' }).sensitive).toBe(true);
      expect(isSensitiveField({ name: 'tax_id' }).sensitive).toBe(true);
      expect(isSensitiveField({ name: 'passport_number' }).sensitive).toBe(true);
    });

    it('allows safe form fields', () => {
      expect(isSensitiveField({ name: 'fullname', type: 'text' }).sensitive).toBe(false);
      expect(isSensitiveField({ name: 'email', type: 'email' }).sensitive).toBe(false);
      expect(isSensitiveField({ name: 'inquiry_type', label: 'Inquiry Category' }).sensitive).toBe(false);
      expect(isSensitiveField({ name: 'message', type: 'textarea' }).sensitive).toBe(false);
      expect(isSensitiveField({ name: 'q', type: 'search' }).sensitive).toBe(false);
    });
  });

  describe('getDeterministicFieldValue', () => {
    it('returns deterministic fixture data matching field types', () => {
      expect(getDeterministicFieldValue({ type: 'email', name: 'user_email' })).toBe('sculra.test.fixture@example.com');
      expect(getDeterministicFieldValue({ name: 'first_name' })).toBe('Sculra');
      expect(getDeterministicFieldValue({ name: 'last_name' })).toBe('Test');
      expect(getDeterministicFieldValue({ name: 'fullname' })).toBe('Sculra Test User');
      expect(getDeterministicFieldValue({ type: 'tel', name: 'phone' })).toBe('+15550199999');
      expect(getDeterministicFieldValue({ type: 'search', name: 'q' })).toBe('Sculra QA');
      expect(getDeterministicFieldValue({ type: 'number', name: 'quantity' })).toBe('1');
      expect(getDeterministicFieldValue({ type: 'url', name: 'website' })).toBe('https://example.com');
      expect(getDeterministicFieldValue({ type: 'textarea', name: 'comment' })).toBe('Sculra automated QA validation test message');
    });

    it('selects first non-empty option when options list is provided', () => {
      expect(getDeterministicFieldValue({ name: 'category', options: ['', 'support', 'sales'] })).toBe('support');
    });
  });
});

describe('DeterministicJourneyPlanner', () => {
  const mockApplicationMap: ApplicationMap = {
    startUrl: 'http://localhost:3000',
    discoveredAt: '2026-09-07T12:00:00Z',
    durationMs: 1500,
    totalPages: 3,
    totalLinks: 5,
    totalButtons: 4,
    totalForms: 1,
    totalInputs: 3,
    pages: [
      {
        url: 'http://localhost:3000',
        title: 'Home Page',
        depth: 0,
        status: 200,
        links: [
          { href: 'http://localhost:3000/features', text: 'Features', isInternal: true },
          { href: 'http://localhost:3000/contact', text: 'Contact', isInternal: true },
        ],
        elements: [
          { type: 'button', text: 'Explore Features', selector: '#explore-btn' },
          { type: 'button', text: 'Delete Project', selector: '#del-btn' }, // Should be skipped
        ],
        forms: [],
        consoleErrors: [],
        networkErrors: [],
      },
      {
        url: 'http://localhost:3000/features',
        title: 'Platform Features',
        depth: 1,
        status: 200,
        links: [{ href: 'http://localhost:3000', text: 'Home', isInternal: true }],
        elements: [{ type: 'button', text: 'Tab 1', selector: '#tab-1' }],
        forms: [],
        consoleErrors: [],
        networkErrors: [],
      },
      {
        url: 'http://localhost:3000/contact',
        title: 'Contact Us',
        depth: 1,
        status: 200,
        links: [],
        elements: [],
        forms: [
          {
            id: 'contact-form',
            action: '/api/contact',
            method: 'POST',
            submitSelector: '#submit-btn',
            submitText: 'Send Feedback',
            fields: [
              { name: 'fullname', type: 'text', required: true, selector: '#fullname' },
              { name: 'email', type: 'email', required: true, selector: '#email' },
              { name: 'password', type: 'password', required: true, selector: '#password' }, // Sensitive, should skip
            ],
          },
        ],
        consoleErrors: [],
        networkErrors: [],
      },
    ],
  };

  it('generates expected journey categories from ApplicationMap', async () => {
    const planner = new DeterministicJourneyPlanner();
    const journeys = await planner.plan(mockApplicationMap);

    expect(journeys.length).toBeGreaterThanOrEqual(3);

    const categories = journeys.map((j) => j.category);
    expect(categories).toContain('navigation');
    expect(categories).toContain('interaction');
    expect(categories).toContain('form');
    expect(categories).toContain('responsive');
  });

  it('filters dangerous buttons during interaction journey planning', async () => {
    const planner = new DeterministicJourneyPlanner();
    const journeys = await planner.plan(mockApplicationMap);

    const interactionJourney = journeys.find((j) => j.category === 'interaction');
    expect(interactionJourney).toBeDefined();

    const deleteStep = interactionJourney?.steps.find((s) => s.targetDescription.includes('Delete Project'));
    expect(deleteStep).toBeUndefined(); // Filtered out by safety policy

    const exploreStep = interactionJourney?.steps.find((s) => s.targetDescription.includes('Explore Features'));
    expect(exploreStep).toBeDefined();
  });

  it('filters sensitive fields during form journey planning', async () => {
    const planner = new DeterministicJourneyPlanner();
    const journeys = await planner.plan(mockApplicationMap);

    const formJourney = journeys.find((j) => j.category === 'form');
    expect(formJourney).toBeDefined();

    const passwordStep = formJourney?.steps.find((s) => s.targetDescription.includes('password'));
    expect(passwordStep).toBeUndefined(); // Filtered out by sensitive field filter

    const nameStep = formJourney?.steps.find((s) => s.targetDescription.includes('fullname'));
    expect(nameStep).toBeDefined();
  });
});

describe('Journey Trace Formatting', () => {
  const sampleResult: JourneyResult = {
    journeyId: 'journey-nav-test',
    name: 'Primary Navigation',
    category: 'navigation',
    status: 'PASSED',
    startedAt: '2026-09-07T12:00:00Z',
    finishedAt: '2026-09-07T12:00:05Z',
    durationMs: 5000,
    viewport: { width: 1280, height: 720, name: 'desktop' },
    actionsAttempted: 2,
    actionsPassed: 2,
    actionsFailed: 0,
    actionsSkipped: 0,
    pagesVisited: ['http://localhost:3000', 'http://localhost:3000/features'],
    observations: [
      {
        type: 'CONSOLE_ERROR',
        message: 'Mock warning',
        severity: 'warning',
        pageUrl: 'http://localhost:3000',
        timestamp: '2026-09-07T12:00:01Z',
      },
    ],
    steps: [
      {
        stepId: 'step-1',
        action: 'NAVIGATE',
        targetDescription: 'Home',
        status: 'PASSED',
        startedAt: '2026-09-07T12:00:00Z',
        finishedAt: '2026-09-07T12:00:02Z',
        durationMs: 2000,
        beforeUrl: 'about:blank',
        afterUrl: 'http://localhost:3000',
        consoleErrors: [],
        networkErrors: [],
        observations: [],
      },
      {
        stepId: 'step-2',
        action: 'CLICK',
        targetDescription: 'Features Link',
        status: 'PASSED',
        startedAt: '2026-09-07T12:00:02Z',
        finishedAt: '2026-09-07T12:00:04Z',
        durationMs: 2000,
        beforeUrl: 'http://localhost:3000',
        afterUrl: 'http://localhost:3000/features',
        consoleErrors: [],
        networkErrors: [],
        observations: [],
      },
    ],
  };

  it('formats structured trace correctly', () => {
    const formatted = formatJourneyTrace(sampleResult);
    expect(formatted.journeyId).toBe('journey-nav-test');
    expect(formatted.steps.length).toBe(2);
    expect(formatted.steps[1].transition).toBe('http://localhost:3000 → http://localhost:3000/features');
    expect(formatted.observationsSummary.length).toBe(1);
  });

  it('generates markdown trace report', () => {
    const md = generateMarkdownTrace([sampleResult]);
    expect(md).toContain('# Sculra Deterministic User Journey Execution Trace');
    expect(md).toContain('## Journey: Primary Navigation (PASSED)');
    expect(md).toContain('| 1 | `NAVIGATE` | Home | **PASSED** |');
    expect(md).toContain('- **[CONSOLE_ERROR]** (warning): Mock warning');
  });
});
