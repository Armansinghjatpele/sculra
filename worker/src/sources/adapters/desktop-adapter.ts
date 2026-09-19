// ==============================================================================
// Sculra Desktop Source Adapter (worker/src/sources/adapters/desktop-adapter.ts)
// ==============================================================================

import { ISourceAdapter } from '../source-adapter';
import {
  ProjectSource,
  SourceHealthObservation,
  SourceFingerprint,
  SourceCapability,
  SourceValidationResult,
  SourceValidationOptions,
} from '../types';
import { SourceFingerprinter } from '../source-fingerprint';
import { SourceCapabilityResolver } from '../source-capabilities';

export class DesktopSourceAdapter implements ISourceAdapter {
  readonly sourceType = 'DESKTOP' as const;

  async validate(
    locator: string,
    config?: Record<string, any>,
    options: SourceValidationOptions = {}
  ): Promise<SourceValidationResult> {
    const fingerprint = SourceFingerprinter.compute('DESKTOP', {
      locator,
      status: 'NOT_READY',
    });

    const capabilities = SourceCapabilityResolver.resolve('DESKTOP', 'UNSUPPORTED', 'NOT_READY', config);

    return {
      valid: true,
      status: 'NOT_READY',
      sourceType: 'DESKTOP',
      capabilities,
      health: 'UNSUPPORTED',
      fingerprint: fingerprint.hash,
      errors: [],
      warnings: [
        'Desktop application testing requires isolated secure VM execution infrastructure. Arbitrary local binary execution is prohibited for safety.',
      ],
      metadata: {
        runtimeState: 'UNSUPPORTED_RUNTIME',
        note: 'Desktop source registered in non-executable mode. Execution blocked by safety policy.',
      },
    };
  }

  async fingerprint(source: ProjectSource): Promise<SourceFingerprint> {
    return SourceFingerprinter.compute('DESKTOP', {
      locator: source.locator,
      status: source.status,
    });
  }

  async capabilities(source: ProjectSource): Promise<SourceCapability[]> {
    return SourceCapabilityResolver.resolve('DESKTOP', 'UNSUPPORTED', source.status, source.configuration);
  }

  async healthCheck(source: ProjectSource): Promise<SourceHealthObservation> {
    return {
      id: `hobs-${Date.now()}`,
      projectSourceId: source.id,
      status: 'UNSUPPORTED',
      metadata: {
        reason: 'Desktop automated testing is currently unsupported.',
      },
      observedAt: new Date().toISOString(),
    };
  }

  async connect(source: ProjectSource): Promise<ProjectSource> {
    return {
      ...source,
      status: 'NOT_READY',
      updatedAt: new Date().toISOString(),
    };
  }

  async disconnect(source: ProjectSource): Promise<void> {
    // Stateless Desktop disconnect
  }
}
