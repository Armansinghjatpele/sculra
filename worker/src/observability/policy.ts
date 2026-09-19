// ==============================================================================
// Sculra Autonomous QA Observability Policies & Ceilings
// (worker/src/observability/policy.ts)
// ==============================================================================

export const OBSERVABILITY_POLICY = {
  // Maximum metadata payload per event in bytes (64KB ceiling)
  MAX_METADATA_BYTES: 64 * 1024,

  // Maximum events retrieved per timeline query
  MAX_TIMELINE_EVENTS: 200,

  // Default timeline pagination limit
  DEFAULT_TIMELINE_LIMIT: 50,

  // Default decision query limit
  MAX_DECISIONS_PER_QUERY: 100,

  // Human approval expiration window: 24 hours in milliseconds
  APPROVAL_EXPIRATION_MS: 24 * 60 * 60 * 1000,

  // Active campaign polling interval: 5 seconds
  ACTIVE_POLLING_INTERVAL_MS: 5000,

  // Inactive polling interval: disabled (null)
  INACTIVE_POLLING_INTERVAL_MS: null,

  // Maximum summary text length
  MAX_SUMMARY_LENGTH: 500,

  // Maximum reason text length
  MAX_REASON_LENGTH: 1000,

  // Maximum evidence IDs per event
  MAX_EVIDENCE_IDS: 50,

  // Maximum related entity IDs per event
  MAX_RELATED_ENTITY_IDS: 50,
} as const;

export const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i,
  /bearer/i,
  /cookie/i,
  /jwt/i,
];

export const SENSITIVE_VALUE_PATTERNS = [
  /ghp_[A-Za-z0-9_]{30,}/,
  /gho_[A-Za-z0-9_]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
];
