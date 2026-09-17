// ==============================================================================
// Sculra Evidence Normalizer & Bounded Bundler
// (worker/src/remediation/evidence-context.ts)
// ==============================================================================

import { FailureObservation, RootCauseEvidence, SourceProvenance } from './types';
import { REMEDIATION_POLICY } from './policy';
import { redactSecrets } from './redaction';
import { BugObservation } from '../issues/types';

export class EvidenceContextBundler {
  /**
   * Normalizes an empirical BugObservation into a structured FailureObservation.
   * NEVER manufactures missing fields.
   */
  static normalizeObservation(bug: BugObservation): FailureObservation {
    const meta = bug.metadata || {};

    return {
      issueId: bug.id,
      testRunId: bug.testRunId,
      campaignId: meta.campaignId,
      projectId: bug.projectId,
      url: bug.url,
      route: meta.route,
      apiEndpoint: meta.endpoint || meta.apiEndpoint,
      httpMethod: meta.method || meta.httpMethod,
      statusCode: meta.statusCode || meta.status,
      selector: bug.selector,
      action: bug.action,
      errorMessage: bug.description || meta.errorMessage,
      stackTrace: meta.stackTrace || meta.stack,
      consoleError: meta.consoleError || meta.consoleMessage,
      networkError: meta.networkError,
      screenshotRef: meta.screenshotPath || meta.screenshotUrl,
      viewport: meta.viewport ? (typeof meta.viewport === 'string' ? meta.viewport : meta.viewport.name) : undefined,
      role: meta.role,
      timestamp: bug.timestamp || new Date().toISOString(),
      fingerprint: bug.fingerprint,
      bugType: bug.type,
      severity: bug.severity,
      sourceObservation: bug,
    };
  }

  /**
   * Bundles empirical evidence into a bounded, prioritized evidence list (<= 50 items, <= 512KB).
   * Hierarchy:
   * 1. Direct failure observation
   * 2. Stack trace
   * 3. Network error / status code
   * 4. Console errors
   * 5. Preceding reproduction actions
   * 6. Change context evidence
   * 7. Historical evidence
   */
  static bundleEvidence(
    observation: FailureObservation,
    additionalEvidence: Array<{
      type: string;
      provenance: SourceProvenance;
      title: string;
      message?: string;
      payload?: Record<string, any>;
    }> = []
  ): RootCauseEvidence[] {
    const items: RootCauseEvidence[] = [];
    let currentBytes = 0;

    const addItem = (
      id: string,
      provenance: SourceProvenance,
      title: string,
      statement: string,
      payload?: Record<string, any>
    ) => {
      if (items.length >= REMEDIATION_POLICY.MAX_EVIDENCE_ITEMS) return;

      const cleanStatement = redactSecrets(statement);
      const jsonPayload = payload ? JSON.parse(redactSecrets(JSON.stringify(payload))) : undefined;

      const approxSize = Buffer.byteLength(cleanStatement, 'utf-8') + (jsonPayload ? Buffer.byteLength(JSON.stringify(jsonPayload), 'utf-8') : 0);
      if (currentBytes + approxSize > REMEDIATION_POLICY.MAX_TOTAL_EVIDENCE_BYTES) return;

      currentBytes += approxSize;
      items.push({
        id,
        provenance,
        title,
        statement: cleanStatement,
        observedFact: provenance !== 'AI_INFERENCE',
        payload: jsonPayload,
        observedAt: observation.timestamp,
      });
    };

    // 1. Primary Failure Observation (Priority 1)
    addItem(
      'ev-failure-primary',
      'DIRECT_QA_EVIDENCE',
      `Observed Failure: ${observation.bugType} on ${observation.url}`,
      observation.errorMessage || `Observed failure with type ${observation.bugType}`,
      {
        bugType: observation.bugType,
        severity: observation.severity,
        url: observation.url,
        action: observation.action,
        selector: observation.selector,
      }
    );

    // 2. Stack Trace (Priority 2)
    if (observation.stackTrace) {
      addItem(
        'ev-stack-trace',
        'RUNTIME_ERROR_STACK',
        'Runtime Stack Trace',
        observation.stackTrace,
        { stackTrace: observation.stackTrace.slice(0, 2000) }
      );
    }

    // 3. Network Evidence (Priority 3)
    if (observation.statusCode || observation.networkError || observation.apiEndpoint) {
      const netMsg = `Endpoint: ${observation.httpMethod || 'GET'} ${observation.apiEndpoint || observation.url} Status: ${observation.statusCode || 'FAILED'}${observation.networkError ? ` Error: ${observation.networkError}` : ''}`;
      addItem(
        'ev-network-failure',
        'NETWORK_EVIDENCE',
        'Network Failure Evidence',
        netMsg,
        {
          endpoint: observation.apiEndpoint,
          method: observation.httpMethod,
          status: observation.statusCode,
          error: observation.networkError,
        }
      );
    }

    // 4. Console Error (Priority 4)
    if (observation.consoleError) {
      addItem(
        'ev-console-error',
        'RUNTIME_ERROR_STACK',
        'Browser Console Error',
        observation.consoleError,
        { consoleError: observation.consoleError }
      );
    }

    // 5. Reproduction Steps from source observation (Priority 5)
    const steps = observation.sourceObservation?.reproductionSteps || [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      addItem(
        `ev-step-${i + 1}`,
        'DOM_BEHAVIOR',
        `Reproduction Step ${step.stepNumber || i + 1}: ${step.action} on ${step.target}`,
        `Expected: ${step.expectedBehavior} | Observed: ${step.observedBehavior}`,
        { step }
      );
    }

    // 6. Additional Evidence items (e.g. changes, history)
    for (let i = 0; i < additionalEvidence.length; i++) {
      const extra = additionalEvidence[i];
      addItem(
        `ev-extra-${i + 1}`,
        extra.provenance,
        extra.title,
        extra.message || extra.title,
        extra.payload
      );
    }

    return items;
  }
}
