// ==============================================================================
// Sculra Release Evidence & Truthful Metrics Formatter
// (worker/src/release/release-evidence.ts)
// ==============================================================================

export class ReleaseEvidenceFormatter {
  /**
   * Formats a numeric score or percentage strictly without fabrication.
   * If value is undefined or null, returns "--".
   */
  public static formatScore(score: number | null | undefined): string {
    if (score === null || score === undefined || Number.isNaN(score)) {
      return '--';
    }
    return `${Math.round(score)}%`;
  }

  /**
   * Formats latency in ms. If unmeasured, returns "--".
   */
  public static formatLatency(ms: number | null | undefined): string {
    if (ms === null || ms === undefined || Number.isNaN(ms)) {
      return '--';
    }
    return `${Math.round(ms)}ms`;
  }

  /**
   * Formats deployment status with truthful explanation.
   */
  public static formatDeploymentStatus(status: string | null | undefined): string {
    if (!status || status === 'UNKNOWN') {
      return 'Deployment not confirmed';
    }
    return status;
  }

  /**
   * Returns a truthful label for evidence completeness.
   */
  public static formatConfidence(confidence: string | null | undefined): string {
    if (!confidence || confidence === 'INSUFFICIENT' || confidence === 'INSUFFICIENT_EVIDENCE') {
      return 'Insufficient evidence';
    }
    return confidence;
  }
}
