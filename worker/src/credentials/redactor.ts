// ==============================================================================
// Sculra Credential Redactor & Masking Layer (worker/src/credentials/redactor.ts)
// ==============================================================================
// Invariants:
// - Comprehensive multi-regex secret masking.
// - Safe preview mask generator (e.g. "gh_••••••91").
// - Never leaks plaintext into error traces, telemetry, logs, or AI context.

import { CredentialType } from './types';

const SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // GitHub tokens
  { regex: /ghp_[A-Za-z0-9_]{36,}/g, replacement: '[REDACTED_GITHUB_PAT]' },
  { regex: /gho_[A-Za-z0-9_]{36,}/g, replacement: '[REDACTED_OAUTH_TOKEN]' },
  { regex: /github_pat_[A-Za-z0-9_]{82}/g, replacement: '[REDACTED_GITHUB_FINE_GRAINED_TOKEN]' },
  { regex: /gh[pousr]-[a-zA-Z0-9]{36,}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },

  // OpenAI keys
  { regex: /sk-[A-Za-z0-9_-]{20,}/g, replacement: '[REDACTED_OPENAI_KEY]' },
  { regex: /sk-proj-[A-Za-z0-9_-]{20,}/g, replacement: '[REDACTED_OPENAI_KEY]' },

  // AWS keys
  { regex: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },

  // JWTs
  { regex: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: '[REDACTED_JWT]' },

  // Bearer & Basic auth headers
  { regex: /bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer [REDACTED_BEARER_TOKEN]' },
  { regex: /basic\s+[A-Za-z0-9+/=]{10,}/gi, replacement: 'Basic [REDACTED_BASIC_AUTH]' },

  // Webhook secrets
  { regex: /whsec_[A-Za-z0-9_-]{20,}/g, replacement: '[REDACTED_WEBHOOK_SECRET]' },

  // Private keys
  { regex: /-----BEGIN\s+([A-Z\s]+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+([A-Z\s]+)?PRIVATE\s+KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },

  // Password fields
  { regex: /password["']?\s*[:=]\s*["']?[^"',\s}]+/gi, replacement: 'password: "[REDACTED_PASSWORD]"' },
  { regex: /secret["']?\s*[:=]\s*["']?[^"',\s}]+/gi, replacement: 'secret: "[REDACTED_SECRET]"' },
];

export class CredentialRedactor {
  /**
   * Generates a safe masked preview for displaying in UI lists (e.g. "gh_••••••91").
   */
  public static maskPreview(secret: string, type: CredentialType): string {
    if (!secret || typeof secret !== 'string') {
      return '--';
    }

    const trimmed = secret.trim();
    if (trimmed.length <= 4) {
      return '••••';
    }

    const suffix = trimmed.slice(-2);

    if (type === 'GITHUB_TOKEN' || trimmed.startsWith('gh')) {
      return `gh_••••••${suffix}`;
    }

    if (type === 'OPENAI_API_KEY' || trimmed.startsWith('sk-')) {
      return `sk-••••••${suffix}`;
    }

    if (type === 'WEBHOOK_SECRET' || trimmed.startsWith('whsec_')) {
      return `wh_••••••${suffix}`;
    }

    return `sec_••••••${suffix}`;
  }

  /**
   * Deeply redacts all sensitive patterns from a string.
   */
  public static maskSecrets(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;
    for (const p of SECRET_PATTERNS) {
      sanitized = sanitized.replace(p.regex, p.replacement);
    }
    return sanitized;
  }

  /**
   * Recursively traverses any data structure to redact secrets.
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
      for (const [key, value] of Object.entries(input as Record<string, any>)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('password') ||
          lowerKey.includes('apikey') ||
          lowerKey.includes('privatekey')
        ) {
          if (typeof value === 'string' && value.length > 0) {
            sanitizedObj[key] = '[REDACTED_CREDENTIAL]';
          } else {
            sanitizedObj[key] = value;
          }
        } else {
          sanitizedObj[key] = this.deepSanitize(value);
        }
      }
      return sanitizedObj as T;
    }

    return input;
  }
}
