// ==============================================================================
// Sculra Worker Logger (worker/src/logger.ts)
// ==============================================================================
// Structured, secure logger formatting test-run execution milestones.
// Redacts sensitive authorization tokens, secrets, and cookies.

const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /sk_test_[a-zA-Z0-9]+/gi,
  /pk_test_[a-zA-Z0-9]+/gi,
  /eyJ[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9_\-\.]+/gi, // JWT
  /password=["'][^"']+["']/gi,
  /cookie:\s*[^;\n]+/gi,
];

export function sanitizeLogMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export class WorkerLogger {
  private testRunId: string;
  private projectId?: string;

  constructor(testRunId: string, projectId?: string) {
    this.testRunId = testRunId;
    this.projectId = projectId;
  }

  log(event: string, details?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const prefix = `[test-run:${this.testRunId}]`;
    const cleanEvent = sanitizeLogMessage(event);

    if (details) {
      const sanitizedDetails = JSON.stringify(details, (key, value) => {
        if (
          typeof key === 'string' &&
          ['authorization', 'cookie', 'password', 'token', 'secret', 'key'].some((k) =>
            key.toLowerCase().includes(k)
          )
        ) {
          return '[REDACTED]';
        }
        return value;
      });
      console.log(`${prefix} ${cleanEvent} | ${timestamp} | ${sanitizedDetails}`);
    } else {
      console.log(`${prefix} ${cleanEvent} | ${timestamp}`);
    }
  }

  warn(event: string, details?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const prefix = `[test-run:${this.testRunId}][WARN]`;
    const cleanEvent = sanitizeLogMessage(event);
    console.warn(`${prefix} ${cleanEvent} | ${timestamp}`, details || '');
  }

  error(event: string, error?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[test-run:${this.testRunId}][ERROR]`;
    const message = error instanceof Error ? error.message : String(error || '');
    const cleanMsg = sanitizeLogMessage(message);
    console.error(`${prefix} ${event}: ${cleanMsg} | ${timestamp}`);
  }
}
