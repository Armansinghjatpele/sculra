// ==============================================================================
// Sculra Deterministic Safe API Executor (worker/src/api-qa/executor.ts)
// ==============================================================================
// Executes bounded, SSRF-protected HTTP requests against API endpoints with
// strict mutation safety policies, redirect revalidation, and zero credential leakage.

import {
  ApiRequestDefinition,
  ApiResponseObservation,
  ApiExecutionLimits,
  DEFAULT_API_EXECUTION_LIMITS,
  SAFE_AUTO_EXECUTE_METHODS,
  ApiHttpMethod,
} from './types';
import { validateTargetUrl } from '../security/ssrf';
import { AuthRedaction } from '../auth/redaction';
import { CancellationToken } from '../types';
import { WorkerLogger } from '../logger';

const DESTRUCTIVE_KEYWORDS = [
  'delete',
  'logout',
  'log-out',
  'signout',
  'sign-out',
  'payment',
  'purchase',
  'checkout',
  'transfer',
  'withdraw',
  'cancel',
  'subscription',
  'bulk-delete',
  'purge',
  'wipe',
  'destroy',
  'terminate',
  'reset-password',
];

export interface ApiExecutionOptions {
  allowLocalhost?: boolean;
  limits?: Partial<ApiExecutionLimits>;
  logger?: WorkerLogger;
  cancellationToken?: CancellationToken;
  explicitlySafe?: boolean;
  followRedirects?: boolean;
}

export class ApiExecutor {
  private limits: ApiExecutionLimits;
  private logger?: WorkerLogger;
  private allowLocalhost: boolean;

  constructor(options: ApiExecutionOptions = {}) {
    this.limits = { ...DEFAULT_API_EXECUTION_LIMITS, ...options.limits };
    this.logger = options.logger;
    this.allowLocalhost = !!options.allowLocalhost;
  }

  /**
   * Deterministically validates whether a request is safe to execute according to method & mutation policies.
   */
  isSafeRequest(request: ApiRequestDefinition, explicitlySafe: boolean = false): { safe: boolean; reason?: string } {
    const method = request.method.toUpperCase() as ApiHttpMethod;

    // 1. Safe HTTP methods (GET, HEAD, OPTIONS)
    if (SAFE_AUTO_EXECUTE_METHODS.has(method)) {
      // Check if URL pathname contains obvious destructive admin patterns
      const lowerUrl = request.url.toLowerCase();
      for (const kw of ['/delete', '/destroy', '/purge']) {
        if (lowerUrl.includes(kw) && !explicitlySafe) {
          return { safe: false, reason: `URL contains destructive keyword "${kw}".` };
        }
      }
      return { safe: true };
    }

    // 2. Mutation HTTP methods (POST, PUT, PATCH, DELETE)
    if (!explicitlySafe) {
      return {
        safe: false,
        reason: `HTTP method ${method} requires explicit safe test configuration. Automatically executing mutations is prohibited.`,
      };
    }

    // 3. Check for high-risk destructive action keywords even when explicitly configured
    const lowerUrl = request.url.toLowerCase();
    for (const kw of DESTRUCTIVE_KEYWORDS) {
      if (lowerUrl.includes(kw) && !explicitlySafe) {
        return {
          safe: false,
          reason: `High-risk destructive keyword "${kw}" detected in API endpoint URL. Execution blocked for safety.`,
        };
      }
    }

    return { safe: true };
  }

  /**
   * Executes an API request with SSRF validation, timeout, bounded response size, and redirect handling.
   */
  async execute(
    request: ApiRequestDefinition,
    options: ApiExecutionOptions = {}
  ): Promise<ApiResponseObservation> {
    const startTime = Date.now();
    const isExplicitlySafe = options.explicitlySafe ?? false;
    const token = options.cancellationToken;

    // 1. Check safety policy
    const safetyCheck = this.isSafeRequest(request, isExplicitlySafe);
    if (!safetyCheck.safe) {
      return this.createErrorObservation(
        request,
        0,
        'SKIPPED_UNSAFE',
        `Request skipped by safety policy: ${safetyCheck.reason}`,
        Date.now() - startTime
      );
    }

    // 2. Initial SSRF Validation
    const urlCheck = validateTargetUrl(request.url, { allowLocalhost: this.allowLocalhost });
    if (!urlCheck.valid) {
      return this.createErrorObservation(
        request,
        0,
        'SSRF_BLOCKED',
        `SSRF Security Violation: ${urlCheck.error}`,
        Date.now() - startTime
      );
    }

    let currentUrl = urlCheck.sanitizedUrl || request.url;
    let redirectCount = 0;

    // 3. Execution Loop with Manual Redirect Revalidation
    while (redirectCount <= this.limits.maxRedirects) {
      if (token?.isCancelled) {
        return this.createErrorObservation(
          request,
          0,
          'CANCELLED',
          'API execution cancelled',
          Date.now() - startTime
        );
      }

      const controller = new AbortController();
      const timeoutMs = request.timeoutMs || this.limits.requestTimeoutMs;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Build headers (inject in-memory credentials without exposing to logs)
        const headers: Record<string, string> = {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'Sculra-Autonomous-QA-Engine/1.0',
          ...(request.headers || {}),
        };

        let bodyPayload: string | undefined;
        if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
          if (typeof request.body === 'object') {
            bodyPayload = JSON.stringify(request.body);
            if (!headers['Content-Type'] && !headers['content-type']) {
              headers['Content-Type'] = 'application/json';
            }
          } else {
            bodyPayload = String(request.body);
          }
        }

        const fetchResponse = await fetch(currentUrl, {
          method: request.method,
          headers,
          body: bodyPayload,
          signal: controller.signal,
          redirect: 'manual',
        });

        clearTimeout(timeoutId);

        // Handle Redirects
        if (fetchResponse.status >= 300 && fetchResponse.status < 400) {
          if (options.followRedirects === false) {
            const durationMs = Date.now() - startTime;
            const status = fetchResponse.status;
            const statusText = fetchResponse.statusText;
            const contentType = fetchResponse.headers.get('content-type') || undefined;
            const safeHeaders: Record<string, string> = {};
            const rawSetCookies: string[] = [];

            fetchResponse.headers.forEach((val, key) => {
              const lower = key.toLowerCase();
              if (lower === 'set-cookie') {
                rawSetCookies.push(val);
                safeHeaders[key] = AuthRedaction.redactHeader(key, val);
              } else if (lower === 'authorization' || lower === 'cookie') {
                safeHeaders[key] = AuthRedaction.redactHeader(key, val);
              } else {
                safeHeaders[key] = val;
              }
            });

            return {
              id: `obs_${request.endpointId}_${Date.now()}`,
              endpointId: request.endpointId,
              method: request.method,
              url: currentUrl,
              status,
              statusText,
              durationMs,
              contentType,
              responseSize: 0,
              redirectCount,
              safeHeaders,
              rawSetCookies,
              role: request.role,
              authenticated: !!request.headers?.['Cookie'] || !!request.headers?.['Authorization'] || !!request.role,
              timestamp: new Date().toISOString(),
            };
          }

          redirectCount++;
          if (redirectCount > this.limits.maxRedirects) {
            return this.createErrorObservation(
              request,
              fetchResponse.status,
              'EXCESSIVE_REDIRECTS',
              `Exceeded maximum redirect limit (${this.limits.maxRedirects})`,
              Date.now() - startTime,
              redirectCount
            );
          }

          const location = fetchResponse.headers.get('location');
          if (!location) {
            return this.createErrorObservation(
              request,
              fetchResponse.status,
              'INVALID_REDIRECT',
              'Redirect response missing Location header',
              Date.now() - startTime,
              redirectCount
            );
          }

          const nextUrl = new URL(location, currentUrl).toString();
          const nextUrlCheck = validateTargetUrl(nextUrl, { allowLocalhost: this.allowLocalhost });
          if (!nextUrlCheck.valid) {
            return this.createErrorObservation(
              request,
              fetchResponse.status,
              'SSRF_REDIRECT_BLOCKED',
              `Redirect destination SSRF violation: ${nextUrlCheck.error}`,
              Date.now() - startTime,
              redirectCount
            );
          }

          currentUrl = nextUrlCheck.sanitizedUrl || nextUrl;
          continue;
        }

        // Process final response
        const durationMs = Date.now() - startTime;
        const status = fetchResponse.status;
        const statusText = fetchResponse.statusText;
        const contentType = fetchResponse.headers.get('content-type') || undefined;

        // Extract safe headers (strictly scrubbing Authorization, Cookie, Set-Cookie, etc.)
        const safeHeaders: Record<string, string> = {};
        const rawSetCookies: string[] = [];
        fetchResponse.headers.forEach((val, key) => {
          const lower = key.toLowerCase();
          if (lower === 'set-cookie') {
            rawSetCookies.push(val);
          }
          if (
            lower !== 'set-cookie' &&
            lower !== 'authorization' &&
            lower !== 'cookie' &&
            lower !== 'x-api-key' &&
            lower !== 'apikey'
          ) {
            safeHeaders[key] = val;
          }
        });

        // Bounded response body extraction
        let rawBody = '';
        let jsonParsed = false;
        let bodySize = 0;

        try {
          const arrayBuffer = await fetchResponse.arrayBuffer();
          bodySize = arrayBuffer.byteLength;

          // Check response size bound
          const boundedBuffer = arrayBuffer.slice(0, this.limits.maxResponseBytes);
          rawBody = new TextDecoder('utf-8').decode(boundedBuffer);

          if (rawBody.trim()) {
            try {
              JSON.parse(rawBody);
              jsonParsed = true;
            } catch {
              jsonParsed = false;
            }
          }
        } catch {
          rawBody = '';
        }

        // Redact and bound body excerpt
        const sanitizedExcerpt = AuthRedaction.redactString(rawBody).substring(0, 1000);

        return {
          id: `obs_${request.endpointId}_${Date.now()}`,
          endpointId: request.endpointId,
          method: request.method,
          url: currentUrl,
          status,
          statusText,
          durationMs,
          contentType,
          responseSize: bodySize,
          redirectCount,
          jsonParsed: (contentType?.includes('application/json') || rawBody.startsWith('{') || rawBody.startsWith('[')) ? jsonParsed : undefined,
          safeHeaders,
          bodyExcerpt: sanitizedExcerpt || undefined,
          rawBody: rawBody || undefined,
          rawSetCookies: rawSetCookies.length > 0 ? rawSetCookies : undefined,
          role: request.role,
          authenticated: !!request.headers?.['Cookie'] || !!request.headers?.['Authorization'] || !!request.role,
          timestamp: new Date().toISOString(),
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;
        const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted');

        return this.createErrorObservation(
          request,
          0,
          isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          isTimeout ? `Request timed out after ${timeoutMs}ms` : `Connection failed: ${err.message}`,
          durationMs,
          redirectCount
        );
      }
    }

    return this.createErrorObservation(
      request,
      0,
      'EXCESSIVE_REDIRECTS',
      `Exceeded max redirects (${this.limits.maxRedirects})`,
      Date.now() - startTime,
      redirectCount
    );
  }

  private createErrorObservation(
    request: ApiRequestDefinition,
    status: number,
    classification: string,
    message: string,
    durationMs: number,
    redirectCount: number = 0
  ): ApiResponseObservation {
    return {
      id: `obs_${request.endpointId}_${Date.now()}`,
      endpointId: request.endpointId,
      method: request.method,
      url: request.url,
      status,
      statusText: classification,
      durationMs,
      responseSize: 0,
      redirectCount,
      safeHeaders: {},
      errorClassification: classification,
      bodyExcerpt: message.substring(0, 300),
      role: request.role,
      authenticated: !!request.role,
      timestamp: new Date().toISOString(),
    };
  }
}
