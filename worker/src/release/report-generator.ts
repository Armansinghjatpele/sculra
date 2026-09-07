// ==============================================================================
// Sculra Structured Release Report Generator (worker/src/release/report-generator.ts)
// ==============================================================================
// Generates comprehensive, transparent, and auditable Markdown and JSON release reports
// incorporating all 16 standardized sections from deterministic evidence.

import { ReleaseAssessment } from './types';

export class ReleaseReportGenerator {
  /**
   * Generates a comprehensive GitHub-flavored Markdown release report.
   */
  static generateMarkdownReport(
    assessment: ReleaseAssessment,
    metadata: {
      targetUrl: string;
      projectName?: string;
      durationMs?: number;
      testRunStatus?: string;
    }
  ): string {
    const { scores, breakdown, blockers, aiAnalysis } = assessment;
    const isPassing = assessment.recommendation === 'RELEASE';
    const isCaution = assessment.recommendation === 'RELEASE_WITH_CAUTION';

    const statusBadge = isPassing
      ? '🟢 **RELEASE RECOMMENDED**'
      : isCaution
      ? '🟡 **RELEASE WITH CAUTION**'
      : assessment.recommendation === 'INSUFFICIENT_EVIDENCE'
      ? '⚪ **INSUFFICIENT EVIDENCE**'
      : '🔴 **DO NOT RELEASE**';

    const confidenceBadge =
      assessment.confidenceLevel === 'HIGH'
        ? '🟢 High Confidence'
        : assessment.confidenceLevel === 'MEDIUM'
        ? '🟡 Medium Confidence'
        : assessment.confidenceLevel === 'LOW'
        ? '🟠 Low Confidence'
        : '⚪ Insufficient Evidence';

    const riskBadge =
      assessment.riskLevel === 'CRITICAL'
        ? '🔴 Critical Risk'
        : assessment.riskLevel === 'HIGH'
        ? '🟠 High Risk'
        : assessment.riskLevel === 'MEDIUM'
        ? '🟡 Medium Risk'
        : assessment.riskLevel === 'LOW'
        ? '🟢 Low Risk'
        : '⚪ Unknown Risk';

    const lines: string[] = [];

    // Header
    lines.push(`# Sculra Release Readiness Report — ${metadata.projectName || 'Web Application'}`);
    lines.push(`> Evaluated for target: \`${metadata.targetUrl}\` | Test Run: \`${assessment.testRunId}\` | Scoring Version: \`v${assessment.scoringVersion}\``);
    lines.push('');

    // 1. Executive Summary
    lines.push('## 1. Executive Summary');
    if (aiAnalysis?.summary) {
      lines.push(aiAnalysis.summary);
    } else {
      lines.push(`The application evaluated at **${scores.overall} / 100** stability readiness with **${blockers.length} active blocker(s)** and ${confidenceBadge}.`);
    }
    lines.push('');

    // 2. Release Recommendation
    lines.push('## 2. Release Recommendation');
    lines.push(`### ${statusBadge}`);
    if (aiAnalysis?.releaseExplanation) {
      lines.push(`> ${aiAnalysis.releaseExplanation}`);
    } else {
      lines.push(`> Recommendation: **${assessment.recommendation.replace(/_/g, ' ')}** (Overall Readiness: ${scores.overall}/100)`);
    }
    lines.push('');

    // 3. Overall Score & Historical Delta
    lines.push('## 3. Overall Score');
    lines.push(`**Score**: \`${scores.overall} / 100\``);
    if (breakdown.historicalComparison?.change !== undefined) {
      const deltaSign = breakdown.historicalComparison.change >= 0 ? '+' : '';
      lines.push(`**Historical Change**: \`${deltaSign}${breakdown.historicalComparison.change} pts\` (Previous: \`${breakdown.historicalComparison.previousScore}/100\`)`);
    }
    lines.push('');

    // 4. Category Scores Matrix
    lines.push('## 4. Category Scores');
    lines.push('| Category | Score | Weight | Status |');
    lines.push('| :--- | :--- | :--- | :--- |');
    lines.push(`| **Functional QA** | **${scores.functional} / 100** | 35% | ${scores.functional >= 80 ? '🟢 Pass' : scores.functional >= 60 ? '🟡 Warning' : '🔴 Fail'} |`);
    lines.push(`| **Visual Quality** | **${scores.visual} / 100** | 20% | ${scores.visual >= 80 ? '🟢 Pass' : scores.visual >= 60 ? '🟡 Warning' : '🔴 Fail'} |`);
    lines.push(`| **Responsive Layout** | **${scores.responsive} / 100** | 20% | ${scores.responsive >= 80 ? '🟢 Pass' : scores.responsive >= 60 ? '🟡 Warning' : '🔴 Fail'} |`);
    lines.push(`| **Execution Reliability** | **${scores.reliability} / 100** | 10% | ${scores.reliability >= 80 ? '🟢 Pass' : scores.reliability >= 60 ? '🟡 Warning' : '🔴 Fail'} |`);
    lines.push(`| **Structural Coverage** | **${scores.coverage} / 100** | 15% | ${scores.coverage >= 70 ? '🟢 Pass' : scores.coverage >= 40 ? '🟡 Partial' : '🔴 Low'} |`);
    lines.push('');

    // 5. Risk Level & 6. Evidence Confidence
    lines.push('## 5. Risk Level & 6. Evidence Confidence');
    lines.push(`- **Risk Classification**: ${riskBadge}`);
    lines.push(`- **Evidence Quality & Confidence**: ${confidenceBadge}`);
    lines.push('');

    // 7. Blocking Issues
    lines.push('## 7. Active Release Blockers');
    if (blockers.length === 0) {
      lines.push('✅ **Zero active release blockers.** No critical functional defects or systemic layout collapses detected.');
    } else {
      lines.push(`⚠️ **${blockers.length} active blocker(s) requiring resolution:**`);
      lines.push('');
      for (const b of blockers) {
        lines.push(`- **[${b.severity.toUpperCase()}] ${b.title}** (${b.category.toUpperCase()})`);
        lines.push(`  - **Why Blocked**: ${b.reason}`);
        lines.push(`  - **Evidence**: ${b.evidenceSummary}`);
        if (b.relatedIssueFingerprints && b.relatedIssueFingerprints.length > 0) {
          lines.push(`  - **Fingerprint**: \`${b.relatedIssueFingerprints[0].substring(0, 16)}...\``);
        }
      }
    }
    lines.push('');

    // 8. Top Issues & Score Deductions
    lines.push('## 8. Top Issues & Score Deductions');
    const allDeductions = [
      ...breakdown.functional.deductions,
      ...breakdown.visual.deductions,
      ...breakdown.responsive.deductions,
      ...breakdown.reliability.deductions,
    ];

    if (allDeductions.length === 0) {
      lines.push('Clean run: 0 score deductions applied.');
    } else {
      lines.push('| Impact | Category | Reason |');
      lines.push('| :--- | :--- | :--- |');
      for (const d of allDeductions.slice(0, 10)) {
        lines.push(`| \`-${d.points} pts\` | **${d.category.toUpperCase()}** | ${d.reason} |`);
      }
    }
    lines.push('');

    // 9. Functional QA
    lines.push('## 9. Functional QA Assessment');
    lines.push(`- **Confirmed Issues**: ${breakdown.functional.confirmedIssuesCount}`);
    lines.push(`- **Suspected Issues**: ${breakdown.functional.suspectedIssuesCount}`);
    lines.push(`- **Failed Workflows**: ${breakdown.functional.failedJourneysCount}`);
    lines.push(`- **Final Functional Score**: \`${scores.functional} / 100\``);
    lines.push('');

    // 10. Visual QA
    lines.push('## 10. Visual QA Assessment');
    lines.push(`- **Visual Regressions Detected**: ${breakdown.visual.regressionsCount}`);
    lines.push(`- **Baselines Established (No comparison)**: ${breakdown.visual.missingBaselinesCount}`);
    lines.push(`- **Final Visual Score**: \`${scores.visual} / 100\``);
    lines.push('');

    // 11. Responsive QA
    lines.push('## 11. Responsive QA Assessment');
    lines.push(`- **Viewports Evaluated**: ${breakdown.responsive.viewportsTested} / 3 (Desktop, Tablet, Mobile)`);
    lines.push(`- **Horizontal Layout Overflows**: ${breakdown.responsive.overflowCount}`);
    lines.push(`- **Clipped Content Defects**: ${breakdown.responsive.clippingCount}`);
    lines.push(`- **Element Collisions**: ${breakdown.responsive.overlapCount}`);
    lines.push(`- **Final Responsive Score**: \`${scores.responsive} / 100\``);
    lines.push('');

    // 12. AI Exploratory QA
    lines.push('## 12. AI Exploratory QA Analysis');
    if (aiAnalysis) {
      lines.push('### Key Risks');
      for (const r of aiAnalysis.keyRisks) lines.push(`- ${r}`);
      lines.push('');
      lines.push('### Strengths & Validated Routes');
      for (const s of aiAnalysis.strengths) lines.push(`- ${s}`);
      lines.push('');
      lines.push('### Evidence Gaps');
      for (const g of aiAnalysis.evidenceGaps) lines.push(`- ${g}`);
    } else {
      lines.push('AI exploratory analysis not configured or offline.');
    }
    lines.push('');

    // 13. Structural Coverage
    lines.push('## 13. Structural Coverage');
    lines.push(`- **Pages Visited**: ${breakdown.coverage.pages.visited} / ${breakdown.coverage.pages.discovered} (${(breakdown.coverage.pages.ratio * 100).toFixed(0)}%)`);
    lines.push(`- **Forms Exercised**: ${breakdown.coverage.forms.exercised} / ${breakdown.coverage.forms.discovered} (${(breakdown.coverage.forms.ratio * 100).toFixed(0)}%)`);
    lines.push(`- **Buttons / CTAs Tested**: ${breakdown.coverage.buttons.exercised} / ${breakdown.coverage.buttons.discovered} (${(breakdown.coverage.buttons.ratio * 100).toFixed(0)}%)`);
    lines.push(`- **Navigation Links Traversed**: ${breakdown.coverage.links.exercised} / ${breakdown.coverage.links.discovered} (${(breakdown.coverage.links.ratio * 100).toFixed(0)}%)`);
    lines.push(`- **Viewports Tested**: ${breakdown.coverage.viewports.tested} / 3`);
    lines.push(`- **Coverage Score**: \`${scores.coverage} / 100\``);
    lines.push('');

    // 14. Collected Evidence
    lines.push('## 14. Collected Evidence & Audit Trail');
    lines.push(`- **Console Error Signatures**: ${breakdown.reliability.consoleErrorsCount}`);
    lines.push(`- **Network Failure Entries**: ${breakdown.reliability.networkErrorsCount}`);
    lines.push(`- **Action Failure Rate**: ${(breakdown.reliability.actionFailureRate * 100).toFixed(1)}%`);
    lines.push('');

    // 15. Recommended Next Actions
    lines.push('## 15. Recommended Next Actions');
    if (aiAnalysis?.recommendedActions && aiAnalysis.recommendedActions.length > 0) {
      for (let i = 0; i < aiAnalysis.recommendedActions.length; i++) {
        lines.push(`${i + 1}. ${aiAnalysis.recommendedActions[i]}`);
      }
    } else {
      lines.push('1. Review all open issues and resolve high-priority defects.');
      lines.push('2. Re-run test suite after applying fixes to verify regressions.');
    }
    lines.push('');

    // 16. Metadata
    lines.push('## 16. Test Run Metadata');
    lines.push(`- **Evaluated At**: \`${assessment.evaluatedAt}\``);
    lines.push(`- **Duration**: \`${metadata.durationMs ? (metadata.durationMs / 1000).toFixed(1) + 's' : 'N/A'}\``);
    lines.push(`- **Status**: \`${metadata.testRunStatus || 'completed'}\``);
    lines.push(`- **Engine Version**: \`Sculra QA Engine v1.0\``);

    return lines.join('\n');
  }
}
