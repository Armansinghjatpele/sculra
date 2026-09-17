// ==============================================================================
// Sculra Developer Feedback Synthesis Engine (worker/src/cicd/feedback.ts)
// ==============================================================================

import {
  CIGateDecision,
  CIFeedback,
  NormalizedCIEvent,
  CIFeedbackStructuredDetails,
  CIFeedbackDomainScore,
} from './types';
import { CampaignSummary } from '../campaign/types';

export class CIFeedbackGenerator {
  /**
   * Synthesizes actionable developer feedback from gate decisions and campaign summaries.
   */
  public static generateFeedback(
    decision: CIGateDecision,
    summary?: CampaignSummary | null,
    event?: NormalizedCIEvent | null,
    dashboardBaseUrl = 'https://app.sculra.com'
  ): CIFeedback {
    const verdict = decision.verdict;
    const scoreText = decision.overallScore !== null ? `${decision.overallScore}/100` : 'N/A';

    let headline = '';
    let checkRunConclusion: 'success' | 'failure' | 'neutral' | 'action_required' | 'cancelled' = 'failure';

    switch (verdict) {
      case 'PASS':
        headline = `✅ Sculra CI Gate Passed (Score: ${scoreText})`;
        checkRunConclusion = 'success';
        break;
      case 'FAIL':
        headline = `❌ Sculra CI Gate Failed: ${decision.criticalFindingsCount} Blocker(s), ${decision.regressionCount} Regression(s)`;
        checkRunConclusion = 'failure';
        break;
      case 'INSUFFICIENT_EVIDENCE':
        headline = '⚠️ Sculra CI Gate: Insufficient Evidence to satisfy release criteria';
        checkRunConclusion = 'action_required';
        break;
      case 'CANCELLED':
        headline = '⏹️ Sculra CI Gate: Test execution cancelled';
        checkRunConclusion = 'cancelled';
        break;
      case 'ERROR':
      default:
        headline = '⚠️ Sculra CI Gate: Execution encountered an error';
        checkRunConclusion = 'neutral';
        break;
    }

    // Build structured details
    const domains: CIFeedbackDomainScore[] = [];
    if (summary?.releaseAssessment?.scores) {
      const scores = summary.releaseAssessment.scores;
      for (const [dom, sc] of Object.entries(scores)) {
        if (dom === 'overall') continue;
        domains.push({
          domain: dom,
          score: typeof sc === 'number' ? sc : undefined,
          status: typeof sc === 'number' && sc < 70 ? 'warning' : 'passed',
        });
      }
    }

    const campaignId = summary?.campaignId;
    const dashboardUrl = campaignId
      ? `${dashboardBaseUrl}/campaigns/${campaignId}`
      : `${dashboardBaseUrl}/projects/${summary?.projectId || ''}`;

    const ci = summary?.changeIntelligence;

    const structuredDetails: CIFeedbackStructuredDetails = {
      verdict,
      overallScore: decision.overallScore,
      releaseVerdict: decision.releaseVerdict,
      policy: decision.gatePolicy,
      commitSha: event?.commit?.sha,
      branch: event?.commit?.branch || event?.pullRequest?.headBranch,
      pullRequestNumber: event?.pullRequest?.number,
      domains,
      blockers: decision.blockers,
      regressions: decision.regressions,
      reasons: decision.reasonCodes,
      dashboardUrl,
      changeIntelligence: ci
        ? {
            riskScore: ci.riskScore,
            riskLevel: ci.riskLevel,
            changeCount: ci.changeCount,
            additionsCount: ci.additionsCount,
            deletionsCount: ci.deletionsCount,
            affectedRoutes: ci.affectedRoutes,
            affectedWorkflows: ci.affectedWorkflows,
            affectedApis: ci.affectedApis,
            recommendedDomains: ci.recommendedDomains,
            isPartial: ci.isPartial,
          }
        : undefined,
    };

    // Synthesize Markdown Report
    const markdownLines: string[] = [];

    markdownLines.push(`## ${headline}`);
    markdownLines.push('');
    markdownLines.push(`> **Policy**: \`${decision.gatePolicy}\` | **Verdict**: **\`${verdict}\`** | **Evidence**: \`${decision.evidenceStatus}\``);
    markdownLines.push('');

    // Change Intelligence Impact Section
    if (ci) {
      markdownLines.push('### 🧠 Code Change Intelligence & Impact');
      markdownLines.push('');
      markdownLines.push(`- **Risk Score**: **${ci.riskScore}/100** (\`${ci.riskLevel}\`)`);
      markdownLines.push(`- **Scope**: ${ci.changeCount} file(s) (+${ci.additionsCount} / -${ci.deletionsCount})`);
      if (ci.isPartial) {
        markdownLines.push('- ⚠️ *Diff exceeded safety boundary; evaluated via partial deterministic analysis.*');
      }
      if (ci.affectedRoutes && ci.affectedRoutes.length > 0) {
        markdownLines.push(`- **Affected Routes (${ci.affectedRoutes.length})**: ${ci.affectedRoutes.slice(0, 5).map((r) => `\`${r}\``).join(', ')}${ci.affectedRoutes.length > 5 ? '...' : ''}`);
      }
      if (ci.affectedWorkflows && ci.affectedWorkflows.length > 0) {
        markdownLines.push(`- **Affected Workflows (${ci.affectedWorkflows.length})**: ${ci.affectedWorkflows.slice(0, 5).map((w) => `\`${w}\``).join(', ')}${ci.affectedWorkflows.length > 5 ? '...' : ''}`);
      }
      if (ci.affectedApis && ci.affectedApis.length > 0) {
        markdownLines.push(`- **Affected APIs (${ci.affectedApis.length})**: ${ci.affectedApis.slice(0, 5).map((a) => `\`${a}\``).join(', ')}${ci.affectedApis.length > 5 ? '...' : ''}`);
      }
      if (ci.recommendedDomains && ci.recommendedDomains.length > 0) {
        markdownLines.push(`- **Recommended QA Focus**: ${ci.recommendedDomains.map((d) => `\`${d}\``).join(', ')}`);
      }
      markdownLines.push('');
    }

    // Summary Table
    markdownLines.push('| Metric | Measured Value | Gate Requirement |');
    markdownLines.push('| :--- | :--- | :--- |');
    markdownLines.push(`| **Release Readiness Score** | **${scoreText}** | Must meet policy thresholds |`);
    markdownLines.push(`| **Recommendation** | \`${decision.releaseVerdict || 'N/A'}\` | \`RELEASE\` / \`RELEASE_WITH_CAUTION\` |`);
    markdownLines.push(`| **Critical Blockers** | ${decision.criticalFindingsCount} | 0 |`);
    markdownLines.push(`| **Regressions** | ${decision.regressionCount} | 0 |`);
    markdownLines.push(`| **Recoveries** | ${decision.recoveriesCount} | Continuous improvement |`);
    markdownLines.push('');

    // Blockers section
    if (decision.blockers.length > 0) {
      markdownLines.push('### 🚨 Critical Gate Blockers');
      markdownLines.push('');
      for (const blocker of decision.blockers) {
        markdownLines.push(`- **[${blocker.severity.toUpperCase()}]** ${blocker.title}: ${blocker.reason}`);
      }
      markdownLines.push('');
    }

    // Regressions section
    if (decision.regressions.length > 0) {
      markdownLines.push('### ⚠️ Regressions Detected');
      markdownLines.push('');
      for (const reg of decision.regressions) {
        markdownLines.push(`- ${reg}`);
      }
      markdownLines.push('');
    }

    // Git context
    if (event?.commit || event?.pullRequest || event?.repository?.fullName) {
      markdownLines.push('### 📌 Commit Context');
      if (event?.repository?.fullName) {
        markdownLines.push(`- **Repository**: \`${event.repository.fullName}\``);
      }
      if (event?.commit?.shortSha) {
        markdownLines.push(`- **Commit**: \`${event.commit.shortSha}\` — ${event.commit.message}`);
      }
      if (event?.pullRequest) {
        markdownLines.push(`- **Pull Request**: #${event.pullRequest.number} (${event.pullRequest.title})`);
      }
      markdownLines.push('');
    }

    // Footer link
    markdownLines.push('---');
    markdownLines.push(`[🔍 View Full Autonomous QA Campaign in Sculra](${dashboardUrl})`);

    const markdownSummary = markdownLines.join('\n');

    return {
      verdict,
      headline,
      markdownSummary,
      structuredDetails,
      checkRunStatus: 'completed',
      checkRunConclusion,
    };
  }
}
