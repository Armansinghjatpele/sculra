// ==============================================================================
// Sculra Action Trace Formatter & Aggregator (worker/src/journeys/trace.ts)
// ==============================================================================

import { JourneyResult, JourneyStepExecution } from './types';

export interface FormattedJourneyTrace {
  journeyId: string;
  name: string;
  status: string;
  durationMs: number;
  steps: Array<{
    stepNumber: number;
    action: string;
    target: string;
    status: string;
    durationMs: number;
    transition?: string;
    error?: string;
  }>;
  observationsSummary: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
}

export function formatJourneyTrace(result: JourneyResult): FormattedJourneyTrace {
  return {
    journeyId: result.journeyId,
    name: result.name,
    status: result.status,
    durationMs: result.durationMs,
    steps: result.steps.map((step, idx) => ({
      stepNumber: idx + 1,
      action: step.action,
      target: step.targetDescription,
      status: step.status,
      durationMs: step.durationMs,
      transition:
        step.beforeUrl !== step.afterUrl
          ? `${step.beforeUrl} → ${step.afterUrl}`
          : undefined,
      error: step.error,
    })),
    observationsSummary: result.observations.map((obs) => ({
      type: obs.type,
      message: obs.message,
      severity: obs.severity,
    })),
  };
}

export function generateMarkdownTrace(results: JourneyResult[]): string {
  const lines: string[] = ['# Sculra Deterministic User Journey Execution Trace\n'];

  for (const result of results) {
    lines.push(`## Journey: ${result.name} (${result.status})`);
    lines.push(`- **Duration**: ${(result.durationMs / 1000).toFixed(2)}s`);
    lines.push(`- **Viewport**: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`);
    lines.push(`- **Actions**: ${result.actionsPassed} passed, ${result.actionsFailed} failed, ${result.actionsSkipped} skipped\n`);

    lines.push('| Step | Action | Target | Status | Transition |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');

    result.steps.forEach((s, idx) => {
      const transition = s.beforeUrl !== s.afterUrl ? `${s.beforeUrl} → ${s.afterUrl}` : '—';
      lines.push(`| ${idx + 1} | \`${s.action}\` | ${s.targetDescription} | **${s.status}** | ${transition} |`);
    });

    if (result.observations.length > 0) {
      lines.push('\n### Observations:');
      result.observations.forEach((obs) => {
        lines.push(`- **[${obs.type}]** (${obs.severity}): ${obs.message}`);
      });
    }

    lines.push('\n---\n');
  }

  return lines.join('\n');
}
