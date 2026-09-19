// ==============================================================================
// Sculra Observability Redaction & Prompt Injection Sanitizer
// (worker/src/observability/redaction.ts)
// ==============================================================================

import { SENSITIVE_KEY_PATTERNS, SENSITIVE_VALUE_PATTERNS, OBSERVABILITY_POLICY } from './policy';

export class ObservabilityRedactor {
  /**
   * Redacts sensitive credentials, tokens, and keys from raw strings.
   */
  public static maskSecrets(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;

    // Redact known token signatures
    sanitized = sanitized.replace(/(ghp_[A-Za-z0-9_]{20,})/g, '[REDACTED_GITHUB_TOKEN]');
    sanitized = sanitized.replace(/(gho_[A-Za-z0-9_]{20,})/g, '[REDACTED_OAUTH_TOKEN]');
    sanitized = sanitized.replace(/(github_pat_[A-Za-z0-9_]{20,})/g, '[REDACTED_GITHUB_PAT]');
    sanitized = sanitized.replace(/(sk-[A-Za-z0-9_-]{20,})/g, '[REDACTED_OPENAI_KEY]');
    sanitized = sanitized.replace(/(AKIA[0-9A-Z]{16})/g, '[REDACTED_AWS_KEY]');
    sanitized = sanitized.replace(/(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, '[REDACTED_JWT]');
    sanitized = sanitized.replace(/(bearer\s+[A-Za-z0-9\-._~+/]+=*)/gi, 'Bearer [REDACTED_BEARER]');
    sanitized = sanitized.replace(/(password\s*[:=]\s*["']?)([^"' \n\r\t]+)(["']?)/gi, '$1[REDACTED_PASSWORD]$3');

    return sanitized;
  }

  /**
   * Neutralizes prompt injection patterns in untrusted logs or comments.
   */
  public static sanitizePromptInjection(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;

    // Neutralize common prompt injection directives
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, ''); // strip HTML comments
    sanitized = sanitized.replace(/\b(ignore\s+all\s+(previous|prior)\s+instructions?)\b/gi, '[NEUTRALIZED_DIRECTIVE]');
    sanitized = sanitized.replace(/\b(system\s+override)\b/gi, '[NEUTRALIZED_OVERRIDE]');
    sanitized = sanitized.replace(/\b(you\s+are\s+now\s+in\s+developer\s+mode)\b/gi, '[NEUTRALIZED_JAILBREAK]');

    return sanitized;
  }

  /**
   * Deeply sanitizes and masks any object, array, or primitive.
   */
  public static deepSanitize<T>(input: T): T {
    if (input === null || input === undefined) return input;

    if (typeof input === 'string') {
      return this.sanitizePromptInjection(this.maskSecrets(input)) as unknown as T;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.deepSanitize(item)) as unknown as T;
    }

    if (typeof input === 'object') {
      const sanitizedObj: Record<string, any> = {};

      for (const [key, value] of Object.entries(input)) {
        const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
        if (isSensitiveKey) {
          sanitizedObj[key] = '[REDACTED_SENSITIVE_FIELD]';
        } else {
          sanitizedObj[key] = this.deepSanitize(value);
        }
      }

      return sanitizedObj as T;
    }

    return input;
  }

  /**
   * Binds metadata to the 64KB ceiling, truncating if necessary.
   */
  public static boundMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = this.deepSanitize(metadata) || {};
    const jsonString = JSON.stringify(sanitized);

    if (Buffer.byteLength(jsonString, 'utf8') <= OBSERVABILITY_POLICY.MAX_METADATA_BYTES) {
      return sanitized;
    }

    // Truncate non-essential metadata keys if exceeding 64KB
    const truncated: Record<string, any> = {
      _truncated: true,
      _originalBytes: Buffer.byteLength(jsonString, 'utf8'),
      summary: sanitized.summary || 'Metadata truncated due to 64KB ceiling',
    };

    for (const [key, value] of Object.entries(sanitized)) {
      truncated[key] = typeof value === 'string' ? value.slice(0, 500) + '... [TRUNCATED]' : value;
      if (Buffer.byteLength(JSON.stringify(truncated), 'utf8') > OBSERVABILITY_POLICY.MAX_METADATA_BYTES - 1024) {
        break;
      }
    }

    return truncated;
  }
}
