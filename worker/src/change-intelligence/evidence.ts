// ==============================================================================
// Sculra Change Intelligence Evidence Formatter & Persister
// (worker/src/change-intelligence/evidence.ts)
// ==============================================================================

import { ChangeAnalysisResult } from './types';
import { TestEvidencePayload } from '../campaign/evidence';

export class ChangeEvidenceFormatter {
  /**
   * Formats a ChangeAnalysisResult into structured TestEvidencePayloads for persistence.
   */
  static formatEvidence(
    projectId: string,
    result: ChangeAnalysisResult,
    testRunId?: string
  ): TestEvidencePayload[] {
    const evidenceRecords: TestEvidencePayload[] = [];
    const campaignId = result.campaignId;

    // 1. Change Summary Evidence
    evidenceRecords.push({
      test_run_id: testRunId,
      project_id: projectId,
      type: 'DISCOVERY_SNAPSHOT',
      title: `Code Change Intelligence: ${result.commitSha.slice(0, 7)} (${result.status})`,
      message: `Change Risk: ${result.risk.score}/100 (${result.risk.level}). ${result.changeSet.files.length} files touched (+${result.changeSet.totalAdditions}/-${result.changeSet.totalDeletions}).`,
      metadata: {
        campaignId,
        evidenceType: 'CHANGE_SUMMARY',
        commitSha: result.commitSha,
        baseSha: result.baseSha,
        riskScore: result.risk.score,
        riskLevel: result.risk.level,
        status: result.status,
        filesCount: result.changeSet.files.length,
        classifications: result.classifications,
        sizeCategory: result.changeSet.sizeCategory,
      },
    });

    // 2. Impact Graph Evidence
    evidenceRecords.push({
      test_run_id: testRunId,
      project_id: projectId,
      type: 'DISCOVERY_SNAPSHOT',
      title: `Impact Graph: ${result.impactGraph.nodeCount} nodes, ${result.impactGraph.edgeCount} edges`,
      message: `Identified ${result.affectedWorkflows.length} affected workflow(s) and ${result.affectedApis.length} affected API endpoint(s).`,
      metadata: {
        campaignId,
        evidenceType: 'IMPACT_GRAPH',
        affectedWorkflows: result.affectedWorkflows,
        affectedApis: result.affectedApis,
        affectedRoutes: result.affectedRoutes,
        recommendedDomains: result.recommendedDomains,
        isTruncated: result.impactGraph.isTruncated,
      },
    });

    return evidenceRecords;
  }
}
