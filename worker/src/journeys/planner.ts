// ==============================================================================
// Sculra Deterministic User Journey Planner (worker/src/journeys/planner.ts)
// ==============================================================================
// Analyzes the ApplicationMap and plans bounded, deterministic, safe candidate
// journeys across navigation, interactive UI controls, forms, and responsive viewports.

import { ApplicationMap, DiscoveredPage } from '../types';
import {
  Journey,
  JourneyStep,
  JourneyLimits,
  IJourneyPlanner,
} from './types';
import { isDangerousAction, isSensitiveField, getDeterministicFieldValue } from './safety';
import { isSameOrigin } from '../discoveryUtils';

export const DEFAULT_JOURNEY_LIMITS: JourneyLimits = {
  maxJourneys: 10,
  maxStepsPerJourney: 25,
  maxActionsPerPage: 20,
  maxNavigationDepth: 3,
  maxJourneyTimeMs: 60000,
  maxActionTimeMs: 5000,
  maxPageWaitMs: 10000,
};

export class DeterministicJourneyPlanner implements IJourneyPlanner {
  async plan(
    applicationMap: ApplicationMap,
    customLimits: Partial<JourneyLimits> = {}
  ): Promise<Journey[]> {
    const limits: JourneyLimits = { ...DEFAULT_JOURNEY_LIMITS, ...customLimits };
    const journeys: Journey[] = [];
    const startUrl = applicationMap.startUrl;

    if (!applicationMap.pages || applicationMap.pages.length === 0) {
      return [];
    }

    const homePage = applicationMap.pages.find((p) => p.depth === 0) || applicationMap.pages[0];

    // ============================================================================
    // 1. Journey A: Primary Navigation & Exploration Flow
    // ============================================================================
    const navSteps: JourneyStep[] = [];
    let stepNum = 1;

    // Step 1: Navigate to Home
    navSteps.push({
      id: `nav-step-${stepNum++}`,
      pageUrl: startUrl,
      action: 'NAVIGATE',
      targetDescription: 'Initial Entry Target',
      expected: { url: startUrl, title: homePage.title },
    });

    // Step 2: Assert Home Title
    navSteps.push({
      id: `nav-step-${stepNum++}`,
      pageUrl: startUrl,
      action: 'ASSERT_TITLE',
      targetDescription: homePage.title || 'Page Title',
      expected: { title: homePage.title },
    });

    // Step 3..N: Internal links navigation
    const internalPages = applicationMap.pages.filter(
      (p) => p.url !== startUrl && isSameOrigin(p.url, startUrl)
    );

    for (const page of internalPages.slice(0, 4)) {
      if (navSteps.length >= limits.maxStepsPerJourney) break;

      // Find link leading to this page from home if exists
      const linkOnHome = homePage.links.find(
        (l) => l.isInternal && (l.href === page.url || page.url.endsWith(l.href))
      );

      if (linkOnHome) {
        navSteps.push({
          id: `nav-step-${stepNum++}`,
          pageUrl: startUrl,
          action: 'CLICK',
          targetDescription: linkOnHome.text || linkOnHome.href,
          selector: `a[href="${linkOnHome.href}"]`,
          expected: { url: page.url, title: page.title },
        });
      } else {
        navSteps.push({
          id: `nav-step-${stepNum++}`,
          pageUrl: page.url,
          action: 'NAVIGATE',
          targetDescription: `Direct Navigation: ${page.title}`,
          expected: { url: page.url, title: page.title },
        });
      }

      navSteps.push({
        id: `nav-step-${stepNum++}`,
        pageUrl: page.url,
        action: 'ASSERT_URL',
        targetDescription: `Verify URL ${page.url}`,
        expected: { url: page.url },
      });
    }

    if (navSteps.length > 0) {
      journeys.push({
        id: 'journey-navigation-core',
        name: 'Primary Navigation & Link Traversal',
        description: 'Verifies top-level navigation flow, URL routing, and title consistency across discovered pages.',
        category: 'navigation',
        startUrl,
        steps: navSteps.slice(0, limits.maxStepsPerJourney),
        timeoutMs: limits.maxJourneyTimeMs,
      });
    }

    // ============================================================================
    // 2. Journey B: Interactive UI Controls & Button State Verification
    // ============================================================================
    const interactionSteps: JourneyStep[] = [];
    let intStepNum = 1;

    for (const page of applicationMap.pages) {
      if (interactionSteps.length >= limits.maxStepsPerJourney) break;

      const buttons = page.elements.filter((e) => e.type === 'button');
      if (buttons.length === 0) continue;

      interactionSteps.push({
        id: `int-step-${intStepNum++}`,
        pageUrl: page.url,
        action: 'NAVIGATE',
        targetDescription: `Navigate to ${page.title}`,
        expected: { url: page.url },
      });

      for (const btn of buttons.slice(0, limits.maxActionsPerPage)) {
        if (interactionSteps.length >= limits.maxStepsPerJourney) break;

        const safety = isDangerousAction(btn.text || '', btn.accessibleName, btn.role);
        if (safety.dangerous) {
          continue; // Skip dangerous buttons during planning
        }

        interactionSteps.push({
          id: `int-step-${intStepNum++}`,
          pageUrl: page.url,
          action: 'CLICK',
          targetDescription: btn.text || btn.accessibleName || 'Button',
          selector: btn.selector,
          timeoutMs: limits.maxActionTimeMs,
        });
      }
    }

    if (interactionSteps.length > 0) {
      journeys.push({
        id: 'journey-interactive-controls',
        name: 'Interactive UI Controls & State Changes',
        description: 'Exercises non-destructive buttons, expandable elements, and interactive controls to observe state changes.',
        category: 'interaction',
        startUrl,
        steps: interactionSteps.slice(0, limits.maxStepsPerJourney),
        timeoutMs: limits.maxJourneyTimeMs,
      });
    }

    // ============================================================================
    // 3. Journey C: Form Usability & Safe Client-Side Validation
    // ============================================================================
    const formPages = applicationMap.pages.filter((p) => p.forms && p.forms.length > 0);

    for (let fIdx = 0; fIdx < formPages.length; fIdx++) {
      if (journeys.length >= limits.maxJourneys) break;

      const page = formPages[fIdx];
      const formSteps: JourneyStep[] = [];
      let fStepNum = 1;

      formSteps.push({
        id: `form-step-${fStepNum++}`,
        pageUrl: page.url,
        action: 'NAVIGATE',
        targetDescription: `Navigate to Form: ${page.title}`,
        expected: { url: page.url },
      });

      for (const form of page.forms) {
        if (formSteps.length >= limits.maxStepsPerJourney) break;

        // Step A: Form validation inspection
        formSteps.push({
          id: `form-step-${fStepNum++}`,
          pageUrl: page.url,
          action: 'VALIDATE_FORM',
          targetDescription: `Inspect Form [${form.action || form.method}] Validation Rules`,
          selector: form.id ? `#${form.id}` : 'form',
        });

        // Step B: Fill safe fields with deterministic test data
        for (const field of form.fields) {
          if (formSteps.length >= limits.maxStepsPerJourney) break;

          const sensitive = isSensitiveField(field);
          if (sensitive.sensitive) {
            continue; // Skip sensitive fields
          }

          const value = getDeterministicFieldValue(field);

          if (field.type === 'checkbox') {
            formSteps.push({
              id: `form-step-${fStepNum++}`,
              pageUrl: page.url,
              action: 'CHECK',
              targetDescription: `Toggle Checkbox [${field.name}]`,
              selector: field.selector,
            });
          } else if (field.type === 'select') {
            formSteps.push({
              id: `form-step-${fStepNum++}`,
              pageUrl: page.url,
              action: 'SELECT',
              targetDescription: `Select Option [${field.name}]`,
              selector: field.selector,
              value,
            });
          } else {
            formSteps.push({
              id: `form-step-${fStepNum++}`,
              pageUrl: page.url,
              action: 'FILL',
              targetDescription: `Fill Field [${field.name}]`,
              selector: field.selector,
              value,
            });
          }
        }

        // Step C: If submit button is present, check submission
        if (form.submitSelector) {
          formSteps.push({
            id: `form-step-${fStepNum++}`,
            pageUrl: page.url,
            action: 'CLICK',
            targetDescription: form.submitText || 'Submit Button',
            selector: form.submitSelector,
            timeoutMs: limits.maxActionTimeMs,
          });
        }
      }

      if (formSteps.length > 0) {
        journeys.push({
          id: `journey-form-${fIdx + 1}`,
          name: `Form Usability & Validation Flow (${page.title})`,
          description: 'Fills safe, non-sensitive form fields, validates client-side constraints, and verifies submit behavior.',
          category: 'form',
          startUrl: page.url,
          steps: formSteps.slice(0, limits.maxStepsPerJourney),
          timeoutMs: limits.maxJourneyTimeMs,
        });
      }
    }

    // ============================================================================
    // 4. Journey D: Responsive Viewport Flow (Mobile)
    // ============================================================================
    if (journeys.length < limits.maxJourneys && navSteps.length > 0) {
      journeys.push({
        id: 'journey-responsive-mobile',
        name: 'Mobile Layout & Navigation (390×844)',
        description: 'Executes core navigation under a compact mobile viewport (390x844) to observe responsiveness and layout usability.',
        category: 'responsive',
        startUrl,
        steps: navSteps.slice(0, 6),
        timeoutMs: limits.maxJourneyTimeMs,
        viewport: { width: 390, height: 844, name: 'mobile' },
      });
    }

    return journeys.slice(0, limits.maxJourneys);
  }
}
