// ==============================================================================
// Sculra Fix Agent Telemetry & Audit Logger (worker/src/fix-agent/telemetry.ts)
// ==============================================================================

import { FixTelemetry, FixAgentState, FixAgentMode } from './types';
import { WorkerLogger } from '../logger';

export class FixTelemetryTracker {
  private startTime: number;
  private telemetry: Partial<FixTelemetry>;
  private logger: WorkerLogger;

  constructor(remediationId: string, projectId: string, issueId: string, mode: FixAgentMode, logger?: WorkerLogger) {
    this.startTime = Date.now();
    this.logger = logger || new WorkerLogger('fix_agent', remediationId);
    this.telemetry = {
      remediationId,
      projectId,
      issueId,
      mode,
      patchAttempts: 0,
      filesInspected: 0,
      filesChanged: 0,
      linesChanged: 0,
      testCount: 0,
      verificationDurationMs: 0,
    };
  }

  recordFilesInspected(count: number): void {
    this.telemetry.filesInspected = count;
  }

  recordPatchGenerated(filesCount: number, linesCount: number, attempts = 1, aiLatencyMs?: number, model?: string): void {
    this.telemetry.filesChanged = filesCount;
    this.telemetry.linesChanged = linesCount;
    this.telemetry.patchAttempts = attempts;
    if (aiLatencyMs) this.telemetry.aiLatencyMs = aiLatencyMs;
    if (model) this.telemetry.aiModel = model;
  }

  recordVerification(durationMs: number, testCount: number): void {
    this.telemetry.verificationDurationMs = durationMs;
    this.telemetry.testCount = testCount;
  }

  recordPRCreated(durationMs: number): void {
    this.telemetry.prCreationDurationMs = durationMs;
  }

  finalize(finalState: FixAgentState): FixTelemetry {
    const totalDurationMs = Date.now() - this.startTime;
    const finalTelemetry: FixTelemetry = {
      remediationId: this.telemetry.remediationId!,
      projectId: this.telemetry.projectId!,
      issueId: this.telemetry.issueId!,
      mode: this.telemetry.mode!,
      finalState,
      totalDurationMs,
      aiLatencyMs: this.telemetry.aiLatencyMs,
      aiModel: this.telemetry.aiModel,
      tokensUsed: this.telemetry.tokensUsed,
      patchAttempts: this.telemetry.patchAttempts || 0,
      filesInspected: this.telemetry.filesInspected || 0,
      filesChanged: this.telemetry.filesChanged || 0,
      linesChanged: this.telemetry.linesChanged || 0,
      testCount: this.telemetry.testCount || 0,
      verificationDurationMs: this.telemetry.verificationDurationMs || 0,
      prCreationDurationMs: this.telemetry.prCreationDurationMs,
    };

    this.logger.log('fix_agent_execution_completed', {
      remediationId: finalTelemetry.remediationId,
      finalState: finalTelemetry.finalState,
      totalDurationMs: finalTelemetry.totalDurationMs,
      filesChanged: finalTelemetry.filesChanged,
      linesChanged: finalTelemetry.linesChanged,
      testCount: finalTelemetry.testCount,
    });

    return finalTelemetry;
  }
}
