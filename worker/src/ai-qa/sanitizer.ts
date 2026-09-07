// ==============================================================================
// Sculra AI QA Context Sanitizer & Security Defense (worker/src/ai-qa/sanitizer.ts)
// ==============================================================================
// Treats all browser-derived DOM data, text, URLs, and errors as UNTRUSTED DATA.
// Enforces prompt-injection neutralization and secret redaction.

const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // JWT tokens (eyJ...)
  { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, replacement: '[REDACTED_JWT]' },
  // Bearer tokens
  { pattern: /Bearer\s+[a-zA-Z0-9_\-.~+/]+=*/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  // Supabase / Clerk service or anon keys
  { pattern: /sbp_[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_SUPABASE_KEY]' },
  { pattern: /sk_live_[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_SECRET_KEY]' },
  { pattern: /pk_live_[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_PUBLIC_KEY]' },
  // Generic API keys and hex secrets
  { pattern: /(api[_-]?key|secret|token|password|auth|credential)\s*[:=]\s*["']?([a-zA-Z0-9_\-]{8,})["']?/gi, replacement: '$1: "[REDACTED_SECRET]"' },
  // Credit cards
  { pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: '[REDACTED_CARD]' },
  // SSNs
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
];

const PROMPT_INJECTION_INDICATORS: RegExp[] = [
  /ignore\s+(previous|above|all)\s+instructions/i,
  /disregard\s+(previous|all)\s+rules/i,
  /system\s+prompt\s*:/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /dan\s+mode/i,
  /new\s+system\s+instruction/i,
  /execute\s+javascript\s*:/i,
  /bypass\s+safety\s+filter/i,
  /exfiltrate/i,
  /send\s+all\s+(data|passwords|tokens)\s+to/i,
];

export class AIQAContextSanitizer {
  /**
   * Sanitizes browser text, neutralizing potential prompt injection attempts
   * and redacting any sensitive tokens/secrets.
   */
  static sanitizeBrowserText(text: string | null | undefined, maxLength: number = 500): string {
    if (!text) return '';

    let clean = String(text).trim();

    // 1. Remove dangerous control characters
    clean = clean.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');

    // 2. Redact known secrets & credentials
    for (const { pattern, replacement } of SECRET_PATTERNS) {
      clean = clean.replace(pattern, replacement);
    }

    // 3. Detect prompt injection attempts and quarantine them explicitly
    for (const injPattern of PROMPT_INJECTION_INDICATORS) {
      if (injPattern.test(clean)) {
        clean = `[UNTRUSTED_DOM_TEXT_FLAGGED: ${clean.replace(/[\n\r]/g, ' ')}]`;
        break;
      }
    }

    // 4. Truncate if exceeding maximum length
    if (clean.length > maxLength) {
      clean = clean.substring(0, maxLength) + '...[truncated]';
    }

    return clean;
  }

  /**
   * Sanitizes URL strings to ensure no embedded credentials (user:pass@host) or sensitive query parameters exist.
   */
  static sanitizeUrl(rawUrl: string | null | undefined): string {
    if (!rawUrl) return '';
    try {
      const parsed = new URL(rawUrl);
      // Strip credentials if present
      parsed.username = '';
      parsed.password = '';

      // Strip sensitive query params
      const sensitiveKeys = ['token', 'key', 'auth', 'password', 'secret', 'code', 'session', 'jwt', 'apiKey'];
      for (const param of Array.from(parsed.searchParams.keys())) {
        if (sensitiveKeys.some((s) => param.toLowerCase().includes(s))) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      }

      return parsed.toString();
    } catch {
      return this.sanitizeBrowserText(rawUrl, 200);
    }
  }

  /**
   * Sanitizes CSS selectors to ensure no script payloads or excessive lengths.
   */
  static sanitizeSelector(selector: string | null | undefined): string | undefined {
    if (!selector) return undefined;
    let clean = selector.trim();
    if (clean.length > 300) {
      clean = clean.substring(0, 300);
    }
    // Remove control chars
    clean = clean.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    return clean;
  }
}
