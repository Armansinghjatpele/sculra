// ==============================================================================
// Sculra Notification Redaction & Secret Sanitization
// (worker/src/notifications/redaction.ts)
// ==============================================================================

import { NOTIFICATION_LIMITS } from './policy';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /bearer/i,
  /credential/i,
  /private[_-]?key/i,
  /signature/i,
  /cookie/i,
  /session/i,
];

export class NotificationRedactor {
  /**
   * Redacts known token patterns and passwords from raw strings.
   */
  public static maskSecrets(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;
    sanitized = sanitized.replace(/(ghp_[A-Za-z0-9_]{20,})/g, '[REDACTED_GITHUB_TOKEN]');
    sanitized = sanitized.replace(/(gho_[A-Za-z0-9_]{20,})/g, '[REDACTED_OAUTH_TOKEN]');
    sanitized = sanitized.replace(/(github_pat_[A-Za-z0-9_]{20,})/g, '[REDACTED_GITHUB_PAT]');
    sanitized = sanitized.replace(/(sk-[A-Za-z0-9_-]{20,})/g, '[REDACTED_OPENAI_KEY]');
    sanitized = sanitized.replace(/(AKIA[0-9A-Z]{16})/g, '[REDACTED_AWS_KEY]');
    sanitized = sanitized.replace(/(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, '[REDACTED_JWT]');
    sanitized = sanitized.replace(/(bearer\s+[A-Za-z0-9\-._~+/]+=*)/gi, 'Bearer [REDACTED_BEARER]');
    sanitized = sanitized.replace(/(password\s*[:=]\s*["']?)([^"' \n\r\t]+)(["']?)/gi, '$1[REDACTED_PASSWORD]$3');
    sanitized = sanitized.replace(/(webhook_secret\s*[:=]\s*["']?)([^"' \n\r\t]+)(["']?)/gi, '$1[REDACTED_SECRET]$3');

    return sanitized;
  }

  /**
   * Deeply sanitizes an object, masking sensitive keys and string values.
   */
  public static deepSanitize<T>(input: T): T {
    if (input === null || input === undefined) return input;

    if (typeof input === 'string') {
      return this.maskSecrets(input) as unknown as T;
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
   * Alias for deepSanitize specifically for metadata payloads.
   */
  public static redactMetadata<T>(input: T): T {
    return this.deepSanitize(input);
  }

  /**
   * Bounds metadata to the 64KB ceiling, truncating if necessary.
   */
  public static boundMetadata(metadata: Record<string, any> = {}): Record<string, any> {
    const sanitized = this.deepSanitize(metadata);
    const jsonString = JSON.stringify(sanitized);

    if (Buffer.byteLength(jsonString, 'utf8') <= NOTIFICATION_LIMITS.MAX_EVENT_METADATA_BYTES) {
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
      if (Buffer.byteLength(JSON.stringify(truncated), 'utf8') > NOTIFICATION_LIMITS.MAX_EVENT_METADATA_BYTES - 1024) {
        break;
      }
    }

    return truncated;
  }
}
