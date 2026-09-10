// ==============================================================================
// Sculra Accessibility Target Discovery Engine (worker/src/accessibility/discovery.ts)
// ==============================================================================

import { ApplicationMap, DiscoveredPage } from '../types';
import { ProductModel } from '../product/types';
import { AccessibilityTarget, AccessibilityTargetType } from './types';
import { AccessibilityPolicyConfig, DEFAULT_ACCESSIBILITY_POLICY } from './policy';

export class AccessibilityTargetDiscovery {
  private policy: AccessibilityPolicyConfig;

  constructor(policy?: Partial<AccessibilityPolicyConfig>) {
    this.policy = { ...DEFAULT_ACCESSIBILITY_POLICY, ...policy };
  }

  /**
   * Discovers deterministic accessibility targets from the ApplicationMap and ProductModel.
   */
  public discoverTargets(
    targetUrl: string,
    applicationMap?: ApplicationMap,
    productModel?: ProductModel
  ): AccessibilityTarget[] {
    const targets: AccessibilityTarget[] = [];
    const seenTargetIds = new Set<string>();

    const safeUrl = new URL(targetUrl);
    const origin = safeUrl.origin;

    // 1. Discover Page Targets from ApplicationMap
    const pages: DiscoveredPage[] = applicationMap?.pages && applicationMap.pages.length > 0
      ? applicationMap.pages
      : [
          {
            url: targetUrl,
            title: 'Initial Target Page',
            depth: 0,
            elementsCount: 0,
            elements: [],
            forms: [],
            links: [],
            consoleErrors: [],
            networkErrors: [],
            timestamp: new Date().toISOString(),
          },
        ];

    // Identify high-criticality workflow URLs from ProductModel if available
    const criticalUrls = new Set<string>();
    if (productModel) {
      for (const wf of productModel.workflows) {
        if (wf.criticality.level === 'CRITICAL' || wf.criticality.level === 'HIGH') {
          if (wf.entryPoint) criticalUrls.add(wf.entryPoint);
          for (const s of wf.steps) {
            if (s.pageUrl) criticalUrls.add(s.pageUrl);
          }
        }
      }
    }

    for (const page of pages) {
      if (targets.length >= this.policy.maxTargets) break;

      // Validate same origin
      try {
        const pUrl = new URL(page.url);
        if (pUrl.origin !== origin) continue;
      } catch {
        continue;
      }

      const isCritical = criticalUrls.has(page.url);
      const isAuthPage = page.url.includes('/login') || page.url.includes('/signin') || page.url.includes('/auth') || page.url.includes('/admin') || page.url.includes('/dashboard');
      const hasForms = page.forms && page.forms.length > 0;

      let pagePriority = 50;
      if (isCritical) pagePriority += 30;
      if (isAuthPage) pagePriority += 20;
      if (hasForms) pagePriority += 15;
      pagePriority = Math.min(100, pagePriority);

      const pageTargetId = `a11y-page-${Buffer.from(page.url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
      if (!seenTargetIds.has(pageTargetId)) {
        seenTargetIds.add(pageTargetId);
        targets.push({
          id: pageTargetId,
          targetType: 'PAGE',
          pageUrl: page.url,
          priority: pagePriority,
          reason: isCritical
            ? 'Business-critical workflow page evaluated for inclusive UX and accessibility'
            : isAuthPage
            ? 'Authenticated/Identity page evaluated for accessible user interaction'
            : hasForms
            ? 'Interactive page containing forms evaluated for accessible input controls'
            : 'Standard application page evaluated for accessibility compliance',
          criticality: isCritical || isAuthPage ? 'critical' : hasForms ? 'high' : 'medium',
        });
      }

      // 2. Discover Form Targets
      if (page.forms) {
        for (let i = 0; i < page.forms.length; i++) {
          if (targets.length >= this.policy.maxTargets) break;
          const form = page.forms[i];
          const formSelector = form.id ? `#${form.id}` : form.action ? `form[action="${form.action}"]` : `form:nth-of-type(${i + 1})`;
          const formTargetId = `a11y-form-${pageTargetId}-${i}`;

          if (!seenTargetIds.has(formTargetId)) {
            seenTargetIds.add(formTargetId);
            targets.push({
              id: formTargetId,
              targetType: 'FORM',
              pageUrl: page.url,
              selector: formSelector,
              priority: pagePriority + 10,
              reason: `Form control with ${form.fields?.length || 0} fields evaluated for accessible labeling and error states`,
              criticality: isCritical || isAuthPage ? 'critical' : 'high',
            });
          }
        }
      }

      // 3. Discover Interactive Elements (Buttons, Inputs)
      if (page.elements) {
        let interactiveCount = 0;
        for (const el of page.elements) {
          if (targets.length >= this.policy.maxTargets) break;
          if (interactiveCount >= this.policy.maxInteractiveElementsPerPage) break;

          if (el.type === 'button' || el.type === 'interactive' || el.role === 'button' || el.role === 'dialog') {
            interactiveCount++;
            const elTargetId = `a11y-el-${pageTargetId}-${interactiveCount}`;
            if (!seenTargetIds.has(elTargetId)) {
              seenTargetIds.add(elTargetId);
              targets.push({
                id: elTargetId,
                targetType: el.role === 'dialog' ? 'DIALOG' : 'BUTTON',
                pageUrl: page.url,
                selector: el.selector,
                role: el.role || 'button',
                priority: pagePriority,
                reason: `Interactive control (${el.type}) evaluated for accessible naming and keyboard operability`,
                criticality: isCritical ? 'high' : 'medium',
              });
            }
          }
        }
      }
    }

    // Sort by priority descending
    return targets.sort((a, b) => b.priority - a.priority).slice(0, this.policy.maxTargets);
  }
}

