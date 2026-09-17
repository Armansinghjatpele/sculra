// ==============================================================================
// Sculra Verification Planner (worker/src/remediation/verification-plan.ts)
// ==============================================================================

import { VerificationPlan, RootCauseHypothesis, FailureObservation } from './types';
import { CampaignDomain } from '../campaign/types';

export class VerificationPlanner {
  /**
   * Generates a verification plan recommending QA domains, referencing existing targets,
   * and providing deterministic regression test suggestions.
   */
  static generateVerificationPlan(
    hypothesis: RootCauseHypothesis | undefined,
    observation: FailureObservation
  ): VerificationPlan {
    const domains = new Set<CampaignDomain>();
    const regressionTests: string[] = [];

    const cat = hypothesis?.category || 'UNKNOWN';
    const isApi = !!observation.apiEndpoint || observation.bugType.includes('API') || (observation.statusCode && observation.statusCode >= 400);

    // 1. Map category / failure to QA domains
    if (isApi) {
      domains.add('API');
      domains.add('FUNCTIONAL');
    }

    if (cat === 'AUTHENTICATION' || cat === 'AUTHORIZATION' || observation.bugType.includes('AUTHENTICATION') || observation.bugType.includes('AUTHORIZATION')) {
      domains.add('SECURITY');
      domains.add('FUNCTIONAL');
    }

    if (cat === 'DOM' || cat === 'UI_STATE' || observation.bugType.includes('CLICK') || observation.bugType.includes('FORM')) {
      domains.add('FUNCTIONAL');
      domains.add('VISUAL');
    }

    if (cat === 'ACCESSIBILITY' || observation.bugType.includes('ACCESSIBILITY')) {
      domains.add('ACCESSIBILITY');
      domains.add('FUNCTIONAL');
    }

    if (cat === 'PERFORMANCE' || observation.bugType.includes('PERFORMANCE') || observation.bugType.includes('TIMEOUT')) {
      domains.add('PERFORMANCE');
    }

    if (domains.size === 0) {
      domains.add('FUNCTIONAL');
    }

    // Always include HISTORICAL to verify regression resolution
    domains.add('HISTORICAL');

    // 2. Existing targets
    const existingTargets: string[] = [];
    if (observation.url) existingTargets.push(observation.url);
    if (observation.apiEndpoint && observation.apiEndpoint !== observation.url) {
      existingTargets.push(observation.apiEndpoint);
    }

    // 3. Deterministic regression test suggestions
    if (isApi) {
      regressionTests.push(`Repeat ${observation.httpMethod || 'POST'} ${observation.apiEndpoint || observation.url} with valid payload fixture.`);
      regressionTests.push(`Verify ${observation.httpMethod || 'POST'} ${observation.apiEndpoint || observation.url} returns expected error handling for malformed input.`);
    } else {
      regressionTests.push(`Execute user journey targeting ${observation.url} to verify normal state transition.`);
      if (observation.selector) {
        regressionTests.push(`Verify element ${observation.selector} is visible, interactable, and responsive to user action.`);
      }
    }

    return {
      suggestedDomains: Array.from(domains),
      existingTargets,
      regressionTests,
    };
  }
}
