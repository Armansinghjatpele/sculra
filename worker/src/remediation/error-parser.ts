// ==============================================================================
// Sculra Error Parser & Signature Normalizer (worker/src/remediation/error-parser.ts)
// ==============================================================================

import { redactSecrets } from './redaction';

export interface ParsedErrorDetails {
  errorType: string;
  message: string;
  mentionedFiles: string[];
  mentionedSymbols: string[];
  normalizedSignature: string;
}

export class ErrorParser {
  /**
   * Parses raw error message or signature into structured error details.
   */
  static parse(rawError: string): ParsedErrorDetails {
    if (!rawError) {
      return {
        errorType: 'UnknownError',
        message: '',
        mentionedFiles: [],
        mentionedSymbols: [],
        normalizedSignature: '',
      };
    }

    const clean = redactSecrets(rawError).trim();
    const typeMatch = clean.match(/^([A-Z][a-zA-Z0-9_]*Error|[A-Z][a-zA-Z0-9_]*Exception):\s*(.*)/s);

    const errorType = typeMatch ? typeMatch[1] : 'Error';
    const message = typeMatch ? typeMatch[2].trim() : clean;

    // Detect mentioned files (e.g. 'in src/utils/math.ts' or 'file:///.../test.ts')
    const fileMatches = clean.match(/(?:[a-zA-Z0-9_\-./]+\.(?:ts|tsx|js|jsx|json|mjs|cjs))/gi) || [];
    const mentionedFiles = Array.from(new Set(fileMatches.filter((f) => !f.includes('://'))));

    // Detect mentioned symbols (e.g. 'cannot read property "x" of undefined' or 'function foo')
    const symbolMatches = clean.match(/['"`]([a-zA-Z0-9_$.]+)['"`]/g) || [];
    const mentionedSymbols = Array.from(
      new Set(
        symbolMatches
          .map((s) => s.replace(/['"`]/g, '').trim())
          .filter((s) => s.length > 1 && !s.includes(' '))
      )
    );

    // Stable signature: lowercased, numbers replaced with placeholders
    const normalizedSignature = clean
      .toLowerCase()
      .replace(/0x[a-f0-9]+/gi, '0x***')
      .replace(/\b\d+\b/g, '#')
      .replace(/\s+/g, ' ');

    return {
      errorType,
      message,
      mentionedFiles,
      mentionedSymbols,
      normalizedSignature,
    };
  }
}
