// ==============================================================================
// Sculra Fix Agent Secret Masking & Prompt Injection Defense (worker/src/fix-agent/redaction.ts)
// ==============================================================================

import {
  redactSecrets,
  sanitizeUntrustedContent,
  wrapQuarantinedContext,
} from '../remediation/redaction';

export { redactSecrets, sanitizeUntrustedContent, wrapQuarantinedContext };

/**
 * Sanitizes untrusted content (issue summaries, error logs, user-supplied diffs)
 * to neutralize potential prompt injection instructions.
 */
export function defangPromptInjection(input: string): string {
  return sanitizeUntrustedContent(input);
}
