// ==============================================================================
// Sculra Deterministic Regression Detection Engine (worker/src/history/regression.ts)
// ==============================================================================

import { HistoricalFinding, RegressionEvent, HistoricalRun } from './types';
import { ProductModel } from '../product/types';

export class RegressionDetector {
  /**
   * Detects new findings and regressions between current and previous comparable runs.
   */
  static detectRegressions(
    unmatchedCurrentFindings: HistoricalFinding[],
    previousRun?: HistoricalRun,
    productModel?: ProductModel
  ): RegressionEvent[] {
    const regressions: RegressionEvent[] = [];

    for (const finding of unmatchedCurrentFindings) {
      // Find matching workflow in ProductModel if available
      let workflowId: string | undefined;
      let workflowName: string | undefined;
      let businessCriticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | undefined;

      if (productModel?.workflows) {
        const wf = productModel.workflows.find((w) =>
          w.steps?.some((s) => s.pageUrl === finding.targetUrl || s.targetSelector === finding.selector)
        );
        if (wf) {
          workflowId = wf.id;
          workflowName = wf.name;
          businessCriticality = wf.criticality?.level as any;
        }
      }

      const category = this.mapCategory(finding.category, finding.type);

      regressions.push({
        id: `reg-${finding.fingerprint.slice(0, 12)}-${Date.now()}`,
        fingerprint: finding.fingerprint,
        findingType: finding.type,
        title: finding.title,
        severity: finding.severity,
        category,
        targetUrl: finding.targetUrl,
        selector: finding.selector,
        method: finding.method,
        role: finding.role,
        viewport: finding.viewport,
        workflowId,
        workflowName,
        businessCriticality,
        reason: previousRun
          ? `Defect appeared in current run (${finding.firstSeenRunId || 'current'}) that did not exist in comparable run (${previousRun.testRunId}).`
          : 'New defect detected in initial baseline execution.',
        previousRunState: previousRun ? 'PASSED' : 'NOT_PRESENT',
        currentRunState: 'FAILED',
        detectedAt: finding.firstSeenAt || new Date().toISOString(),
        observedValue: finding.metadata?.observedValue,
        thresholdValue: finding.metadata?.thresholdValue,
      });
    }

    return regressions;
  }

  private static mapCategory(
    category?: string,
    type?: string
  ): 'functional' | 'visual' | 'responsive' | 'reliability' | 'security' | 'api' | 'performance' | 'accessibility' {
    const cat = (category || '').toLowerCase();
    const typ = (type || '').toUpperCase();

    if (cat === 'security' || typ.startsWith('SECURITY_') || typ.startsWith('AUTH_')) return 'security';
    if (cat === 'performance' || typ.startsWith('PERFORMANCE_') || typ.includes('LATENCY') || typ.includes('WEB_VITAL')) return 'performance';
    if (cat === 'accessibility' || typ.startsWith('ACCESSIBILITY_') || typ.includes('WCAG') || typ.includes('CONTRAST') || typ.includes('KEYBOARD_TRAP') || typ.includes('TOUCH_TARGET')) return 'accessibility';
    if (cat === 'api' || typ.startsWith('API_')) return 'api';
    if (cat === 'visual' || typ.startsWith('VISUAL_')) return 'visual';
    if (cat === 'responsive' || typ.startsWith('RESPONSIVE_')) return 'responsive';
    if (cat === 'reliability' || typ.includes('CONSOLE_') || typ.includes('UNHANDLED_')) return 'reliability';

    return 'functional';
  }
}
