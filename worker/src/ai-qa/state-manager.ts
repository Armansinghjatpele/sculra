// ==============================================================================
// Sculra Adaptive AI QA State Manager (worker/src/ai-qa/state-manager.ts)
// ==============================================================================
// Manages the state machine, coverage tracking, hypothesis lifecycle,
// uncovered area discovery, and termination evaluations for the adaptive loop.

import { ApplicationMap, DiscoveredPage } from '../types';
import { BugObservation } from '../issues/types';
import { JourneyResult, JourneyObservation, JourneyStepExecution } from '../journeys/types';
import {
  AIQAPlan,
  AIQAAction,
  AIQABudget,
  AIQAStopReason,
  AIQAIssueAssessment,
  ActionRejectionReason,
  AIQAValidationResult,
  SanitizedPageSummary,
} from './types';
import {
  AIQAState,
  AIQAStateSummary,
  CoverageSummary,
  UncoveredAreas,
  HighRiskArea,
  BlockedArea,
  HypothesisRecord,
  TestedPageRecord,
} from './state';
import { AIQAContextSanitizer } from './sanitizer';

export interface InitializeStateOptions {
  testRunId: string;
  targetUrl: string;
  applicationMap?: ApplicationMap;
  initialIssues?: BugObservation[];
  initialJourneys?: JourneyResult[];
  initialObservations?: JourneyObservation[];
  budget: AIQABudget;
}

export class AIQAStateManager {
  /**
   * Initializes the adaptive QA state prior to iteration 1.
   */
  static initializeState(options: InitializeStateOptions): AIQAState {
    const appPages = options.applicationMap?.pages || [];
    const testedPages = new Map<string, TestedPageRecord>();

    // Index pages visited in initial journeys (e.g. from discovery / basic tests)
    for (const j of options.initialJourneys || []) {
      for (const step of j.steps) {
        const pageUrl = step.afterUrl || step.beforeUrl;
        if (pageUrl) {
          const existing = testedPages.get(pageUrl);
          if (existing) {
            existing.timesTested++;
            if (step.status === 'FAILED') existing.status = 'FAILED';
          } else {
            testedPages.set(pageUrl, {
              url: pageUrl,
              firstTestedIteration: 0,
              lastTestedIteration: 0,
              timesTested: 1,
              status: step.status === 'FAILED' ? 'FAILED' : 'PASSED',
            });
          }
        }
      }
    }

    const state: AIQAState = {
      testRunId: options.testRunId,
      iteration: 0,
      applicationMapSummary: {
        totalPages: options.applicationMap?.totalPages || appPages.length,
        totalForms: options.applicationMap?.totalForms || 0,
        totalButtons: options.applicationMap?.totalButtons || 0,
        totalLinks: options.applicationMap?.totalLinks || 0,
      },
      testedPages,
      testedInteractions: [],
      testedForms: [],
      testedNavigationPaths: [],
      testedViewports: ['desktop'],
      discoveredIssues: (options.initialIssues || []).map((b) => ({
        fingerprint: b.fingerprint,
        type: b.type,
        severity: b.severity,
        title: b.title,
        pageUrl: b.url,
        selector: b.selector,
        occurrenceCount: 1,
      })),
      confirmedIssues: [],
      suspectedIssues: [],
      failedJourneys: (options.initialJourneys || [])
        .filter((j) => j.status === 'FAILED')
        .map((j) => ({
          journeyId: j.journeyId,
          name: j.name,
          status: j.status,
          durationMs: j.durationMs,
          actionsPassed: j.actionsPassed,
          actionsFailed: j.actionsFailed,
          observationsCount: (j.observations || []).length,
        })),
      successfulJourneys: (options.initialJourneys || [])
        .filter((j) => j.status === 'PASSED')
        .map((j) => ({
          journeyId: j.journeyId,
          name: j.name,
          status: j.status,
          durationMs: j.durationMs,
          actionsPassed: j.actionsPassed,
          actionsFailed: j.actionsFailed,
          observationsCount: (j.observations || []).length,
        })),
      hypotheses: new Map<string, HypothesisRecord>(),
      rejectedPlans: [],
      uncoveredAreas: {
        unvisitedPages: [],
        unexercisedForms: [],
        unexercisedButtons: [],
        unexercisedLinks: [],
        unexercisedNavigationPaths: [],
      },
      highRiskAreas: [],
      blockedAreas: [],
      recentObservations: (options.initialObservations || []).map((obs) => ({
        type: obs.type,
        message: obs.message,
        severity: obs.severity,
        pageUrl: obs.pageUrl,
        selector: obs.selector,
        timestamp: obs.timestamp,
      })),
      coverageSummary: {
        pages: { discovered: 0, visited: 0 },
        forms: { discovered: 0, exercised: 0 },
        buttons: { discovered: 0, exercised: 0 },
        links: { discovered: 0, exercised: 0 },
        navigationPaths: { discovered: 0, exercised: 0 },
        hypotheses: { formulated: 0, tested: 0, confirmed: 0, disproven: 0, inconclusive: 0 },
      },
      remainingBudget: options.budget,
    };

    // Compute initial uncovered areas, high risk areas, and coverage counts
    state.uncoveredAreas = this.computeUncoveredAreas(state, options.applicationMap);
    state.highRiskAreas = this.computeHighRiskAreas(state, options.applicationMap, options.initialIssues, options.initialObservations);
    state.coverageSummary = this.computeCoverage(state, options.applicationMap);

    return state;
  }

  /**
   * Computes deterministic coverage counts (no fake percentages).
   */
  static computeCoverage(state: AIQAState, appMap?: ApplicationMap): CoverageSummary {
    const pages = appMap?.pages || [];
    const discoveredPagesCount = pages.length;

    const normalizedTestedUrls = new Set(
      Array.from(state.testedPages.keys()).map((u) => u.replace(/\/$/, ''))
    );
    let visitedPagesCount = 0;
    for (const page of pages) {
      if (normalizedTestedUrls.has(page.url.replace(/\/$/, ''))) {
        visitedPagesCount++;
      }
    }
    if (discoveredPagesCount === 0) {
      visitedPagesCount = state.testedPages.size;
    }

    let discoveredFormsCount = 0;
    let discoveredButtonsCount = 0;
    let discoveredLinksCount = 0;

    for (const page of pages) {
      discoveredFormsCount += (page.forms || []).length;
      discoveredButtonsCount += (page.elements || []).filter((e) => e.type === 'button' || e.role === 'button').length;
      discoveredLinksCount += (page.links || []).length;
    }

    // Set of exercised form keys
    const exercisedFormsSet = new Set<string>();
    for (const tf of state.testedForms) {
      exercisedFormsSet.add(`${tf.pageUrl}::${tf.formSelectorOrAction}`);
    }

    // Set of exercised buttons
    const exercisedButtonsSet = new Set<string>();
    for (const ti of state.testedInteractions) {
      if (ti.action === 'CLICK') {
        exercisedButtonsSet.add(`${ti.pageUrl}::${ti.selector}`);
      }
    }

    // Exercised navigation paths
    const exercisedNavSet = new Set<string>();
    for (const np of state.testedNavigationPaths) {
      exercisedNavSet.add(`${np.fromUrl} -> ${np.toUrl}`);
    }

    // Hypotheses breakdown
    let formulatedHyp = 0;
    let testedHyp = 0;
    let confirmedHyp = 0;
    let disprovenHyp = 0;
    let inconclusiveHyp = 0;

    for (const h of state.hypotheses.values()) {
      formulatedHyp++;
      if (h.status !== 'PENDING') testedHyp++;
      if (h.status === 'CONFIRMED') confirmedHyp++;
      if (h.status === 'DISPROVEN') disprovenHyp++;
      if (h.status === 'INCONCLUSIVE') inconclusiveHyp++;
    }

    return {
      pages: {
        discovered: discoveredPagesCount,
        visited: visitedPagesCount,
      },
      forms: {
        discovered: discoveredFormsCount,
        exercised: exercisedFormsSet.size,
      },
      buttons: {
        discovered: discoveredButtonsCount,
        exercised: exercisedButtonsSet.size,
      },
      links: {
        discovered: discoveredLinksCount,
        exercised: exercisedNavSet.size,
      },
      navigationPaths: {
        discovered: discoveredLinksCount,
        exercised: state.testedNavigationPaths.length,
      },
      hypotheses: {
        formulated: formulatedHyp,
        tested: testedHyp,
        confirmed: confirmedHyp,
        disproven: disprovenHyp,
        inconclusive: inconclusiveHyp,
      },
    };
  }

  /**
   * Identifies unvisited pages, unexercised forms, buttons, and navigation links.
   */
  static computeUncoveredAreas(state: AIQAState, appMap?: ApplicationMap): UncoveredAreas {
    const unvisitedPages: SanitizedPageSummary[] = [];
    const unexercisedForms: Array<{ pageUrl: string; formIndex: number; fieldsCount: number; fields: string[] }> = [];
    const unexercisedButtons: Array<{ pageUrl: string; selector: string; text?: string; isPrimaryCta?: boolean }> = [];
    const unexercisedLinks: Array<{ pageUrl: string; href: string; text?: string }> = [];
    const unexercisedNavigationPaths: Array<{ fromUrl: string; toUrl: string }> = [];

    const exercisedInteractions = new Set(state.testedInteractions.map((i) => `${i.pageUrl}::${i.selector}`));
    const exercisedForms = new Set(state.testedForms.map((f) => `${f.pageUrl}::${f.formSelectorOrAction}`));
    const exercisedNav = new Set(state.testedNavigationPaths.map((n) => `${n.fromUrl}->${n.toUrl}`));
    const normalizedTestedPages = new Set(
      Array.from(state.testedPages.keys()).map((u) => u.replace(/\/$/, ''))
    );

    for (const page of appMap?.pages || []) {
      const isVisited = normalizedTestedPages.has(page.url.replace(/\/$/, ''));
      if (!isVisited) {
        unvisitedPages.push({
          url: page.url,
          title: page.title || 'Untitled Page',
          depth: page.depth,
          interactiveElementsCount: (page.elements || []).length,
          formsCount: (page.forms || []).length,
          linksCount: (page.links || []).length,
          sampleElements: (page.elements || []).slice(0, 5).map((e) => ({
            type: e.type,
            selector: e.selector,
            text: e.text,
            isPrimaryCta: e.role === 'button' || e.type === 'button',
          })),
          sampleForms: (page.forms || []).slice(0, 3).map((f) => ({
            action: f.action,
            method: f.method || 'GET',
            fieldsCount: (f.fields || []).length,
            fields: (f.fields || []).map((fld) => ({
              name: fld.name,
              type: fld.type || 'text',
              label: fld.label,
              placeholder: fld.placeholder,
              required: !!fld.required,
              selector: fld.selector,
            })),
          })),
        });
      }

      // Check unexercised forms
      (page.forms || []).forEach((form, fIdx) => {
        const formKey = `${page.url}::${form.action || form.method || `form-${fIdx}`}`;
        if (!exercisedForms.has(formKey)) {
          unexercisedForms.push({
            pageUrl: page.url,
            formIndex: fIdx,
            fieldsCount: (form.fields || []).length,
            fields: (form.fields || []).map((f) => f.name || f.type || 'field'),
          });
        }
      });

      // Check unexercised buttons
      for (const el of page.elements || []) {
        if (el.type === 'button' || el.role === 'button') {
          const elKey = `${page.url}::${el.selector}`;
          if (!exercisedInteractions.has(elKey)) {
            unexercisedButtons.push({
              pageUrl: page.url,
              selector: el.selector,
              text: el.text || el.accessibleName,
              isPrimaryCta: true,
            });
          }
        }
      }

      // Check unexercised links
      for (const link of page.links || []) {
        if (link.isInternal && link.href) {
          const navKey = `${page.url}->${link.href}`;
          if (!exercisedNav.has(navKey)) {
            unexercisedNavigationPaths.push({
              fromUrl: page.url,
              toUrl: link.href,
            });
          }
        }
      }
    }

    return {
      unvisitedPages,
      unexercisedForms,
      unexercisedButtons,
      unexercisedLinks,
      unexercisedNavigationPaths,
    };
  }

  /**
   * Discovers areas with high defect risk (previous errors, broken controls, responsive overflow).
   */
  static computeHighRiskAreas(
    state: AIQAState,
    appMap?: ApplicationMap,
    issues: BugObservation[] = [],
    observations: JourneyObservation[] = []
  ): HighRiskArea[] {
    const riskMap = new Map<string, HighRiskArea>();

    // 1. Pages with confirmed issues
    for (const issue of issues) {
      if (issue.url) {
        const existing = riskMap.get(issue.url);
        const riskLevel = issue.severity === 'critical' || issue.severity === 'high' ? 'critical' : 'high';
        if (existing) {
          existing.relatedBugsCount++;
          if (riskLevel === 'critical') existing.riskLevel = 'critical';
        } else {
          riskMap.set(issue.url, {
            pageUrl: issue.url,
            reason: `Discovered defect: [${issue.type}] ${issue.title}`,
            riskLevel,
            relatedBugsCount: 1,
            relatedObservationsCount: 0,
          });
        }
      }
    }

    // 2. Pages with error observations or failed journey steps
    for (const obs of observations) {
      if (obs.severity === 'error' || obs.type === 'CLICK_NO_OP') {
        const existing = riskMap.get(obs.pageUrl);
        if (existing) {
          existing.relatedObservationsCount++;
        } else {
          riskMap.set(obs.pageUrl, {
            pageUrl: obs.pageUrl,
            reason: `Observed error/no-op: ${obs.message.substring(0, 100)}`,
            riskLevel: 'medium',
            relatedBugsCount: 0,
            relatedObservationsCount: 1,
          });
        }
      }
    }

    return Array.from(riskMap.values()).slice(0, 8);
  }

  /**
   * Updates state after an iteration executes.
   */
  static updateAfterIteration(
    state: AIQAState,
    iteration: number,
    plan: AIQAPlan,
    validationResult: AIQAValidationResult,
    journeyResult: JourneyResult | undefined,
    newObservations: JourneyObservation[],
    newIssues: AIQAIssueAssessment[],
    budget: AIQABudget,
    appMap?: ApplicationMap
  ): AIQAState {
    state.iteration = iteration;
    state.remainingBudget = budget;

    // 1. Record Hypotheses
    for (const hyp of plan.hypotheses || []) {
      const existing = state.hypotheses.get(hyp.id);
      if (!existing) {
        state.hypotheses.set(hyp.id, {
          id: hyp.id,
          description: hyp.description,
          targetUrl: hyp.targetUrl,
          suspectedBugType: hyp.suspectedBugType,
          priority: plan.priority,
          supportingEvidence: (hyp as any).supportingEvidence,
          status: 'TESTING',
          confidence: hyp.confidence,
          iterationFormulated: iteration,
          iterationTested: iteration,
        });
      }
    }

    // 2. Update Rejected Actions
    if (validationResult.rejectedActions.length > 0) {
      state.rejectedPlans.push({
        iteration,
        planId: plan.planId,
        rejections: validationResult.rejectedActions,
      });
    }

    // 3. Process Journey Steps & Actuations
    if (journeyResult) {
      let anyStepFailed = false;

      for (const step of journeyResult.steps) {
        const pageUrl = step.afterUrl || step.beforeUrl || plan.actions[0]?.pageUrl;
        if (pageUrl) {
          const pageRec = state.testedPages.get(pageUrl);
          if (pageRec) {
            pageRec.timesTested++;
            pageRec.lastTestedIteration = iteration;
            if (step.status === 'FAILED') pageRec.status = 'FAILED';
          } else {
            state.testedPages.set(pageUrl, {
              url: pageUrl,
              firstTestedIteration: iteration,
              lastTestedIteration: iteration,
              timesTested: 1,
              status: step.status === 'FAILED' ? 'FAILED' : 'PASSED',
            });
          }
        }

        if (step.selector) {
          state.testedInteractions.push({
            selector: step.selector,
            action: step.action,
            pageUrl: pageUrl || '',
            iteration,
            status: step.status === 'PASSED' ? 'PASSED' : step.status === 'FAILED' ? 'FAILED' : 'SKIPPED',
          });
        }

        if (step.action === 'FILL' || step.action === 'VALIDATE_FORM') {
          state.testedForms.push({
            formSelectorOrAction: step.selector || 'form',
            pageUrl: pageUrl || '',
            iteration,
            status: step.status === 'FAILED' ? 'FAILED' : 'PASSED',
            fieldsTested: step.selector ? [step.selector] : [],
          });
        }

        if (step.beforeUrl && step.afterUrl && step.beforeUrl !== step.afterUrl) {
          state.testedNavigationPaths.push({
            fromUrl: step.beforeUrl,
            toUrl: step.afterUrl,
            iteration,
            status: step.status === 'FAILED' ? 'FAILED' : 'PASSED',
          });
        }

        if (step.status === 'FAILED') {
          anyStepFailed = true;
        }
      }

      if (journeyResult.status === 'PASSED') {
        state.successfulJourneys.push({
          journeyId: journeyResult.journeyId,
          name: journeyResult.name,
          status: 'PASSED',
          durationMs: journeyResult.durationMs,
          actionsPassed: journeyResult.actionsPassed,
          actionsFailed: journeyResult.actionsFailed,
          observationsCount: (journeyResult.observations || []).length,
        });
      } else {
        state.failedJourneys.push({
          journeyId: journeyResult.journeyId,
          name: journeyResult.name,
          status: journeyResult.status,
          durationMs: journeyResult.durationMs,
          actionsPassed: journeyResult.actionsPassed,
          actionsFailed: journeyResult.actionsFailed,
          observationsCount: (journeyResult.observations || []).length,
        });
      }

      // 4. Update Hypotheses Outcomes based on Execution Evidence
      for (const [hypId, hyp] of state.hypotheses.entries()) {
        if (hyp.iterationTested === iteration && hyp.status === 'TESTING') {
          // Check if any confirmed issue or step failure matches the hypothesis targetUrl
          const matchingIssues = newIssues.filter((i) => i.pageUrl === hyp.targetUrl);
          const matchingObservations = newObservations.filter((o) => o.pageUrl === hyp.targetUrl && (o.severity === 'error' || o.type === 'CLICK_NO_OP'));

          if (matchingIssues.length > 0 || matchingObservations.length > 0 || anyStepFailed) {
            hyp.status = 'CONFIRMED';
            hyp.outcomeReason = `Confirmed by ${matchingIssues.length} issue(s) / observations during test execution.`;
          } else if (journeyResult.status === 'PASSED') {
            hyp.status = 'DISPROVEN';
            hyp.outcomeReason = `Target route and controls passed deterministic assertions cleanly.`;
          } else {
            hyp.status = 'INCONCLUSIVE';
            hyp.outcomeReason = `Execution completed partially without conclusive verification.`;
          }
        }
      }
    }

    // 5. Append New Observations & Issues
    for (const obs of newObservations) {
      state.recentObservations.push({
        type: obs.type,
        message: obs.message,
        severity: obs.severity,
        pageUrl: obs.pageUrl,
        selector: obs.selector,
        timestamp: obs.timestamp,
      });
    }

    for (const iss of newIssues) {
      if (iss.confidence === 'CONFIRMED') {
        state.confirmedIssues.push(iss);
      } else {
        state.suspectedIssues.push(iss);
      }
    }

    // 6. Recalculate Uncovered Areas, High Risk Areas, and Coverage
    state.uncoveredAreas = this.computeUncoveredAreas(state, appMap);
    state.highRiskAreas = this.computeHighRiskAreas(state, appMap, [], newObservations);
    state.coverageSummary = this.computeCoverage(state, appMap);

    return state;
  }

  /**
   * Generates a compact, token-efficient state summary for AI Context injection.
   */
  static generateCompactStateSummary(state: AIQAState): AIQAStateSummary {
    const uncoveredTargets: AIQAStateSummary['uncoveredHighValueTargets'] = [];

    // Prioritize top unvisited pages
    for (const page of state.uncoveredAreas.unvisitedPages.slice(0, 3)) {
      uncoveredTargets.push({
        type: 'PAGE',
        pageUrl: page.url,
        description: `Unvisited page: ${page.title} (${page.interactiveElementsCount} elements, ${page.formsCount} forms)`,
        priority: 'high',
      });
    }

    // Prioritize top unexercised forms
    for (const form of state.uncoveredAreas.unexercisedForms.slice(0, 2)) {
      uncoveredTargets.push({
        type: 'FORM',
        pageUrl: form.pageUrl,
        description: `Unexercised form on ${form.pageUrl} with fields: [${form.fields.join(', ')}]`,
        priority: 'high',
      });
    }

    // Prioritize top unexercised primary buttons
    for (const btn of state.uncoveredAreas.unexercisedButtons.slice(0, 3)) {
      uncoveredTargets.push({
        type: 'BUTTON',
        pageUrl: btn.pageUrl,
        description: `Unexercised primary button: ${btn.text || btn.selector}`,
        priority: 'medium',
        targetSelector: btn.selector,
      });
    }

    // Active hypotheses
    const activeHypotheses = Array.from(state.hypotheses.values())
      .slice(-4)
      .map((h) => ({
        id: h.id,
        description: h.description,
        targetUrl: h.targetUrl,
        priority: h.priority,
        status: h.status,
      }));

    // Recent failures
    const recentFailures: AIQAStateSummary['recentFailures'] = [];
    for (const fj of state.failedJourneys.slice(-2)) {
      recentFailures.push({
        iteration: state.iteration,
        pageUrl: fj.name,
        actionDescription: `Journey ${fj.name} failed with ${fj.actionsFailed} failed actions`,
        error: `Actions failed: ${fj.actionsFailed}`,
      });
    }

    return {
      iteration: state.iteration,
      coverage: state.coverageSummary,
      uncoveredHighValueTargets: uncoveredTargets,
      highRiskAreas: state.highRiskAreas.slice(0, 4),
      activeHypotheses,
      recentFailures,
      recentObservationsCount: state.recentObservations.length,
      remainingBudget: {
        remainingIterations: state.remainingBudget.remainingIterations,
        remainingActions: Math.max(0, state.remainingBudget.maxTotalActions - state.remainingBudget.actionsExecuted),
        remainingCalls: Math.max(0, state.remainingBudget.maxCalls - state.remainingBudget.callsMade),
      },
    };
  }

  /**
   * Determines whether the adaptive loop should terminate early.
   */
  static evaluateTerminationCondition(
    state: AIQAState,
    plan: AIQAPlan | undefined,
    validationResult: AIQAValidationResult | undefined
  ): { terminate: boolean; reason?: AIQAStopReason; message?: string } {
    // 1. Explicit model stop condition
    if (plan && plan.stopConditions && plan.stopConditions.length > 0) {
      const stopCond = plan.stopConditions[0];
      const reason: AIQAStopReason =
        stopCond.type === 'NO_USEFUL_ACTIONS' || stopCond.type === 'GOAL_ACHIEVED'
          ? 'GOAL_ACHIEVED'
          : stopCond.type === 'BUDGET_LIMIT'
          ? 'BUDGET_EXHAUSTED'
          : 'NO_UNTESTED_HIGH_VALUE_PATHS';

      return {
        terminate: true,
        reason,
        message: stopCond.reason || 'AI QA goal achieved across discovered routes.',
      };
    }

    // 2. All actions rejected by Safety Validator
    if (validationResult && validationResult.rejectedActions.length > 0 && validationResult.approvedActions.length === 0) {
      return {
        terminate: true,
        reason: 'ALL_ACTIONS_REJECTED',
        message: 'All proposed actions violated safety policy and were rejected.',
      };
    }

    // 3. No uncovered high value targets remain
    if (
      state.uncoveredAreas.unvisitedPages.length === 0 &&
      state.uncoveredAreas.unexercisedForms.length === 0 &&
      state.uncoveredAreas.unexercisedButtons.length === 0 &&
      state.iteration >= 2
    ) {
      return {
        terminate: true,
        reason: 'NO_UNTESTED_HIGH_VALUE_PATHS',
        message: 'All discovered routes, forms, and interactive controls have been systematically tested.',
      };
    }

    // 4. Critical blocker found (e.g. fatal 500 error or crash on root URL)
    const criticalBugs = state.confirmedIssues.filter(
      (i) => i.type === 'PAGE_LOAD_FAILURE' || i.type === 'RUNTIME_EXCEPTION' || i.type === 'HTTP_ERROR'
    );
    if (criticalBugs.length >= 3) {
      return {
        terminate: true,
        reason: 'CRITICAL_BUG_FOUND',
        message: `Terminating early due to ${criticalBugs.length} critical functional defects detected.`,
      };
    }

    return { terminate: false };
  }
}
