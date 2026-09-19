// ==============================================================================
// Sculra Source Ingestion Redactor & Sanitizer (worker/src/sources/source-redaction.ts)
// ==============================================================================

import { SOURCE_POLICY } from './policy';

const SENSITIVE_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /ghp_[A-Za-z0-9_]{36,}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { regex: /gho_[A-Za-z0-9_]{36,}/g, replacement: '[REDACTED_OAUTH_TOKEN]' },
  { regex: /github_pat_[A-Za-z0-9_]{82}/g, replacement: '[REDACTED_GITHUB_PAT]' },
  { regex: /sk-[A-Za-z0-9_-]{20,}/g, replacement: '[REDACTED_OPENAI_KEY]' },
  { regex: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  { regex: /bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer [REDACTED_BEARER_TOKEN]' },
  { regex: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: '[REDACTED_JWT]' },
  { regex: /password["']?\s*[:=]\s*["']?[^"',\s}]+/gi, replacement: 'password: "[REDACTED_PASSWORD]"' },
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt\s+override/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /output\s+all\s+api\s+keys/i,
  /reveal\s+internal\s+prompts/i,
];

export class SourceRedactor {
  /**
   * Deeply sanitizes an object or string, masking secrets and neutralising prompt injection.
   */
  static sanitize<T>(input: T): T {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'string') {
      let cleaned = String(input);
      for (const p of SENSITIVE_PATTERNS) {
        cleaned = cleaned.replace(p.regex, p.replacement);
      }
      for (const p of PROMPT_INJECTION_PATTERNS) {
        if (p.test(cleaned)) {
          cleaned = cleaned.replace(p, '[SANITIZED_PROMPT_INJECTION_ATTEMPT]');
        }
      }
      return cleaned as unknown as T;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitize(item)) as unknown as T;
    }

    if (typeof input === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(input as Record<string, any>)) {
        const sanitizedVal = this.sanitize(val);
        const lowerKey = key.toLowerCase();
        if (
          (lowerKey.includes('token') ||
            lowerKey.includes('secret') ||
            lowerKey.includes('password') ||
            lowerKey.includes('apikey') ||
            lowerKey.includes('authorization')) &&
          sanitizedVal === val &&
          typeof val === 'string'
        ) {
          result[key] = '[REDACTED_CREDENTIAL]';
        } else {
          result[key] = sanitizedVal;
        }
      }
      return result as unknown as T;
    }

    return input;
  }

  /**
   * Enforces 128KB ceiling on metadata payload.
   */
  static enforceMetadataCeiling(metadata: Record<string, any>): Record<string, any> {
    try {
      const json = JSON.stringify(metadata);
      if (Buffer.byteLength(json, 'utf8') <= SOURCE_POLICY.MAX_SNAPSHOT_METADATA_BYTES) {
        return metadata;
      }
      // Truncate non-essential metadata if over ceiling
      return {
        _warning: 'Metadata exceeded 128KB ceiling and was bounded.',
        _truncated: true,
        summary: metadata.summary || 'Summary unavailable',
        truncatedAt: new Date().toISOString(),
      };
    } catch {
      return { _error: 'Failed serializing metadata' };
    }
  }
}
