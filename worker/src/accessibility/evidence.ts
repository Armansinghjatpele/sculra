// ==============================================================================
// Sculra Accessibility Evidence & Fingerprinting Formatter (worker/src/accessibility/evidence.ts)
// ==============================================================================

import { AccessibilityFinding, AccessibilityFindingType } from './types';
import { BugObservation } from '../issues/types';
import { AccessibilitySeverityClassifier } from './severity';

export class AccessibilityEvidenceFormatter {
  /**
   * Generates a deterministic fingerprint for an accessibility finding.
   */
  public static generateFingerprint(
    findingType: AccessibilityFindingType,
    pageUrl: string,
    selector?: string,
    viewport: string = 'desktop'
  ): string {
    let cleanUrl = pageUrl;
    try {
      const u = new URL(pageUrl);
      cleanUrl = `${u.origin}${u.pathname}`.replace(/\/$/, '');
    } catch {
      cleanUrl = pageUrl.replace(/[^a-zA-Z0-9]/g, '_');
    }

    const cleanSelector = (selector || 'page')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);

    return `a11y_${findingType.toLowerCase()}_${cleanUrl.replace(/[^a-zA-Z0-9]/g, '_')}_${cleanSelector}_${viewport}`;
  }

  /**
   * Converts a deterministic AccessibilityFinding into a standard BugObservation.
   */
  public static toBugObservation(
    finding: AccessibilityFinding,
    testRunId: string,
    projectId: string
  ): BugObservation {
    const meta = AccessibilitySeverityClassifier.getMetadata(finding.type);

    return {
      id: `bug-a11y-${testRunId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      testRunId,
      projectId,
      type: 'LAYOUT_DEFECT',
      severity: finding.severity,
      confidence: finding.confidence,
      status: 'open',
      title: `Accessibility: ${finding.title}`,
      summary: `${finding.description} [${finding.wcagReference}]`,
      description: `${finding.deterministicReason} Remediation: ${finding.remediationRecommendation}`,
      url: finding.targetUrl,
      reproductionSteps: [
        {
          stepNumber: 1,
          action: 'NAVIGATE',
          target: finding.targetUrl,
          url: finding.targetUrl,
          expectedBehavior: 'Page conforms to WCAG 2.1 AA accessible user interface standards',
          observedBehavior: `Accessibility defect detected: [${finding.type}] ${finding.description}`,
          selector: finding.selector,
        },
      ],
      fingerprint: finding.fingerprint,
      timestamp: finding.timestamp,
    };
  }
}

