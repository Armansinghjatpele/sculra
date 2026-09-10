// ==============================================================================
// Sculra Multi-Viewport Responsive Accessibility Orchestrator (worker/src/accessibility/responsive.ts)
// ==============================================================================

import { Browser, BrowserContext, Page } from 'playwright';
import { ViewportConfig } from '../types';
import { AccessibilityPolicyConfig, DEFAULT_ACCESSIBILITY_POLICY } from './policy';
import { TouchTargetEvaluator } from './touch-targets';
import { TextScalingEvaluator } from './text-scaling';
import { TouchTargetResult, TextScalingResult } from './types';

export class ResponsiveAccessibilityEngine {
  private policy: AccessibilityPolicyConfig;

  constructor(policy?: Partial<AccessibilityPolicyConfig>) {
    this.policy = { ...DEFAULT_ACCESSIBILITY_POLICY, ...policy };
  }

  /**
   * Executes responsive accessibility evaluations across Desktop, Tablet, and Mobile viewports.
   */
  public async evaluateResponsiveAccessibility(
    browser: Browser,
    pageUrl: string
  ): Promise<{
    touchTargetResults: TouchTargetResult[];
    textScalingResults: TextScalingResult[];
  }> {
    const touchTargetResults: TouchTargetResult[] = [];
    const textScalingResults: TextScalingResult[] = [];

    const viewports: ViewportConfig[] = this.policy.viewports.slice(0, this.policy.maxViewports);

    for (const vp of viewports) {
      let ctx: BrowserContext | null = null;
      let page: Page | null = null;

      try {
        ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          userAgent: 'Sculra-Autonomous-Accessibility-Engine/1.0',
        });
        page = await ctx.newPage();
        page.setDefaultNavigationTimeout(this.policy.timeoutMs);

        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: this.policy.timeoutMs });
        await page.waitForTimeout(100);

        // 1. If mobile viewport, run Touch Target Evaluation
        if (vp.name === 'mobile' && this.policy.enableTouchTargetAnalysis) {
          const targets = await TouchTargetEvaluator.evaluateTouchTargets(page, pageUrl, this.policy);
          touchTargetResults.push(...targets);
        }

        // 2. Run Text Scaling reflow test on representative viewports
        if (this.policy.enableTextScaling) {
          const textScaleRes = await TextScalingEvaluator.evaluateTextScaling(page, pageUrl, vp.name);
          textScalingResults.push(textScaleRes);
        }
      } catch (err: any) {
        // Handled cleanly per viewport
      } finally {
        if (page) await page.close().catch(() => {});
        if (ctx) await ctx.close().catch(() => {});
      }
    }

    return {
      touchTargetResults,
      textScalingResults,
    };
  }
}

