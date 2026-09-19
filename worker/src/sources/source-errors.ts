// ==============================================================================
// Sculra Source Ingestion Typed Errors (worker/src/sources/source-errors.ts)
// ==============================================================================

export class SourceError extends Error {
  readonly code: string;
  readonly fatal: boolean;
  readonly details?: Record<string, any>;

  constructor(message: string, code: string, fatal = false, details?: Record<string, any>) {
    super(message);
    this.name = 'SourceError';
    this.code = code;
    this.fatal = fatal;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SourceSSRFError extends SourceError {
  constructor(targetUrl: string, reason: string) {
    super(
      `SSRF Security Violation: Access to target URL "${targetUrl}" is blocked. ${reason}`,
      'SSRF_SECURITY_VIOLATION',
      true,
      { targetUrl, reason }
    );
    this.name = 'SourceSSRFError';
  }
}

export class SourceUnreachableError extends SourceError {
  constructor(target: string, reason: string, statusCode?: number) {
    super(
      `Target "${target}" is unreachable: ${reason}`,
      'TARGET_UNREACHABLE',
      false,
      { target, reason, statusCode }
    );
    this.name = 'SourceUnreachableError';
  }
}

export class SourceRateLimitError extends SourceError {
  constructor(provider: string, retryAfterSeconds?: number) {
    super(
      `Rate limit exceeded for provider ${provider}.${retryAfterSeconds ? ` Retry after ${retryAfterSeconds}s.` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      false,
      { provider, retryAfterSeconds }
    );
    this.name = 'SourceRateLimitError';
  }
}

export class SourceUnsupportedError extends SourceError {
  constructor(sourceType: string, reason: string) {
    super(
      `Source type "${sourceType}" is unsupported or not ready: ${reason}`,
      'SOURCE_UNSUPPORTED',
      true,
      { sourceType, reason }
    );
    this.name = 'SourceUnsupportedError';
  }
}

export class SourceValidationException extends SourceError {
  constructor(message: string, field?: string) {
    super(message, 'SOURCE_VALIDATION_ERROR', true, { field });
    this.name = 'SourceValidationException';
  }
}
