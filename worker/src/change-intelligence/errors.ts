// ==============================================================================
// Sculra Change Intelligence Error Classes (worker/src/change-intelligence/errors.ts)
// ==============================================================================

export class ChangeIntelligenceError extends Error {
  public readonly errorCode: string;
  public readonly statusCode: number;

  constructor(message: string, errorCode = 'CHANGE_INTELLIGENCE_ERROR', statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DiffParsingError extends ChangeIntelligenceError {
  constructor(message: string) {
    super(message, 'DIFF_PARSING_FAILED', 400);
  }
}

export class DiffOversizedError extends ChangeIntelligenceError {
  constructor(message: string) {
    super(message, 'DIFF_OVERSIZED', 413);
  }
}

export class PathTraversalError extends ChangeIntelligenceError {
  constructor(path: string) {
    super(`Potential path traversal attempt detected in path: '${path}'`, 'PATH_TRAVERSAL_DETECTED', 400);
  }
}

export class GitHubApiError extends ChangeIntelligenceError {
  constructor(message: string, statusCode = 502) {
    super(message, 'GITHUB_API_ERROR', statusCode);
  }
}
