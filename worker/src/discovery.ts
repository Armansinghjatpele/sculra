// ==============================================================================
// Sculra Autonomous Application Discovery Engine (worker/src/discovery.ts)
// ==============================================================================
// Performs safe, bounded, deterministic crawling of a target web application.
// Extracts pages, links, buttons, forms, inputs, and responsive layout evidence.

import { Browser, BrowserContext, Page } from 'playwright';
import {
  ApplicationMap,
  DiscoveredPage,
  DiscoveredElement,
  DiscoveredForm,
  DiscoveredFormField,
  DiscoveredLink,
  DiscoveryLimits,
  ViewportCapture,
  ViewportConfig,
  CapturedConsoleError,
  CapturedNetworkError,
  CapturedScreenshot,
  CancellationToken,
} from './types';
import { normalizeUrl, isSameOrigin } from './discoveryUtils';
import { validateTargetUrl } from './security/ssrf';
import { WorkerLogger } from './logger';

export interface DiscoveryOptions {
  limits?: Partial<DiscoveryLimits>;
  allowLocalhost?: boolean;
  cancellationToken?: CancellationToken;
  logger?: WorkerLogger;
  existingContext?: BrowserContext;
}

const DEFAULT_VIEWPORTS: ViewportConfig[] = [
  { width: 1440, height: 900, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 390, height: 844, name: 'mobile' },
];

export const DEFAULT_DISCOVERY_LIMITS: DiscoveryLimits = {
  maxPages: 25,
  maxDepth: 3,
  maxLinksPerPage: 50,
  maxInteractionsPerPage: 100,
  maxTotalDiscoveryTimeMs: 60000,
  viewports: DEFAULT_VIEWPORTS,
};

export class ApplicationDiscovery {
  private browser: Browser;
  private startUrl: string;
  private limits: DiscoveryLimits;
  private allowLocalhost: boolean;
  private cancellationToken?: CancellationToken;
  private logger: WorkerLogger;
  private options: DiscoveryOptions;

  constructor(browser: Browser, startUrl: string, options: DiscoveryOptions = {}) {
    this.browser = browser;
    this.startUrl = startUrl;
    this.options = options;
    this.limits = { ...DEFAULT_DISCOVERY_LIMITS, ...(options.limits || {}) };
    this.allowLocalhost = options.allowLocalhost ?? false;
    this.cancellationToken = options.cancellationToken;
    this.logger = options.logger || new WorkerLogger('discovery');
  }

  async discover(): Promise<ApplicationMap> {
    const startTime = Date.now();
    this.logger.log('discovery_started', {
      startUrl: this.startUrl,
      maxPages: this.limits.maxPages,
      maxDepth: this.limits.maxDepth,
      maxTotalDiscoveryTimeMs: this.limits.maxTotalDiscoveryTimeMs,
    });

    const normalizedStart = normalizeUrl(this.startUrl, this.startUrl) || this.startUrl;
    const visitedUrls = new Set<string>();
    const discoveredPages: DiscoveredPage[] = [];
    const responsiveCaptures: ViewportCapture[] = [];

    const queue: Array<{ url: string; depth: number; sourceUrl?: string }> = [
      { url: normalizedStart, depth: 0 },
    ];

    let context: BrowserContext | null = null;
    let page: Page | null = null;
    const isExternalContext = !!this.options.existingContext;

    try {
      context = this.options.existingContext || (await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Sculra-Autonomous-Discovery-Engine/1.0',
        ignoreHTTPSErrors: false,
      }));

      page = await context.newPage();
      page.setDefaultNavigationTimeout(15000);
      page.setDefaultTimeout(15000);

      while (
        queue.length > 0 &&
        discoveredPages.length < this.limits.maxPages &&
        Date.now() - startTime < this.limits.maxTotalDiscoveryTimeMs
      ) {
        if (this.cancellationToken?.isCancelled) {
          this.logger.log('discovery_cancelled');
          break;
        }

        const current = queue.shift();
        if (!current) break;

        const { url: currentUrl, depth, sourceUrl } = current;

        // Skip if already visited
        if (visitedUrls.has(currentUrl)) {
          continue;
        }
        visitedUrls.add(currentUrl);

        // Security check on target URL
        const validation = validateTargetUrl(currentUrl, {
          allowLocalhost: this.allowLocalhost,
        });
        if (!validation.valid) {
          this.logger.warn('discovery_url_blocked', { url: currentUrl, reason: validation.error });
          continue;
        }

        this.logger.log('discovering_page', { url: currentUrl, depth, sourceUrl });

        const pageConsoleErrors: CapturedConsoleError[] = [];
        const pageNetworkErrors: CapturedNetworkError[] = [];

        // Attach listeners for this page visit
        const consoleListener = (msg: any) => {
          if (msg.type() === 'error') {
            pageConsoleErrors.push({
              message: msg.text(),
              url: currentUrl,
              timestamp: new Date().toISOString(),
              location: msg.location()?.url
                ? `${msg.location().url}:${msg.location().lineNumber}`
                : undefined,
            });
          }
        };

        const pageErrorListener = (err: Error) => {
          pageConsoleErrors.push({
            message: err.message,
            url: currentUrl,
            timestamp: new Date().toISOString(),
            location: err.stack?.split('\n')[1]?.trim(),
          });
        };

        const requestFailedListener = (req: any) => {
          const failure = req.failure();
          pageNetworkErrors.push({
            url: req.url(),
            method: req.method(),
            resourceType: req.resourceType(),
            errorText: failure?.errorText || 'Request failed',
            timestamp: new Date().toISOString(),
          });
        };

        const responseListener = (res: any) => {
          const status = res.status();
          if (status >= 400) {
            pageNetworkErrors.push({
              url: res.url(),
              method: res.request().method(),
              status,
              resourceType: res.request().resourceType(),
              errorText: `HTTP ${status} ${res.statusText()}`,
              timestamp: new Date().toISOString(),
            });
          }
        };

        page.on('console', consoleListener);
        page.on('pageerror', pageErrorListener);
        page.on('requestfailed', requestFailedListener);
        page.on('response', responseListener);

        try {
          // Navigate to page
          const response = await page.goto(currentUrl, {
            waitUntil: 'load',
            timeout: 15000,
          });

          // Wait a moment for dynamic rendering / hydrate
          await page.waitForTimeout(200);

          const title = (await page.title()) || 'Untitled Page';
          const resolvedUrl = page.url();

          // Capture viewport screenshot
          let screenshot: CapturedScreenshot | undefined;
          try {
            const buffer = await page.screenshot({ fullPage: false, type: 'png' });
            screenshot = {
              title: `Page Screenshot: ${title}`,
              buffer,
              mimeType: 'image/png',
              timestamp: new Date().toISOString(),
            };
          } catch (scErr: any) {
            this.logger.warn('screenshot_capture_failed', { message: scErr.message });
          }

          // Evaluate DOM to extract semantic structure
          const extraction = await page.evaluate(() => {
            function getResilientSelector(el: Element): string {
              if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) {
                return `#${el.id}`;
              }
              const testId =
                el.getAttribute('data-testid') ||
                el.getAttribute('data-test-id') ||
                el.getAttribute('data-cy');
              if (testId) {
                return `[data-testid="${testId}"]`;
              }
              const ariaLabel = el.getAttribute('aria-label');
              if (ariaLabel) {
                return `[aria-label="${ariaLabel.trim().replace(/"/g, '\\"')}"]`;
              }
              const name = el.getAttribute('name');
              if (name && el.tagName) {
                return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`;
              }
              const role = el.getAttribute('role');
              const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
              if (text && (el.tagName === 'BUTTON' || el.tagName === 'A' || role === 'button')) {
                return `${el.tagName.toLowerCase()}:has-text("${text.replace(/"/g, '\\"')}")`;
              }
              const type = el.getAttribute('type');
              if (type) {
                return `${el.tagName.toLowerCase()}[type="${type}"]`;
              }
              return el.tagName.toLowerCase();
            }

            // 1. Extract Links
            const anchorElements = Array.from(document.querySelectorAll('a[href]'));
            const extractedLinks = anchorElements.map((a) => {
              const href = a.getAttribute('href') || '';
              const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
              const isInternal =
                href.startsWith('/') ||
                href.startsWith('./') ||
                href.startsWith('../') ||
                (href.startsWith('http') && href.includes(window.location.host));
              return { text: text || href, href, isInternal };
            });

            // 2. Extract Buttons
            const buttonElements = Array.from(
              document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')
            );
            const extractedButtons = buttonElements.map((btn) => {
              const text = (btn.textContent || (btn as HTMLInputElement).value || '').trim().replace(/\s+/g, ' ');
              const ariaLabel = btn.getAttribute('aria-label') || undefined;
              const role = btn.getAttribute('role') || 'button';
              const tagName = btn.tagName.toLowerCase();
              const rect = btn.getBoundingClientRect();
              const selector = getResilientSelector(btn);

              return {
                type: 'button' as const,
                role,
                accessibleName: ariaLabel || text,
                text,
                tagName,
                selector,
                boundingBox: {
                  x: Math.round(rect.x),
                  y: Math.round(rect.y),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                },
              };
            });

            // 3. Extract Forms and Form Fields
            const formElements = Array.from(document.querySelectorAll('form'));
            const extractedForms = formElements.map((form) => {
              const action = form.getAttribute('action') || undefined;
              const method = (form.getAttribute('method') || 'GET').toUpperCase();
              const id = form.id || undefined;

              const fields: any[] = [];
              const fieldElements = Array.from(
                form.querySelectorAll('input, select, textarea')
              ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

              for (const field of fieldElements) {
                const name = field.getAttribute('name') || field.id || '';
                const type = field.getAttribute('type') || field.tagName.toLowerCase();
                const placeholder = field.getAttribute('placeholder') || undefined;
                const required = field.required || field.hasAttribute('required');

                // Try to find label
                let label: string | undefined;
                if (field.id) {
                  const lbl = document.querySelector(`label[for="${field.id}"]`);
                  if (lbl) label = (lbl.textContent || '').trim();
                }
                if (!label && field.closest('label')) {
                  label = (field.closest('label')?.textContent || '').trim();
                }
                if (!label && field.getAttribute('aria-label')) {
                  label = field.getAttribute('aria-label') || undefined;
                }

                let options: string[] | undefined;
                if (field.tagName.toLowerCase() === 'select') {
                  const selectEl = field as HTMLSelectElement;
                  options = Array.from(selectEl.options).map((opt) => opt.text.trim());
                }

                fields.push({
                  name: name || `field_${fields.length + 1}`,
                  type,
                  label,
                  placeholder,
                  required,
                  options,
                  selector: getResilientSelector(field),
                });
              }

              // Submit button
              const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
              const submitText = submitBtn
                ? (submitBtn.textContent || (submitBtn as HTMLInputElement).value || '').trim()
                : undefined;
              const submitSelector = submitBtn ? getResilientSelector(submitBtn) : undefined;

              return {
                id,
                action,
                method,
                fields,
                submitSelector,
                submitText,
              };
            });

            // 4. Extract Standalone Inputs (not inside a form)
            const standaloneInputs = Array.from(
              document.querySelectorAll('input:not(form input), select:not(form select), textarea:not(form textarea)')
            ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

            const extractedInputs = standaloneInputs.map((input) => {
              const name = input.getAttribute('name') || input.id || '';
              const type = input.getAttribute('type') || input.tagName.toLowerCase();
              const ariaLabel = input.getAttribute('aria-label') || undefined;
              const rect = input.getBoundingClientRect();

              return {
                type: 'input' as const,
                role: input.getAttribute('role') || undefined,
                accessibleName: ariaLabel || name,
                text: name,
                tagName: input.tagName.toLowerCase(),
                selector: getResilientSelector(input),
                boundingBox: {
                  x: Math.round(rect.x),
                  y: Math.round(rect.y),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                },
              };
            });

            // 5. Navigation landmarks
            const navElements = Array.from(document.querySelectorAll('nav, [role="navigation"], header'));
            const extractedNavs = navElements.map((nav) => ({
              type: 'navigation' as const,
              role: nav.getAttribute('role') || 'navigation',
              accessibleName: nav.getAttribute('aria-label') || undefined,
              text: (nav.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50),
              tagName: nav.tagName.toLowerCase(),
              selector: getResilientSelector(nav),
            }));

            // 6. Basic layout metadata
            const body = document.body;
            const docEl = document.documentElement;
            const layoutMetadata = {
              bodyWidth: body ? body.clientWidth : 0,
              bodyHeight: body ? body.clientHeight : 0,
              scrollWidth: docEl ? docEl.scrollWidth : 0,
              scrollHeight: docEl ? docEl.scrollHeight : 0,
            };

            return {
              links: extractedLinks,
              buttons: extractedButtons,
              forms: extractedForms,
              standaloneInputs: extractedInputs,
              navs: extractedNavs,
              layoutMetadata,
            };
          });

          // Compile discovered elements for this page
          const pageElements: DiscoveredElement[] = [
            ...extraction.buttons.map((b) => ({ ...b, sourcePage: currentUrl })),
            ...extraction.standaloneInputs.map((i) => ({ ...i, sourcePage: currentUrl })),
            ...extraction.navs.map((n) => ({ ...n, sourcePage: currentUrl })),
          ];

          const pageForms: DiscoveredForm[] = extraction.forms.map((f) => ({
            ...f,
            sourcePage: currentUrl,
          }));

          const pageLinks: DiscoveredLink[] = extraction.links.map((l) => ({
            ...l,
            sourcePage: currentUrl,
          }));

          // Record discovered page
          discoveredPages.push({
            url: currentUrl,
            title,
            depth,
            sourceUrl,
            screenshot,
            elementsCount: pageElements.length + pageForms.reduce((sum, f) => sum + f.fields.length, 0),
            elements: pageElements.slice(0, this.limits.maxInteractionsPerPage),
            forms: pageForms,
            links: pageLinks,
            consoleErrors: [...pageConsoleErrors],
            networkErrors: [...pageNetworkErrors],
            timestamp: new Date().toISOString(),
          });

          // Perform Responsive Viewport Captures on Start Page (depth 0)
          if (depth === 0 && this.limits.viewports && this.limits.viewports.length > 0) {
            for (const vp of this.limits.viewports) {
              try {
                await page.setViewportSize({ width: vp.width, height: vp.height });
                await page.waitForTimeout(150);

                const vpLayout = await page.evaluate(() => {
                  const docEl = document.documentElement;
                  const body = document.body;
                  return {
                    bodyWidth: body ? body.clientWidth : 0,
                    bodyHeight: body ? body.clientHeight : 0,
                    scrollWidth: docEl ? docEl.scrollWidth : 0,
                    scrollHeight: docEl ? docEl.scrollHeight : 0,
                  };
                });

                const vpBuffer = await page.screenshot({ fullPage: false, type: 'png' });
                responsiveCaptures.push({
                  viewport: vp,
                  pageUrl: currentUrl,
                  title: `${title} (${vp.name.toUpperCase()} - ${vp.width}x${vp.height})`,
                  screenshot: {
                    title: `Responsive Viewport: ${vp.name} (${vp.width}x${vp.height})`,
                    buffer: vpBuffer,
                    mimeType: 'image/png',
                    timestamp: new Date().toISOString(),
                    viewportName: vp.name,
                  },
                  layoutMetadata: vpLayout,
                });
              } catch (vpErr: any) {
                this.logger.warn('responsive_capture_failed', {
                  viewport: vp.name,
                  message: vpErr.message,
                });
              }
            }

            // Restore base viewport
            await page.setViewportSize({ width: 1280, height: 720 });
          }

          // Queue newly discovered same-origin links if depth < maxDepth
          if (depth < this.limits.maxDepth) {
            let linksQueuedForPage = 0;
            for (const link of extraction.links) {
              if (linksQueuedForPage >= this.limits.maxLinksPerPage) break;

              const normalized = normalizeUrl(link.href, currentUrl);
              if (normalized && !visitedUrls.has(normalized) && isSameOrigin(normalized, normalizedStart)) {
                const alreadyQueued = queue.some((q) => q.url === normalized);
                if (!alreadyQueued) {
                  queue.push({ url: normalized, depth: depth + 1, sourceUrl: currentUrl });
                  linksQueuedForPage++;
                }
              }
            }
          }

        } catch (pageErr: any) {
          this.logger.error('page_discovery_error', { url: currentUrl, message: pageErr.message });
          // Still record page error
          discoveredPages.push({
            url: currentUrl,
            title: 'Failed to Load Page',
            depth,
            sourceUrl,
            elementsCount: 0,
            elements: [],
            forms: [],
            links: [],
            consoleErrors: [
              ...pageConsoleErrors,
              {
                message: pageErr.message || 'Page navigation failed',
                url: currentUrl,
                timestamp: new Date().toISOString(),
              },
            ],
            networkErrors: [...pageNetworkErrors],
            timestamp: new Date().toISOString(),
          });
        } finally {
          // Remove page listeners before next iteration
          page.off('console', consoleListener);
          page.off('pageerror', pageErrorListener);
          page.off('requestfailed', requestFailedListener);
          page.off('response', responseListener);
        }
      }
    } finally {
      if (page) await page.close().catch(() => {});
      if (!isExternalContext && context) await context.close().catch(() => {});
    }

    // Calculate totals across application map
    let totalLinks = 0;
    let totalButtons = 0;
    let totalForms = 0;
    let totalInputs = 0;

    for (const p of discoveredPages) {
      totalLinks += p.links.length;
      totalButtons += p.elements.filter((e) => e.type === 'button').length;
      totalForms += p.forms.length;
      totalInputs +=
        p.elements.filter((e) => e.type === 'input').length +
        p.forms.reduce((sum, f) => sum + f.fields.length, 0);
    }

    const applicationMap: ApplicationMap = {
      startUrl: normalizedStart,
      discoveredAt: new Date().toISOString(),
      totalPages: discoveredPages.length,
      totalLinks,
      totalButtons,
      totalForms,
      totalInputs,
      pages: discoveredPages,
      responsiveCaptures,
    };

    this.logger.log('discovery_completed', {
      totalPages: applicationMap.totalPages,
      totalLinks: applicationMap.totalLinks,
      totalButtons: applicationMap.totalButtons,
      totalForms: applicationMap.totalForms,
      totalInputs: applicationMap.totalInputs,
      responsiveCaptures: responsiveCaptures.length,
      durationMs: Date.now() - startTime,
    });

    return applicationMap;
  }
}
