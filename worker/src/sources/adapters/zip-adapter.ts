// ==============================================================================
// Sculra ZIP Source Adapter (worker/src/sources/adapters/zip-adapter.ts)
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
import { SOURCE_POLICY } from '../policy';
import { SourceFingerprinter } from '../source-fingerprint';
import { SourceCapabilityResolver } from '../source-capabilities';

export class ZipSourceAdapter implements ISourceAdapter {
  readonly sourceType = 'ZIP' as const;

  async validate(
    locator: string,
    config?: Record<string, any>,
    options: SourceValidationOptions = {}
  ): Promise<SourceValidationResult> {
    const errors: SourceValidationResult['errors'] = [];
    const warnings: string[] = [];

    // Path traversal check
    if (locator.includes('../') || locator.includes('..\\') || locator.includes('\0')) {
      return {
        valid: false,
        status: 'UNSUPPORTED',
        sourceType: 'ZIP',
        capabilities: SourceCapabilityResolver.resolve('ZIP', 'MISCONFIGURED', 'UNSUPPORTED'),
        health: 'MISCONFIGURED',
        errors: [
          {
            code: 'PATH_TRAVERSAL_DETECTED',
            message: 'ZIP locator contains illegal path traversal sequences.',
            fatal: true,
            field: 'locator',
          },
        ],
        warnings: [],
      };
    }

    const archiveBytes = config?.fileSizeBytes || 0;
    if (archiveBytes > SOURCE_POLICY.ZIP_MAX_ARCHIVE_BYTES) {
      return {
        valid: false,
        status: 'UNSUPPORTED',
        sourceType: 'ZIP',
        capabilities: SourceCapabilityResolver.resolve('ZIP', 'MISCONFIGURED', 'UNSUPPORTED'),
        health: 'MISCONFIGURED',
        errors: [
          {
            code: 'ARCHIVE_TOO_LARGE',
            message: `ZIP archive size (${archiveBytes} bytes) exceeds limit of ${SOURCE_POLICY.ZIP_MAX_ARCHIVE_BYTES} bytes.`,
            fatal: true,
            field: 'configuration.fileSizeBytes',
          },
        ],
        warnings: [],
      };
    }

    // Truthful check: Is archive storage provisioned?
    const hasStorage = Boolean(config?.storageKey || config?.archiveUrl || config?.extractedPath);

    if (!hasStorage) {
      warnings.push('ZIP storage runner is currently unprovisioned in this environment.');
      const capabilities = SourceCapabilityResolver.resolve('ZIP', 'NOT_READY', 'NOT_READY', config);
      const fingerprint = SourceFingerprinter.compute('ZIP', { locator, status: 'NOT_READY' });

      return {
        valid: true,
        status: 'NOT_READY',
        sourceType: 'ZIP',
        capabilities,
        health: 'NOT_READY',
        fingerprint: fingerprint.hash,
        errors: [],
        warnings,
        metadata: {
          runtimeState: 'UNPROVISIONED_STORAGE',
          note: 'ZIP project source registered. Upload bundle to initiate static source analysis.',
        },
      };
    }

    const capabilities = SourceCapabilityResolver.resolve('ZIP', 'HEALTHY', 'AVAILABLE', config);
    const fingerprint = SourceFingerprinter.compute('ZIP', {
      locator,
      checksum: config?.checksum || 'unverified',
    });

    return {
      valid: true,
      status: 'AVAILABLE',
      sourceType: 'ZIP',
      capabilities,
      health: 'HEALTHY',
      fingerprint: fingerprint.hash,
      errors: [],
      warnings,
      metadata: {
        checksum: config?.checksum,
        filesCount: config?.filesCount,
      },
    };
  }

  async fingerprint(source: ProjectSource): Promise<SourceFingerprint> {
    return SourceFingerprinter.compute('ZIP', {
      locator: source.locator,
      status: source.status,
    });
  }

  async capabilities(source: ProjectSource): Promise<SourceCapability[]> {
    const health = source.status === 'AVAILABLE' ? 'HEALTHY' : 'NOT_READY';
    return SourceCapabilityResolver.resolve('ZIP', health, source.status, source.configuration);
  }

  async healthCheck(source: ProjectSource): Promise<SourceHealthObservation> {
    return {
      id: `hobs-${Date.now()}`,
      projectSourceId: source.id,
      status: source.status === 'AVAILABLE' ? 'HEALTHY' : 'NOT_READY',
      metadata: { note: 'ZIP source static health check' },
      observedAt: new Date().toISOString(),
    };
  }

  async connect(source: ProjectSource): Promise<ProjectSource> {
    return {
      ...source,
      status: source.configuration?.archiveUrl ? 'AVAILABLE' : 'NOT_READY',
      updatedAt: new Date().toISOString(),
    };
  }

  async disconnect(source: ProjectSource): Promise<void> {
    // Stateless ZIP disconnect
  }
}
