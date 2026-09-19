// ==============================================================================
// Sculra Source Ingestion Observability Event Emitter
// (worker/src/sources/source-events.ts)
// ==============================================================================

import { AutonomousEventBuilder } from '../observability/event-builder';
import { AutonomousEventStore } from '../observability/event-store';
import {
  ProjectSource,
  SourceSnapshot,
  SourceValidationResult,
  SourceChange,
  SourceType,
} from './types';

export class SourceEventEmitter {
  /**
   * Emits SOURCE_VALIDATION_STARTED event.
   */
  static async emitValidationStarted(
    projectId: string,
    sourceType: SourceType,
    locator: string,
    organizationId?: string
  ): Promise<void> {
    const event = AutonomousEventBuilder.create('SOURCE_VALIDATION_STARTED')
      .setProject(projectId, organizationId)
      .setActor('SOURCE_INGESTOR', `ingestor-${sourceType.toLowerCase()}`)
      .setStageAndStatus('INGESTION', 'RUNNING')
      .setCategoryAndSource('ACTION', 'SOURCE')
      .setSummary(`Validating ${sourceType} source: ${locator}`, 'Source connection and security preflight checks initiated')
      .setConfidence('HIGH')
      .setMetadata({ sourceType, locator })
      .build();

    await AutonomousEventStore.append(event);
  }

  /**
   * Emits SOURCE_VALIDATED event.
   */
  static async emitValidated(
    projectId: string,
    sourceId: string,
    sourceType: SourceType,
    result: SourceValidationResult,
    organizationId?: string
  ): Promise<void> {
    const availableCaps = result.capabilities
      .filter((c) => c.state === 'AVAILABLE')
      .map((c) => c.key);

    const event = AutonomousEventBuilder.create('SOURCE_VALIDATED')
      .setProject(projectId, organizationId)
      .setActor('SOURCE_INGESTOR', `ingestor-${sourceType.toLowerCase()}`)
      .setStageAndStatus('INGESTION', result.valid ? 'COMPLETED' : 'FAILED')
      .setCategoryAndSource('ACTION_RESULT', 'SOURCE')
      .setSummary(
        `${sourceType} source validated: ${result.health} (${availableCaps.length} capabilities active)`,
        result.warnings.join('; ') || 'Preflight checks passed with full policy compliance'
      )
      .setConfidence('HIGH')
      .setMetadata({
        sourceId,
        sourceType,
        health: result.health,
        status: result.status,
        latencyMs: result.latencyMs,
        fingerprint: result.fingerprint,
        availableCapabilities: availableCaps,
      })
      .build();

    await AutonomousEventStore.append(event);
  }

  /**
   * Emits SOURCE_VALIDATION_FAILED event.
   */
  static async emitValidationFailed(
    projectId: string,
    sourceType: SourceType,
    locator: string,
    error: string,
    organizationId?: string
  ): Promise<void> {
    const event = AutonomousEventBuilder.create('SOURCE_VALIDATION_FAILED')
      .setProject(projectId, organizationId)
      .setActor('SOURCE_INGESTOR', `ingestor-${sourceType.toLowerCase()}`)
      .setStageAndStatus('INGESTION', 'FAILED')
      .setCategoryAndSource('ACTION_RESULT', 'SOURCE')
      .setSummary(
        `Validation failed for ${sourceType} source: ${error}`,
        `Security or reachability failure encountered during preflight for ${locator}`
      )
      .setConfidence('HIGH')
      .setMetadata({ sourceType, locator, error })
      .build();

    await AutonomousEventStore.append(event);
  }

  /**
   * Emits SOURCE_CONNECTED event.
   */
  static async emitSourceConnected(source: ProjectSource): Promise<void> {
    const event = AutonomousEventBuilder.create('SOURCE_CONNECTED')
      .setProject(source.projectId, source.organizationId)
      .setActor('SOURCE_INGESTOR', `ingestor-${source.type.toLowerCase()}`)
      .setStageAndStatus('INGESTION', 'COMPLETED')
      .setCategoryAndSource('ACTION', 'SOURCE')
      .setSummary(
        `Connected ${source.type} source: ${source.locator}`,
        `Source status set to ${source.status} in environment ${source.environment}`
      )
      .setConfidence('HIGH')
      .setMetadata({
        sourceId: source.id,
        sourceType: source.type,
        environment: source.environment,
        branch: source.branch,
      })
      .build();

    await AutonomousEventStore.append(event);
  }

  /**
   * Emits SOURCE_CHANGED or SOURCE_UNCHANGED event.
   */
  static async emitSourceChange(source: ProjectSource, change: SourceChange): Promise<void> {
    const eventType = change.type === 'SOURCE_UNCHANGED' ? 'SOURCE_UNCHANGED' : 'SOURCE_CHANGED';

    const event = AutonomousEventBuilder.create(eventType)
      .setProject(source.projectId, source.organizationId)
      .setActor('SOURCE_INGESTOR', `ingestor-${source.type.toLowerCase()}`)
      .setStageAndStatus('INGESTION', 'COMPLETED')
      .setCategoryAndSource(
        change.type === 'SOURCE_UNCHANGED' ? 'INFERRED_CONCLUSION' : 'OBSERVED_FACT',
        'SOURCE'
      )
      .setSummary(change.details, `Fingerprint evaluation: ${change.currentFingerprint.substring(0, 12)}...`)
      .setConfidence('HIGH')
      .setMetadata({
        sourceId: source.id,
        changeType: change.type,
        fingerprint: change.currentFingerprint,
        previousFingerprint: change.previousFingerprint,
        ...(change.metadata || {}),
      })
      .build();

    await AutonomousEventStore.append(event);
  }

  /**
   * Emits SOURCE_SNAPSHOT_CREATED event.
   */
  static async emitSnapshotCreated(source: ProjectSource, snapshot: SourceSnapshot): Promise<void> {
    const event = AutonomousEventBuilder.create('SOURCE_SNAPSHOT_CREATED')
      .setProject(source.projectId, source.organizationId)
      .setActor('SOURCE_INGESTOR', `ingestor-${source.type.toLowerCase()}`)
      .setStageAndStatus('INGESTION', 'COMPLETED')
      .setCategoryAndSource('ACTION_RESULT', 'SOURCE')
      .setSummary(
        `Created source snapshot ${snapshot.id.substring(0, 14)} (${source.type})`,
        `Recorded immutable snapshot with fingerprint ${snapshot.fingerprint.substring(0, 10)}...`
      )
      .setConfidence('HIGH')
      .setMetadata({
        sourceId: source.id,
        snapshotId: snapshot.id,
        fingerprint: snapshot.fingerprint,
        revision: snapshot.revision,
      })
      .build();

    await AutonomousEventStore.append(event);
  }
}
