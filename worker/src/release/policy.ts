// ==============================================================================
// Sculra Release Orchestration & Environment Policies (worker/src/release/policy.ts)
// ==============================================================================

export const RELEASE_POLICY = {
  // Environment Ceilings
  MAX_ENVIRONMENTS_PER_PROJECT: 20,
  DEFAULT_VALIDATION_TIMEOUT_MS: 30000,
  MAX_REDIRECT_HOPS: 5,
  MAX_RESPONSE_BYTES: 1048576, // 1 MB ceiling

  // Deployment Bounds
  MAX_DEPLOYMENTS_PER_PROJECT: 500,
  MAX_DEPLOYMENTS_PER_DAY: 100,

  // Release Orchestration Bounds
  MAX_RELEASE_CHECKS_PER_RELEASE: 10,
  MAX_CAMPAIGN_DURATION_SECONDS: 900, // 15 min max QA run
  MAX_RETRIES: 2,
  MAX_CONCURRENT_RELEASE_CHECKS: 2,

  // Human Approval Expiry Window
  APPROVAL_VALIDITY_WINDOW_MS: 86400000, // 24 hours
} as const;

export class ReleasePolicyEnforcer {
  /**
   * Asserts environment count within project limit.
   */
  public static assertEnvironmentLimit(currentCount: number): void {
    if (currentCount >= RELEASE_POLICY.MAX_ENVIRONMENTS_PER_PROJECT) {
      throw new Error(
        `Project environment limit reached (${RELEASE_POLICY.MAX_ENVIRONMENTS_PER_PROJECT} environments max).`
      );
    }
  }

  /**
   * Asserts release check count within release limit.
   */
  public static assertReleaseCheckLimit(currentCount: number): void {
    if (currentCount >= RELEASE_POLICY.MAX_RELEASE_CHECKS_PER_RELEASE) {
      throw new Error(
        `Maximum release checks (${RELEASE_POLICY.MAX_RELEASE_CHECKS_PER_RELEASE}) reached for this release.`
      );
    }
  }
}
