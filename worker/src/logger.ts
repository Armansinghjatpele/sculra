// ==============================================================================
// Sculra Worker Logger (worker/src/logger.ts)
// ==============================================================================
// Structured, secure logger formatting worker and test-run execution milestones.
// Redacts sensitive authorization tokens, secrets, service keys, and cookies.

const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /sk_test_[a-zA-Z0-9]+/gi,
  /pk_test_[a-zA-Z0-9]+/gi,
  /sb_secret_[a-zA-Z0-9_\-]+/gi,
  /service_role[a-zA-Z0-9_\-\.]*/gi,
  /eyJ[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9_\-\.]+/gi, // JWT
  /password=["'][^"']+["']/gi,
  /cookie:\s*[^;\n]+/gi,
  /api[_-]?key["':\s=]+[a-zA-Z0-9_\-]+/gi,
  /secret[_-]?key["':\s=]+[a-zA-Z0-9_\-]+/gi,
];

export function sanitizeLogMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeLogMessage(obj);
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      ['authorization', 'cookie', 'password', 'token', 'secret', 'key', 'apikey', 'service_role'].some((k) =>
        lowerKey.includes(k)
      )
    ) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeObject(value);
    }
  }
  return result;
}

export interface LoggerContext {
  workerId?: string;
  jobId?: string;
  jobType?: string;
  projectId?: string;
  testRunId?: string;
}

export class WorkerLogger {
  private context: LoggerContext;

  constructor(contextOrId: string | LoggerContext, projectId?: string) {
    if (typeof contextOrId === 'string') {
      this.context = {
        testRunId: contextOrId,
        projectId,
      };
    } else {
      this.context = { ...contextOrId };
      if (projectId) {
        this.context.projectId = projectId;
      }
    }
  }

  private formatPrefix(): string {
    const parts: string[] = [];
    if (this.context.workerId) {
      parts.push(`worker:${this.context.workerId}`);
    }
    if (this.context.jobType) {
      parts.push(`type:${this.context.jobType}`);
    }
    if (this.context.jobId) {
      parts.push(`job:${this.context.jobId}`);
    } else if (this.context.testRunId) {
      parts.push(`test-run:${this.context.testRunId}`);
    }
    if (this.context.projectId) {
      parts.push(`proj:${this.context.projectId}`);
    }

    return parts.length > 0 ? `[${parts.join('][')}]` : '[worker]';
  }

  log(event: string, details?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const prefix = this.formatPrefix();
    const cleanEvent = sanitizeLogMessage(event);

    if (details) {
      const sanitized = sanitizeObject(details);
      console.log(`${prefix} ${cleanEvent} | ${timestamp} | ${JSON.stringify(sanitized)}`);
    } else {
      console.log(`${prefix} ${cleanEvent} | ${timestamp}`);
    }
  }

  warn(event: string, details?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const prefix = `${this.formatPrefix()}[WARN]`;
    const cleanEvent = sanitizeLogMessage(event);
    const sanitized = details ? sanitizeObject(details) : undefined;
    console.warn(`${prefix} ${cleanEvent} | ${timestamp}`, sanitized ? JSON.stringify(sanitized) : '');
  }

  error(event: string, error?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `${this.formatPrefix()}[ERROR]`;
    const message = error instanceof Error ? error.message : String(error || '');
    const cleanMsg = sanitizeLogMessage(message);
    console.error(`${prefix} ${event}: ${cleanMsg} | ${timestamp}`);
  }
}
