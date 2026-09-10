// ==============================================================================
// Sculra Accessibility Score & Findings Aggregation Analyzer (worker/src/accessibility/analyzer.ts)
// ==============================================================================

import {
  AccessibilityFinding,
  AccessibilityCoverageSummary,
  KeyboardNavigationResult,
  ContrastCheckResult,
  TouchTargetResult,
  FormAccessibilityResult,
  SemanticAnalysisResult,
  TextScalingResult,
  ReducedMotionResult,
  DialogAccessibilityResult,
} from './types';

export interface AggregateAnalysisInput {
  targetsDiscovered: number;
  pagesTested: number;
  findings: AccessibilityFinding[];
  keyboardResults: KeyboardNavigationResult[];
  contrastResults: ContrastCheckResult[];
  touchTargetResults: TouchTargetResult[];
  formResults: FormAccessibilityResult[];
  semanticResults: SemanticAnalysisResult[];
  textScalingResults: TextScalingResult[];
  reducedMotionResults: ReducedMotionResult[];
  dialogResults: DialogAccessibilityResult[];
  durationMs: number;
}

export class AccessibilityAnalyzer {
  /**
   * Evaluates aggregate accessibility evidence, computes deterministic category score and coverage.
   */
  public static analyze(input: AggregateAnalysisInput): {
    coverage: AccessibilityCoverageSummary;
    accessibilityScore?: number;
  } {
    const {
      targetsDiscovered,
      pagesTested,
      findings,
      keyboardResults,
      contrastResults,
      touchTargetResults,
      formResults,
      semanticResults,
      textScalingResults,
      reducedMotionResults,
      dialogResults,
      durationMs,
    } = input;

    const criticalFindings = findings.filter((f) => f.severity === 'critical').length;
    const highFindings = findings.filter((f) => f.severity === 'high').length;
    const mediumFindings = findings.filter((f) => f.severity === 'medium').length;
    const lowFindings = findings.filter((f) => f.severity === 'low').length;
    const inconclusiveCount = findings.filter((f) => f.type === 'ACCESSIBILITY_CHECK_INCONCLUSIVE').length;

    const keyboardChecks = keyboardResults.reduce((sum, k) => sum + k.totalSteps, 0);
    const focusChecks = keyboardResults.reduce(
      (sum, k) => sum + k.focusedSequence.filter((f) => f.hasVisibleFocus !== undefined).length,
      0
    );
    const formChecks = formResults.reduce((sum, f) => sum + f.inputsCount, 0);
    const contrastChecks = contrastResults.length;
    const touchTargetChecks = touchTargetResults.length;
    const semanticChecks = semanticResults.reduce(
      (sum, s) => sum + s.headings.length + s.landmarks.length + s.images.length + s.ariaChecks.length,
      0
    );
    const responsiveChecks = touchTargetResults.length + textScalingResults.length;

    const totalMeasurements =
      keyboardChecks + focusChecks + formChecks + contrastChecks + touchTargetChecks + semanticChecks + responsiveChecks;

    // Mathematical Score Calculation (0-100)
    // Only compute a score if measurements or findings actually exist; otherwise undefined
    let accessibilityScore: number | undefined;
    if (totalMeasurements > 0 || findings.length > 0) {
      let rawScore = 100;
      rawScore -= criticalFindings * 35;
      rawScore -= highFindings * 15;
      rawScore -= mediumFindings * 6;
      rawScore -= lowFindings * 2;
      accessibilityScore = Math.max(0, Math.min(100, rawScore));
    }

    const coverage: AccessibilityCoverageSummary = {
      targetsDiscovered,
      targetsTested: pagesTested,
      pagesTested,
      totalChecks: totalMeasurements,
      keyboardChecks,
      focusChecks,
      formChecks,
      contrastChecks,
      touchTargetChecks,
      semanticChecks,
      responsiveChecks,
      findingsCount: findings.length,
      criticalFindings,
      highFindings,
      mediumFindings,
      lowFindings,
      inconclusiveCount,
      accessibilityScore,
      durationMs,
    };

    return {
      coverage,
      accessibilityScore,
    };
  }
}

