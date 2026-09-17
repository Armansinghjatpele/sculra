// ==============================================================================
// Sculra Change Context Correlator (worker/src/remediation/change-context.ts)
// ==============================================================================

import { ChangeContext, RelevantChange, FailureObservation, ChangeRelationship } from './types';
import { RouteMapper } from './route-mapper';

export class ChangeContextCorrelator {
  /**
   * Correlates an observed QA failure with Prompt 32 Code Change Intelligence data.
   */
  static correlate(
    observation: FailureObservation,
    changeAnalysis?: any
  ): ChangeContext {
    if (!changeAnalysis) {
      return {
        hasRelevantCodeChange: false,
        relevantChanges: [],
      };
    }

    const commitSha = changeAnalysis.commit_sha || changeAnalysis.commitSha;
    const baseSha = changeAnalysis.base_sha || changeAnalysis.baseSha;
    const pullRequestNumber = changeAnalysis.pull_request_number || changeAnalysis.pullRequestNumber;
    const branch = changeAnalysis.branch;
    const riskScore = changeAnalysis.risk_score || changeAnalysis.riskScore;
    const riskLevel = changeAnalysis.risk_level || changeAnalysis.riskLevel;

    const rawChanges: any[] =
      changeAnalysis.files ||
      changeAnalysis.summary?.files ||
      changeAnalysis.impact_graph?.nodes ||
      [];

    const failureUrl = observation.url || '';
    const failureRoute = observation.route || '';
    const failureEndpoint = observation.apiEndpoint || '';
    const failureError = (observation.errorMessage || '').toLowerCase();

    const relevantChanges: RelevantChange[] = [];
    let hasRelevantCodeChange = false;

    for (const raw of rawChanges) {
      const filePath = (raw.filePath || raw.filename || raw.id || '').replace(/\\/g, '/');
      if (!filePath) continue;

      let relationship: ChangeRelationship = 'NO_KNOWN_CHANGE_RELATIONSHIP';

      // 1. Direct Route / API match
      const mappedRoute = RouteMapper.fileToRoute(filePath);
      if (mappedRoute) {
        if (
          (failureEndpoint && RouteMapper.matchesRoute(failureEndpoint, mappedRoute.routePath)) ||
          (failureRoute && RouteMapper.matchesRoute(failureRoute, mappedRoute.routePath)) ||
          (failureUrl && RouteMapper.matchesRoute(failureUrl, mappedRoute.routePath))
        ) {
          relationship = 'DIRECT_CHANGE';
        }
      }

      // 2. Stack trace file match
      if (
        observation.stackTrace &&
        observation.stackTrace.toLowerCase().includes(filePath.toLowerCase())
      ) {
        relationship = 'DIRECT_CHANGE';
      }

      // 3. Mentioned in error message
      if (failureError && failureError.includes(filePath.toLowerCase())) {
        relationship = 'DIRECT_CHANGE';
      }

      // 4. Transitive change via impact graph
      if (relationship === 'NO_KNOWN_CHANGE_RELATIONSHIP' && raw.transitiveDependents?.length) {
        relationship = 'TRANSITIVE_CHANGE';
      }

      if (relationship === 'DIRECT_CHANGE' || relationship === 'TRANSITIVE_CHANGE') {
        hasRelevantCodeChange = true;
      }

      relevantChanges.push({
        file: filePath,
        changeType: (raw.status || raw.changeType || 'MODIFIED').toUpperCase() as any,
        commitSha: commitSha || 'unknown',
        diffSnippet: raw.patch ? raw.patch.slice(0, 1000) : undefined,
        additions: raw.additions || 0,
        deletions: raw.deletions || 0,
        relationship,
        affectedSymbols: raw.symbols || [],
        affectedRoutes: mappedRoute ? [mappedRoute.routePath] : [],
      });
    }

    return {
      commitSha,
      baseSha,
      pullRequestNumber,
      branch,
      relevantChanges,
      riskScore,
      riskLevel,
      hasRelevantCodeChange,
    };
  }
}
