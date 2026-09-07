// ==============================================================================
// Sculra Deterministic Playwright Browser Runner (worker/src/runner.ts)
// ==============================================================================
// Headless browser automation executing deterministic page navigation,
// evidence extraction (screenshots, console errors, network failures), and status resolution.

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  RunnerOptions,
  TestExecutionResult,
  CapturedConsoleError,
  CapturedNetworkError,
  CapturedScreenshot,
  CancellationToken,
} from './types';
import { validateTargetUrl } from './security';
import { WorkerLogger } from './logger';

export class BrowserRunner {
  private testRunId: string;
  private projectId?: string;
  private logger: WorkerLogger;
  private options: RunnerOptions;

  constructor(testRunId: string, projectId?: string, options: RunnerOptions = {}) {
    this.testRunId = testRunId;
    this.projectId = projectId;
    this.logger = new WorkerLogger(testRunId, projectId);
    this.options = {
      browserType: (process.env.TEST_BROWSER as any) || options.browserType || 'chromium',
      headless: options.headless ?? true,
      navigationTimeoutMs:
        options.navigationTimeoutMs ??
        (process.env.TEST_NAVIGATION_TIMEOUT_MS
          ? parseInt(process.env.TEST_NAVIGATION_TIMEOUT_MS, 10)
          : 15000),
      runTimeoutMs:
        options.runTimeoutMs ??
        (process.env.TEST_RUN_TIMEOUT_MS
          ? parseInt(process.env.TEST_RUN_TIMEOUT_MS, 10)
          : 30000),
      allowLocalhost: options.allowLocalhost ?? (process.env.NODE_ENV === 'test'),
      viewport: options.viewport ?? { width: 1280, height: 720 },
    };
  }

  async run(
    targetUrl: string,
    cancellationToken?: CancellationToken
  ): Promise<TestExecutionResult> {
    const startTime = Date.now();
    this.logger.log('test_run_started', { targetUrl });

    // 1. SSRF & Protocol Security Check
    const validation = validateTargetUrl(targetUrl, {
      allowLocalhost: this.options.allowLocalhost,
    });

    if (!validation.valid) {
      const durationMs = Date.now() - startTime;
      this.logger.error('ssrf_validation_failed', validation.error);
      return {
        status: 'failed',
        durationMs,
        consoleErrors: [],
        networkErrors: [],
        screenshots: [],
        failureReason: `Security Violation: ${validation.error}`,
      };
    }

    const safeUrl = validation.sanitizedUrl || targetUrl;
    const consoleErrors: CapturedConsoleError[] = [];
    const networkErrors: CapturedNetworkError[] = [];
    const screenshots: CapturedScreenshot[] = [];

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let pageTitle: string | undefined;
    let finalUrl: string | undefined;
    let statusCode: number | undefined;
    let failureReason: string | undefined;
    let status: 'passed' | 'failed' | 'cancelled' = 'passed';

    try {
      if (cancellationToken?.isCancelled) {
        return {
          status: 'cancelled',
          durationMs: Date.now() - startTime,
          consoleErrors: [],
          networkErrors: [],
          screenshots: [],
          failureReason: 'Test was cancelled prior to browser launch.',
        };
      }

      // 2. Launch Browser
      this.logger.log('browser_launching', {
        browser: this.options.browserType,
        headless: this.options.headless,
      });

      browser = await chromium.launch({
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      this.logger.log('browser_started');

      if (cancellationToken?.isCancelled) {
        await browser.close();
        return {
          status: 'cancelled',
          durationMs: Date.now() - startTime,
          consoleErrors: [],
          networkErrors: [],
          screenshots: [],
          failureReason: 'Test was cancelled after browser launch.',
        };
      }

      // 3. Create Isolated Browser Context
      context = await browser.newContext({
        viewport: this.options.viewport,
        userAgent: 'Sculra-Autonomous-QA-Engine/1.0',
        ignoreHTTPSErrors: false,
      });

      page = await context.newPage();
      page.setDefaultNavigationTimeout(this.options.navigationTimeoutMs || 15000);
      page.setDefaultTimeout(this.options.navigationTimeoutMs || 15000);

      // 4. Attach Event Listeners (Console Errors)
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const entry: CapturedConsoleError = {
            message: msg.text(),
            url: page?.url() || safeUrl,
            timestamp: new Date().toISOString(),
            location: msg.location()?.url
              ? `${msg.location().url}:${msg.location().lineNumber}`
              : undefined,
          };
          consoleErrors.push(entry);
          this.logger.log('console_error_detected', { text: msg.text() });
        }
      });

      // Page runtime errors
      page.on('pageerror', (err) => {
        const entry: CapturedConsoleError = {
          message: err.message,
          url: page?.url() || safeUrl,
          timestamp: new Date().toISOString(),
          location: err.stack?.split('\n')[1]?.trim(),
        };
        consoleErrors.push(entry);
        this.logger.log('page_error_detected', { message: err.message });
      });

      // 5. Attach Event Listeners (Network Failures & HTTP >= 400)
      page.on('requestfailed', (req) => {
        const failure = req.failure();
        const entry: CapturedNetworkError = {
          url: req.url(),
          method: req.method(),
          resourceType: req.resourceType(),
          errorText: failure?.errorText || 'Request failed',
          timestamp: new Date().toISOString(),
        };
        networkErrors.push(entry);
        this.logger.log('network_request_failed', {
          url: req.url(),
          method: req.method(),
          error: failure?.errorText,
        });
      });

      page.on('response', (res) => {
        const resStatus = res.status();
        if (resStatus >= 400) {
          const entry: CapturedNetworkError = {
            url: res.url(),
            method: res.request().method(),
            status: resStatus,
            resourceType: res.request().resourceType(),
            errorText: `HTTP ${resStatus} ${res.statusText()}`,
            timestamp: new Date().toISOString(),
          };
          networkErrors.push(entry);
        }
      });

      // 6. Navigate to Target URL
      this.logger.log('navigating_to_target', { url: safeUrl });
      const response = await page.goto(safeUrl, {
        waitUntil: 'load',
        timeout: this.options.navigationTimeoutMs,
      });

      if (response) {
        statusCode = response.status();
        this.logger.log('page_loaded', { statusCode });

        // Treat HTTP 5xx as fatal failure
        if (statusCode >= 500) {
          status = 'failed';
          failureReason = `Target returned server error response HTTP ${statusCode}`;
        }
      } else {
        this.logger.warn('page_loaded_no_response');
      }

      pageTitle = await page.title();
      finalUrl = page.url();

      this.logger.log('page_metadata_captured', {
        title: pageTitle,
        finalUrl,
      });

      // 7. Capture Viewport Screenshot
      try {
        const buffer = await page.screenshot({
          fullPage: false,
          type: 'png',
        });

        screenshots.push({
          title: `Initial Viewport Capture — ${pageTitle || 'Page'}`,
          buffer,
          mimeType: 'image/png',
          timestamp: new Date().toISOString(),
        });
        this.logger.log('screenshot_captured', { sizeBytes: buffer.length });
      } catch (screenshotErr: any) {
        this.logger.warn('screenshot_capture_failed', {
          message: screenshotErr.message,
        });
      }

    } catch (err: any) {
      status = 'failed';
      failureReason = err.message || 'Browser execution failed';
      this.logger.error('execution_exception', err);
    } finally {
      // Clean up browser resources
      try {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        this.logger.log('browser_closed');
      } catch (cleanupErr: any) {
        this.logger.warn('cleanup_warning', { message: cleanupErr.message });
      }
    }

    const durationMs = Date.now() - startTime;

    this.logger.log('test_run_completed', {
      status,
      durationMs,
      consoleErrorsCount: consoleErrors.length,
      networkErrorsCount: networkErrors.length,
      screenshotsCount: screenshots.length,
    });

    return {
      status,
      pageTitle,
      finalUrl,
      statusCode,
      durationMs,
      consoleErrors,
      networkErrors,
      screenshots,
      failureReason,
    };
  }
}
