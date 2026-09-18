// ==============================================================================
// Sculra Fix Agent Strongly-Typed Error Hierarchy (worker/src/fix-agent/errors.ts)
// ==============================================================================

export class FixAgentError extends Error {
  public readonly code: string;
  public readonly remediationId?: string;

  constructor(message: string, code = 'FIX_AGENT_ERROR', remediationId?: string) {
    super(message);
    this.name = 'FixAgentError';
    this.code = code;
    this.remediationId = remediationId;
  }
}

export class FixAuthorizationError extends FixAgentError {
  constructor(message: string, remediationId?: string) {
    super(message, 'AUTHORIZATION_DENIED', remediationId);
    this.name = 'FixAuthorizationError';
  }
}

export class PolicyBlockedError extends FixAgentError {
  public readonly violation: string;

  constructor(message: string, violation = 'POLICY_BLOCKED', remediationId?: string) {
    super(message, 'POLICY_BLOCKED', remediationId);
    this.name = 'PolicyBlockedError';
    this.violation = violation;
  }
}

export class DiagnosisValidationError extends FixAgentError {
  constructor(message: string, remediationId?: string) {
    super(message, 'DIAGNOSIS_VALIDATION_FAILED', remediationId);
    this.name = 'DiagnosisValidationError';
  }
}

export class PatchGenerationError extends FixAgentError {
  constructor(message: string, remediationId?: string) {
    super(message, 'PATCH_GENERATION_FAILED', remediationId);
    this.name = 'PatchGenerationError';
  }
}

export class PatchValidationError extends FixAgentError {
  public readonly reason: string;

  constructor(message: string, reason = 'PATCH_VALIDATION_FAILED', remediationId?: string) {
    super(message, 'PATCH_VALIDATION_FAILED', remediationId);
    this.name = 'PatchValidationError';
    this.reason = reason;
  }
}

export class WorkspaceError extends FixAgentError {
  constructor(message: string, remediationId?: string) {
    super(message, 'WORKSPACE_ERROR', remediationId);
    this.name = 'WorkspaceError';
  }
}

export class PatchApplicationError extends FixAgentError {
  constructor(message: string, remediationId?: string) {
    super(message, 'PATCH_APPLICATION_FAILED', remediationId);
    this.name = 'PatchApplicationError';
  }
}

export class DiffReviewError extends FixAgentError {
  public readonly violations: string[];

  constructor(message: string, violations: string[] = [], remediationId?: string) {
    super(message, 'DIFF_REVIEW_FAILED', remediationId);
    this.name = 'DiffReviewError';
    this.violations = violations;
  }
}

export class VerificationTimeoutError extends FixAgentError {
  public readonly timeoutSeconds: number;

  constructor(message: string, timeoutSeconds: number, remediationId?: string) {
    super(message, 'VERIFICATION_TIMEOUT', remediationId);
    this.name = 'VerificationTimeoutError';
    this.timeoutSeconds = timeoutSeconds;
  }
}

export class VerificationFailedError extends FixAgentError {
  public readonly failedCommands: string[];

  constructor(message: string, failedCommands: string[] = [], remediationId?: string) {
    super(message, 'VERIFICATION_FAILED', remediationId);
    this.name = 'VerificationFailedError';
    this.failedCommands = failedCommands;
  }
}

export class BaselineNotReproducedError extends FixAgentError {
  constructor(message: string, remediationId?: string) {
    super(message, 'BASELINE_NOT_REPRODUCED', remediationId);
    this.name = 'BaselineNotReproducedError';
  }
}

export class RollbackError extends FixAgentError {
  constructor(message: string, remediationId?: string) {
    super(message, 'ROLLBACK_FAILED', remediationId);
    this.name = 'RollbackError';
  }
}

export class GitSafetyError extends FixAgentError {
  constructor(message: string, remediationId?: string) {
    super(message, 'GIT_SAFETY_VIOLATION', remediationId);
    this.name = 'GitSafetyError';
  }
}

export class FixGitHubApiError extends FixAgentError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number, remediationId?: string) {
    super(message, 'GITHUB_API_ERROR', remediationId);
    this.name = 'FixGitHubApiError';
    this.statusCode = statusCode;
  }
}
export { FixGitHubApiError as GitHubApiError };

export class ConcurrencyLockError extends FixAgentError {
  public readonly lockKey: string;

  constructor(message: string, lockKey: string) {
    super(message, 'CONCURRENCY_LOCKED');
    this.name = 'ConcurrencyLockError';
    this.lockKey = lockKey;
  }
}

export class CancellationError extends FixAgentError {
  constructor(message: string, remediationId?: string) {
    super(message, 'EXECUTION_CANCELLED', remediationId);
    this.name = 'CancellationError';
  }
}
