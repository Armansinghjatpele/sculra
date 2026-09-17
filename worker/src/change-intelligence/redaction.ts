// ==============================================================================
// Sculra Change Intelligence Sanitization & Secret Redaction
// (worker/src/change-intelligence/redaction.ts)
// ==============================================================================

export {
  sanitizeCIInput,
  maskSecrets,
} from '../cicd/redaction';

/**
 * Redacts any detected API keys, passwords, or tokens in diff patches.
 */
export function redactPatchSecrets(patch: string | undefined | null): string | undefined {
  if (!patch) return undefined;
  const { maskSecrets } = require('../cicd/redaction');
  return maskSecrets(patch);
}
