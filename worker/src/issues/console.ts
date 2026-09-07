// ==============================================================================
// Sculra Console Error Intelligence & Normalization (worker/src/issues/console.ts)
// ==============================================================================

import { CapturedConsoleError } from '../types';

export interface NormalizedConsoleError {
  rawMessage: string;
  signature: string;
  category: 'runtime_exception' | 'framework_exception' | 'application_error' | 'warning' | 'fixture_error';
  isBugCandidate: boolean;
}

/**
 * Normalizes console error text by stripping timestamps, random UUIDs, line/column numbers,
 * memory pointers, and ephemeral port numbers to produce a stable deduplication signature.
 */
export function normalizeConsoleSignature(rawMessage: string): string {
  if (!rawMessage) return '';
  return rawMessage
    .trim()
    .toLowerCase()
    .replace(/0x[a-f0-9]+/gi, '0x***')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'uuid-***')
    .replace(/\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(\.\d+)?z?\b/gi, 'timestamp-***')
    .replace(/:\d{2,5}\b/g, ':port')
    .replace(/:\d+:\d+/g, ':line:col')
    .replace(/\b(webpack-internal|turbopack):\/\/\S+/g, 'chunk-src')
    .replace(/\s+/g, ' ');
}

/**
 * Classifies a console error into a structured category and determines whether it represents
 * a functional bug candidate.
 */
export function classifyConsoleError(error: CapturedConsoleError): NormalizedConsoleError {
  const msg = error.message || '';
  const msgLower = msg.toLowerCase();
  const signature = normalizeConsoleSignature(msg);

  // 1. Fixture test errors
  if (msgLower.includes('intentional runtime error in fixture') || msgLower.includes('sculra intentional')) {
    return {
      rawMessage: msg,
      signature,
      category: 'fixture_error',
      isBugCandidate: true,
    };
  }

  // 2. Warnings (React dev warnings, deprecations)
  if (
    msgLower.startsWith('warning:') ||
    msgLower.includes('react-hooks/rules-of-hooks') ||
    msgLower.includes('deprecated')
  ) {
    return {
      rawMessage: msg,
      signature,
      category: 'warning',
      isBugCandidate: false,
    };
  }

  // 3. Framework exceptions (Hydration, Chunk Load)
  if (
    msgLower.includes('hydration failed') ||
    msgLower.includes('text content did not match') ||
    msgLower.includes('loading chunk') ||
    msgLower.includes('minified react error')
  ) {
    return {
      rawMessage: msg,
      signature,
      category: 'framework_exception',
      isBugCandidate: true,
    };
  }

  // 4. Runtime Javascript exceptions
  if (
    msgLower.includes('uncaught') ||
    msgLower.includes('typeerror') ||
    msgLower.includes('referenceerror') ||
    msgLower.includes('syntaxerror') ||
    msgLower.includes('rangeerror') ||
    msgLower.includes('cannot read property') ||
    msgLower.includes('cannot read properties') ||
    msgLower.includes('is not a function') ||
    msgLower.includes('is not defined')
  ) {
    return {
      rawMessage: msg,
      signature,
      category: 'runtime_exception',
      isBugCandidate: true,
    };
  }

  // 5. Default application error
  return {
    rawMessage: msg,
    signature,
    category: 'application_error',
    isBugCandidate: true,
  };
}
