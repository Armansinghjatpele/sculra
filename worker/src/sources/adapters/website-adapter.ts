// ==============================================================================
// Sculra Website Source Adapter (worker/src/sources/adapters/website-adapter.ts)
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

export class WebsiteSourceAdapter implements ISourceAdapter {
  readonly sourceType = 'WEBSITE' as const;

  /**
   * Hardened website validation with multi-hop SSRF validation and response limits.
   */
  async validate(
    locator: string,
    config?: Record<string, any>,
    options: SourceValidationOptions = {}
  ): Promise<SourceValidationResult> {
    const errors: SourceValidationResult['errors'] = [];
    const warnings: string[] = [];

    // 1. Initial SSRF & URL Syntax Validation
    const urlCheck = validateTargetUrl(locator, {
      allowLocalhost: options.allowLocalhost,
    });

    if (!urlCheck.valid) {
      const isSsrf = Boolean(urlCheck.error?.includes('restricted') || urlCheck.error?.includes('private'));
      return {
        valid: false,
        status: 'UNAVAILABLE',
        sourceType: 'WEBSITE',
        capabilities: SourceCapabilityResolver.resolve('WEBSITE', 'UNREACHABLE', 'UNAVAILABLE'),
        health: isSsrf ? 'FORBIDDEN' : 'MISCONFIGURED',
        errors: [
          {
            code: isSsrf ? 'SSRF_SECURITY_VIOLATION' : 'INVALID_URL',
            message: urlCheck.error || 'Invalid target URL',
            fatal: true,
            field: 'locator',
          },
        ],
        warnings,
      };
    }

    const sanitizedUrl = urlCheck.sanitizedUrl || locator;

    // Check scheme
    if (sanitizedUrl.startsWith('http://') && !sanitizedUrl.includes('localhost') && !sanitizedUrl.includes('127.0.0.1')) {
      warnings.push('Target uses unencrypted HTTP protocol. HTTPS is recommended for security.');
    }

    if (options.skipNetworkChecks) {
      const fingerprint = SourceFingerprinter.compute('WEBSITE', {
        canonicalOrigin: new URL(sanitizedUrl).origin,
        status: 200,
      });

      return {
        valid: true,
        status: 'AVAILABLE',
        sourceType: 'WEBSITE',
        capabilities: SourceCapabilityResolver.resolve('WEBSITE', 'HEALTHY', 'AVAILABLE'),
        health: 'HEALTHY',
        fingerprint: fingerprint.hash,
        errors: [],
        warnings,
      };
    }

    // 2. Network Reachability & SSRF Protected Fetch
    try {
      const fetchResult = await BoundedHttpClient.safeFetch(sanitizedUrl, {
        timeoutMs: options.timeoutMs,
        allowLocalhost: options.allowLocalhost,
      });

      let healthState: SourceHealthState = 'HEALTHY';
      let sourceStatus: SourceStatus = 'AVAILABLE';

      if (fetchResult.status === 401 || fetchResult.status === 407) {
        healthState = 'AUTH_REQUIRED';
        warnings.push(`Target requires authentication (HTTP ${fetchResult.status}). Form or role login setup recommended.`);
      } else if (fetchResult.status === 403) {
        healthState = 'FORBIDDEN';
        warnings.push(`Target returned HTTP 403 Forbidden. IP allowlisting may be required.`);
      } else if (fetchResult.status >= 500) {
        healthState = 'DEGRADED';
        warnings.push(`Target returned server error HTTP ${fetchResult.status}.`);
      } else if (fetchResult.durationMs > 5000) {
        healthState = 'DEGRADED';
        warnings.push(`Target response latency (${fetchResult.durationMs}ms) exceeds recommended threshold.`);
      }

      const canonicalOrigin = new URL(fetchResult.finalUrl).origin;
      const titleMatch = fetchResult.body.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      const fingerprint = SourceFingerprinter.compute('WEBSITE', {
        canonicalOrigin,
        status: fetchResult.status,
        serverHeader: fetchResult.headers['server'] || '',
        title,
      });

      const capabilities = SourceCapabilityResolver.resolve('WEBSITE', healthState, sourceStatus, config);

      return {
        valid: true,
        status: sourceStatus,
        sourceType: 'WEBSITE',
        capabilities,
        health: healthState,
        fingerprint: fingerprint.hash,
        latencyMs: fetchResult.durationMs,
        errors: [],
        warnings,
        metadata: {
          finalUrl: fetchResult.finalUrl,
          statusCode: fetchResult.status,
          redirectsFollowed: fetchResult.redirectsFollowed,
          contentLength: fetchResult.body.length,
          title,
        },
      };
    } catch (err: any) {
      const isSSRF = err.name === 'SourceSSRFError' || err.message?.includes('SSRF');
      const healthState: SourceHealthState = isSSRF ? 'FORBIDDEN' : 'UNREACHABLE';

      return {
        valid: false,
        status: 'UNAVAILABLE',
        sourceType: 'WEBSITE',
        capabilities: SourceCapabilityResolver.resolve('WEBSITE', healthState, 'UNAVAILABLE'),
        health: healthState,
        errors: [
          {
            code: isSSRF ? 'SSRF_BLOCKED' : 'CONNECTION_FAILED',
            message: err.message || 'Failed connecting to website target',
            fatal: true,
            field: 'locator',
          },
        ],
        warnings,
      };
    }
  }

  async fingerprint(source: ProjectSource): Promise<SourceFingerprint> {
    const origin = new URL(source.locator).origin;
    return SourceFingerprinter.compute('WEBSITE', {
      locator: origin,
      environment: source.environment,
      status: source.status,
    });
  }

  async capabilities(source: ProjectSource): Promise<SourceCapability[]> {
    const health = source.status === 'AVAILABLE' ? 'HEALTHY' : 'UNREACHABLE';
    return SourceCapabilityResolver.resolve('WEBSITE', health, source.status, source.configuration);
  }

  async healthCheck(source: ProjectSource): Promise<SourceHealthObservation> {
    const startTime = Date.now();
    try {
      const res = await BoundedHttpClient.safeFetch(source.locator, {
        timeoutMs: 10000,
        allowLocalhost: source.environment === 'Localhost' || source.environment === 'Development',
      });

      const status: SourceHealthState = res.status >= 500 ? 'DEGRADED' : res.status === 401 ? 'AUTH_REQUIRED' : res.status === 403 ? 'FORBIDDEN' : 'HEALTHY';

      return {
        id: `hobs-${Date.now()}`,
        projectSourceId: source.id,
        status,
        latencyMs: res.durationMs,
        metadata: {
          statusCode: res.status,
          redirects: res.redirectsFollowed,
        },
        observedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        id: `hobs-${Date.now()}`,
        projectSourceId: source.id,
        status: 'UNREACHABLE',
        latencyMs: Date.now() - startTime,
        errorCode: err.message?.includes('SSRF') ? 'SSRF_RESTRICTION' : 'CONNECTION_ERROR',
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
    // Stateless website disconnect
  }
}
