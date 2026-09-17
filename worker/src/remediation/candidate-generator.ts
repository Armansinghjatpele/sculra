// ==============================================================================
// Sculra Deterministic Candidate Generator (worker/src/remediation/candidate-generator.ts)
// ==============================================================================

import {
  FailureObservation,
  ChangeContext,
  HistoricalContext,
  CodeContext,
  RootCauseHypothesis,
  HypothesisCategory,
  RootCauseEvidence,
} from './types';

export class RemediationCandidateGenerator {
  /**
   * Generates grounded, deterministic root-cause candidate hypotheses based on empirical evidence patterns.
   * Every candidate must have concrete supporting evidence.
   */
  static generateCandidates(
    observation: FailureObservation,
    evidenceList: RootCauseEvidence[],
    codeContext: CodeContext,
    changeContext: ChangeContext,
    historyContext: HistoricalContext
  ): RootCauseHypothesis[] {
    const candidates: RootCauseHypothesis[] = [];
    let counter = 1;

    const findEvId = (pred: (e: RootCauseEvidence) => boolean): string | undefined => {
      const found = evidenceList.find(pred);
      return found?.id;
    };

    const primaryEvId = findEvId((e) => e.id === 'ev-failure-primary') || 'ev-failure-primary';
    const stackEvId = findEvId((e) => e.provenance === 'RUNTIME_ERROR_STACK');
    const netEvId = findEvId((e) => e.provenance === 'NETWORK_EVIDENCE');

    const err = (observation.errorMessage || '').toLowerCase();
    const consoleMsg = (observation.consoleError || '').toLowerCase();
    const netErr = (observation.networkError || '').toLowerCase();
    const bugType = (observation.bugType || (observation as any).type || '').toUpperCase();

    // 1. Pattern: HTTP 500 / Runtime error with matching recently changed file/handler
    if (
      (observation.statusCode && observation.statusCode >= 500) ||
      bugType === 'RUNTIME_EXCEPTION' ||
      bugType === 'API_HTTP_5XX' ||
      bugType === 'HTTP_ERROR'
    ) {
      if (changeContext.hasRelevantCodeChange) {
        const matchingChanges = changeContext.relevantChanges.filter(
          (c) => c.relationship === 'DIRECT_CHANGE'
        );
        const changedFiles = matchingChanges.map((c) => c.file);

        candidates.push({
          id: `cand-${counter++}`,
          category: 'RECENT_CODE_CHANGE',
          statement: `Runtime failure occurred in endpoint or handler matching recent code changes in ${changedFiles.join(', ') || 'modified source'}.`,
          status: 'CANDIDATE',
          confidence: 'HIGH',
          supportingEvidenceIds: [primaryEvId, ...(stackEvId ? [stackEvId] : []), ...(netEvId ? [netEvId] : [])],
          contradictingEvidenceIds: [],
          filePaths: changedFiles,
          symbols: matchingChanges.flatMap((c) => c.affectedSymbols || []),
          sourceReferences: ['DIRECT_QA_EVIDENCE', 'CHANGED_CODE', ...(stackEvId ? ['RUNTIME_ERROR_STACK' as const] : [])],
          affectedTarget: observation.apiEndpoint || observation.url,
        });
      }
    }

    // 2. Pattern: Recurring failure with no code change
    if (historyContext.isRecurring && !changeContext.hasRelevantCodeChange) {
      candidates.push({
        id: `cand-${counter++}`,
        category: 'REGRESSION',
        statement: `Failure recurred across multiple test runs (${historyContext.totalOccurrences} total occurrences) with no direct recent code modifications.`,
        status: 'CANDIDATE',
        confidence: 'MEDIUM',
        supportingEvidenceIds: [primaryEvId],
        contradictingEvidenceIds: [],
        filePaths: [],
        symbols: [],
        sourceReferences: ['DIRECT_QA_EVIDENCE', 'HISTORICAL_QA_EVIDENCE'],
        affectedTarget: observation.url,
      });
    }

    // 3. Pattern: Element Missing or Timeout
    if (
      bugType === 'CLICK_TIMEOUT' ||
      bugType === 'ELEMENT_NOT_INTERACTABLE' ||
      err.includes('waiting for selector') ||
      err.includes('not found') ||
      err.includes('no element matches')
    ) {
      const isOccluded = err.includes('intercepts pointer') || err.includes('obscuring');
      const category: HypothesisCategory = isOccluded ? 'DOM' : 'DOM';

      candidates.push({
        id: `cand-${counter++}`,
        category,
        statement: isOccluded
          ? `Target element ${observation.selector || ''} was occluded by an overlapping overlay or DOM node during interaction.`
          : `Target element ${observation.selector || ''} was absent from the DOM or failed to become interactable within the timeout window.`,
        status: 'CANDIDATE',
        confidence: 'HIGH',
        supportingEvidenceIds: [primaryEvId],
        contradictingEvidenceIds: [],
        filePaths: codeContext.files.map((f) => f.path),
        symbols: [],
        sourceReferences: ['DIRECT_QA_EVIDENCE', 'DOM_BEHAVIOR'],
        affectedTarget: observation.selector || observation.url,
      });
    }

    // 4. Pattern: Form submission blocked by client-side validation
    if (
      bugType === 'FORM_SUBMISSION_FAILURE' ||
      bugType === 'FORM_VALIDATION_FAILURE' ||
      err.includes('validation') ||
      err.includes('required')
    ) {
      candidates.push({
        id: `cand-${counter++}`,
        category: 'VALIDATION_LOGIC',
        statement: 'Form submission was prevented by client-side input validation or missing required input fields.',
        status: 'CANDIDATE',
        confidence: 'HIGH',
        supportingEvidenceIds: [primaryEvId],
        contradictingEvidenceIds: [],
        filePaths: codeContext.files.map((f) => f.path),
        symbols: [],
        sourceReferences: ['DIRECT_QA_EVIDENCE', 'DOM_BEHAVIOR'],
        affectedTarget: observation.url,
      });
    }

    // 5. Pattern: Network CORS configuration error
    if (
      netErr.includes('cors') ||
      consoleMsg.includes('cors') ||
      err.includes('cors') ||
      consoleMsg.includes('access-control-allow-origin')
    ) {
      candidates.push({
        id: `cand-${counter++}`,
        category: 'CONFIGURATION',
        statement: 'Network request was blocked by browser Cross-Origin Resource Sharing (CORS) policy or missing Access-Control headers.',
        status: 'CANDIDATE',
        confidence: 'VERY_HIGH',
        supportingEvidenceIds: [primaryEvId, ...(netEvId ? [netEvId] : [])],
        contradictingEvidenceIds: [],
        filePaths: [],
        symbols: [],
        sourceReferences: ['DIRECT_QA_EVIDENCE', 'NETWORK_EVIDENCE'],
        affectedTarget: observation.apiEndpoint || observation.url,
      });
    }

    // 6. Pattern: Authentication / Authorization failure
    if (
      observation.statusCode === 401 ||
      observation.statusCode === 403 ||
      bugType.includes('AUTHENTICATION') ||
      bugType.includes('AUTHORIZATION')
    ) {
      const isAuthN = observation.statusCode === 401 || bugType.includes('AUTHENTICATION');
      candidates.push({
        id: `cand-${counter++}`,
        category: isAuthN ? 'AUTHENTICATION' : 'AUTHORIZATION',
        statement: isAuthN
          ? 'Endpoint rejected request due to missing, expired, or invalid session authentication credentials (HTTP 401).'
          : 'Endpoint rejected request due to insufficient role permissions or authorization policy denial (HTTP 403).',
        status: 'CANDIDATE',
        confidence: 'HIGH',
        supportingEvidenceIds: [primaryEvId, ...(netEvId ? [netEvId] : [])],
        contradictingEvidenceIds: [],
        filePaths: codeContext.files.map((f) => f.path),
        symbols: [],
        sourceReferences: ['DIRECT_QA_EVIDENCE', 'NETWORK_EVIDENCE'],
        affectedTarget: observation.apiEndpoint || observation.url,
      });
    }

    // 7. Generic fallback candidate if nothing specific matched
    if (candidates.length === 0) {
      candidates.push({
        id: `cand-${counter++}`,
        category: 'RUNTIME_EXCEPTION',
        statement: `Observed failure (${observation.bugType}) during execution of ${observation.url}.`,
        status: 'CANDIDATE',
        confidence: 'LOW',
        supportingEvidenceIds: [primaryEvId],
        contradictingEvidenceIds: [],
        filePaths: codeContext.files.map((f) => f.path),
        symbols: [],
        sourceReferences: ['DIRECT_QA_EVIDENCE'],
        affectedTarget: observation.url,
      });
    }

    return candidates;
  }
}
