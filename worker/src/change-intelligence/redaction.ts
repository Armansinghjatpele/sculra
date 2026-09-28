// ==============================================================================
// Sculra Change Intelligence Sanitization & Secret Redaction
// (worker/src/change-intelligence/redaction.ts)
// ==============================================================================

export {
  sanitizeCIInput,
  maskSecrets,
} from '../cicd/redaction';
import { maskSecrets } from '../cicd/redaction';

const SENSITIVE_KEY_PATTERN = /(password|secret|token|api_?key|auth|bearer|cookie|credential|private|cert|ssh|jwt)/i;

/**
 * Recursively redacts sensitive keys and values from objects, arrays, and primitives.
 */
export function redactSensitiveData(data: any, depth = 0): any {
  if (depth > 10) return '[TRUNCATED]';
  if (data === null || data === undefined) return data;
  if (typeof data === 'boolean' || typeof data === 'number') return data;

  if (typeof data === 'string') {
    return maskSecrets(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveData(val, depth + 1);
      }
    }
    return result;
  }

  return data;
}

/**
 * Redacts any detected API keys, passwords, or tokens in diff patches.
 */
export function redactPatchSecrets(patch: string | undefined | null): string | undefined {
  if (!patch) return undefined;
  return maskSecrets(patch);
}
