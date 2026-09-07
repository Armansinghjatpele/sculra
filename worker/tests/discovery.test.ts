import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser } from 'playwright';
import { ApplicationDiscovery } from '../src/discovery';
import { createFixtureServer, FixtureServer } from './fixtures/app';

describe('Application Discovery Engine with Real Playwright', () => {
  let fixture: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    fixture = await createFixtureServer();
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (fixture) await fixture.close();
  });

  it('should discover all fixture pages, links, buttons, forms, and responsive captures', async () => {
    const discovery = new ApplicationDiscovery(browser, fixture.url, {
      allowLocalhost: true,
      limits: {
        maxPages: 10,
        maxDepth: 3,
        maxTotalDiscoveryTimeMs: 30000,
      },
    });

    const appMap = await discovery.discover();

    // 1. Verify pages mapped
    expect(appMap.totalPages).toBeGreaterThanOrEqual(4);
    const urls = appMap.pages.map((p) => p.url);
    expect(urls).toContain(`${fixture.url}/`);
    expect(urls.some((u) => u.includes('/second'))).toBe(true);
    expect(urls.some((u) => u.includes('/form'))).toBe(true);

    // 2. Verify link discovery on home page
    const homePage = appMap.pages.find((p) => p.url === `${fixture.url}/`);
    expect(homePage).toBeDefined();
    expect(homePage?.title).toBe('Sculra Test Target Home');
    expect(homePage?.links.length).toBeGreaterThanOrEqual(4);

    // 3. Verify button extraction
    expect(appMap.totalButtons).toBeGreaterThanOrEqual(2);
    const exploreBtn = homePage?.elements.find((e) => e.text?.includes('Explore Features'));
    expect(exploreBtn).toBeDefined();
    expect(exploreBtn?.selector).toContain('explore-btn');

    // 4. Verify form discovery on /form page
    const formPage = appMap.pages.find((p) => p.url.includes('/form'));
    expect(formPage).toBeDefined();
    expect(formPage?.forms.length).toBe(1);

    const feedbackForm = formPage?.forms[0];
    expect(feedbackForm?.method).toBe('POST');
    expect(feedbackForm?.action).toBe('/api/feedback');
    expect(feedbackForm?.fields.length).toBeGreaterThanOrEqual(5);

    // Check fields in form
    const nameField = feedbackForm?.fields.find((f) => f.name === 'fullname');
    expect(nameField).toBeDefined();
    expect(nameField?.required).toBe(true);
    expect(nameField?.placeholder).toBe('Jane Doe');

    const emailField = feedbackForm?.fields.find((f) => f.name === 'email');
    expect(emailField).toBeDefined();
    expect(emailField?.type).toBe('email');

    const selectField = feedbackForm?.fields.find((f) => f.name === 'inquiry_type');
    expect(selectField).toBeDefined();
    expect(selectField?.options).toContain('Technical Support');
    expect(selectField?.options).toContain('Sales Inquiry');

    // 5. Verify console error and network error capture on /error page
    const errorPage = appMap.pages.find((p) => p.url.includes('/error'));
    if (errorPage) {
      expect(errorPage.consoleErrors.length).toBeGreaterThanOrEqual(1);
      expect(errorPage.consoleErrors.some((c) => c.message.includes('Sculra Intentional Runtime Error'))).toBe(true);
      expect(errorPage.networkErrors.some((n) => n.status === 500)).toBe(true);
    }

    // 6. Verify responsive captures (desktop, tablet, mobile)
    expect(appMap.responsiveCaptures).toBeDefined();
    expect(appMap.responsiveCaptures?.length).toBe(3);
    const viewports = appMap.responsiveCaptures?.map((r) => r.viewport.name);
    expect(viewports).toContain('desktop');
    expect(viewports).toContain('tablet');
    expect(viewports).toContain('mobile');
  }, 40000);

  it('should respect maxPages limit strictly', async () => {
    const discovery = new ApplicationDiscovery(browser, fixture.url, {
      allowLocalhost: true,
      limits: {
        maxPages: 2,
        maxDepth: 3,
      },
    });

    const appMap = await discovery.discover();
    expect(appMap.totalPages).toBeLessThanOrEqual(2);
  });

  it('should respect maxDepth limit strictly', async () => {
    const discovery = new ApplicationDiscovery(browser, fixture.url, {
      allowLocalhost: true,
      limits: {
        maxPages: 10,
        maxDepth: 0, // only root page
      },
    });

    const appMap = await discovery.discover();
    expect(appMap.totalPages).toBe(1);
  });
});
