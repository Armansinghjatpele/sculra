// ==============================================================================
// Sculra Test Target Candidate Generator (worker/src/strategy/candidate-generator.ts)
// ==============================================================================
// Discovers, synthesizes, and builds typed TestTarget candidates from
// ApplicationMap, AIQAState, BugObservations, JourneyResults, and Responsive Viewports.

import { TestTarget, TestTargetType, TargetSource } from './types';
import { ApplicationMap, DiscoveredPage } from '../types';
import { AIQAState } from '../ai-qa/state';
import { BugObservation } from '../issues/types';
import { JourneyResult } from '../journeys/types';

export interface CandidateGenerationContext {
  targetUrl: string;
  applicationMap?: ApplicationMap;
  state?: AIQAState;
  bugObservations?: BugObservation[];
  journeyResults?: JourneyResult[];
  consoleErrors?: Array<{ message: string; url?: string }>;
  networkErrors?: Array<{ url: string; status: number }>;
  testedViewports?: string[];
  historicalIssues?: Array<{ pageUrl: string; title: string; fingerprint?: string }>;
}

export class CandidateGenerator {
  /**
   * Generates a comprehensive, deduplicated array of candidate TestTargets.
   */
  static generateCandidates(context: CandidateGenerationContext): TestTarget[] {
    const candidates: TestTarget[] = [];
    const seenIds = new Set<string>();

    const addCandidate = (target: TestTarget) => {
      if (!seenIds.has(target.id)) {
        seenIds.add(target.id);
        candidates.push(target);
      }
    };

    const targetUrl = context.targetUrl;
    const appMap = context.applicationMap;
    const state = context.state;
    const bugs = context.bugObservations || [];
    const journeys = context.journeyResults || [];
    const consoleErrs = context.consoleErrors || [];
    const networkErrs = context.networkErrors || [];

    // Helper: Normalize URL to ID segment
    const urlToSegment = (url: string) => {
      try {
        const u = new URL(url);
        return (u.pathname + u.search).replace(/[^a-zA-Z0-9_-]/g, '_') || 'root';
      } catch {
        return url.replace(/[^a-zA-Z0-9_-]/g, '_');
      }
    };

    // ---------------------------------------------------------------------------
    // 1. Failure Investigation Candidates (Highest Urgency)
    // ---------------------------------------------------------------------------
    for (const bug of bugs) {
      const pageUrl = bug.url || targetUrl;
      const id = `target-fail-${bug.type.toLowerCase()}-${urlToSegment(pageUrl)}-${(bug.selector || 'page').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)}`;
      addCandidate({
        id,
        targetType: 'PREVIOUS_FAILURE',
        pageUrl,
        selector: bug.selector,
        action: 'CLICK',
        priorityScore: bug.severity === 'critical' ? 95 : bug.severity === 'high' ? 85 : 70,
        priorityLevel: bug.severity === 'critical' || bug.severity === 'high' ? 'critical' : 'high',
        riskLevel: bug.severity === 'critical' ? 'critical' : 'high',
        coverageValue: 50,
        reasons: [`Follow-up investigation for ${bug.severity} severity bug: ${bug.title}`],
        dependencies: [`target-page-${urlToSegment(pageUrl)}`],
        source: 'FAILURE_INVESTIGATION',
        status: 'PENDING',
        estimatedCost: 2,
        evidenceCount: 1,
        attemptsCount: 0,
        relatedIssueFingerprint: bug.fingerprint,
        metadata: { bug },
      });
    }

    // 5xx Server Error Candidates
    for (const nErr of networkErrs.filter((n) => n.status >= 500)) {
      const id = `target-5xx-${urlToSegment(nErr.url)}`;
      addCandidate({
        id,
        targetType: 'PREVIOUS_FAILURE',
        pageUrl: nErr.url,
        action: 'NAVIGATE',
        priorityScore: 90,
        priorityLevel: 'critical',
        riskLevel: 'critical',
        coverageValue: 60,
        reasons: [`HTTP ${nErr.status} server error detected on endpoint: ${nErr.url}`],
        dependencies: [],
        source: 'FAILURE_INVESTIGATION',
        status: 'PENDING',
        estimatedCost: 1,
        evidenceCount: 1,
        attemptsCount: 0,
      });
    }

    // Console Runtime Crash Candidates
    for (const cErr of consoleErrs) {
      const pageUrl = cErr.url || targetUrl;
      const id = `target-console-err-${urlToSegment(pageUrl)}`;
      addCandidate({
        id,
        targetType: 'PREVIOUS_FAILURE',
        pageUrl,
        action: 'NAVIGATE',
        priorityScore: 78,
        priorityLevel: 'high',
        riskLevel: 'high',
        coverageValue: 40,
        reasons: [`Console runtime exception observed on ${pageUrl}: ${cErr.message.substring(0, 80)}`],
        dependencies: [`target-page-${urlToSegment(pageUrl)}`],
        source: 'FAILURE_INVESTIGATION',
        status: 'PENDING',
        estimatedCost: 2,
        evidenceCount: 1,
        attemptsCount: 0,
      });
    }

    // ---------------------------------------------------------------------------
    // 2. Active Hypothesis Candidates
    // ---------------------------------------------------------------------------
    if (state?.hypotheses) {
      for (const hyp of state.hypotheses.values()) {
        if (hyp.status === 'PENDING' || hyp.status === 'TESTING') {
          const id = `target-hyp-${hyp.id}`;
          addCandidate({
            id,
            targetType: 'SUSPECTED_ISSUE',
            pageUrl: hyp.targetUrl,
            action: 'NAVIGATE',
            priorityScore: hyp.confidence === 'high' ? 82 : 68,
            priorityLevel: hyp.confidence === 'high' ? 'high' : 'medium',
            riskLevel: 'high',
            coverageValue: 50,
            reasons: [`Active hypothesis testing: ${hyp.description}`],
            dependencies: [`target-page-${urlToSegment(hyp.targetUrl)}`],
            source: 'HYPOTHESIS',
            status: 'PENDING',
            estimatedCost: 2,
            evidenceCount: 0,
            attemptsCount: 0,
            hypothesisId: hyp.id,
          });
        }
      }
    }

    // ---------------------------------------------------------------------------
    // 3. Application Map Discovery Candidates (Pages, Forms, Primary CTAs, Nav)
    // ---------------------------------------------------------------------------
    const pages = appMap?.pages || [];
    for (const page of pages) {
      const pageSeg = urlToSegment(page.url);
      const isVisited = state?.testedPages?.has(page.url);

      // Page Visit Candidate
      const pageId = `target-page-${pageSeg}`;
      addCandidate({
        id: pageId,
        targetType: 'PAGE',
        pageUrl: page.url,
        action: 'NAVIGATE',
        priorityScore: isVisited ? 30 : 80,
        priorityLevel: isVisited ? 'low' : 'high',
        riskLevel: page.depth === 0 ? 'medium' : 'low',
        coverageValue: isVisited ? 10 : 85,
        reasons: isVisited
          ? [`Route already visited in previous iteration: ${page.url}`]
          : [`Unvisited discovered route at depth ${page.depth}: ${page.url}`],
        dependencies: [],
        source: 'DISCOVERY',
        status: isVisited ? 'EXECUTED' : 'PENDING',
        estimatedCost: 1,
        evidenceCount: isVisited ? 1 : 0,
        attemptsCount: isVisited ? 1 : 0,
        metadata: { depth: page.depth, title: page.title },
      });

      // Forms Candidates on Page
      (page.forms || []).forEach((form, fIdx) => {
        const formId = `target-form-${pageSeg}-${fIdx}`;
        const isFormTested = state?.testedForms?.some((tf) => tf.pageUrl === page.url);
        const formSelector = (form as any).selector || form.submitSelector || (form.id ? `#${form.id}` : (form.action ? `form[action="${form.action}"]` : `form:nth-of-type(${fIdx + 1})`));
        const formName = (form as any).name || form.action || (form.id ? `#${form.id}` : `form #${fIdx + 1}`);
        addCandidate({
          id: formId,
          targetType: 'FORM',
          pageUrl: page.url,
          selector: formSelector,
          action: 'VALIDATE_FORM',
          priorityScore: isFormTested ? 25 : 78,
          priorityLevel: isFormTested ? 'low' : 'high',
          riskLevel: 'high',
          coverageValue: isFormTested ? 15 : 80,
          reasons: isFormTested
            ? [`Form previously evaluated: ${formName}`]
            : [`Interactive form with ${(form.fields || []).length} field(s) on ${page.url}`],
          dependencies: [pageId],
          source: 'DISCOVERY',
          status: isFormTested ? 'EXECUTED' : 'PENDING',
          estimatedCost: 3,
          evidenceCount: isFormTested ? 1 : 0,
          attemptsCount: isFormTested ? 1 : 0,
          metadata: { form },
        });
      });

      // Primary Buttons / CTAs on Page
      const pageButtons = (page.elements || []).filter(
        (e) => e.type === 'button' || e.role === 'button' || e.tagName?.toLowerCase() === 'button'
      );
      pageButtons.forEach((btn, bIdx) => {
        const isPrimary = Boolean((btn as any).isPrimaryCta || (btn.text && /sign|log|submit|start|get|buy|register/i.test(btn.text)) || (btn.accessibleName && /sign|log|submit|start|get|buy|register/i.test(btn.accessibleName)));
        if (isPrimary || bIdx < 3) {
          const btnId = `target-btn-${pageSeg}-${bIdx}`;
          const isBtnTested = state?.testedInteractions?.some(
            (ti) => ti.pageUrl === page.url && ti.selector === btn.selector
          );
          const btnLabel = btn.text || btn.accessibleName || btn.selector;
          addCandidate({
            id: btnId,
            targetType: 'BUTTON',
            pageUrl: page.url,
            selector: btn.selector,
            action: 'CLICK',
            priorityScore: isBtnTested ? 20 : (isPrimary ? 75 : 60),
            priorityLevel: isBtnTested ? 'low' : (isPrimary ? 'high' : 'medium'),
            riskLevel: isPrimary ? 'medium' : 'low',
            coverageValue: isBtnTested ? 10 : 70,
            reasons: isBtnTested
              ? [`Button previously exercised: ${btnLabel}`]
              : [isPrimary ? `Primary CTA button on ${page.url}: "${btnLabel}"` : `Interactive button: "${btnLabel}"`],
            dependencies: [pageId],
            source: 'DISCOVERY',
            status: isBtnTested ? 'EXECUTED' : 'PENDING',
            estimatedCost: 2,
            evidenceCount: isBtnTested ? 1 : 0,
            attemptsCount: isBtnTested ? 1 : 0,
            metadata: { button: btn },
          });
        }
      });

      // Outbound Navigation Links on Page
      (page.links || []).slice(0, 4).forEach((link, lIdx) => {
        if (link.href && link.href.startsWith('http')) {
          const linkId = `target-nav-${pageSeg}-${urlToSegment(link.href)}`;
          const isNavTested = state?.testedNavigationPaths?.some(
            (tn) => tn.fromUrl === page.url && tn.toUrl === link.href
          );
          const linkSelector = (link as any).selector || `a[href*="${link.href.replace(/'/g, "\\'")}"]`;
          addCandidate({
            id: linkId,
            targetType: 'NAVIGATION_PATH',
            pageUrl: page.url,
            selector: linkSelector,
            action: 'CLICK',
            priorityScore: isNavTested ? 15 : 62,
            priorityLevel: isNavTested ? 'low' : 'medium',
            riskLevel: 'low',
            coverageValue: isNavTested ? 5 : 65,
            reasons: isNavTested
              ? [`Navigation path already traversed: ${page.url} -> ${link.href}`]
              : [`Internal navigation link: "${link.text || link.href}" -> ${link.href}`],
            dependencies: [pageId],
            source: 'DISCOVERY',
            status: isNavTested ? 'EXECUTED' : 'PENDING',
            estimatedCost: 2,
            evidenceCount: isNavTested ? 1 : 0,
            attemptsCount: isNavTested ? 1 : 0,
            metadata: { link },
          });
        }
      });
    }

    // ---------------------------------------------------------------------------
    // 4. Responsive Viewport Gap Candidates
    // ---------------------------------------------------------------------------
    const testedVps = context.testedViewports || ['desktop'];
    const targetViewports: Array<'mobile' | 'tablet'> = ['mobile', 'tablet'];

    for (const vp of targetViewports) {
      if (!testedVps.includes(vp)) {
        for (const page of pages.slice(0, 3)) {
          const id = `target-resp-${vp}-${urlToSegment(page.url)}`;
          addCandidate({
            id,
            targetType: 'RESPONSIVE_VIEW',
            pageUrl: page.url,
            viewportName: vp,
            action: 'NAVIGATE',
            priorityScore: 72,
            priorityLevel: 'high',
            riskLevel: 'medium',
            coverageValue: 80,
            reasons: [`Cross-device responsive validation on ${vp.toUpperCase()} viewport: ${page.url}`],
            dependencies: [],
            source: 'RESPONSIVE',
            status: 'PENDING',
            estimatedCost: 2,
            evidenceCount: 0,
            attemptsCount: 0,
          });
        }
      }
    }

    return candidates;
  }
}
