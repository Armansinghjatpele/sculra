// ==============================================================================
// Sculra Accessibility & Inclusive UX Scanner Orchestrator (worker/src/accessibility/scanner.ts)
// ==============================================================================

import { Browser, BrowserContext, Page } from 'playwright';
import {
  AccessibilityFinding,
  AccessibilityScanResult,
  KeyboardNavigationResult,
  ContrastCheckResult,
  TouchTargetResult,
  FormAccessibilityResult,
  SemanticAnalysisResult,
  TextScalingResult,
  ReducedMotionResult,
  DialogAccessibilityResult,
} from './types';
import { AccessibilityPolicyConfig, DEFAULT_ACCESSIBILITY_POLICY } from './policy';
import { AccessibilityTargetDiscovery } from './discovery';
import { KeyboardNavigationEngine } from './keyboard';
import { FocusVisibilityEvaluator } from './focus';
import { AccessibleNameEvaluator } from './semantics';
import { FormAccessibilityEvaluator } from './forms';
import { AriaValidator } from './aria';
import { HeadingHierarchyEvaluator } from './headings';
import { LandmarkEvaluator } from './landmarks';
import { DialogAccessibilityEvaluator } from './dialogs';
import { ImageAccessibilityEvaluator } from './images';
import { ContrastEvaluator } from './contrast';
import { StatusMessageEvaluator } from './errors';
import { ResponsiveAccessibilityEngine } from './responsive';
import { ReducedMotionEvaluator } from './motion';
import { AccessibilitySeverityClassifier } from './severity';
import { AccessibilityEvidenceFormatter } from './evidence';
import { AccessibilityAnalyzer } from './analyzer';
import { WorkerLogger } from '../logger';
import { ApplicationMap, CancellationToken } from '../types';
import { ProductModel } from '../product/types';
import { BugObservation } from '../issues/types';

export interface ScanAccessibilityOptions {
  testRunId: string;
  projectId: string;
  targetUrl: string;
  browser?: Browser;
  page?: Page;
  browserContext?: BrowserContext;
  applicationMap?: ApplicationMap;
  productModel?: ProductModel;
  journeyResults?: any[];
  roleContexts?: any[];
  allowLocalhost?: boolean;
  logger?: WorkerLogger;
  cancellationToken?: CancellationToken;
}

export class AccessibilityScanner {
  private policy: AccessibilityPolicyConfig;
  private logger?: WorkerLogger;

  constructor(policy?: Partial<AccessibilityPolicyConfig>, logger?: WorkerLogger) {
    this.policy = { ...DEFAULT_ACCESSIBILITY_POLICY, ...policy };
    this.logger = logger;
  }

  public async scan(options: ScanAccessibilityOptions): Promise<AccessibilityScanResult> {
    const startTime = Date.now();
    const {
      testRunId,
      projectId,
      targetUrl,
      browser,
      page: existingPage,
      applicationMap,
      productModel,
      cancellationToken,
    } = options;

    this.logger?.log('accessibility_scan_started', { targetUrl, projectId });

    const findings: AccessibilityFinding[] = [];
    const bugObservations: BugObservation[] = [];
    const keyboardResults: KeyboardNavigationResult[] = [];
    const contrastResults: ContrastCheckResult[] = [];
    const touchTargetResults: TouchTargetResult[] = [];
    const formResults: FormAccessibilityResult[] = [];
    const semanticResults: SemanticAnalysisResult[] = [];
    const textScalingResults: TextScalingResult[] = [];
    const reducedMotionResults: ReducedMotionResult[] = [];
    const dialogResults: DialogAccessibilityResult[] = [];

    // 1. Discover Accessibility Targets
    const discovery = new AccessibilityTargetDiscovery(this.policy);
    const targets = discovery.discoverTargets(targetUrl, applicationMap, productModel);

    this.logger?.log('accessibility_targets_discovered', { count: targets.length });

    // Group target pages to visit (bounded by maxPages)
    const uniquePageUrls = Array.from(new Set(targets.map((t) => t.pageUrl))).slice(
      0,
      this.policy.maxPages
    );

    let pagesTestedCount = 0;

    for (const pageUrl of uniquePageUrls) {
      if (cancellationToken?.isCancelled) break;

      let localPage = existingPage;
      let ownPage = false;

      try {
        if (!localPage && browser) {
          const ctx = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            userAgent: 'Sculra-Autonomous-Accessibility-Engine/1.0',
          });
          localPage = await ctx.newPage();
          localPage.setDefaultNavigationTimeout(this.policy.timeoutMs);
          await localPage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: this.policy.timeoutMs });
          await localPage.waitForTimeout(100);
          ownPage = true;
        }

        if (!localPage) continue;

        pagesTestedCount++;

        // A. Accessible Name Evaluation
        if (this.policy.enableSemanticValidation) {
          const names = await AccessibleNameEvaluator.evaluateAccessibleNames(localPage);
          for (const item of names) {
            if (!item.hasAccessibleName) {
              const findingType = item.isButton
                ? 'EMPTY_BUTTON_NAME'
                : item.isLink
                ? 'EMPTY_LINK_NAME'
                : 'MISSING_ACCESSIBLE_NAME';
              const meta = AccessibilitySeverityClassifier.getMetadata(findingType);
              const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                findingType,
                pageUrl,
                item.selector,
                'desktop'
              );

              const finding: AccessibilityFinding = {
                id: `a11y-name-${Date.now()}-${findings.length + 1}`,
                type: findingType,
                title: meta.title,
                wcagReference: meta.wcagReference,
                principle: meta.principle,
                severity: meta.defaultSeverity,
                confidence: meta.defaultConfidence,
                description: `${item.tagName.toUpperCase()} element (${item.selector}) does not have a recognizable accessible name.`,
                deterministicReason: `Element failed all accessible name computation passes (aria-labelledby, aria-label, label element, textContent, alt, title).`,
                remediationRecommendation: meta.remediationHint,
                targetUrl: pageUrl,
                selector: item.selector,
                role: item.role,
                viewport: 'desktop',
                evidence: { item },
                fingerprint: fp,
                timestamp: new Date().toISOString(),
              };

              findings.push(finding);
              bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
            }
          }
        }

        // B. Form Accessibility Evaluation
        if (this.policy.enableFormTesting) {
          const fRes = await FormAccessibilityEvaluator.evaluateForms(localPage, pageUrl);
          formResults.push(...fRes);

          for (const form of fRes) {
            for (const inp of form.inputs) {
              if (!inp.hasAssociatedLabel) {
                const meta = AccessibilitySeverityClassifier.getMetadata('INPUT_MISSING_LABEL');
                const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                  'INPUT_MISSING_LABEL',
                  pageUrl,
                  inp.selector,
                  'desktop'
                );

                const finding: AccessibilityFinding = {
                  id: `a11y-form-label-${Date.now()}-${findings.length + 1}`,
                  type: 'INPUT_MISSING_LABEL',
                  title: meta.title,
                  wcagReference: meta.wcagReference,
                  principle: meta.principle,
                  severity: meta.defaultSeverity,
                  confidence: meta.defaultConfidence,
                  description: `Form field (${inp.selector}) is missing a programmatically associated label.`,
                  deterministicReason: `No associated <label for="${inp.name || 'id'}">, aria-labelledby, or aria-label was detected.`,
                  remediationRecommendation: meta.remediationHint,
                  targetUrl: pageUrl,
                  selector: inp.selector,
                  viewport: 'desktop',
                  evidence: { input: inp },
                  fingerprint: fp,
                  timestamp: new Date().toISOString(),
                };

                findings.push(finding);
                bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
              }

              if (inp.isInvalid && !inp.hasAssociatedError) {
                const meta = AccessibilitySeverityClassifier.getMetadata('FORM_ERROR_NOT_ACCESSIBLE');
                const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                  'FORM_ERROR_NOT_ACCESSIBLE',
                  pageUrl,
                  inp.selector,
                  'desktop'
                );

                const finding: AccessibilityFinding = {
                  id: `a11y-form-err-${Date.now()}-${findings.length + 1}`,
                  type: 'FORM_ERROR_NOT_ACCESSIBLE',
                  title: meta.title,
                  wcagReference: meta.wcagReference,
                  principle: meta.principle,
                  severity: meta.defaultSeverity,
                  confidence: meta.defaultConfidence,
                  description: `Invalid form input (${inp.selector}) has an error state without programmatic association.`,
                  deterministicReason: `Field does not provide aria-describedby or aria-errormessage linking to the validation error description.`,
                  remediationRecommendation: meta.remediationHint,
                  targetUrl: pageUrl,
                  selector: inp.selector,
                  viewport: 'desktop',
                  evidence: { input: inp },
                  fingerprint: fp,
                  timestamp: new Date().toISOString(),
                };

                findings.push(finding);
                bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
              }
            }
          }
        }

        // C. ARIA Validation
        if (this.policy.enableAriaValidation) {
          const ariaChecks = await AriaValidator.validateAria(localPage);
          for (const item of ariaChecks) {
            if (item.hiddenFocusable) {
              const meta = AccessibilitySeverityClassifier.getMetadata('ARIA_HIDDEN_FOCUSABLE');
              const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                'ARIA_HIDDEN_FOCUSABLE',
                pageUrl,
                item.selector,
                'desktop'
              );

              const finding: AccessibilityFinding = {
                id: `a11y-aria-hidden-${Date.now()}-${findings.length + 1}`,
                type: 'ARIA_HIDDEN_FOCUSABLE',
                title: meta.title,
                wcagReference: meta.wcagReference,
                principle: meta.principle,
                severity: meta.defaultSeverity,
                confidence: meta.defaultConfidence,
                description: `Element (${item.selector}) or its focusable children are marked with aria-hidden="true".`,
                deterministicReason: `Focusable elements inside aria-hidden regions cause screen readers to lose focus context.`,
                remediationRecommendation: meta.remediationHint,
                targetUrl: pageUrl,
                selector: item.selector,
                viewport: 'desktop',
                evidence: { item },
                fingerprint: fp,
                timestamp: new Date().toISOString(),
              };

              findings.push(finding);
              bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
            }

            for (const r of item.invalidRoles) {
              const meta = AccessibilitySeverityClassifier.getMetadata('ARIA_ROLE_INVALID');
              const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                'ARIA_ROLE_INVALID',
                pageUrl,
                item.selector,
                'desktop'
              );

              const finding: AccessibilityFinding = {
                id: `a11y-aria-role-${Date.now()}-${findings.length + 1}`,
                type: 'ARIA_ROLE_INVALID',
                title: meta.title,
                wcagReference: meta.wcagReference,
                principle: meta.principle,
                severity: meta.defaultSeverity,
                confidence: meta.defaultConfidence,
                description: `Element (${item.selector}) specifies invalid ARIA role "${r}".`,
                deterministicReason: `"${r}" is not recognized in the W3C WAI-ARIA role taxonomy.`,
                remediationRecommendation: meta.remediationHint,
                targetUrl: pageUrl,
                selector: item.selector,
                viewport: 'desktop',
                evidence: { role: r, item },
                fingerprint: fp,
                timestamp: new Date().toISOString(),
              };

              findings.push(finding);
              bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
            }

            for (const attr of item.invalidAttributes) {
              const meta = AccessibilitySeverityClassifier.getMetadata('ARIA_ATTRIBUTE_INVALID');
              const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                'ARIA_ATTRIBUTE_INVALID',
                pageUrl,
                item.selector,
                'desktop'
              );

              const finding: AccessibilityFinding = {
                id: `a11y-aria-attr-${Date.now()}-${findings.length + 1}`,
                type: 'ARIA_ATTRIBUTE_INVALID',
                title: meta.title,
                wcagReference: meta.wcagReference,
                principle: meta.principle,
                severity: meta.defaultSeverity,
                confidence: meta.defaultConfidence,
                description: `Element (${item.selector}) contains unsupported ARIA attribute "${attr}".`,
                deterministicReason: `Attribute "${attr}" is not a valid W3C WAI-ARIA attribute.`,
                remediationRecommendation: meta.remediationHint,
                targetUrl: pageUrl,
                selector: item.selector,
                viewport: 'desktop',
                evidence: { attribute: attr, item },
                fingerprint: fp,
                timestamp: new Date().toISOString(),
              };

              findings.push(finding);
              bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
            }
          }
        }

        // D. Heading Structure
        const headingResult = await HeadingHierarchyEvaluator.evaluateHeadings(localPage);
        if (headingResult.hasSkippedHeadings) {
          const meta = AccessibilitySeverityClassifier.getMetadata('HEADING_HIERARCHY_ERROR');
          const fp = AccessibilityEvidenceFormatter.generateFingerprint(
            'HEADING_HIERARCHY_ERROR',
            pageUrl,
            'headings',
            'desktop'
          );

          const finding: AccessibilityFinding = {
            id: `a11y-heading-${Date.now()}-${findings.length + 1}`,
            type: 'HEADING_HIERARCHY_ERROR',
            title: meta.title,
            wcagReference: meta.wcagReference,
            principle: meta.principle,
            severity: meta.defaultSeverity,
            confidence: meta.defaultConfidence,
            description: `Page heading hierarchy skips levels (e.g. h1 followed directly by h3).`,
            deterministicReason: `Observed discontinuous heading structure: ${headingResult.headings.map((h) => `h${h.level}`).join(' -> ')}`,
            remediationRecommendation: meta.remediationHint,
            targetUrl: pageUrl,
            selector: 'headings',
            viewport: 'desktop',
            evidence: { headings: headingResult.headings },
            fingerprint: fp,
            timestamp: new Date().toISOString(),
          };

          findings.push(finding);
          bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
        }

        // E. Landmarks
        const landmarkResult = await LandmarkEvaluator.evaluateLandmarks(localPage);
        if (!landmarkResult.hasMainLandmark && headingResult.headings.length > 0) {
          const meta = AccessibilitySeverityClassifier.getMetadata('MISSING_MAIN_LANDMARK');
          const fp = AccessibilityEvidenceFormatter.generateFingerprint(
            'MISSING_MAIN_LANDMARK',
            pageUrl,
            'main',
            'desktop'
          );

          const finding: AccessibilityFinding = {
            id: `a11y-landmark-main-${Date.now()}-${findings.length + 1}`,
            type: 'MISSING_MAIN_LANDMARK',
            title: meta.title,
            wcagReference: meta.wcagReference,
            principle: meta.principle,
            severity: meta.defaultSeverity,
            confidence: meta.defaultConfidence,
            description: `Page is missing a top-level <main> or [role="main"] landmark region.`,
            deterministicReason: `Document structure contains semantic content without enclosing main landmark.`,
            remediationRecommendation: meta.remediationHint,
            targetUrl: pageUrl,
            selector: 'main',
            viewport: 'desktop',
            evidence: { landmarks: landmarkResult.landmarks },
            fingerprint: fp,
            timestamp: new Date().toISOString(),
          };

          findings.push(finding);
          bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
        }

        // F. Image Alt Checks
        const imageItems = await ImageAccessibilityEvaluator.evaluateImages(localPage);
        for (const img of imageItems) {
          if (img.isMissingAlt) {
            const meta = AccessibilitySeverityClassifier.getMetadata('IMAGE_MISSING_ALT');
            const fp = AccessibilityEvidenceFormatter.generateFingerprint(
              'IMAGE_MISSING_ALT',
              pageUrl,
              img.selector,
              'desktop'
            );

            const finding: AccessibilityFinding = {
              id: `a11y-img-alt-${Date.now()}-${findings.length + 1}`,
              type: 'IMAGE_MISSING_ALT',
              title: meta.title,
              wcagReference: meta.wcagReference,
              principle: meta.principle,
              severity: meta.defaultSeverity,
              confidence: meta.defaultConfidence,
              description: `Image (${img.selector}) is missing an alt attribute.`,
              deterministicReason: `Non-decorative <img> does not provide an alt attribute or aria-label.`,
              remediationRecommendation: meta.remediationHint,
              targetUrl: pageUrl,
              selector: img.selector,
              viewport: 'desktop',
              evidence: { img },
              fingerprint: fp,
              timestamp: new Date().toISOString(),
            };

            findings.push(finding);
            bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
          } else if (img.isInvalidAlt) {
            const meta = AccessibilitySeverityClassifier.getMetadata('IMAGE_INVALID_ALT');
            const fp = AccessibilityEvidenceFormatter.generateFingerprint(
              'IMAGE_INVALID_ALT',
              pageUrl,
              img.selector,
              'desktop'
            );

            const finding: AccessibilityFinding = {
              id: `a11y-img-invalt-${Date.now()}-${findings.length + 1}`,
              type: 'IMAGE_INVALID_ALT',
              title: meta.title,
              wcagReference: meta.wcagReference,
              principle: meta.principle,
              severity: meta.defaultSeverity,
              confidence: meta.defaultConfidence,
              description: `Image (${img.selector}) has placeholder or filename alt text ("${img.alt}").`,
              deterministicReason: `Alt text matches generic placeholder or file extension pattern.`,
              remediationRecommendation: meta.remediationHint,
              targetUrl: pageUrl,
              selector: img.selector,
              viewport: 'desktop',
              evidence: { img },
              fingerprint: fp,
              timestamp: new Date().toISOString(),
            };

            findings.push(finding);
            bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
          }
        }

        // G. Color Contrast Evaluation
        if (this.policy.enableContrastAnalysis) {
          const cRes = await ContrastEvaluator.evaluateContrast(localPage, pageUrl, this.policy);
          contrastResults.push(...cRes);

          for (const c of cRes) {
            if (c.status === 'FAIL') {
              const meta = AccessibilitySeverityClassifier.getMetadata('CONTRAST_FAILURE');
              const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                'CONTRAST_FAILURE',
                pageUrl,
                c.selector,
                'desktop'
              );

              const finding: AccessibilityFinding = {
                id: `a11y-contrast-${Date.now()}-${findings.length + 1}`,
                type: 'CONTRAST_FAILURE',
                title: meta.title,
                wcagReference: meta.wcagReference,
                principle: meta.principle,
                severity: meta.defaultSeverity,
                confidence: meta.defaultConfidence,
                description: `Text element (${c.selector}) has insufficient contrast ratio (${c.contrastRatio}:1 vs required ${c.requiredRatio}:1).`,
                deterministicReason: `Computed foreground ${c.computedColor} against background ${c.computedBgColor} yields contrast ratio below WCAG AA threshold.`,
                remediationRecommendation: meta.remediationHint,
                targetUrl: pageUrl,
                selector: c.selector,
                viewport: 'desktop',
                evidence: { contrast: c },
                fingerprint: fp,
                timestamp: new Date().toISOString(),
              };

              findings.push(finding);
              bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
            }
          }
        }

        // H. Keyboard Navigation & Trap Testing
        if (this.policy.enableKeyboardTesting) {
          const kbEngine = new KeyboardNavigationEngine(this.policy, this.logger);
          const kbRes = await kbEngine.evaluateKeyboardNavigation(localPage, pageUrl, 'desktop');
          keyboardResults.push(kbRes);

          if (kbRes.trapsDetected && kbRes.trapDetails) {
            const meta = AccessibilitySeverityClassifier.getMetadata('KEYBOARD_TRAP');
            const fp = AccessibilityEvidenceFormatter.generateFingerprint(
              'KEYBOARD_TRAP',
              pageUrl,
              kbRes.trapDetails.selector,
              'desktop'
            );

            const finding: AccessibilityFinding = {
              id: `a11y-trap-${Date.now()}-${findings.length + 1}`,
              type: 'KEYBOARD_TRAP',
              title: meta.title,
              wcagReference: meta.wcagReference,
              principle: meta.principle,
              severity: meta.defaultSeverity,
              confidence: meta.defaultConfidence,
              description: `Keyboard navigation trapped in endless focus cycle at (${kbRes.trapDetails.selector}).`,
              deterministicReason: `Focus repeated continuously across ${kbRes.trapDetails.cyclicStepCount} elements without advancing.`,
              remediationRecommendation: meta.remediationHint,
              targetUrl: pageUrl,
              selector: kbRes.trapDetails.selector,
              viewport: 'desktop',
              evidence: { trap: kbRes.trapDetails },
              fingerprint: fp,
              timestamp: new Date().toISOString(),
            };

            findings.push(finding);
            bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
          }

          if (kbRes.unreachableElementsCount > 0) {
            const meta = AccessibilitySeverityClassifier.getMetadata('CONTENT_NOT_REACHABLE_BY_KEYBOARD');
            const fp = AccessibilityEvidenceFormatter.generateFingerprint(
              'CONTENT_NOT_REACHABLE_BY_KEYBOARD',
              pageUrl,
              kbRes.unreachableSelectors[0] || 'unreachable',
              'desktop'
            );

            const finding: AccessibilityFinding = {
              id: `a11y-unreachable-${Date.now()}-${findings.length + 1}`,
              type: 'CONTENT_NOT_REACHABLE_BY_KEYBOARD',
              title: meta.title,
              wcagReference: meta.wcagReference,
              principle: meta.principle,
              severity: meta.defaultSeverity,
              confidence: meta.defaultConfidence,
              description: `${kbRes.unreachableElementsCount} interactive control(s) were unreachable during sequential keyboard navigation.`,
              deterministicReason: `Interactive elements never received focus during complete tab cycle: ${kbRes.unreachableSelectors.slice(0, 3).join(', ')}`,
              remediationRecommendation: meta.remediationHint,
              targetUrl: pageUrl,
              selector: kbRes.unreachableSelectors[0],
              viewport: 'desktop',
              evidence: { unreachableSelectors: kbRes.unreachableSelectors },
              fingerprint: fp,
              timestamp: new Date().toISOString(),
            };

            findings.push(finding);
            bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
          }
        }

        // I. Focus Visibility
        if (this.policy.enableFocusVisibility) {
          const focusChecks = await FocusVisibilityEvaluator.evaluateFocusVisibility(localPage, pageUrl);
          for (const f of focusChecks) {
            if (!f.isVisible && f.isConclusive) {
              const meta = AccessibilitySeverityClassifier.getMetadata('FOCUS_NOT_VISIBLE');
              const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                'FOCUS_NOT_VISIBLE',
                pageUrl,
                f.selector,
                'desktop'
              );

              const finding: AccessibilityFinding = {
                id: `a11y-focus-vis-${Date.now()}-${findings.length + 1}`,
                type: 'FOCUS_NOT_VISIBLE',
                title: meta.title,
                wcagReference: meta.wcagReference,
                principle: meta.principle,
                severity: meta.defaultSeverity,
                confidence: meta.defaultConfidence,
                description: `Interactive element (${f.selector}) has no visible focus indicator when focused.`,
                deterministicReason: `Computed styles show outline: none/0px and no compensatory border or shadow modification on focus.`,
                remediationRecommendation: meta.remediationHint,
                targetUrl: pageUrl,
                selector: f.selector,
                viewport: 'desktop',
                evidence: { focus: f },
                fingerprint: fp,
                timestamp: new Date().toISOString(),
              };

              findings.push(finding);
              bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
            }
          }
        }

        // J. Dialog Accessibility
        if (this.policy.enableDialogTesting) {
          const dialogs = await DialogAccessibilityEvaluator.evaluateDialogs(localPage, pageUrl);
          dialogResults.push(...dialogs);

          for (const d of dialogs) {
            if (!d.hasAccessibleName) {
              const meta = AccessibilitySeverityClassifier.getMetadata('DIALOG_MISSING_NAME');
              const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                'DIALOG_MISSING_NAME',
                pageUrl,
                d.selector,
                'desktop'
              );

              const finding: AccessibilityFinding = {
                id: `a11y-dlg-name-${Date.now()}-${findings.length + 1}`,
                type: 'DIALOG_MISSING_NAME',
                title: meta.title,
                wcagReference: meta.wcagReference,
                principle: meta.principle,
                severity: meta.defaultSeverity,
                confidence: meta.defaultConfidence,
                description: `Dialog (${d.selector}) has no accessible title or label.`,
                deterministicReason: `Dialog lacks aria-labelledby or aria-label describing its purpose.`,
                remediationRecommendation: meta.remediationHint,
                targetUrl: pageUrl,
                selector: d.selector,
                viewport: 'desktop',
                evidence: { dialog: d },
                fingerprint: fp,
                timestamp: new Date().toISOString(),
              };

              findings.push(finding);
              bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
            }
          }
        }

        // K. Reduced Motion Check
        if (this.policy.enableReducedMotion) {
          const motionRes = await ReducedMotionEvaluator.evaluateReducedMotion(localPage, pageUrl);
          reducedMotionResults.push(motionRes);

          if (motionRes.status === 'FAIL') {
            for (const el of motionRes.animatingElements.filter((a) => !a.respectsReducedMotion)) {
              const meta = AccessibilitySeverityClassifier.getMetadata('REDUCED_MOTION_FAILURE');
              const fp = AccessibilityEvidenceFormatter.generateFingerprint(
                'REDUCED_MOTION_FAILURE',
                pageUrl,
                el.selector,
                'desktop'
              );

              const finding: AccessibilityFinding = {
                id: `a11y-motion-${Date.now()}-${findings.length + 1}`,
                type: 'REDUCED_MOTION_FAILURE',
                title: meta.title,
                wcagReference: meta.wcagReference,
                principle: meta.principle,
                severity: meta.defaultSeverity,
                confidence: meta.defaultConfidence,
                description: `Animation on (${el.selector}) continues without reduction when prefers-reduced-motion is active.`,
                deterministicReason: `Continuous looping animation (${el.animationName}) does not pause or disable under reduced motion media query.`,
                remediationRecommendation: meta.remediationHint,
                targetUrl: pageUrl,
                selector: el.selector,
                viewport: 'desktop',
                evidence: { animatingElement: el },
                fingerprint: fp,
                timestamp: new Date().toISOString(),
              };

              findings.push(finding);
              bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
            }
          }
        }

        // Semantic summary
        semanticResults.push({
          pageUrl,
          headings: headingResult.headings,
          hasSkippedHeadings: headingResult.hasSkippedHeadings,
          hasMainLandmark: landmarkResult.hasMainLandmark,
          duplicateMainLandmarksCount: landmarkResult.duplicateMainLandmarksCount,
          landmarks: landmarkResult.landmarks,
          images: imageItems,
          ariaChecks: [],
        });

      } catch (pageErr: any) {
        this.logger?.warn('accessibility_page_scan_error', {
          pageUrl,
          error: pageErr.message,
        });
      } finally {
        if (ownPage && localPage) {
          await localPage.close().catch(() => {});
        }
      }
    }

    // 2. Multi-Viewport Responsive Accessibility Checks (Mobile Touch Targets & Reflow)
    if (this.policy.enableResponsiveTesting && browser && !cancellationToken?.isCancelled && uniquePageUrls.length > 0) {
      try {
        const respEngine = new ResponsiveAccessibilityEngine(this.policy);
        const primaryUrl = uniquePageUrls[0];
        const respOutput = await respEngine.evaluateResponsiveAccessibility(browser, primaryUrl);

        touchTargetResults.push(...respOutput.touchTargetResults);
        textScalingResults.push(...respOutput.textScalingResults);

        // Touch target failures
        for (const t of respOutput.touchTargetResults) {
          if (!t.isCompliant) {
            const meta = AccessibilitySeverityClassifier.getMetadata('TOUCH_TARGET_TOO_SMALL');
            const fp = AccessibilityEvidenceFormatter.generateFingerprint(
              'TOUCH_TARGET_TOO_SMALL',
              primaryUrl,
              t.selector,
              'mobile'
            );

            const finding: AccessibilityFinding = {
              id: `a11y-touch-${Date.now()}-${findings.length + 1}`,
              type: 'TOUCH_TARGET_TOO_SMALL',
              title: meta.title,
              wcagReference: meta.wcagReference,
              principle: meta.principle,
              severity: meta.defaultSeverity,
              confidence: meta.defaultConfidence,
              description: `Interactive element (${t.selector}) touch target size (${t.width}x${t.height}px) is below minimum ${t.minimumRequired}x${t.minimumRequired}px.`,
              deterministicReason: `Mobile touch target bounding box does not satisfy minimum dimension requirement.`,
              remediationRecommendation: meta.remediationHint,
              targetUrl: primaryUrl,
              selector: t.selector,
              viewport: 'mobile',
              evidence: { touchTarget: t },
              fingerprint: fp,
              timestamp: new Date().toISOString(),
            };

            findings.push(finding);
            bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
          }
        }

        // Text scaling failures
        for (const ts of respOutput.textScalingResults) {
          if (ts.status === 'FAIL') {
            const meta = AccessibilitySeverityClassifier.getMetadata('CONTENT_CLIPPED_ON_TEXT_SCALE');
            const fp = AccessibilityEvidenceFormatter.generateFingerprint(
              'CONTENT_CLIPPED_ON_TEXT_SCALE',
              primaryUrl,
              ts.clippedElements[0]?.selector || 'text-scale',
              ts.viewport
            );

            const finding: AccessibilityFinding = {
              id: `a11y-txtscale-${Date.now()}-${findings.length + 1}`,
              type: 'CONTENT_CLIPPED_ON_TEXT_SCALE',
              title: meta.title,
              wcagReference: meta.wcagReference,
              principle: meta.principle,
              severity: meta.defaultSeverity,
              confidence: meta.defaultConfidence,
              description: `${ts.clippedElements.length} text container(s) clipped during 200% text scaling reflow.`,
              deterministicReason: `Text contents overflowed bounded container width during 200% zoom scaling.`,
              remediationRecommendation: meta.remediationHint,
              targetUrl: primaryUrl,
              selector: ts.clippedElements[0]?.selector,
              viewport: ts.viewport,
              evidence: { textScaling: ts },
              fingerprint: fp,
              timestamp: new Date().toISOString(),
            };

            findings.push(finding);
            bugObservations.push(AccessibilityEvidenceFormatter.toBugObservation(finding, testRunId, projectId));
          }
        }
      } catch (respErr: any) {
        this.logger?.warn('accessibility_responsive_error', { error: respErr.message });
      }
    }

    const durationMs = Date.now() - startTime;

    // 3. Compute Aggregate Coverage & Deterministic Score
    const { coverage } = AccessibilityAnalyzer.analyze({
      targetsDiscovered: targets.length,
      pagesTested: pagesTestedCount,
      findings,
      keyboardResults,
      contrastResults,
      touchTargetResults,
      formResults,
      semanticResults,
      textScalingResults,
      reducedMotionResults,
      dialogResults,
      durationMs,
    });

    this.logger?.log('accessibility_scan_completed', {
      targetsDiscovered: targets.length,
      pagesTested: pagesTestedCount,
      findingsCount: findings.length,
      criticalFindings: coverage.criticalFindings,
      highFindings: coverage.highFindings,
      accessibilityScore: coverage.accessibilityScore,
      durationMs,
    });

    return {
      testRunId,
      projectId,
      targetUrl,
      coverage,
      findings,
      bugObservations,
      keyboardResults,
      contrastResults,
      touchTargetResults,
      formResults,
      semanticResults,
      textScalingResults,
      reducedMotionResults,
      dialogResults,
    };
  }
}

