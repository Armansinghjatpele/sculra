// ==============================================================================
// Sculra AI Historical Summary Interpreter (worker/src/history/ai-interpreter.ts)
// ==============================================================================
// Strictly an explanatory layer that summarizes cross-run changes into natural
// executive language. Deterministic analysis is authoritative.
// Features prompt injection defense, credential redaction, and deterministic fallback.

import OpenAI from 'openai';
import {
  AIHistoricalSummary,
  HistoricalSummary,
  RegressionEvent,
  RecoveryEvent,
  RecurrenceEvent,
  StabilitySignal,
  CoverageTrend,
  HistoricalMetricDelta,
  HistoricalFinding,
} from './types';

export interface AIInterpreterInput {
  summary: HistoricalSummary;
  regressions: RegressionEvent[];
  recoveries: RecoveryEvent[];
  recurrences: RecurrenceEvent[];
  notRetested: HistoricalFinding[];
  stabilitySignals: StabilitySignal[];
  coverageTrends: CoverageTrend[];
  metricDeltas: HistoricalMetricDelta[];
  client?: OpenAI;
  model?: string;
  timeoutMs?: number;
  apiKey?: string;
}

export class HistoricalAIInterpreter {
  /**
   * Sanitizes input strings against prompt injection attempts and strip control tokens.
   */
  public static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '') // Control characters
      .replace(/(?:system|assistant|user):\s*/gi, '') // Role hijacking
      .replace(/(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|prior)\s+instructions/gi, '[REDACTED_PROMPT_INJECTION]')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Script tags
      .replace(/[`]{3,}/g, "'''") // Triple backtick block breaks
      .slice(0, 500); // Bounded length per field
  }

  /**
   * Redacts sensitive keys, auth tokens, passwords, and bearer secrets.
   */
  public static redactSecrets(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input
      .replace(/(?:bearer\s+[A-Za-z0-9\-._~+/]+=*)/gi, 'Bearer [REDACTED]')
      .replace(/(?:api[_-]?key|secret|token|password|auth)=([^\s&"']+)/gi, '$1=[REDACTED]')
      .replace(/(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, '[REDACTED_JWT]');
  }

  /**
   * Clean and sanitize an arbitrary string for LLM prompts.
   */
  public static cleanForPrompt(input: string): string {
    return this.sanitizeString(this.redactSecrets(input));
  }

  /**
   * Generates a deterministic fallback summary when AI is disabled, unconfigured, or fails.
   */
  public static generateDeterministicSummary(input: Omit<AIInterpreterInput, 'client' | 'apiKey' | 'model' | 'timeoutMs'>): AIHistoricalSummary {
    const { summary, regressions, recoveries, recurrences, stabilitySignals, coverageTrends, metricDeltas } = input;

    const whatChanged: string[] = [];
    const whatDegraded: string[] = [];
    const whatImproved: string[] = [];
    const recurringConcerns: string[] = [];
    const recommendedNextActions: string[] = [];

    // Executive summary creation
    let exec = '';
    if (summary.comparisonStatus === 'BASELINE_MISSING' || summary.comparisonStatus === 'NO_COMPARABLE_RUN') {
      exec = `Initial baseline established with ${summary.totalTestedTargetsCount} tested targets. No previous comparable run was available for delta calculation.`;
    } else {
      const deltaStr = summary.scoreDelta !== undefined
        ? (summary.scoreDelta > 0 ? `+${summary.scoreDelta}` : `${summary.scoreDelta}`)
        : '0';
      exec = `Release health is ${summary.releaseTrend.toLowerCase()} (${deltaStr} score delta) with ${regressions.length} new regression(s), ${recoveries.length} recovered defect(s), and ${recurrences.length} recurring defect(s).`;
    }

    // Degraded items
    for (const reg of regressions.slice(0, 5)) {
      const targetStr = reg.targetUrl + (reg.selector ? ` (${reg.selector})` : '');
      whatDegraded.push(
        `[${reg.severity.toUpperCase()}] New regression: ${this.cleanForPrompt(reg.title || reg.findingType)} on ${targetStr}`
      );
    }
    const degradedMetrics = metricDeltas.filter(m => m.direction === 'WORSE');
    for (const m of degradedMetrics.slice(0, 3)) {
      whatDegraded.push(
        `Metric ${m.metricName} degraded from ${m.previousValue ?? '--'} to ${m.currentValue ?? '--'}${m.unit ? ' ' + m.unit : ''}`
      );
    }

    // Improved items
    for (const rec of recoveries.slice(0, 5)) {
      const targetStr = rec.targetUrl + (rec.selector ? ` (${rec.selector})` : '');
      whatImproved.push(
        `[${rec.severity.toUpperCase()}] Recovered: ${this.cleanForPrompt(rec.title || rec.findingType)} on ${targetStr}`
      );
    }
    const improvedMetrics = metricDeltas.filter(m => m.direction === 'BETTER');
    for (const m of improvedMetrics.slice(0, 3)) {
      whatImproved.push(
        `Metric ${m.metricName} improved from ${m.previousValue ?? '--'} to ${m.currentValue ?? '--'}${m.unit ? ' ' + m.unit : ''}`
      );
    }

    // Recurring items
    for (const rec of recurrences.slice(0, 5)) {
      const targetStr = rec.targetUrl + (rec.selector ? ` (${rec.selector})` : '');
      recurringConcerns.push(
        `Persistent defect (${rec.occurrenceCount} runs): ${this.cleanForPrompt(rec.title || rec.findingType)} on ${targetStr}`
      );
    }
    const unstable = stabilitySignals.filter(s => s.stability === 'INTERMITTENT' || s.stability === 'STABLE_FAILURE');
    for (const u of unstable.slice(0, 3)) {
      recurringConcerns.push(
        `Target ${u.targetIdentifier} is ${u.stability} (${Math.round(u.flakeRate * 100)}% flakiness across ${u.totalEvaluations} runs)`
      );
    }

    // Changed overview
    if (regressions.length > 0) whatChanged.push(`${regressions.length} new regression(s) introduced.`);
    if (recoveries.length > 0) whatChanged.push(`${recoveries.length} defect(s) verified as recovered.`);
    if (recurrences.length > 0) whatChanged.push(`${recurrences.length} defect(s) recurred from previous runs.`);
    for (const cov of coverageTrends.filter(c => c.trendState !== 'STABLE' && c.trendState !== 'INSUFFICIENT_DATA')) {
      whatChanged.push(`Coverage for ${cov.dimension} is ${cov.trendState.toLowerCase()} (${Math.round((cov.delta ?? 0) * 100)}% change).`);
    }

    // Recommendations
    if (regressions.some(r => r.severity === 'critical' || r.severity === 'high')) {
      recommendedNextActions.push('Block release pipeline until critical and high severity regressions are addressed.');
    }
    if (unstable.length > 0) {
      recommendedNextActions.push(`Investigate ${unstable.length} unstable or flaky targets to stabilize test signals.`);
    }
    if (recoveries.length > 0) {
      recommendedNextActions.push('Maintain automated regression guards around verified recovered components.');
    }
    if (recommendedNextActions.length === 0) {
      recommendedNextActions.push('Proceed with standard release validation procedures.');
    }

    return {
      executiveSummary: exec,
      whatChanged: whatChanged.length > 0 ? whatChanged : ['No significant cross-run changes detected.'],
      whatDegraded: whatDegraded,
      whatImproved: whatImproved,
      recurringConcerns: recurringConcerns,
      recommendedNextActions: recommendedNextActions,
      confidence: 'high',
    };
  }

  /**
   * Main interpretation entry point. Tries OpenAI if available; falls back cleanly to deterministic.
   */
  public static async interpret(input: AIInterpreterInput): Promise<AIHistoricalSummary> {
    const apiKey = input.apiKey || process.env.OPENAI_API_KEY;
    const client = input.client || (apiKey ? new OpenAI({ apiKey, timeout: input.timeoutMs || 15000 }) : null);

    if (!client) {
      return this.generateDeterministicSummary(input);
    }

    try {
      const model = input.model || process.env.SCULRA_AI_MODEL || 'gpt-4o-mini';

      const promptData = {
        comparisonStatus: input.summary.comparisonStatus,
        scoreDelta: input.summary.scoreDelta,
        releaseTrend: input.summary.releaseTrend,
        totalTestedTargets: input.summary.totalTestedTargetsCount,
        regressionsCount: input.regressions.length,
        recoveriesCount: input.recoveries.length,
        recurrencesCount: input.recurrences.length,
        regressions: input.regressions.slice(0, 8).map(r => ({
          type: r.findingType,
          severity: r.severity,
          target: this.cleanForPrompt(r.targetUrl + (r.selector ? ` ${r.selector}` : '')),
          title: this.cleanForPrompt(r.title),
        })),
        recoveries: input.recoveries.slice(0, 8).map(r => ({
          type: r.findingType,
          severity: r.severity,
          target: this.cleanForPrompt(r.targetUrl + (r.selector ? ` ${r.selector}` : '')),
          title: this.cleanForPrompt(r.title),
        })),
        recurrences: input.recurrences.slice(0, 8).map(r => ({
          type: r.findingType,
          severity: r.severity,
          target: this.cleanForPrompt(r.targetUrl + (r.selector ? ` ${r.selector}` : '')),
          consecutiveRuns: r.consecutiveRunCount,
          occurrenceCount: r.occurrenceCount,
        })),
        unstableTargets: input.stabilitySignals
          .filter(s => s.stability === 'INTERMITTENT' || s.stability === 'STABLE_FAILURE')
          .slice(0, 5)
          .map(s => ({
            target: this.cleanForPrompt(s.targetIdentifier),
            stability: s.stability,
            flakeRate: Math.round(s.flakeRate * 100) + '%',
          })),
        metricDeltas: input.metricDeltas.slice(0, 5).map(m => ({
          metric: m.metricName,
          direction: m.direction,
          previous: m.previousValue,
          current: m.currentValue,
          unit: m.unit,
        })),
      };

      const systemPrompt = `You are Sculra's AI Historical QA Memory Interpreter.
Your job is to provide concise, factual, executive-level summaries of cross-run QA intelligence.
Rules:
- Strictly adhere to provided facts. Do NOT invent bugs, scores, or regressions.
- If comparisonStatus is BASELINE_MISSING, clearly explain that a baseline was established.
- Emphasize business risk, recovered components, and regressions.
- Respond with a JSON object matching this schema:
{
  "executiveSummary": "string",
  "whatChanged": ["string"],
  "whatDegraded": ["string"],
  "whatImproved": ["string"],
  "recurringConcerns": ["string"],
  "recommendedNextActions": ["string"],
  "confidence": "high" | "medium" | "low"
}`;

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze the following cross-run QA changes:\n${JSON.stringify(promptData, null, 2)}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        return this.generateDeterministicSummary(input);
      }

      const parsed = JSON.parse(rawContent);
      return {
        executiveSummary: typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary : 'Cross-run QA summary available.',
        whatChanged: Array.isArray(parsed.whatChanged) ? parsed.whatChanged : [],
        whatDegraded: Array.isArray(parsed.whatDegraded) ? parsed.whatDegraded : [],
        whatImproved: Array.isArray(parsed.whatImproved) ? parsed.whatImproved : [],
        recurringConcerns: Array.isArray(parsed.recurringConcerns) ? parsed.recurringConcerns : [],
        recommendedNextActions: Array.isArray(parsed.recommendedNextActions) ? parsed.recommendedNextActions : [],
        confidence: parsed.confidence === 'low' || parsed.confidence === 'medium' || parsed.confidence === 'high' ? parsed.confidence : 'high',
      };
    } catch (err) {
      // Fallback gracefully on any API or parsing error
      return this.generateDeterministicSummary(input);
    }
  }
}
