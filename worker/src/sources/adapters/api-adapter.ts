// ==============================================================================
// Sculra API Source Adapter (worker/src/sources/adapters/api-adapter.ts)
// ==============================================================================

import { ISourceAdapter } from '../source-adapter';
import {
  ProjectSource,
  SourceHealthObservation,
  SourceFingerprint,
  SourceCapability,
  SourceValidationResult,
  SourceValidationOptions,
  SourceHealthState,
  SourceStatus,
} from '../types';
import { BoundedHttpClient } from '../source-limits';
import { SourceFingerprinter } from '../source-fingerprint';
import { SourceCapabilityResolver } from '../source-capabilities';
import { validateTargetUrl } from '../../security/ssrf';

export class ApiSourceAdapter implements ISourceAdapter {
  readonly sourceType = 'API' as const;

  async validate(
    locator: string,
    config?: Record<string, any>,
    options: SourceValidationOptions = {}
  ): Promise<SourceValidationResult> {
    const urlCheck = validateTargetUrl(locator, {
      allowLocalhost: options.allowLocalhost,
    });

    if (!urlCheck.valid) {
      const isSsrf = Boolean(urlCheck.error?.includes('restricted') || urlCheck.error?.includes('private'));
      return {
        valid: false,
        status: 'UNAVAILABLE',
        sourceType: 'API',
        capabilities: SourceCapabilityResolver.resolve('API', 'MISCONFIGURED', 'UNAVAILABLE'),
        health: isSsrf ? 'FORBIDDEN' : 'MISCONFIGURED',
        errors: [
          {
            code: isSsrf ? 'SSRF_SECURITY_VIOLATION' : 'INVALID_API_URL',
            message: urlCheck.error || 'Invalid API base URL',
            fatal: true,
            field: 'locator',
          },
        ],
        warnings: [],
      };
    }

    const sanitizedUrl = urlCheck.sanitizedUrl || locator;
    const openApiUrl = config?.openApiUrl;
    const warnings: string[] = [];

    if (!openApiUrl && !config?.openApiDocument) {
      warnings.push('No OpenAPI specification provided. API testing will probe known endpoints.');
    }

    if (options.skipNetworkChecks) {
      const fingerprint = SourceFingerprinter.compute('API', {
        baseUrl: sanitizedUrl,
        openApiUrl: openApiUrl || 'none',
      });

      return {
        valid: true,
        status: 'AVAILABLE',
        sourceType: 'API',
        capabilities: SourceCapabilityResolver.resolve('API', 'HEALTHY', 'AVAILABLE', config),
        health: 'HEALTHY',
        fingerprint: fingerprint.hash,
        errors: [],
        warnings,
      };
    }

    try {
      const res = await BoundedHttpClient.safeFetch(sanitizedUrl, {
        timeoutMs: options.timeoutMs,
        allowLocalhost: options.allowLocalhost,
      });

      const healthState: SourceHealthState = res.status >= 500 ? 'DEGRADED' : res.status === 401 ? 'AUTH_REQUIRED' : res.status === 403 ? 'FORBIDDEN' : 'HEALTHY';
      const sourceStatus: SourceStatus = 'AVAILABLE';

      const fingerprint = SourceFingerprinter.compute('API', {
        baseUrl: sanitizedUrl,
        status: res.status,
        openApiUrl: openApiUrl || 'none',
      });

      return {
        valid: true,
        status: sourceStatus,
        sourceType: 'API',
        capabilities: SourceCapabilityResolver.resolve('API', healthState, sourceStatus, config),
        health: healthState,
        fingerprint: fingerprint.hash,
        latencyMs: res.durationMs,
        errors: [],
        warnings,
        metadata: {
          statusCode: res.status,
          finalUrl: res.finalUrl,
          hasOpenApi: Boolean(openApiUrl || config?.openApiDocument),
        },
      };
    } catch (err: any) {
      const isSSRF = err.name === 'SourceSSRFError' || err.message?.includes('SSRF');
      return {
        valid: false,
        status: 'UNAVAILABLE',
        sourceType: 'API',
        capabilities: SourceCapabilityResolver.resolve('API', 'UNREACHABLE', 'UNAVAILABLE'),
        health: isSSRF ? 'FORBIDDEN' : 'UNREACHABLE',
        errors: [
          {
            code: isSSRF ? 'SSRF_BLOCKED' : 'CONNECTION_FAILED',
            message: err.message || 'Failed connecting to API endpoint',
            fatal: true,
            field: 'locator',
          },
        ],
        warnings,
      };
    }
  }

  async fingerprint(source: ProjectSource): Promise<SourceFingerprint> {
    return SourceFingerprinter.compute('API', {
      locator: source.locator,
      openApiUrl: source.configuration?.openApiUrl || 'none',
      status: source.status,
    });
  }

  async capabilities(source: ProjectSource): Promise<SourceCapability[]> {
    const health = source.status === 'AVAILABLE' ? 'HEALTHY' : 'UNREACHABLE';
    return SourceCapabilityResolver.resolve('API', health, source.status, source.configuration);
  }

  async healthCheck(source: ProjectSource): Promise<SourceHealthObservation> {
    const startTime = Date.now();
    try {
      const res = await BoundedHttpClient.safeFetch(source.locator, {
        timeoutMs: 10000,
        allowLocalhost: source.environment === 'Localhost' || source.environment === 'Development',
      });
      return {
        id: `hobs-${Date.now()}`,
        projectSourceId: source.id,
        status: res.status >= 500 ? 'DEGRADED' : 'HEALTHY',
        latencyMs: res.durationMs,
        metadata: { statusCode: res.status },
        observedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        id: `hobs-${Date.now()}`,
        projectSourceId: source.id,
        status: 'UNREACHABLE',
        latencyMs: Date.now() - startTime,
        errorCode: 'CONNECTION_FAILED',
        metadata: { error: err.message },
        observedAt: new Date().toISOString(),
      };
    }
  }

  async connect(source: ProjectSource): Promise<ProjectSource> {
    return {
      ...source,
      status: 'AVAILABLE',
      updatedAt: new Date().toISOString(),
    };
  }

  async disconnect(source: ProjectSource): Promise<void> {
    // Stateless API disconnect
  }
}
