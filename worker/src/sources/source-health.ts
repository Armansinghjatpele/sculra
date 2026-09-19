// ==============================================================================
// Sculra Unified Source Health Tracker (worker/src/sources/source-health.ts)
// ==============================================================================

import {
  SourceHealthObservation,
  SourceHealthState,
  ProjectSource,
} from './types';
import { SOURCE_POLICY } from './policy';
import { SourceAdapterRegistry } from './source-registry';

export class SourceHealthTracker {
  private static observationsBySource = new Map<string, SourceHealthObservation[]>();

  /**
   * Executes a genuine health check using the source adapter and records the observation.
   */
  static async executeHealthCheck(source: ProjectSource): Promise<SourceHealthObservation> {
    const adapter = SourceAdapterRegistry.getAdapter(source.type);
    const observation = await adapter.healthCheck(source);

    this.recordObservation(source.id, observation);
    return observation;
  }

  /**
   * Records a health observation enforcing maximum history ceiling (100).
   */
  static recordObservation(sourceId: string, observation: SourceHealthObservation): void {
    const history = this.observationsBySource.get(sourceId) || [];
    history.unshift(observation);
    if (history.length > SOURCE_POLICY.MAX_HEALTH_HISTORY) {
      history.pop();
    }
    this.observationsBySource.set(sourceId, history);
  }

  /**
   * Retrieves recent observations for a source.
   */
  static getHistory(sourceId: string): SourceHealthObservation[] {
    return this.observationsBySource.get(sourceId) || [];
  }

  /**
   * Clears observation history (e.g. for testing).
   */
  static clear(): void {
    this.observationsBySource.clear();
  }
}
