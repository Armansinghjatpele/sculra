// ==============================================================================
// Sculra Campaign Evidence & Cross-Domain Correlator (worker/src/campaign/correlation.ts)
// ==============================================================================

import {
  CampaignState,
  CampaignTask,
  CampaignTaskResult,
  CampaignObservation,
  CampaignEvidenceLink,
  CampaignDomain,
} from './types';

export interface CorrelationResult {
  observations: CampaignObservation[];
  evidenceLinks: CampaignEvidenceLink[];
  crossDomainCorrelations: {
    type: string;
    description: string;
    sourceDomain: CampaignDomain;
    correlatedDomain: CampaignDomain;
    targetIdentifier: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }[];
}

export class CampaignEvidenceCorrelator {
  /**
   * Correlates task results, observations, and findings across domains.
   */
  static correlate(state: CampaignState, latestResult?: CampaignTaskResult): CorrelationResult {
    const observations: CampaignObservation[] = [];
    const evidenceLinks: CampaignEvidenceLink[] = [];
    const crossDomainCorrelations: CorrelationResult['crossDomainCorrelations'] = [];

    if (!latestResult) {
      return { observations, evidenceLinks, crossDomainCorrelations };
    }

    const task = state.tasks.get(latestResult.taskId);
    if (!task) return { observations, evidenceLinks, crossDomainCorrelations };

    const targetId = latestResult.target.identifier;
    const now = new Date().toISOString();

    // 1. Process and record Task Result Observations
    if (latestResult.observations && latestResult.observations.length > 0) {
      for (const obs of latestResult.observations) {
        observations.push({
          id: `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: now,
          domain: latestResult.domain,
          taskId: latestResult.taskId,
          targetIdentifier: targetId,
          type: obs.type,
          severity: (obs.severity as any) || 'medium',
          message: obs.description || obs.summary || obs.title,
          metadata: { ...obs },
        });
      }
    }

    // 2. Process Evidence Links
    if (latestResult.evidence && latestResult.evidence.length > 0) {
      for (const ev of latestResult.evidence) {
        evidenceLinks.push({
          evidenceId: ev.id || `ev-${Date.now().toString(36)}`,
          taskId: latestResult.taskId,
          domain: latestResult.domain,
          targetIdentifier: targetId,
          type: ev.type || 'observation',
          title: ev.title || `${latestResult.domain} Evidence on ${targetId}`,
          url: ev.url || task.target.url,
          relatedFindingId: ev.metadata?.findingId,
          relatedIssueFingerprint: ev.metadata?.fingerprint,
        });
      }
    }

    // 3. Deterministic Cross-Domain Correlations

    // A. Functional / Journey Failure + Network / API 500
    if (latestResult.domain === 'FUNCTIONAL' || latestResult.domain === 'JOURNEY') {
      const matchingApi500 = state.networkErrors.find((ne) => ne.status !== undefined && ne.status >= 500);
      if (matchingApi500 && latestResult.status === 'FAILED') {
        crossDomainCorrelations.push({
          type: 'RELATED_BACKEND_FAILURE',
          description: `Functional failure on "${targetId}" is correlated with HTTP ${matchingApi500.status} on endpoint "${matchingApi500.url}".`,
          sourceDomain: latestResult.domain,
          correlatedDomain: 'API',
          targetIdentifier: targetId,
          severity: 'high',
        });
      }

      // Functional Failure + Console Error
      const matchingConsole = state.consoleErrors[0];
      if (matchingConsole && latestResult.status === 'FAILED') {
        crossDomainCorrelations.push({
          type: 'RUNTIME_ERROR_EVIDENCE',
          description: `Functional failure on "${targetId}" is correlated with runtime browser exception: "${matchingConsole.message.slice(0, 100)}".`,
          sourceDomain: latestResult.domain,
          correlatedDomain: 'FUNCTIONAL',
          targetIdentifier: targetId,
          severity: 'medium',
        });
      }
    }

    // B. Security Finding on Business-Critical Workflow
    if (latestResult.domain === 'SECURITY' || latestResult.domain === 'AUTHORIZATION') {
      const isCriticalWorkflow = task.target.businessCriticality === 'CRITICAL' || task.target.businessCriticality === 'HIGH';
      const hasSecurityFindings = latestResult.findings.some((f) => f.severity === 'critical' || f.severity === 'high');
      if (isCriticalWorkflow && hasSecurityFindings) {
        crossDomainCorrelations.push({
          type: 'HIGH_CAMPAIGN_SECURITY_RISK',
          description: `Security vulnerability identified on business-critical workflow "${targetId}", elevating campaign release risk.`,
          sourceDomain: latestResult.domain,
          correlatedDomain: 'PRODUCT',
          targetIdentifier: targetId,
          severity: 'critical',
        });
      }
    }

    // C. Accessibility Blocker on Critical Workflow
    if (latestResult.domain === 'ACCESSIBILITY') {
      const isCriticalWorkflow = task.target.businessCriticality === 'CRITICAL' || task.target.businessCriticality === 'HIGH';
      const hasCriticalA11y = latestResult.findings.some((f) => f.severity === 'critical');
      if (isCriticalWorkflow && hasCriticalA11y) {
        crossDomainCorrelations.push({
          type: 'RELEASE_RELEVANT_A11Y_RISK',
          description: `Critical accessibility barrier on workflow "${targetId}" impacts core user journey accessibility.`,
          sourceDomain: 'ACCESSIBILITY',
          correlatedDomain: 'PRODUCT',
          targetIdentifier: targetId,
          severity: 'high',
        });
      }
    }

    // D. Performance Regression on Tested Target
    if (latestResult.domain === 'PERFORMANCE') {
      const perfReg = latestResult.findings.find((f) => f.type === 'PERFORMANCE_REGRESSION' || f.isRegression);
      if (perfReg) {
        crossDomainCorrelations.push({
          type: 'HISTORICAL_PERFORMANCE_REGRESSION',
          description: `Performance degradation detected on "${targetId}" compared to historical baseline: ${perfReg.details || perfReg.message || ''}`,
          sourceDomain: 'PERFORMANCE',
          correlatedDomain: 'HISTORICAL',
          targetIdentifier: targetId,
          severity: 'high',
        });
      }
    }

    return { observations, evidenceLinks, crossDomainCorrelations };
  }
}
