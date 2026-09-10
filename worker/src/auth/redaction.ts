// ==============================================================================
// Sculra Authentication & Telemetry Redaction Engine (worker/src/auth/redaction.ts)
// ==============================================================================
// Enforces strict, deterministic redaction of credentials, cookies, tokens, and authorization state.

export const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /api[_-]?key/i,
  /apikey/i,
  /otp/i,
  /mfa/i,
  /jwt/i,
  /bearer/i,
  /private[_-]?key/i,
  /credential/i,
  /code/i,
];

export const SENSITIVE_VALUE_PATTERNS = [
  // Authorization header with token
  /Authorization\s*:\s*(?:Bearer\s+)?[^\s,;]+/gi,
  // Bearer tokens
  /Bearer\s+[^\s,;]+/gi,
  // JWT tokens (3 parts)
  /eyJ[a-zA-Z0-9_\-.~+/]+\.[a-zA-Z0-9_\-.~+/]+\.[a-zA-Z0-9_\-.~+/]+/g,
  // Common key prefixes
  /sk_live_[a-zA-Z0-9]{16,}/g,
  /sk_test_[a-zA-Z0-9]{16,}/g,
  /sbp_[a-zA-Z0-9]{16,}/g,
  // Generic key-value assignment in query strings or JSON strings
  /(?:password|passwd|secret|token|apiKey|api_key|code)\s*[:=]\s*["']?([^"'\s&]+)["']?/gi,
];

export class AuthRedaction {
  /**
   * Checks if a key name matches any known sensitive property pattern.
   */
  public static isSensitiveKey(key: string): boolean {
    if (!key) return false;
    return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
  }

  /**
   * Redacts sensitive patterns from a raw string.
   */
  public static redactString(input: string | null | undefined): string {
    if (!input) return '';
    let result = String(input);

    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      result = result.replace(pattern, (match, p1) => {
        if (p1 !== undefined) {
          return match.replace(p1, '[REDACTED]');
        }
        return '[REDACTED]';
      });
    }

    return result;
  }

  /**
   * Deeply sanitizes an arbitrary object or array, stripping sensitive keys and values.
   */
  public static sanitizeObject<T = any>(obj: T, depth: number = 0): T {
    if (depth > 10 || obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.redactString(obj) as any;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, depth + 1)) as any;
    }

    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj as Record<string, any>)) {
      if (this.isSensitiveKey(k)) {
        clean[k] = '[REDACTED]';
      } else if (typeof v === 'string') {
        clean[k] = this.redactString(v);
      } else if (typeof v === 'object' && v !== null) {
        clean[k] = this.sanitizeObject(v, depth + 1);
      } else {
        clean[k] = v;
      }
    }

    return clean as T;
  }

  public static redactObject<T = any>(obj: T, depth: number = 0): T {
    return this.sanitizeObject(obj, depth);
  }

  /**
   * Redacts a single header value if the header name is sensitive.
   */
  public static redactHeader(key: string, value: string): string {
    const lowerKey = key.toLowerCase();
    if (this.isSensitiveKey(key) || this.isSensitiveKey(lowerKey)) {
      return '[REDACTED]';
    }
    return this.redactString(value);
  }

  /**
   * Sanitizes HTTP headers, stripping Cookie, Authorization, and custom session tokens.
   */
  public static sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      const lowerKey = k.toLowerCase();
      if (this.isSensitiveKey(k) || this.isSensitiveKey(lowerKey)) {
        sanitized[lowerKey] = '[REDACTED]';
      } else {
        sanitized[lowerKey] = this.redactString(v);
      }
    }
    return sanitized;
  }

  public static redactHeaders(headers: Record<string, string>): Record<string, string> {
    return this.sanitizeHeaders(headers);
  }

  /**
   * Redacts sensitive query parameters from a URL.
   */
  public static redactUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    try {
      const url = new URL(rawUrl);
      for (const key of Array.from(url.searchParams.keys())) {
        if (this.isSensitiveKey(key)) {
          url.searchParams.set(key, '[REDACTED]');
        }
      }
      return url.toString();
    } catch {
      return this.redactString(rawUrl);
    }
  }
}
