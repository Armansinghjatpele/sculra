// ==============================================================================
// Sculra Business Criticality Evaluator (worker/src/product/criticality.ts)
// ==============================================================================

import { CriticalityAssessment, CriticalityLevel, SemanticPageClassification, ProductWorkflow } from './types';
import { DiscoveredPage } from '../types';
import { BugObservation } from '../issues/types';

export class BusinessCriticalityEvaluator {
  /**
   * Deterministically evaluates the business criticality of a page, feature, or workflow.
   */
  public static evaluatePageCriticality(options: {
    page: DiscoveredPage;
    classification?: SemanticPageClassification;
    workflows?: ProductWorkflow[];
    bugObservations?: BugObservation[];
  }): CriticalityAssessment {
    const { page, classification, workflows = [], bugObservations = [] } = options;
    const reasons: string[] = [];
    const evidence: string[] = [];
    let score = 30; // Base baseline score

    const pathname = (() => {
      try {
        return new URL(page.url).pathname.toLowerCase();
      } catch {
        return page.url.toLowerCase();
      }
    })();

    // 1. Semantic Category & Route Signal
    const cat = classification?.category || 'UNKNOWN';
    if (cat === 'PAYMENT' || cat === 'CHECKOUT' || /pay|checkout|billing|subscription/i.test(pathname)) {
      score += 45;
      reasons.push('Direct revenue, checkout, or subscription billing boundary (+45 pts).');
      evidence.push(`Checkout/Billing keyword on ${page.url}`);
    } else if (cat === 'AUTH' || cat === 'LOGIN' || cat === 'SIGN_UP' || /auth|login|sign[-_]?up/i.test(pathname)) {
      score += 35;
      reasons.push('Authentication gateway required for member access (+35 pts).');
      evidence.push(`Authentication route detected: ${page.url}`);
    } else if (cat === 'CREATE' || cat === 'EDIT' || /create|new|edit/i.test(pathname)) {
      score += 30;
      reasons.push('Core resource mutation & creation workflow (+30 pts).');
      evidence.push(`Resource creation/edit route: ${page.url}`);
    } else if (cat === 'DASHBOARD' || cat === 'ANALYTICS' || /dashboard|analytics/i.test(pathname)) {
      score += 25;
      reasons.push('Primary workspace dashboard or operational metrics view (+25 pts).');
      evidence.push(`Dashboard view: ${page.url}`);
    } else if (cat === 'ADMIN' || /admin|manage[-_]?users/i.test(pathname)) {
      score += 25;
      reasons.push('Organization permissions and administrative control (+25 pts).');
      evidence.push(`Admin route: ${page.url}`);
    } else if (cat === 'LANDING') {
      score += 20;
      reasons.push('Public marketing entry point and primary user acquisition front (+20 pts).');
      evidence.push(`Landing entry: ${page.url}`);
    }

    // 2. Interactive Form Presence
    if ((page.forms || []).length > 0) {
      const fieldCount = page.forms.reduce((sum, f) => sum + (f.fields || []).length, 0);
      if (fieldCount >= 3) {
        score += 15;
        reasons.push(`Contains multi-field interactive form with ${fieldCount} fields (+15 pts).`);
        evidence.push(`Form with ${fieldCount} fields on ${page.url}`);
      }
    }

    // 3. Workflow Prominence & Centrality
    const referencingWorkflows = workflows.filter((w) =>
      w.steps.some((s) => s.pageUrl.replace(/\/$/, '') === page.url.replace(/\/$/, ''))
    );
    if (referencingWorkflows.length >= 3) {
      score += 20;
      reasons.push(`Central nexus utilized by ${referencingWorkflows.length} distinct product workflows (+20 pts).`);
      evidence.push(`Workflows: ${referencingWorkflows.map((w) => w.name).join(', ')}`);
    } else if (referencingWorkflows.length >= 1) {
      score += 10;
      reasons.push(`Active component in ${referencingWorkflows.length} user workflow (+10 pts).`);
    }

    // 4. Failure & Issue Signals
    const relatedBugs = bugObservations.filter(
      (b) => b.url && b.url.replace(/\/$/, '') === page.url.replace(/\/$/, '')
    );
    if (relatedBugs.some((b) => b.severity === 'critical' || b.severity === 'high')) {
      score += 15;
      reasons.push(`Observed high/critical defects on this route (+15 pts).`);
      evidence.push(`${relatedBugs.length} bug observations on route`);
    }

    // Clamp score
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    const level = this.scoreToLevel(finalScore);

    return {
      score: finalScore,
      level,
      reasons,
      evidence,
      confidence: 0.9,
    };
  }

  /**
   * Helper to convert a numeric score to a strongly typed CriticalityLevel.
   */
  public static scoreToLevel(score: number): CriticalityLevel {
    if (score >= 90) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 45) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'UNKNOWN';
  }
}
