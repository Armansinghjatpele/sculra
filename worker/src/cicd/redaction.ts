// ==============================================================================
// Sculra CI/CD Input Sanitization & Secret Redaction (worker/src/cicd/redaction.ts)
// ==============================================================================

import { NormalizedCIEvent } from './types';

// Sensitive credential patterns to mask
const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-\.=:_+/]+/gi,
  /ey[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+/g, // JWTs
  /gh[pousr]_[a-zA-Z0-9]{36,}/g, // GitHub tokens
  /github_pat_[a-zA-Z0-9_]{50,}/g, // GitHub fine-grained PAT
  /sb_secret_[a-zA-Z0-9_-]{20,}/g, // Supabase secret keys
  /service_role[a-zA-Z0-9_\-\.=:_+/]{20,}/gi,
  /password\s*[:=]\s*['"][^'"]+['"]/gi,
  /secret\s*[:=]\s*['"][^'"]+['"]/gi,
  /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
];

// Prompt injection marker patterns to neutralize
const PROMPT_INJECTION_PATTERNS = [
  /\b(?:ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|directives))\b/gi,
  /\b(?:disregard\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|directives))\b/gi,
  /\b(?:you\s+are\s+now\s+(?:a|an)?\s*[a-zA-Z0-9_-]+)\b/gi,
  /\[INST\][\s\S]*?\[\/INST\]/gi,
  /<<SYS>>[\s\S]*?<<\/SYS>>/gi,
  /<\|im_start\|>[\s\S]*?<\|im_end\|>/gi,
  /\b(?:system|system\s+prompt|developer\s+mode|jailbreak)\s*:\s*/gi,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:[^\s]+/gi,
];

/**
 * Sanitizes untrusted user inputs (such as commit messages, PR titles, and branch names)
 * to prevent prompt injection and XSS/HTML injection attacks.
 */
export function sanitizeCIInput(input: string | undefined | null, maxLength = 500): string {
  if (!input) return '';

  let sanitized = String(input);

  // 1. Remove dangerous prompt injection keywords / system markers
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_INPUT]');
  }

  // 2. Defang HTML angle brackets and control characters
  sanitized = sanitized
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3. Mask any leaked credentials that might be in commit messages
  sanitized = maskSecrets(sanitized);

  // 4. Bound length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '... (truncated)';
  }

  return sanitized.trim();
}

/**
 * Masks secrets, tokens, API keys, and credentials.
 */
export function maskSecrets(text: string | undefined | null): string {
  if (!text) return '';
  let result = String(text);

  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      if (match.toLowerCase().startsWith('bearer ')) {
        return 'Bearer [REDACTED_TOKEN]';
      }
      return '[REDACTED_SECRET]';
    });
  }

  return result;
}

/**
 * Returns a safely sanitized copy of a NormalizedCIEvent.
 */
export function sanitizeNormalizedEvent(event: NormalizedCIEvent): NormalizedCIEvent {
  return {
    ...event,
    repository: {
      ...event.repository,
      fullName: sanitizeCIInput(event.repository.fullName, 120),
      owner: sanitizeCIInput(event.repository.owner, 60),
      name: sanitizeCIInput(event.repository.name, 60),
    },
    commit: event.commit
      ? {
          ...event.commit,
          message: sanitizeCIInput(event.commit.message, 500),
          authorName: sanitizeCIInput(event.commit.authorName, 100),
          branch: sanitizeCIInput(event.commit.branch, 100),
        }
      : undefined,
    pullRequest: event.pullRequest
      ? {
          ...event.pullRequest,
          title: sanitizeCIInput(event.pullRequest.title, 250),
          headBranch: sanitizeCIInput(event.pullRequest.headBranch, 100),
          baseBranch: sanitizeCIInput(event.pullRequest.baseBranch, 100),
          sender: sanitizeCIInput(event.pullRequest.sender, 100),
        }
      : undefined,
  };
}
