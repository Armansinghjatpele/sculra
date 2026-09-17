// ==============================================================================
// Sculra Remediation Policy & Resource Bounds (worker/src/remediation/policy.ts)
// ==============================================================================

/**
 * Strict resource limits to enforce deterministic execution, prevent memory exhaustion,
 * cost runaways, and context bloat.
 */
export const REMEDIATION_POLICY = {
  // Evidence bounds
  MAX_EVIDENCE_ITEMS: 50,
  MAX_TOTAL_EVIDENCE_BYTES: 512 * 1024, // 512 KB

  // Code context bounds
  MAX_RELEVANT_FILES: 20,
  MAX_BYTES_PER_FILE: 50 * 1024, // 50 KB
  MAX_TOTAL_CODE_CONTEXT: 300 * 1024, // 300 KB
  MAX_SYMBOLS: 100,
  MAX_IMPORT_DEPTH: 3,

  // Campaign & execution bounds
  MAX_ANALYSES_PER_CAMPAIGN: 20,
  MAX_AI_REQUESTS_PER_ANALYSIS: 2,
  MAX_ANALYSIS_SECONDS: 45,

  // Current analysis schema version
  CURRENT_ANALYSIS_VERSION: 1,
} as const;
