// ==============================================================================
// Sculra Bounded Impact Graph Builder (worker/src/change-intelligence/graph.ts)
// ==============================================================================

import {
  ImpactGraph,
  ImpactNode,
  ImpactEdge,
  ImpactConfidence,
  ImpactTargetType,
} from './types';
import { MAX_GRAPH_NODES, MAX_GRAPH_EDGES } from './policy';

export class ImpactGraphBuilder {
  private nodes: Record<string, ImpactNode> = {};
  private edges: ImpactEdge[] = [];
  private isTruncated = false;

  public addNode(id: string, type: ImpactTargetType | 'FILE' | 'SYMBOL', name: string, metadata?: Record<string, any>): void {
    if (this.nodes[id]) return;

    if (Object.keys(this.nodes).length >= MAX_GRAPH_NODES) {
      this.isTruncated = true;
      return;
    }

    this.nodes[id] = {
      id,
      type,
      name,
      metadata,
    };
  }

  public addEdge(
    sourceId: string,
    targetId: string,
    relationship:
      | 'MODIFIES'
      | 'IMPORTS'
      | 'SERVES'
      | 'CALLS'
      | 'PART_OF'
      | 'AFFECTS'
      | 'USED_BY'
      | 'COVERS'
      | 'FAILED_BEFORE',
    reason: string,
    confidence: ImpactConfidence = 'HIGH',
    source = 'change_intelligence'
  ): void {
    if (this.edges.length >= MAX_GRAPH_EDGES) {
      this.isTruncated = true;
      return;
    }

    // Avoid duplicate edges
    const exists = this.edges.some(
      (e) => e.sourceId === sourceId && e.targetId === targetId && e.relationship === relationship
    );
    if (!exists) {
      this.edges.push({
        sourceId,
        targetId,
        relationship,
        reason,
        confidence,
        source,
      });
    }
  }

  public build(): ImpactGraph {
    return {
      nodes: this.nodes,
      edges: this.edges,
      nodeCount: Object.keys(this.nodes).length,
      edgeCount: this.edges.length,
      isTruncated: this.isTruncated,
    };
  }
}
