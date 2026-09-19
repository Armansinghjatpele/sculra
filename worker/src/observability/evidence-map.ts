// ==============================================================================
// Sculra Unified Evidence Graph Builder (worker/src/observability/evidence-map.ts)
// ==============================================================================

import { EvidenceGraph, EvidenceNode, EvidenceEdge, EvidenceNodeType } from './types';

export class EvidenceMapBuilder {
  /**
   * Constructs the factual evidence chain linking execution entities.
   * Missing links are truthfully represented with exists = false.
   */
  public static buildGraph(params: {
    campaignId?: string | null;
    targetId?: string | null;
    testRunId?: string | null;
    observationId?: string | null;
    issueId?: string | null;
    historicalComparisonId?: string | null;
    rootCauseId?: string | null;
    fixPlanId?: string | null;
    patchId?: string | null;
    verificationId?: string | null;
    prNumber?: number | null;
    approvalId?: string | null;
  }): EvidenceGraph {
    const nodes: EvidenceNode[] = [];
    const edges: EvidenceEdge[] = [];
    let missingCount = 0;

    const chain: Array<{
      type: EvidenceNodeType;
      title: string;
      value?: string | number | null;
      status: string;
    }> = [
      { type: 'CAMPAIGN', title: 'QA Campaign', value: params.campaignId, status: params.campaignId ? 'RECORDED' : 'MISSING' },
      { type: 'TARGET', title: 'Discovered Target', value: params.targetId, status: params.targetId ? 'RECORDED' : 'MISSING' },
      { type: 'TEST', title: 'Executed Test', value: params.testRunId, status: params.testRunId ? 'RECORDED' : 'MISSING' },
      { type: 'OBSERVATION', title: 'Empirical Evidence', value: params.observationId, status: params.observationId ? 'RECORDED' : 'MISSING' },
      { type: 'ISSUE', title: 'Diagnosed Issue', value: params.issueId, status: params.issueId ? 'RECORDED' : 'MISSING' },
      { type: 'HISTORICAL_COMPARISON', title: 'Historical Memory', value: params.historicalComparisonId, status: params.historicalComparisonId ? 'RECORDED' : 'MISSING' },
      { type: 'ROOT_CAUSE', title: 'Root Cause Hypothesis', value: params.rootCauseId, status: params.rootCauseId ? 'RECORDED' : 'MISSING' },
      { type: 'FIX_PLAN', title: 'Grounded Fix Plan', value: params.fixPlanId, status: params.fixPlanId ? 'RECORDED' : 'MISSING' },
      { type: 'PATCH', title: 'Structured Patch', value: params.patchId, status: params.patchId ? 'RECORDED' : 'MISSING' },
      { type: 'VERIFICATION', title: 'Targeted Verification', value: params.verificationId, status: params.verificationId ? 'RECORDED' : 'MISSING' },
      { type: 'PR', title: 'GitHub Pull Request', value: params.prNumber ? `#${params.prNumber}` : null, status: params.prNumber ? 'OPENED' : 'MISSING' },
      { type: 'APPROVAL', title: 'Human Approval Gate', value: params.approvalId, status: params.approvalId ? 'RECORDED' : 'MISSING' },
    ];

    let previousNodeId: string | null = null;

    for (const item of chain) {
      const exists = Boolean(item.value);
      if (!exists) missingCount++;

      const nodeId = `node-${item.type.toLowerCase()}`;
      nodes.push({
        id: nodeId,
        type: item.type,
        title: item.title,
        status: item.status,
        exists,
        entityId: item.value ? String(item.value) : null,
      });

      if (previousNodeId) {
        edges.push({
          fromNodeId: previousNodeId,
          toNodeId: nodeId,
          relationship: exists ? 'SUPPORTS' : 'UNESTABLISHED',
        });
      }

      previousNodeId = nodeId;
    }

    return {
      nodes,
      edges,
      missingCount,
    };
  }
}
