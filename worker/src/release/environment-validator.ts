// ==============================================================================
// Sculra Environment Validator & SSRF Protection (worker/src/release/environment-validator.ts)
// ==============================================================================

import { BoundedHttpClient } from '../sources/source-limits';
import { validateTargetUrl } from '../security/ssrf';
import { EnvironmentHealthStatus } from './types';
import { RELEASE_POLICY } from './policy';

export interface EnvironmentValidationResult {
  valid: boolean;
  healthStatus: EnvironmentHealthStatus;
  httpStatus?: number;
  latencyMs?: number;
  finalUrl?: string;
  error?: string;
  checkedAt: string;
}

export class EnvironmentValidator {
  /**
   * Validates target environment base URL against SSRF policy and tests live reachability.
   * Reuses the production BoundedHttpClient with manual hop-by-hop redirect verification.
   */
  public static async validateEnvironmentUrl(
    baseUrl: string,
    options: {
      allowLocalhost?: boolean;
      timeoutMs?: number;
      skipProbe?: boolean;
    } = {}
  ): Promise<EnvironmentValidationResult> {
    const checkedAt = new Date().toISOString();

    if (!baseUrl || typeof baseUrl !== 'string') {
      return {
        valid: false,
        healthStatus: 'MISCONFIGURED',
        error: 'Environment base URL is missing or empty.',
        checkedAt,
      };
    }

    const trimmed = baseUrl.trim();

    // 1. Structural URL and scheme parsing
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return {
        valid: false,
        healthStatus: 'MISCONFIGURED',
        error: `Invalid URL format: "${trimmed}". Must include http:// or https://.`,
        checkedAt,
      };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        healthStatus: 'MISCONFIGURED',
        error: `Unsupported protocol "${parsed.protocol}". Only http: and https: are allowed.`,
        checkedAt,
      };
    }

    // 2. Strict SSRF Defense Check on root target
    const ssrfCheck = validateTargetUrl(trimmed, { allowLocalhost: options.allowLocalhost ?? false });
    if (!ssrfCheck.valid) {
      return {
        valid: false,
        healthStatus: 'UNREACHABLE',
        error: `SSRF Violation: ${ssrfCheck.error || 'Target blocked by workspace SSRF security shield.'}`,
        checkedAt,
      };
    }

    if (options.skipProbe) {
      return {
        valid: true,
        healthStatus: 'HEALTHY',
        checkedAt,
      };
    }

    // 3. Bounded HTTP Probe with hop-by-hop redirect inspection
    const timeoutMs = options.timeoutMs ?? RELEASE_POLICY.DEFAULT_VALIDATION_TIMEOUT_MS;

    try {
      const fetchResult = await BoundedHttpClient.safeFetch(trimmed, {
        timeoutMs,
        maxBytes: RELEASE_POLICY.MAX_RESPONSE_BYTES,
        allowLocalhost: options.allowLocalhost ?? false,
      });

      let healthStatus: EnvironmentHealthStatus = 'HEALTHY';
      if (fetchResult.status === 401 || fetchResult.status === 403) {
        healthStatus = 'AUTH_REQUIRED';
      } else if (fetchResult.status >= 400) {
        healthStatus = 'DEGRADED';
      }

      return {
        valid: true,
        healthStatus,
        httpStatus: fetchResult.status,
        latencyMs: fetchResult.durationMs,
        finalUrl: fetchResult.finalUrl,
        checkedAt,
      };
    } catch (err: any) {
      const msg = err.message || '';
      let healthStatus: EnvironmentHealthStatus = 'UNREACHABLE';

      if (msg.includes('SSRF') || msg.includes('Blocked')) {
        healthStatus = 'UNREACHABLE';
      } else if (msg.includes('timeout') || msg.includes('aborted')) {
        healthStatus = 'UNREACHABLE';
      } else if (msg.includes('policy limit') || msg.includes('redirect limit')) {
        healthStatus = 'DEGRADED';
      }

      return {
        valid: false,
        healthStatus,
        error: msg || 'Failed connecting to environment target.',
        checkedAt,
      };
    }
  }
}
