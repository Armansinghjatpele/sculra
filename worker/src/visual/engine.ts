// ==============================================================================
// Sculra Deterministic Visual & Responsive QA Engine (worker/src/visual/engine.ts)
// ==============================================================================

import { Browser, Page } from 'playwright';
import {
  ViewportProfile,
  VisualObservation,
  VisualSnapshot,
  VisualComparison,
  ResponsiveExecutionResult,
  VisualEngineOptions,
} from './types';
import { DEFAULT_VIEWPORT_PROFILES, VISUAL_LIMITS } from './viewport';
import { stabilizePageForCapture } from './stability';
import { OverflowDetector } from './overflow';
import { OverlapDetector } from './overlap';
import { TextOverflowDetector } from './text';
import { VisualComparator } from './comparison';
import { BaselineManager } from './baseline';
import { WorkerLogger } from '../logger';
import { CancellationToken, DiscoveredPage } from '../types';
import { BugObservation } from '../issues/types';
import { computeBugFingerprint } from '../issues/fingerprint';
import { sanitizeUrl } from '../issues/network';

export class ResponsiveVisualEngine {
  private browser: Browser;
  private logger: WorkerLogger;
  private options: VisualEngineOptions;
  private overflowDetector: OverflowDetector;
  private overlapDetector: OverlapDetector;
  private textDetector: TextOverflowDetector;
  private comparator: VisualComparator;
  public baselineManager: BaselineManager;

  constructor(browser: Browser, options: VisualEngineOptions = {}, logger?: WorkerLogger) {
    this.browser = browser;
    this.options = options;
    this.logger = logger || new WorkerLogger('visual_engine');
    this.overflowDetector = new OverflowDetector();
    this.overlapDetector = new OverlapDetector();
    this.textDetector = new TextOverflowDetector();
    this.comparator = new VisualComparator();
    this.baselineManager = new BaselineManager(this.logger);
  }

  async execute(
    testRunId: string,
    projectId: string,
    targetUrl: string,
    discoveredPages: DiscoveredPage[] = [],
    cancellationToken?: CancellationToken
  ): Promise<{
    result: ResponsiveExecutionResult;
    bugObservations: BugObservation[];
  }> {
    const startTime = Date.now();
    const viewports = this.options.viewports || DEFAULT_VIEWPORT_PROFILES;
    const maxPages = Math.min(
      this.options.maxPages || VISUAL_LIMITS.MAX_RESPONSIVE_PAGES,
      VISUAL_LIMITS.MAX_RESPONSIVE_PAGES
    );
    const maxExecutionTime =
      this.options.maxExecutionTimeMs || VISUAL_LIMITS.MAX_RESPONSIVE_EXECUTION_TIME_MS;

    this.logger.log('responsive_execution_started', {
      viewportsCount: viewports.length,
      maxPages,
    });

    const snapshots: VisualSnapshot[] = [];
    const comparisons: VisualComparison[] = [];
    const observations: VisualObservation[] = [];
    const bugObservations: BugObservation[] = [];

    // Prioritize targetUrl / homepage, then discovered pages with forms or interactive controls
    const prioritizedUrls: string[] = [targetUrl];
    for (const p of discoveredPages) {
      if (!prioritizedUrls.includes(p.url)) {
        prioritizedUrls.push(p.url);
      }
      if (prioritizedUrls.length >= maxPages) break;
    }

    let context: any = null;

    try {
      for (const vp of viewports) {
        if (cancellationToken?.isCancelled) {
          this.logger.log('visual_execution_cancelled');
          break;
        }
        if (Date.now() - startTime > maxExecutionTime) {
          this.logger.warn('visual_execution_timeout');
          break;
        }

        // Launch fresh isolated context per viewport profile
        context = await this.browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.deviceScaleFactor || 1,
          isMobile: vp.isMobile || false,
          hasTouch: vp.hasTouch || false,
          userAgent: vp.userAgent || 'Sculra-Visual-QA-Engine/1.0',
          ignoreHTTPSErrors: false,
        });

        const activePage = await context.newPage();
        activePage.setDefaultNavigationTimeout(15000);
        activePage.setDefaultTimeout(15000);

        for (const pageUrl of prioritizedUrls) {
          if (cancellationToken?.isCancelled) break;
          if (Date.now() - startTime > maxExecutionTime) break;

          try {
            this.logger.log('evaluating_responsive_page', {
              viewport: vp.name,
              url: pageUrl,
            });

            await activePage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await stabilizePageForCapture(activePage, { settlingDelayMs: 150 });

            // 1. Capture Viewport Screenshot & Create Snapshot
            const screenshotBuffer = await activePage.screenshot({ fullPage: false, type: 'png' });
            const snapshotId = `snap-${testRunId}-${vp.name}-${Math.random().toString(36).substring(2, 8)}`;
            const snapshot: VisualSnapshot = {
              id: snapshotId,
              testRunId,
              projectId,
              pageUrl,
              viewport: vp,
              width: vp.width,
              height: vp.height,
              buffer: screenshotBuffer,
              capturedAt: new Date().toISOString(),
              metadata: {
                viewportName: vp.name,
              },
            };
            snapshots.push(snapshot);

            // 2. Visual Baseline Comparison
            const baseline = await this.baselineManager.getBaseline(null, projectId, pageUrl, vp);
            if (baseline && baseline.buffer) {
              const comp = this.comparator.compareBuffers(
                baseline.buffer,
                screenshotBuffer,
                pageUrl,
                vp,
                { thresholds: this.options.thresholds }
              );
              comp.baselineId = baseline.id;
              comp.currentId = snapshotId;
              comparisons.push(comp);

              if (comp.status === 'HIGH' || comp.status === 'MEDIUM') {
                const severity = comp.status === 'HIGH' ? 'high' : 'medium';
                const obs: VisualObservation = {
                  id: `obs-regression-${Math.random().toString(36).substring(2, 10)}`,
                  type: 'VISUAL_REGRESSION',
                  pageUrl,
                  viewport: vp,
                  severity,
                  title: `Visual regression detected on ${vp.name} (${Math.round(comp.pixelDifferenceRatio * 100)}% pixel diff)`,
                  description: `Visual screenshot differed from baseline by ${Math.round(comp.pixelDifferenceRatio * 10000) / 100}% (${comp.changedPixelCount} pixels changed).`,
                  boundingBox: comp.boundingRegion,
                  comparisonRatio: comp.pixelDifferenceRatio,
                  timestamp: new Date().toISOString(),
                  metadata: {
                    viewportName: vp.name,
                    status: comp.status,
                    changedPixelCount: comp.changedPixelCount,
                  },
                };
                observations.push(obs);
              }
            } else {
              // Mark baseline missing without failing run
              comparisons.push({
                id: `comp-missing-${Math.random().toString(36).substring(2, 8)}`,
                currentId: snapshotId,
                pageUrl,
                viewport: vp,
                pixelDifferenceRatio: 0,
                changedPixelCount: 0,
                totalPixelCount: vp.width * vp.height,
                status: 'BASELINE_MISSING',
                threshold: 0,
                timestamp: new Date().toISOString(),
              });
            }

            // 3. Overflow Detection
            const overflowRes = await this.overflowDetector.detect(activePage, vp, pageUrl);
            observations.push(...overflowRes.observations);

            // 4. Overlap Detection
            const overlapObs = await this.overlapDetector.detect(activePage, vp, pageUrl);
            observations.push(...overlapObs);

            // 5. Text Overflow Detection
            const textObs = await this.textDetector.detect(activePage, vp, pageUrl);
            observations.push(...textObs);

          } catch (pageEvalErr: any) {
            this.logger.warn('responsive_page_eval_error', {
              viewport: vp.name,
              url: pageUrl,
              message: pageEvalErr.message,
            });
          }
        }

        await activePage.close().catch(() => {});
        await context.close().catch(() => {});
        context = null;
      }
    } finally {
      if (context) await context.close().catch(() => {});
    }

    // 6. Convert Visual Observations to Standard Bug Observations for Issue Persistence
    for (const obs of observations) {
      if (obs.severity === 'info') continue;

      const bugType =
        obs.type === 'VISUAL_REGRESSION'
          ? 'VISUAL_REGRESSION'
          : obs.type === 'HORIZONTAL_OVERFLOW' || obs.type === 'VERTICAL_OVERFLOW'
          ? 'LAYOUT_DEFECT'
          : obs.type === 'ELEMENT_OVERLAP'
          ? 'LAYOUT_DEFECT'
          : obs.type === 'CONTENT_CLIPPED'
          ? 'BROKEN_CONTROL'
          : 'LAYOUT_DEFECT';

      const fingerprint = computeBugFingerprint({
        projectId,
        url: obs.pageUrl,
        bugType,
        action: 'RESPONSIVE_CHECK',
        selector: `${obs.viewport.name}:${obs.selector || obs.type}`,
        errorSignature: `${obs.type}_${obs.viewport.name}_${obs.overflowAmount || obs.overlapArea || ''}`,
      });

      bugObservations.push({
        id: `bug-${fingerprint.substring(0, 12)}`,
        testRunId,
        projectId,
        type: bugType,
        severity: obs.severity,
        confidence: 'high',
        status: 'open',
        title: obs.title,
        summary: obs.description,
        description: `${obs.description} (Observed on viewport: ${obs.viewport.name} ${obs.viewport.width}x${obs.viewport.height})`,
        url: sanitizeUrl(obs.pageUrl),
        action: 'RESPONSIVE_CHECK',
        selector: obs.selector,
        errorSignature: `${obs.type}_${obs.viewport.name}`,
        reproductionSteps: [
          {
            stepNumber: 1,
            action: 'SET_VIEWPORT',
            target: `${obs.viewport.name} (${obs.viewport.width}x${obs.viewport.height})`,
            url: obs.pageUrl,
            expectedBehavior: `Set browser viewport to ${obs.viewport.width}x${obs.viewport.height}`,
            observedBehavior: `Viewport set to ${obs.viewport.name}`,
          },
          {
            stepNumber: 2,
            action: 'NAVIGATE',
            target: obs.pageUrl,
            url: obs.pageUrl,
            expectedBehavior: 'Navigate to target page',
            observedBehavior: 'Page rendered',
          },
          {
            stepNumber: 3,
            action: 'INSPECT_LAYOUT',
            target: obs.selector || 'body',
            url: obs.pageUrl,
            expectedBehavior: `Layout adapts cleanly without ${obs.type.toLowerCase().replace(/_/g, ' ')}`,
            observedBehavior: obs.description,
          },
        ],
        fingerprint,
        timestamp: obs.timestamp,
        metadata: {
          viewport: obs.viewport,
          observationType: obs.type,
          boundingBox: obs.boundingBox,
          secondaryBoundingBox: obs.secondaryBoundingBox,
          overlapArea: obs.overlapArea,
          overflowAmount: obs.overflowAmount,
          comparisonRatio: obs.comparisonRatio,
          ...obs.metadata,
        },
      });
    }

    const durationMs = Date.now() - startTime;
    this.logger.log('responsive_execution_completed', {
      durationMs,
      snapshotsCount: snapshots.length,
      comparisonsCount: comparisons.length,
      observationsCount: observations.length,
      bugsCount: bugObservations.length,
    });

    return {
      result: {
        viewports,
        snapshots,
        comparisons,
        observations,
        durationMs,
      },
      bugObservations,
    };
  }
}
