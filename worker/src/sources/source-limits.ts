// ==============================================================================
// Sculra Bounded HTTP Fetch & Redirect Inspector (worker/src/sources/source-limits.ts)
// ==============================================================================

import { SOURCE_POLICY } from './policy';
import { validateTargetUrl } from '../security/ssrf';
import { SourceSSRFError } from './source-errors';

export interface BoundedFetchResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  finalUrl: string;
  redirectsFollowed: number;
  durationMs: number;
}

export class BoundedHttpClient {
  /**
   * Performs an SSRF-protected, bounded HTTP request with manual redirect checking.
   */
  static async safeFetch(
    initialUrl: string,
    options: {
      timeoutMs?: number;
      maxBytes?: number;
      allowLocalhost?: boolean;
      headers?: Record<string, string>;
      method?: string;
    } = {}
  ): Promise<BoundedFetchResult> {
    const timeoutMs = options.timeoutMs ?? SOURCE_POLICY.DEFAULT_VALIDATION_TIMEOUT_MS;
    const maxBytes = options.maxBytes ?? SOURCE_POLICY.MAX_RESPONSE_BYTES;
    const allowLocalhost = options.allowLocalhost ?? false;

    let currentUrl = initialUrl;
    let redirectsCount = 0;
    const startTime = Date.now();

    while (redirectsCount <= SOURCE_POLICY.MAX_REDIRECT_HOPS) {
      // 1. SSRF Validation on currentUrl
      const ssrfCheck = validateTargetUrl(currentUrl, { allowLocalhost });
      if (!ssrfCheck.valid) {
        throw new SourceSSRFError(currentUrl, ssrfCheck.error || 'Blocked by SSRF policy');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(currentUrl, {
          method: options.method || 'GET',
          headers: {
            'User-Agent': 'Sculra-Connection-Intelligence/1.0',
            ...(options.headers || {}),
          },
          redirect: 'manual', // Enforce manual handling to validate every redirect hop
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Check for redirect status (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const location = res.headers.get('location');
          if (!location) {
            throw new Error(`Redirect HTTP ${res.status} returned without Location header.`);
          }

          redirectsCount++;
          if (redirectsCount > SOURCE_POLICY.MAX_REDIRECT_HOPS) {
            throw new Error(`Exceeded maximum redirect limit of ${SOURCE_POLICY.MAX_REDIRECT_HOPS} hops.`);
          }

          // Resolve relative redirect against currentUrl
          currentUrl = new URL(location, currentUrl).toString();
          continue; // Loop and re-evaluate SSRF on new destination
        }

        // Bounded body consumption
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > maxBytes) {
          throw new Error(
            `Response size ${arrayBuffer.byteLength} bytes exceeds policy limit of ${maxBytes} bytes.`
          );
        }

        const body = Buffer.from(arrayBuffer).toString('utf8');
        const headers: Record<string, string> = {};
        res.headers.forEach((val, key) => {
          headers[key.toLowerCase()] = val;
        });

        return {
          status: res.status,
          statusText: res.statusText,
          headers,
          body,
          finalUrl: currentUrl,
          redirectsFollowed: redirectsCount,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          throw new Error(`Connection timed out after ${timeoutMs}ms.`);
        }
        throw err;
      }
    }

    throw new Error(`Exceeded redirect limit of ${SOURCE_POLICY.MAX_REDIRECT_HOPS} hops.`);
  }
}
