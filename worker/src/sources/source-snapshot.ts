// ==============================================================================
// Sculra Source Snapshot Manager (worker/src/sources/source-snapshot.ts)
// ==============================================================================

import {
  ProjectSource,
  SourceSnapshot,
  SourceValidationResult,
  SourceChange,
} from './types';
import { SourceRedactor } from './source-redaction';
import { SourceFingerprinter } from './source-fingerprint';

export class SourceSnapshotManager {
  /**
   * Creates an immutable SourceSnapshot representing exactly what Sculra observed.
   */
  static createSnapshot(
    source: ProjectSource,
    validation: SourceValidationResult
  ): SourceSnapshot {
    const rawMetadata = {
      ...(validation.metadata || {}),
      latencyMs: validation.latencyMs,
      warningsCount: validation.warnings.length,
      errorsCount: validation.errors.length,
    };

    // Sanitize secrets and enforce 128KB ceiling
    const sanitizedMetadata = SourceRedactor.sanitize(rawMetadata);
    const boundedMetadata = SourceRedactor.enforceMetadataCeiling(sanitizedMetadata);

    return {
      id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      projectSourceId: source.id,
      projectId: source.projectId,
      organizationId: source.organizationId,
      fingerprint: validation.fingerprint || source.id,
      revision: validation.revision || source.branch || undefined,
      environment: source.environment,
      capabilities: validation.capabilities,
      metadata: boundedMetadata,
      status: validation.status,
      observedAt: new Date().toISOString(),
    };
  }

  /**
   * Detects changes between consecutive snapshots.
   */
  static detectSnapshotChange(
    previous: SourceSnapshot | undefined,
    current: SourceSnapshot
  ): SourceChange {
    return SourceFingerprinter.detectChange(
      current.projectSourceId,
      previous?.fingerprint,
      current.fingerprint,
      {
        prevRevision: previous?.revision,
        currRevision: current.revision,
        prevStatus: previous?.status,
        currStatus: current.status,
      }
    );
  }
}
