// ==============================================================================
// Sculra Stack Trace Parser & Normalizer (worker/src/remediation/stack-trace.ts)
// ==============================================================================

import { StackTraceFrame } from './types';
import { redactSecrets } from './redaction';

/**
 * Common patterns for stack trace lines:
 * 1. Node V8: "    at functionName (file.ts:10:20)" or "    at file.ts:10:20"
 * 2. Async Node: "    at async functionName (file.ts:10:20)"
 * 3. Browser Firefox / Safari: "functionName@https://.../file.js:10:20"
 * 4. Webpack / Turbopack: "    at Object.<anonymous> (webpack-internal:///(app-pages)/./app/api/checkout/route.ts:12:34)"
 */
const V8_FRAME_REGEX = /^\s*at\s+(?:async\s+)?(?:([^\s(]+)\s+\((.+):(\d+):(\d+)\)|(.+):(\d+):(\d+))\s*$/;
const WEBPACK_REGEX = /webpack-internal:\/\/\(?([^)]+)\)?\/\.?\/?(.*)/;
const TURBOPACK_REGEX = /\[turbopack\]\s*\(rsc\)\/\.?\/?(.*)/;
const SAFARI_FIREFOX_FRAME_REGEX = /^\s*(?:([^@]*)@)?(.+):(\d+):(\d+)\s*$/;

export class StackTraceParser {
  /**
   * Parses an error stack trace string into structured StackTraceFrame objects.
   */
  static parse(rawStackTrace: string): StackTraceFrame[] {
    if (!rawStackTrace || typeof rawStackTrace !== 'string') {
      return [];
    }

    const cleanTrace = redactSecrets(rawStackTrace);
    const lines = cleanTrace.split('\n');
    const frames: StackTraceFrame[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Skip non-frame header lines like "Error: foo" or "TypeError: bar"
      if (!line.startsWith('at ') && !line.includes('@') && !line.includes(':')) {
        continue;
      }

      const frame = this.parseFrameLine(rawLine);
      if (frame) {
        frames.push(frame);
      }
    }

    return frames;
  }

  /**
   * Parses an individual stack trace line.
   */
  static parseFrameLine(rawLine: string): StackTraceFrame | null {
    const trimmed = rawLine.trim();

    // 1. Try V8 / Node format
    const v8Match = trimmed.match(V8_FRAME_REGEX);
    if (v8Match) {
      const fnName = v8Match[1] || undefined;
      const rawPath = v8Match[2] || v8Match[5];
      const lineNum = parseInt(v8Match[3] || v8Match[6], 10);
      const colNum = parseInt(v8Match[4] || v8Match[7], 10);

      const normalizedPath = this.normalizeFilePath(rawPath);
      return {
        filePath: normalizedPath,
        line: lineNum,
        column: colNum,
        functionName: fnName,
        raw: trimmed,
        isRuntimeLocation: true,
      };
    }

    // 2. Try Safari / Firefox format: fn@url:line:col
    const safariMatch = trimmed.match(SAFARI_FIREFOX_FRAME_REGEX);
    if (safariMatch && (trimmed.includes('@') || trimmed.includes('/'))) {
      const fnName = safariMatch[1] ? safariMatch[1].trim() : undefined;
      const rawPath = safariMatch[2];
      const lineNum = parseInt(safariMatch[3], 10);
      const colNum = parseInt(safariMatch[4], 10);

      const normalizedPath = this.normalizeFilePath(rawPath);
      return {
        filePath: normalizedPath,
        line: lineNum,
        column: colNum,
        functionName: fnName,
        raw: trimmed,
        isRuntimeLocation: true,
      };
    }

    return null;
  }

  /**
   * Normalizes URLs, bundle references, and webpack wrappers into repo-relative file paths.
   */
  static normalizeFilePath(rawPath: string): string {
    if (!rawPath) return '';
    let p = rawPath.trim();

    // Handle webpack-internal URLs: webpack-internal:///(app-pages-browser)/./app/page.tsx
    const wpMatch = p.match(WEBPACK_REGEX);
    if (wpMatch) {
      p = wpMatch[2] || wpMatch[1];
    }

    // Handle turbopack URLs
    const tpMatch = p.match(TURBOPACK_REGEX);
    if (tpMatch) {
      p = tpMatch[1];
    }

    // Strip URL protocols and hostnames (e.g. http://localhost:3000/_next/static/...)
    if (p.startsWith('http://') || p.startsWith('https://')) {
      try {
        const parsed = new URL(p);
        p = parsed.pathname;
      } catch {
        // Leave as is
      }
    }

    // Strip leading /_next/static/chunks/ or static/
    p = p.replace(/^\/_next\/static\/(chunks\/)?/, '');
    p = p.replace(/^static\/(chunks\/)?/, '');

    // Normalize slashes
    p = p.replace(/\\/g, '/');

    // Remove leading ./ or /
    p = p.replace(/^\.?\//, '');

    return p;
  }
}
