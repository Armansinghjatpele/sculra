// ==============================================================================
// Sculra Remediation Typed Error Hierarchy (worker/src/remediation/errors.ts)
// ==============================================================================

export type RemediationErrorCode =
  | 'CODE_CONTEXT_UNAVAILABLE'
  | 'GITHUB_UNAVAILABLE'
  | 'SOURCE_MAP_UNAVAILABLE'
  | 'EVIDENCE_UNAVAILABLE'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMIT'
  | 'AI_INVALID_OUTPUT'
  | 'AI_PROVIDER_ERROR'
  | 'INSUFFICIENT_EVIDENCE'
  | 'PARTIAL_CONTEXT'
  | 'PATH_TRAVERSAL_DETECTED'
  | 'SECURITY_RISK_DETECTED';

export class RemediationError extends Error {
  constructor(
    message: string,
    public readonly code: RemediationErrorCode,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'RemediationError';
  }
}

export class CodeContextUnavailableError extends RemediationError {
  constructor(message = 'Code context could not be retrieved from source provider', details?: Record<string, any>) {
    super(message, 'CODE_CONTEXT_UNAVAILABLE', details);
    this.name = 'CodeContextUnavailableError';
  }
}

export class GitHubUnavailableError extends RemediationError {
  constructor(message = 'GitHub API is unavailable or rate limited', details?: Record<string, any>) {
    super(message, 'GITHUB_UNAVAILABLE', details);
    this.name = 'GitHubUnavailableError';
  }
}

export class SourceMapUnavailableError extends RemediationError {
  constructor(message = 'Source map is unavailable or could not be safely resolved', details?: Record<string, any>) {
    super(message, 'SOURCE_MAP_UNAVAILABLE', details);
    this.name = 'SourceMapUnavailableError';
  }
}

export class EvidenceUnavailableError extends RemediationError {
  constructor(message = 'Required empirical evidence was not found for analysis', details?: Record<string, any>) {
    super(message, 'EVIDENCE_UNAVAILABLE', details);
    this.name = 'EvidenceUnavailableError';
  }
}

export class AITimeoutError extends RemediationError {
  constructor(message = 'AI root cause analysis timed out', details?: Record<string, any>) {
    super(message, 'AI_TIMEOUT', details);
    this.name = 'AITimeoutError';
  }
}

export class AIRateLimitError extends RemediationError {
  constructor(message = 'AI provider rate limit encountered', details?: Record<string, any>) {
    super(message, 'AI_RATE_LIMIT', details);
    this.name = 'AIRateLimitError';
  }
}

export class AIInvalidOutputError extends RemediationError {
  constructor(message = 'AI output failed strict schema validation or produced ungrounded references', details?: Record<string, any>) {
    super(message, 'AI_INVALID_OUTPUT', details);
    this.name = 'AIInvalidOutputError';
  }
}

export class InsufficientEvidenceError extends RemediationError {
  constructor(message = 'Empirical evidence is insufficient to formulate a reliable diagnosis', details?: Record<string, any>) {
    super(message, 'INSUFFICIENT_EVIDENCE', details);
    this.name = 'InsufficientEvidenceError';
  }
}

export class PartialContextError extends RemediationError {
  constructor(message = 'Context limits were reached; analysis proceeded with partial context', details?: Record<string, any>) {
    super(message, 'PARTIAL_CONTEXT', details);
    this.name = 'PartialContextError';
  }
}
