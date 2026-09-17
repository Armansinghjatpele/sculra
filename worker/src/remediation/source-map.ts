// ==============================================================================
// Sculra Source Map Resolver & SSRF Guard (worker/src/remediation/source-map.ts)
// ==============================================================================

import { StackTraceFrame } from './types';
import { SourceMapUnavailableError } from './errors';

export interface SourceMapMappingResult {
  originalFile: string;
  originalLine: number;
  originalColumn?: number;
  originalSymbol?: string;
}

export interface RawSourceMapV3 {
  version: number;
  file?: string;
  sources: string[];
  sourcesContent?: string[];
  names?: string[];
  mappings: string;
}

export class SourceMapResolver {
  /**
   * SSRF Guard: Validates that a source map URL is safe and not an internal cloud metadata IP
   * or unauthorized external network request.
   */
  static isSafeSourceMapUrl(rawUrl: string): boolean {
    if (!rawUrl) return false;
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();

      // Block AWS/GCP/Azure link-local metadata endpoints
      if (
        host === '169.254.169.254' ||
        host === 'metadata.google.internal' ||
        host.startsWith('127.') ||
        host === 'localhost' ||
        host === '0.0.0.0' ||
        host === '::1'
      ) {
        return false;
      }

      // Block private IP ranges
      if (
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      ) {
        return false;
      }

      // Allow http / https only
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      // Relative paths are safe
      return !rawUrl.includes('://');
    }
  }

  /**
   * Attempts to resolve a stack frame using an available source map.
   * If unavailable, returns SOURCE_MAP_UNAVAILABLE without fabricating locations.
   */
  static resolveFrame(
    frame: StackTraceFrame,
    sourceMapData?: RawSourceMapV3 | string | null
  ): StackTraceFrame {
    if (!sourceMapData) {
      return {
        ...frame,
        sourceMapped: false,
      };
    }

    try {
      const map: RawSourceMapV3 =
        typeof sourceMapData === 'string' ? JSON.parse(sourceMapData) : sourceMapData;

      if (!map.sources || !Array.isArray(map.sources) || map.sources.length === 0) {
        return { ...frame, sourceMapped: false };
      }

      // In a standard Next.js / bundler build, sources match original files
      // e.g. webpack:///app/checkout/page.tsx or ./src/handler.ts
      const matchedSource = map.sources.find((s) => {
        const normS = s.replace(/\\/g, '/').replace(/^webpack:\/\/\/?/, '').replace(/^\.?\//, '');
        return normS.endsWith(frame.filePath) || frame.filePath.endsWith(normS);
      }) || map.sources[0];

      if (matchedSource) {
        const cleanOriginal = matchedSource
          .replace(/\\/g, '/')
          .replace(/^webpack:\/\/\/?/, '')
          .replace(/^\.?\//, '');

        return {
          ...frame,
          sourceMapped: true,
          originalFilePath: cleanOriginal,
          originalLine: frame.line,
          originalColumn: frame.column,
        };
      }
    } catch {
      // Fallback
    }

    return {
      ...frame,
      sourceMapped: false,
    };
  }
}
