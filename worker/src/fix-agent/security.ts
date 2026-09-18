// ==============================================================================
// Sculra Fix Agent Security Scanner (worker/src/fix-agent/security.ts)
// ==============================================================================

const SECURITY_SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /(?:^|\/)(auth|authentication|authorization|security|session|login|signup|oauth|sso|mfa|jwt)\b/i,
  /(?:^|\/)middleware\.(ts|js)$/i,
  /(?:^|\/)api\/webhooks\b/i,
  /(?:^|\/)(stripe|payment|billing|checkout)\b/i,
  /(?:^|\/)(role|permission|policy|rls)\b/i,
];

const SECURITY_SENSITIVE_CONTENT_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'AUTHENTICATION_BYPASS', pattern: /\b(skipAuth|bypassAuth|noAuth|disableAuth|ignoreAuth)\b/i },
  { name: 'TOKEN_OR_SESSION_MANIPULATION', pattern: /\b(jwt\.sign|jwt\.verify|session\.user|auth\.jwt|getAuthToken)\b/i },
  { name: 'COOKIE_SECURITY_ATTRIBUTES', pattern: /\b(httpOnly|sameSite|secure)\s*:\s*(false|['"]none['"])/i },
  { name: 'CORS_WILDCARD', pattern: /Access-Control-Allow-Origin\s*['":]\s*\*/i },
  { name: 'SERVICE_ROLE_ESCALATION', pattern: /\b(SUPABASE_SERVICE_ROLE_KEY|service_role|serviceKey|adminClient)\b/i },
  { name: 'SECURITY_HEADERS_DISABLED', pattern: /\b(Content-Security-Policy|X-Frame-Options|X-Content-Type-Options)\s*:\s*null/i },
  { name: 'PASSWORD_OR_SECRET_EXPOSURE', pattern: /\b(password|secretKey|privateKey)\s*=\s*['"][^'"]+['"]/i },
  { name: 'PAYMENT_MUTATION', pattern: /\b(stripe\.charges|stripe\.paymentIntents|stripe\.refunds)\b/i },
  { name: 'RAW_SQL_INJECTION_RISK', pattern: /\b(rawSql|executeSql|queryRawUnsafe|prisma\.\$queryRawUnsafe)\b/i },
];

const DESTRUCTIVE_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-[rf]{1,2}\b/i,
  /\bdrop\s+(table|database|schema|user)\b/i,
  /\btruncate\s+(table)?\b/i,
  /\bdelete\s+from\b/i,
  /\bformat\s+[a-z]:/i,
  /\bmkfs\b/i,
  /\b(curl|wget)\b.*\|\s*(sh|bash|zsh|powershell|cmd)\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bchmod\s+777\b/i,
  /\bchown\b/i,
  /\bkill\s+-9\s+1\b/i,
];

export class FixSecurityScanner {
  /**
   * Evaluates whether a file path touches a security-sensitive application domain.
   */
  static isSecuritySensitivePath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return SECURITY_SENSITIVE_PATH_PATTERNS.some((p) => p.test(normalized));
  }

  /**
   * Scans content or diff snippets for security-sensitive markers.
   */
  static detectSecurityFlags(filePath: string, content: string): string[] {
    const flags: string[] = [];

    if (this.isSecuritySensitivePath(filePath)) {
      flags.push('SECURITY_SENSITIVE_PATH');
    }

    for (const { name, pattern } of SECURITY_SENSITIVE_CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        flags.push(name);
      }
    }

    return Array.from(new Set(flags));
  }

  /**
   * Detects whether a proposed test or shell command contains destructive directives.
   */
  static containsDestructiveCommand(command: string): boolean {
    if (!command || !command.trim()) return false;
    return DESTRUCTIVE_COMMAND_PATTERNS.some((p) => p.test(command));
  }
}
