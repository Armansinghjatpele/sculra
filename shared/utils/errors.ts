// ==============================================================================
// Sculra Typed Error Classes (shared/utils/errors.ts)
// ==============================================================================

export class SculraError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'INTERNAL_ERROR', statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class APIError extends SculraError {
  constructor(message: string, code = 'API_ERROR', statusCode = 400) {
    super(message, code, statusCode);
  }
}

export class ValidationError extends SculraError {
  public readonly details: Record<string, string>;

  constructor(message: string, details: Record<string, string> = {}) {
    super(message, 'VALIDATION_ERROR', 422);
    this.details = details;
  }
}

export class AuthError extends SculraError {
  constructor(message: string, code = 'UNAUTHENTICATED') {
    super(message, code, 401);
  }
}

export class PermissionError extends SculraError {
  constructor(message: string = 'Access denied: Insufficient privileges') {
    super(message, 'FORBIDDEN', 403);
  }
}
