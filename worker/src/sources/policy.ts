// ==============================================================================
// Sculra Multi-Source Ingestion Policies & Safety Ceilings
// (worker/src/sources/policy.ts)
// ==============================================================================

export const SOURCE_POLICY = {
  // Timeouts & Network bounds
  MAX_SOURCE_VALIDATION_SECONDS: 30,
  DEFAULT_VALIDATION_TIMEOUT_MS: 15000,
  MAX_REDIRECT_HOPS: 5,
  MAX_RESPONSE_BYTES: 1048576, // 1MB
  MAX_GITHUB_REQUESTS_PER_VALIDATION: 20,

  // Metadata & Storage bounds
  MAX_SNAPSHOT_METADATA_BYTES: 131072, // 128KB
  MAX_HEALTH_HISTORY: 100,
  MAX_SOURCES_PER_PROJECT: 10,
  MAX_CONCURRENT_VALIDATIONS: 4,
  CACHE_TTL_MS: 60000, // 60s cache

  // ZIP limits (Safety against decompression bombs & directory traversal)
  ZIP_MAX_ARCHIVE_BYTES: 52428800, // 50MB
  ZIP_MAX_FILES_COUNT: 1000,
  ZIP_MAX_EXTRACTED_BYTES: 209715200, // 200MB

  // Permitted scheme protocols
  ALLOWED_SCHEMES: ['http:', 'https:'],

  // Environments
  KNOWN_ENVIRONMENTS: ['Production', 'Staging', 'Preview', 'Development', 'Localhost'],
} as const;
