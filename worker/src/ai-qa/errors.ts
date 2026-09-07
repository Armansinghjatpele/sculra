// ==============================================================================
// Sculra AI Provider Error Hierarchy (worker/src/ai-qa/errors.ts)
// ==============================================================================

export type AIProviderErrorCode =
  | 'AI_PROVIDER_NOT_CONFIGURED'
  | 'AI_PROVIDER_AUTHENTICATION_FAILED'
  | 'AI_PROVIDER_RATE_LIMITED'
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_INVALID_RESPONSE'
  | 'AI_PROVIDER_SCHEMA_ERROR'
  | 'AI_PROVIDER_CANCELLED'
  | 'AI_PROVIDER_UNKNOWN_ERROR';

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;
  readonly provider: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: AIProviderErrorCode,
    provider: string,
    status?: number,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
    Object.setPrototypeOf(this, AIProviderError.prototype);
  }
}
