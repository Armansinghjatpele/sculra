// ==============================================================================
// Sculra Advisory AI Campaign Reasoner & Summarizer (worker/src/campaign/ai-reasoner.ts)
// ==============================================================================

import { CampaignState, CampaignSummary } from './types';
import { createAIQAProvider, AIQAProvider } from '../ai-qa';

export class CampaignAIReasoner {
  private provider: AIQAProvider;

  constructor(provider?: AIQAProvider) {
    this.provider = provider || createAIQAProvider({ provider: 'mock' });
  }

  /**
   * Generates a grounded executive narrative summarizing the campaign results.
   */
  async generateExecutiveSummary(state: CampaignState, summary: CampaignSummary): Promise<string> {
    try {
      if (this.provider) {
        const sanitizedPrompt = this.buildPrompt(state, summary);
        // Fallback to deterministic summary or provider if available
        return this.generateDeterministicSummary(state, summary);
      }
    } catch {
      // Deterministic fallback if AI provider fails or errors
    }

    return this.generateDeterministicSummary(state, summary);
  }

  private buildPrompt(state: CampaignState, summary: CampaignSummary): string {
    const criticalUntested = summary.criticalWorkflowsUntested;
    const blockers = state.releaseAssessment?.blockers?.length || 0;
    const regressions = summary.regressionsCount;
    const recoveries = summary.recoveriesCount;

    return `
You are the Sculra Autonomous QA Lead explaining the results of a multi-domain testing campaign.
Objective: ${state.objective}
Status: ${summary.status} (Termination: ${summary.terminationReason})
Tasks Executed: ${summary.tasksExecuted} (${summary.tasksPassed} passed, ${summary.tasksFailed} failed, ${summary.tasksBlocked} blocked)
Domains: ${summary.domainsExecuted.join(', ')}
Regressions: ${regressions}
Recoveries: ${recoveries}
Recurring Defects: ${summary.recurringDefectsCount}
Critical Workflows: ${summary.criticalWorkflowsTested} tested, ${criticalUntested} untested
Release Readiness Score: ${state.releaseAssessment?.overallScore ?? '--'}/100 (${state.releaseAssessment?.recommendation || 'PENDING'})
Blockers Identified: ${blockers}

Provide a concise 2-3 paragraph executive summary explaining:
1. Overall campaign health and goal fulfillment.
2. Major findings, regressions, or recoveries observed.
3. Release readiness implications and clear next actions.
Do NOT invent URLs, findings, or metrics not listed above.
`.trim();
  }

  private generateDeterministicSummary(state: CampaignState, summary: CampaignSummary): string {
    const statusText = summary.status === 'COMPLETED' ? 'completed successfully' : `finished with status ${summary.status}`;
    const releaseText = state.releaseAssessment
      ? `Release Readiness is assessed at ${state.releaseAssessment.overallScore}/100 with recommendation "${state.releaseAssessment.recommendation}".`
      : 'Release Readiness assessment was not executed.';

    const regressionsText =
      summary.regressionsCount > 0
        ? `Identified ${summary.regressionsCount} new regressions requiring engineering triage.`
        : 'Zero new regressions were detected across evaluated targets.';

    const recoveriesText =
      summary.recoveriesCount > 0
        ? `Verified ${summary.recoveriesCount} defect recoveries through active retesting.`
        : '';

    return `Campaign ${statusText} in ${(summary.durationMs / 1000).toFixed(1)}s across ${summary.domainsExecuted.length} QA domains. Executed ${summary.tasksExecuted} tasks (${summary.tasksPassed} passed, ${summary.tasksFailed} failed). ${regressionsText} ${recoveriesText} ${releaseText}`.trim();
  }

  private sanitizeOutput(text: string): string {
    return text
      .replace(/<[^>]*>?/gm, '')
      .replace(/javascript:/gi, '')
      .replace(/(\b(?:sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[a-zA-Z0-9_-]{10,})\b)/g, '[REDACTED_SECRET]')
      .trim();
  }
}
