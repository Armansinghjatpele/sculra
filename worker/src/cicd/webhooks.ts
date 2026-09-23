// ==============================================================================
// Sculra CI/CD Webhook Verification & Processing (worker/src/cicd/webhooks.ts)
// ==============================================================================

import crypto from 'crypto';
import { PayloadTooLargeError, SignatureVerificationError } from './errors';
import { CredentialResolver } from '../credentials/resolver';

export const MAX_WEBHOOK_PAYLOAD_BYTES = 1048576; // 1 MB

/**
 * Verifies GitHub's HMAC SHA-256 signature using vault credential resolution or raw secret.
 */
export async function verifyGitHubSignatureWithVault(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secretOrCredentialRef: string | null | undefined,
  context?: { organizationId?: string; projectId?: string }
): Promise<boolean> {
  if (!secretOrCredentialRef) return false;
  if (secretOrCredentialRef.startsWith('vault:')) {
    const credId = secretOrCredentialRef.slice(6);
    const resolution = await CredentialResolver.resolve(
      { credentialId: credId, provider: 'CI_WEBHOOK', scope: 'WEBHOOK_VERIFY' },
      {
        actor: 'CICDWebhookEngine',
        actorType: 'WORKER',
        purpose: 'WebhookVerification',
        organizationId: context?.organizationId,
        projectId: context?.projectId,
      }
    );
    try {
      return verifyGitHubSignature(rawBody, signatureHeader, resolution.secret);
    } finally {
      resolution.dispose();
    }
  }
  return verifyGitHubSignature(rawBody, signatureHeader, secretOrCredentialRef);
}

/**
 * Verifies GitHub's HMAC SHA-256 signature with constant-time equality check.
 * Strictly defends against timing attacks.
 */
export function verifyGitHubSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  // Header format must be "sha256=<hex_digest>"
  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignatureHex = parts[1].trim().toLowerCase();

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const computedSignatureHex = hmac.digest('hex').toLowerCase();

  const expectedBuffer = Buffer.from(expectedSignatureHex, 'utf8');
  const computedBuffer = Buffer.from(computedSignatureHex, 'utf8');

  // Prevent timing side-channels
  if (expectedBuffer.length !== computedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
  } catch {
    return false;
  }
}

/**
 * Validates that webhook payload size does not exceed the 1MB threshold.
 */
export function validatePayloadSize(
  contentLength: number | undefined,
  maxBytes = MAX_WEBHOOK_PAYLOAD_BYTES
): void {
  if (contentLength !== undefined && contentLength > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }
}

/**
 * Normalizes headers from Node / Next.js Fetch API / raw objects.
 */
export function getHeaderValue(
  headers: Record<string, string | string[] | undefined> | { get(name: string): string | null },
  headerName: string
): string | null {
  if (!headers) return null;

  if (typeof (headers as any).get === 'function') {
    return (headers as any).get(headerName);
  }

  const target = headerName.toLowerCase();
  for (const [key, val] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      if (Array.isArray(val)) return val[0] || null;
      return typeof val === 'string' ? val : null;
    }
  }

  return null;
}

/**
 * Extracts GitHub Delivery ID header.
 */
export function extractDeliveryId(
  headers: Record<string, string | string[] | undefined> | { get(name: string): string | null }
): string | null {
  return getHeaderValue(headers, 'x-github-delivery');
}

/**
 * Extracts GitHub Event header.
 */
export function extractEventType(
  headers: Record<string, string | string[] | undefined> | { get(name: string): string | null }
): string | null {
  return getHeaderValue(headers, 'x-github-event');
}
