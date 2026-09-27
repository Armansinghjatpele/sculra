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

  public addNode(id: string, type: ImpactNode['type'], name: string, metadata?: Record<string, any>): void {
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
    relationship: ImpactEdge['relationship'],
    reason: string,
    confidence: ImpactConfidence = 'HIGH',
    source = 'change_intelligence'
  ): void {
    if (this.edges.length >= MAX_GRAPH_EDGES) {
      this.isTruncated = true;
      return;
    }

    // Avoid self-cycles or duplicate edges
    if (sourceId === targetId) return;

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

  /**
   * Traverses downstream edges from a starting node up to maxDepth with cycle detection.
   */
  public getDownstreamNodes(startNodeId: string, maxDepth = 5): ImpactNode[] {
    const visited = new Set<string>();
    const result: ImpactNode[] = [];
    const queue: { id: string; depth: number }[] = [{ id: startNodeId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.depth >= maxDepth) continue;
      visited.add(current.id);

      if (current.id !== startNodeId && this.nodes[current.id]) {
        result.push(this.nodes[current.id]);
      }

      const outgoing = this.edges.filter((e) => e.sourceId === current.id);
      for (const edge of outgoing) {
        if (!visited.has(edge.targetId)) {
          queue.push({ id: edge.targetId, depth: current.depth + 1 });
        }
      }
    }

    return result;
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
