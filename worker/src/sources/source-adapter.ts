// ==============================================================================
// Sculra Provider-Independent Source Adapter Contract (worker/src/sources/source-adapter.ts)
// ==============================================================================

import {
  ProjectSource,
  SourceSnapshot,
  SourceHealthObservation,
  SourceFingerprint,
  SourceCapability,
  SourceValidationResult,
  SourceValidationOptions,
} from './types';

export interface ISourceAdapter {
  readonly sourceType: ProjectSource['type'];

  /**
   * Validates target locator, credentials, connectivity, SSRF compliance, and environment.
   */
  validate(
    locator: string,
    config?: Record<string, any>,
    options?: SourceValidationOptions
  ): Promise<SourceValidationResult>;

  /**
   * Generates a deterministic fingerprint representing observed source state.
   */
  fingerprint(source: ProjectSource): Promise<SourceFingerprint>;

  /**
   * Resolves truthful capabilities available for this source.
   */
  capabilities(source: ProjectSource): Promise<SourceCapability[]>;

  /**
   * Performs real-time health check against the source.
   */
  healthCheck(source: ProjectSource): Promise<SourceHealthObservation>;

  /**
   * Connects and initializes runtime context for this source.
   */
  connect(source: ProjectSource): Promise<ProjectSource>;

  /**
   * Disconnects or cleans up source resources.
   */
  disconnect(source: ProjectSource): Promise<void>;
}
