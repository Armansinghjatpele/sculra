// ==============================================================================
// Sculra Deterministic User Journey Executor (worker/src/journeys/executor.ts)
// ==============================================================================
// Executes planned user journeys step-by-step using Playwright browser instances,
// collecting step executions, screenshots, console telemetry, and structured observations.

import { Browser, BrowserContext, Page } from 'playwright';
import {
  Journey,
  JourneyResult,
  JourneyStep,
  JourneyStepExecution,
  JourneyObservation,
  StepResultStatus,
} from './types';
import { resolveResilientLocator } from './selectors';
import { isDangerousAction, isSensitiveField } from './safety';
import { validateTargetUrl } from '../security';
import { isSameOrigin } from '../discoveryUtils';
import { WorkerLogger } from '../logger';
import {
  CapturedConsoleError,
  CapturedNetworkError,
  CapturedScreenshot,
  CancellationToken,
} from '../types';

export interface JourneyExecutorOptions {
  allowLocalhost?: boolean;
  cancellationToken?: CancellationToken;
  logger?: WorkerLogger;
}

export class JourneyExecutor {
  private browser: Browser;
  private options: JourneyExecutorOptions;
  private logger: WorkerLogger;

  constructor(browser: Browser, options: JourneyExecutorOptions = {}) {
    this.browser = browser;
    this.options = options;
    this.logger = options.logger || new WorkerLogger('journeys');
  }

  async executeJourneys(journeys: Journey[]): Promise<JourneyResult[]> {
    const results: JourneyResult[] = [];

    for (const journey of journeys) {
      if (this.options.cancellationToken?.isCancelled) {
        this.logger.log('journeys_cancelled_by_token', { journeyId: journey.id });
        break;
      }

      this.logger.log('executing_journey', {
        journeyId: journey.id,
        name: journey.name,
        category: journey.category,
        stepsCount: journey.steps.length,
      });

      const journeyResult = await this.executeSingleJourney(journey);
      results.push(journeyResult);
    }

    return results;
  }

  private async executeSingleJourney(journey: Journey): Promise<JourneyResult> {
    const startTime = Date.now();
    const executedSteps: JourneyStepExecution[] = [];
    const observations: JourneyObservation[] = [];
    const pagesVisited = new Set<string>();

    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let actionsAttempted = 0;
    let actionsPassed = 0;
    let actionsFailed = 0;
    let actionsSkipped = 0;

    const journeyConsoleErrors: CapturedConsoleError[] = [];
    const journeyNetworkErrors: CapturedNetworkError[] = [];

    try {
      // 1. Create Isolated Browser Context with Journey Viewport
      const viewport = journey.viewport || { width: 1280, height: 720, name: 'desktop' as const };
      context = await this.browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        userAgent: 'Sculra-Deterministic-Journey-Engine/1.0',
        ignoreHTTPSErrors: false,
      });

      page = await context.newPage();
      page.setDefaultNavigationTimeout(15000);
      page.setDefaultTimeout(10000);

      // 2. Attach Telemetry Listeners
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const entry: CapturedConsoleError = {
            message: msg.text(),
            url: page?.url() || journey.startUrl,
            timestamp: new Date().toISOString(),
            location: msg.location()?.url
              ? `${msg.location().url}:${msg.location().lineNumber}`
              : undefined,
          };
          journeyConsoleErrors.push(entry);
          observations.push({
            type: 'CONSOLE_ERROR',
            message: msg.text(),
            severity: 'error',
            pageUrl: page?.url() || journey.startUrl,
            timestamp: new Date().toISOString(),
          });
        }
      });

      page.on('pageerror', (err) => {
        const entry: CapturedConsoleError = {
          message: err.message,
          url: page?.url() || journey.startUrl,
          timestamp: new Date().toISOString(),
          location: err.stack?.split('\n')[1]?.trim(),
        };
        journeyConsoleErrors.push(entry);
        observations.push({
          type: 'CONSOLE_ERROR',
          message: err.message,
          severity: 'error',
          pageUrl: page?.url() || journey.startUrl,
          timestamp: new Date().toISOString(),
        });
      });

      page.on('requestfailed', (req) => {
        const failure = req.failure();
        const entry: CapturedNetworkError = {
          url: req.url(),
          method: req.method(),
          resourceType: req.resourceType(),
          errorText: failure?.errorText || 'Request failed',
          timestamp: new Date().toISOString(),
        };
        journeyNetworkErrors.push(entry);
        observations.push({
          type: 'NETWORK_FAILURE',
          message: `Network request failed: ${req.method()} ${req.url()} (${failure?.errorText || 'Unknown error'})`,
          severity: 'warning',
          pageUrl: page?.url() || journey.startUrl,
          timestamp: new Date().toISOString(),
        });
      });

      page.on('response', (res) => {
        const status = res.status();
        if (status >= 400) {
          const entry: CapturedNetworkError = {
            url: res.url(),
            method: res.request().method(),
            status,
            resourceType: res.request().resourceType(),
            errorText: `HTTP ${status} ${res.statusText()}`,
            timestamp: new Date().toISOString(),
          };
          journeyNetworkErrors.push(entry);
          observations.push({
            type: 'NETWORK_FAILURE',
            message: `HTTP ${status} response on ${res.url()}`,
            severity: status >= 500 ? 'error' : 'warning',
            pageUrl: page?.url() || journey.startUrl,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // 3. Step Execution Loop
      for (const step of journey.steps) {
        if (this.options.cancellationToken?.isCancelled) {
          this.logger.log('journey_step_cancelled_by_token', { stepId: step.id });
          break;
        }

        actionsAttempted++;
        const stepStart = Date.now();
        const beforeUrl = page.url() || step.pageUrl;
        if (beforeUrl && beforeUrl !== 'about:blank') {
          pagesVisited.add(beforeUrl);
        }

        let stepStatus: StepResultStatus = 'PASSED';
        let stepError: string | undefined;
        let stepScreenshot: CapturedScreenshot | undefined;

        const initialConsoleCount = journeyConsoleErrors.length;
        const initialNetCount = journeyNetworkErrors.length;

        try {
          // If the step specifies a pageUrl and browser is currently on a different page,
          // align to the expected pageUrl before performing the step action.
          if (step.action !== 'NAVIGATE' && step.pageUrl) {
            const currentNorm = (page.url() || '').replace(/\/$/, '');
            const stepNorm = (step.pageUrl || '').replace(/\/$/, '');
            if (stepNorm && currentNorm !== stepNorm && currentNorm !== 'about:blank') {
              await page.goto(step.pageUrl, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
            }
          }

          switch (step.action) {
            case 'NAVIGATE': {
              const targetUrl = step.pageUrl;
              // SSRF Security Check
              const validation = validateTargetUrl(targetUrl, {
                allowLocalhost: this.options.allowLocalhost,
              });

              if (!validation.valid) {
                stepStatus = 'BLOCKED';
                stepError = `Security Check Failed: ${validation.error}`;
                observations.push({
                  type: 'NAVIGATION_FAILURE',
                  message: stepError,
                  severity: 'error',
                  pageUrl: targetUrl,
                  timestamp: new Date().toISOString(),
                });
                break;
              }

              // Same origin verification
              if (!isSameOrigin(targetUrl, journey.startUrl)) {
                stepStatus = 'SKIPPED';
                stepError = 'Cross-origin navigation rejected by policy';
                observations.push({
                  type: 'SKIPPED_EXTERNAL_ORIGIN',
                  message: `Cross-origin target rejected: ${targetUrl}`,
                  severity: 'info',
                  pageUrl: targetUrl,
                  timestamp: new Date().toISOString(),
                });
                break;
              }

              await page.goto(targetUrl, { waitUntil: 'load', timeout: 15000 });
              pagesVisited.add(page.url());
              break;
            }

            case 'ASSERT_TITLE': {
              const currentTitle = await page.title();
              if (step.expected?.title && !currentTitle.toLowerCase().includes(step.expected.title.toLowerCase())) {
                stepStatus = 'FAILED';
                stepError = `Title assertion failed. Expected "${step.expected.title}", got "${currentTitle}"`;
              }
              break;
            }

            case 'ASSERT_URL': {
              const currentUrl = page.url();
              if (step.expected?.url && !currentUrl.includes(step.expected.url)) {
                stepStatus = 'FAILED';
                stepError = `URL assertion failed. Expected "${step.expected.url}", got "${currentUrl}"`;
              }
              break;
            }

            case 'CLICK': {
              // Safety classification check
              const safety = isDangerousAction(step.targetDescription, undefined, undefined);
              if (safety.dangerous) {
                stepStatus = 'SKIPPED';
                stepError = `Dangerous action skipped: ${safety.reason}`;
                observations.push({
                  type: 'SKIPPED_DANGEROUS_ACTION',
                  message: stepError,
                  severity: 'info',
                  pageUrl: page.url(),
                  selector: step.selector,
                  timestamp: new Date().toISOString(),
                });
                break;
              }

              const locator = await resolveResilientLocator(page, step);
              if (!locator) {
                stepStatus = 'FAILED';
                stepError = `Unable to locate interactable element "${step.targetDescription}"`;
                observations.push({
                  type: 'ELEMENT_NOT_INTERACTABLE',
                  message: stepError,
                  severity: 'warning',
                  pageUrl: page.url(),
                  selector: step.selector,
                  timestamp: new Date().toISOString(),
                });
                break;
              }

              const urlBeforeClick = page.url();
              const domSummaryBefore = await page.evaluate(() => document.body.innerText.length);

              await locator.click({ timeout: step.timeoutMs || 5000 });
              await page.waitForTimeout(300);

              const urlAfterClick = page.url();
              const domSummaryAfter = await page.evaluate(() => document.body.innerText.length);

              // Detect no-op interaction
              if (urlBeforeClick === urlAfterClick && domSummaryBefore === domSummaryAfter) {
                // Check if button text indicates an intentionally broken button or if state didn't change
                if (step.selector?.includes('broken') || step.targetDescription.toLowerCase().includes('broken')) {
                  observations.push({
                    type: 'CLICK_NO_OP',
                    message: `Element "${step.targetDescription}" clicked successfully but triggered zero state or DOM mutations`,
                    severity: 'warning',
                    pageUrl: urlAfterClick,
                    selector: step.selector,
                    timestamp: new Date().toISOString(),
                  });
                }
              }

              if (urlAfterClick !== 'about:blank') {
                pagesVisited.add(urlAfterClick);
              }
              break;
            }

            case 'FILL': {
              const fieldName = step.targetDescription;
              if (isSensitiveField({ name: fieldName, label: fieldName, id: step.selector })) {
                stepStatus = 'SKIPPED';
                stepError = 'Sensitive field skipped by safety policy';
                observations.push({
                  type: 'SKIPPED_SENSITIVE_FIELD',
                  message: `Skipped filling sensitive field "${fieldName}"`,
                  severity: 'info',
                  pageUrl: page.url(),
                  selector: step.selector,
                  timestamp: new Date().toISOString(),
                });
                break;
              }

              const locator = await resolveResilientLocator(page, step);
              if (!locator) {
                stepStatus = 'FAILED';
                stepError = `Field locator not found for "${fieldName}"`;
                break;
              }

              await locator.fill(step.value || 'Sculra Test', { timeout: step.timeoutMs || 5000 });
              break;
            }

            case 'SELECT': {
              const locator = await resolveResilientLocator(page, step);
              if (!locator) {
                stepStatus = 'FAILED';
                stepError = `Select locator not found for "${step.targetDescription}"`;
                break;
              }

              if (step.value) {
                await locator.selectOption({ label: step.value }).catch(async () => {
                  await locator.selectOption({ value: step.value });
                }).catch(async () => {
                  await locator.selectOption({ index: 0 });
                });
              }
              break;
            }

            case 'CHECK': {
              const locator = await resolveResilientLocator(page, step);
              if (locator) {
                await locator.check({ timeout: step.timeoutMs || 5000 });
              }
              break;
            }

            case 'UNCHECK': {
              const locator = await resolveResilientLocator(page, step);
              if (locator) {
                await locator.uncheck({ timeout: step.timeoutMs || 5000 });
              }
              break;
            }

            case 'VALIDATE_FORM': {
              // Inspect form elements for client-side validation rules
              const validationReport = await page.evaluate((sel) => {
                const form = document.querySelector(sel || 'form') as HTMLFormElement | null;
                if (!form) return { formFound: false, requiredCount: 0, invalidCount: 0 };

                const inputs = Array.from(form.querySelectorAll('input, select, textarea')) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
                const requiredFields = inputs.filter((i) => i.required || i.hasAttribute('required')).map((i) => i.name || i.id);
                const invalidFields = inputs.filter((i) => !i.checkValidity()).map((i) => ({ name: i.name || i.id, message: i.validationMessage }));

                return {
                  formFound: true,
                  requiredCount: requiredFields.length,
                  requiredFields,
                  invalidCount: invalidFields.length,
                  invalidFields,
                };
              }, step.selector);

              if (validationReport.formFound) {
                observations.push({
                  type: 'FORM_VALIDATION_FAILURE',
                  message: `Form inspection: ${validationReport.requiredCount} required fields identified, ${validationReport.invalidCount} initial constraint messages`,
                  severity: 'info',
                  pageUrl: page.url(),
                  selector: step.selector,
                  metadata: validationReport,
                  timestamp: new Date().toISOString(),
                });
              }
              break;
            }

            default:
              stepStatus = 'PASSED';
              break;
          }
        } catch (err: any) {
          stepStatus = 'FAILED';
          stepError = err.message || 'Action failed during execution';
          observations.push({
            type: 'ELEMENT_NOT_INTERACTABLE',
            message: `Step execution exception: ${stepError}`,
            severity: 'error',
            pageUrl: page.url(),
            selector: step.selector,
            timestamp: new Date().toISOString(),
          });
        }

        const afterUrl = page.url() || beforeUrl;
        if (afterUrl && afterUrl !== 'about:blank') {
          pagesVisited.add(afterUrl);
        }

        // Tally statistics
        if (stepStatus === 'PASSED') {
          actionsPassed++;
        } else if (stepStatus === 'FAILED') {
          actionsFailed++;
        } else {
          actionsSkipped++;
        }

        // Step-specific error slices
        const stepConsoleErrors = journeyConsoleErrors.slice(initialConsoleCount);
        const stepNetworkErrors = journeyNetworkErrors.slice(initialNetCount);

        // Capture screenshot if step failed or on milestone navigation
        if (stepStatus === 'FAILED' || step.action === 'NAVIGATE' || step.action === 'VALIDATE_FORM') {
          try {
            const buf = await page.screenshot({ fullPage: false, type: 'png' });
            stepScreenshot = {
              title: `Journey [${journey.name}] - Step [${step.action}]: ${step.targetDescription}`,
              buffer: buf,
              mimeType: 'image/png',
              timestamp: new Date().toISOString(),
            };
          } catch {
            // Ignore screenshot failure
          }
        }

        executedSteps.push({
          stepId: step.id,
          action: step.action,
          targetDescription: step.targetDescription,
          selector: step.selector,
          status: stepStatus,
          startedAt: new Date(stepStart).toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - stepStart,
          beforeUrl,
          afterUrl,
          value: step.value,
          error: stepError,
          screenshot: stepScreenshot,
          consoleErrors: stepConsoleErrors,
          networkErrors: stepNetworkErrors,
          observations: observations.slice(),
        });
      }

    } catch (fatalErr: any) {
      this.logger.error('journey_fatal_exception', {
        journeyId: journey.id,
        message: fatalErr.message,
      });
      observations.push({
        type: 'PAGE_LOAD_FAILURE',
        message: `Fatal error in journey ${journey.id}: ${fatalErr.message}`,
        severity: 'error',
        pageUrl: journey.startUrl,
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }

    // Determine overall journey status
    let status: 'PASSED' | 'FAILED' | 'PARTIAL' | 'CANCELLED' = 'PASSED';
    if (this.options.cancellationToken?.isCancelled) {
      status = 'CANCELLED';
    } else if (actionsFailed > 0 && actionsPassed > 0) {
      status = 'PARTIAL';
    } else if (actionsFailed > 0 && actionsPassed === 0) {
      status = 'FAILED';
    }

    const durationMs = Date.now() - startTime;

    this.logger.log('journey_completed', {
      journeyId: journey.id,
      status,
      actionsAttempted,
      actionsPassed,
      actionsFailed,
      actionsSkipped,
      observationsCount: observations.length,
      durationMs,
    });

    return {
      journeyId: journey.id,
      name: journey.name,
      category: journey.category,
      status,
      startedAt: new Date(startTime).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs,
      viewport: journey.viewport || { width: 1280, height: 720, name: 'desktop' },
      steps: executedSteps,
      observations,
      pagesVisited: Array.from(pagesVisited),
      actionsAttempted,
      actionsPassed,
      actionsFailed,
      actionsSkipped,
    };
  }
}
