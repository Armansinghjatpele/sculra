// ==============================================================================
// Sculra Deterministic API Endpoint Discovery (worker/src/api-qa/discovery.ts)
// ==============================================================================
// Aggregates and normalizes API endpoints from browser network traces, DOM forms,
// DOM links, OpenAPI specifications, and explicit project configurations.

import {
  ApiEndpoint,
  ApiHttpMethod,
  ApiProjectConfig,
  ApiExecutionLimits,
  DEFAULT_API_EXECUTION_LIMITS,
  SAFE_AUTO_EXECUTE_METHODS,
} from './types';
import { ApplicationMap, CapturedNetworkError, CancellationToken } from '../types';
import { normalizeHttpMethod, normalizeEndpointPath, normalizeApiUrl, generateEndpointId } from './normalizer';
import { OpenApiParser } from './openapi';
import { WorkerLogger } from '../logger';

export interface ApiDiscoveryParams {
  targetUrl: string;
  applicationMap?: ApplicationMap;
  networkObservations?: Array<{ url: string; method?: string; status?: number; contentType?: string }>;
  projectConfig?: ApiProjectConfig;
  limits?: Partial<ApiExecutionLimits>;
  allowLocalhost?: boolean;
  logger?: WorkerLogger;
  cancellationToken?: CancellationToken;
}

export class ApiEndpointDiscovery {
  private limits: ApiExecutionLimits;
  private logger?: WorkerLogger;

  constructor(limits: Partial<ApiExecutionLimits> = {}, logger?: WorkerLogger) {
    this.limits = { ...DEFAULT_API_EXECUTION_LIMITS, ...limits };
    this.logger = logger;
  }

  /**
   * Discovers and aggregates all API endpoints from available sources deterministically.
   */
  async discover(params: ApiDiscoveryParams): Promise<ApiEndpoint[]> {
    const {
      targetUrl,
      applicationMap,
      networkObservations = [],
      projectConfig,
      allowLocalhost,
      cancellationToken,
    } = params;

    const endpointMap = new Map<string, ApiEndpoint>();
    const now = new Date().toISOString();

    this.logger?.log('api_discovery_started', { targetUrl });

    // 1. Discover from Explicit Project Configuration
    if (projectConfig?.explicitEndpoints) {
      for (const ep of projectConfig.explicitEndpoints) {
        const method = normalizeHttpMethod(ep.method);
        const normPath = ep.path.trim().replace(/\/+$/, '') || '/';
        const id = generateEndpointId(method, normPath);
        const isSafe = SAFE_AUTO_EXECUTE_METHODS.has(method);

        endpointMap.set(id, {
          id,
          method,
          path: normPath,
          url: new URL(normPath, targetUrl).toString(),
          source: 'PROJECT_CONFIG',
          firstSeen: now,
          lastSeen: now,
          summary: ep.description,
          confidence: 1.0,
          requiresExplicitSafeConfig: !isSafe && !ep.safeToExecute,
          expectedRole: ep.requiredRole,
          responseStatus: ep.expectedStatus,
        });
      }
    }

    // 2. Discover from OpenAPI specification if configured
    if (projectConfig?.openApiUrl && !cancellationToken?.isCancelled) {
      try {
        const parser = new OpenApiParser(this.limits);
        const openApiSummary = await parser.parseFromUrl(projectConfig.openApiUrl, {
          allowLocalhost,
          cancellationToken,
        });

        for (const ep of openApiSummary.endpoints) {
          if (!endpointMap.has(ep.id)) {
            endpointMap.set(ep.id, ep);
          }
        }

        this.logger?.log('api_openapi_discovery_completed', {
          endpointsCount: openApiSummary.endpointsCount,
          errorsCount: openApiSummary.parseErrors?.length || 0,
        });
      } catch (err: any) {
        this.logger?.warn('api_openapi_discovery_failed', { error: err.message });
      }
    }

    // 3. Discover from Browser Network Observations
    for (const net of networkObservations) {
      if (endpointMap.size >= this.limits.maxEndpoints) break;

      const norm = normalizeApiUrl(net.url, targetUrl);
      const pathname = norm.pathname;

      // Filter for API-like endpoints (/api/, /v1/, /v2/, /graphql, json content types)
      const isApiRoute =
        pathname.startsWith('/api') ||
        pathname.startsWith('/v1/') ||
        pathname.startsWith('/v2/') ||
        pathname.startsWith('/v3/') ||
        pathname.includes('/graphql') ||
        pathname.endsWith('.json') ||
        (net.contentType && net.contentType.includes('application/json'));

      if (isApiRoute) {
        const method = normalizeHttpMethod(net.method);
        const normPath = normalizeEndpointPath(pathname);
        const id = generateEndpointId(method, normPath);

        if (!endpointMap.has(id)) {
          const isSafe = SAFE_AUTO_EXECUTE_METHODS.has(method);
          endpointMap.set(id, {
            id,
            method,
            path: normPath,
            url: norm.normalizedUrl,
            source: 'NETWORK_OBSERVATION',
            firstSeen: now,
            lastSeen: now,
            contentType: net.contentType,
            responseStatus: net.status,
            confidence: 0.95,
            requiresExplicitSafeConfig: !isSafe,
          });
        }
      }
    }

    // 4. Discover from DOM Application Map (Forms & Links)
    if (applicationMap) {
      for (const page of applicationMap.pages) {
        if (endpointMap.size >= this.limits.maxEndpoints) break;

        // Check forms
        for (const form of page.forms || []) {
          if (form.action && (form.action.startsWith('/api') || form.action.includes('/api/'))) {
            const method = normalizeHttpMethod(form.method);
            const normPath = normalizeEndpointPath(form.action);
            const id = generateEndpointId(method, normPath);

            if (!endpointMap.has(id)) {
              const isSafe = SAFE_AUTO_EXECUTE_METHODS.has(method);
              endpointMap.set(id, {
                id,
                method,
                path: normPath,
                url: new URL(normPath, targetUrl).toString(),
                source: 'DOM_FORM',
                firstSeen: now,
                lastSeen: now,
                confidence: 0.9,
                requiresExplicitSafeConfig: !isSafe,
                parameters: (form.fields || []).map((f) => ({
                  name: f.name,
                  in: 'query',
                  required: f.required,
                  type: f.type,
                })),
              });
            }
          }
        }

        // Check links
        for (const link of page.links || []) {
          if (link.href && (link.href.startsWith('/api') || link.href.includes('/api/'))) {
            const norm = normalizeApiUrl(link.href, targetUrl);
            const normPath = normalizeEndpointPath(norm.pathname);
            const id = generateEndpointId('GET', normPath);

            if (!endpointMap.has(id)) {
              endpointMap.set(id, {
                id,
                method: 'GET',
                path: normPath,
                url: norm.normalizedUrl,
                source: 'DOM_LINK',
                firstSeen: now,
                lastSeen: now,
                confidence: 0.85,
                requiresExplicitSafeConfig: false,
              });
            }
          }
        }
      }
    }

    const discoveredList = Array.from(endpointMap.values()).slice(0, this.limits.maxEndpoints);

    this.logger?.log('api_discovery_completed', {
      endpointsCount: discoveredList.length,
      safeEndpointsCount: discoveredList.filter((e) => !e.requiresExplicitSafeConfig).length,
    });

    return discoveredList;
  }
}
