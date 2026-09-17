// ==============================================================================
// Sculra CI/CD Error Classification Hierarchy (worker/src/cicd/errors.ts)
// ==============================================================================

export class CICDError extends Error {
  public readonly errorCode: string;
  public readonly statusCode: number;

  constructor(message: string, errorCode = 'CICD_ERROR', statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SignatureVerificationError extends CICDError {
  constructor(message = 'HMAC SHA-256 signature verification failed or signature header missing') {
    super(message, 'SIGNATURE_VERIFICATION_FAILED', 401);
  }
}

export class PayloadTooLargeError extends CICDError {
  constructor(maxBytes = 1048576) {
    super(`Payload size exceeded limit of ${maxBytes} bytes`, 'PAYLOAD_TOO_LARGE', 413);
  }
}

export class UntrustedRepositoryError extends CICDError {
  constructor(repo: string) {
    super(`Repository '${repo}' is not trusted or does not match project configuration`, 'UNTRUSTED_REPOSITORY', 403);
  }
}

export class ProjectNotFoundError extends CICDError {
  constructor(identifier: string) {
    super(`No configured Sculra project found matching '${identifier}'`, 'PROJECT_NOT_FOUND', 404);
  }
}

export class CIDisabledError extends CICDError {
  constructor(projectId: string) {
    super(`CI/CD automation is currently disabled for project '${projectId}'`, 'CI_DISABLED', 200);
  }
}

export class DuplicateDeliveryError extends CICDError {
  public readonly deliveryId: string;

  constructor(deliveryId: string) {
    super(`Webhook delivery '${deliveryId}' has already been received and processed`, 'DUPLICATE_DELIVERY', 200);
    this.deliveryId = deliveryId;
  }
}

export class GateEvaluationError extends CICDError {
  constructor(message: string) {
    super(message, 'GATE_EVALUATION_FAILED', 500);
  }
}
