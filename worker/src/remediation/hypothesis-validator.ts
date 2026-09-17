// ==============================================================================
// Sculra Hypothesis Validator & Contradiction Filter
// (worker/src/remediation/hypothesis-validator.ts)
// ==============================================================================

import {
  RootCauseHypothesis,
  FailureObservation,
  RootCauseEvidence,
  ChangeContext,
  CodeContext,
  HistoricalContext,
} from './types';

export class HypothesisValidator {
  /**
   * Validates each candidate hypothesis against observed facts and evidence.
   * Immediately rejects hypotheses that are contradicted by the evidence trail.
   */
  static validateHypotheses(
    hypotheses: RootCauseHypothesis[],
    observation: FailureObservation,
    evidenceList: RootCauseEvidence[],
    codeContext: CodeContext,
    changeContext: ChangeContext,
    historyContext: HistoricalContext
  ): RootCauseHypothesis[] {
    const validated: RootCauseHypothesis[] = [];

    const evidenceMap = new Map<string, RootCauseEvidence>();
    for (const ev of evidenceList) {
      evidenceMap.set(ev.id, ev);
    }

    const failureUrl = (observation.url || '').toLowerCase();
    const failureEndpoint = (observation.apiEndpoint || '').toLowerCase();
    const isApiFailure = !!observation.apiEndpoint || (observation.statusCode !== undefined && observation.statusCode >= 400);

    for (const h of hypotheses) {
      const stmtLower = h.statement.toLowerCase();
      let status = h.status;
      let rejectionReason: string | undefined;
      const contradictingIds: string[] = [...h.contradictingEvidenceIds];
      const supportingIds: string[] = [...h.supportingEvidenceIds];

      // 1. Contradiction Check: Hypothesis claims API failure, but failure occurred on client navigation before any network call
      if (
        (h.category === 'API_CONTRACT' || stmtLower.includes('api failure') || stmtLower.includes('endpoint returned')) &&
        !isApiFailure &&
        observation.bugType === 'NAVIGATION_FAILURE'
      ) {
        status = 'REJECTED';
        rejectionReason = 'Contradicted by timeline: navigation failed prior to any API network call.';
        contradictingIds.push('ev-failure-primary');
      }

      // 2. Contradiction Check: Hypothesis claims recent code change, but no relevant files changed in commit
      if (
        h.category === 'RECENT_CODE_CHANGE' &&
        !changeContext.hasRelevantCodeChange &&
        changeContext.relevantChanges.length === 0
      ) {
        status = 'REJECTED';
        rejectionReason = 'Contradicted by change intelligence: no relevant source files were modified in the commit or PR.';
      }

      // 3. Contradiction Check: Hypothesis claims element missing, but error signature indicates element was found and received click
      if (
        stmtLower.includes('element was absent') &&
        observation.bugType === 'CLICK_NO_OP'
      ) {
        status = 'REJECTED';
        rejectionReason = 'Contradicted by DOM interaction trace: element was successfully located and clicked, but triggered no state change.';
        contradictingIds.push('ev-failure-primary');
      }

      // 4. Contradiction Check: Hypothesis references files that do not exist in code context
      if (h.filePaths && h.filePaths.length > 0) {
        const availablePaths = new Set(codeContext.files.map((f) => f.path.toLowerCase()));
        const invalidPaths = h.filePaths.filter((p) => !availablePaths.has(p.toLowerCase()));
        if (invalidPaths.length > 0 && codeContext.files.length > 0 && !codeContext.isPartial) {
          // Filter out hallucinated or non-existent file paths
          h.filePaths = h.filePaths.filter((p) => availablePaths.has(p.toLowerCase()));
          if (h.filePaths.length === 0 && h.category === 'RECENT_CODE_CHANGE') {
            status = 'REJECTED';
            rejectionReason = `Referenced files (${invalidPaths.join(', ')}) do not exist in the repository context.`;
          }
        }
      }

      // 5. Upgrade status if well-supported by evidence
      if (status !== 'REJECTED') {
        const validSupportingCount = supportingIds.filter((id) => evidenceMap.has(id)).length;
        if (validSupportingCount >= 2 || (h.category === 'RECENT_CODE_CHANGE' && changeContext.hasRelevantCodeChange)) {
          status = 'SUPPORTED';
        } else if (validSupportingCount === 1) {
          status = 'WEAKLY_SUPPORTED';
        } else {
          status = 'UNRESOLVED';
        }
      }

      validated.push({
        ...h,
        status,
        rejectionReason,
        supportingEvidenceIds: supportingIds,
        contradictingEvidenceIds: contradictingIds,
      });
    }

    return validated;
  }
}
