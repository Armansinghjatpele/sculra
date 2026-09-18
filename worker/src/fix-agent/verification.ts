// ==============================================================================
// Sculra Verification & Baseline Reproduction Manager (worker/src/fix-agent/verification.ts)
// ==============================================================================

import {
  VerificationResult,
  VerificationStatus,
  BaselineStatus,
  TestCommandResult,
  TestCommandPlan,
} from './types';
import { TestRunner } from './test-runner';
import { IsolatedWorkspaceManager } from './workspace';
import { BugObservation } from '../issues/types';

export class VerificationManager {
  private testRunner: TestRunner;

  constructor(testRunner?: TestRunner) {
    this.testRunner = testRunner || new TestRunner();
  }

  /**
   * Evaluates baseline reproduction on the unpatched workspace.
   */
  async runBaselineReproduction(
    workspace: IsolatedWorkspaceManager,
    observation?: BugObservation,
    testPlan?: TestCommandPlan
  ): Promise<{ status: BaselineStatus; details: string }> {
    // If no test plan or observation, mark baseline as inconclusive/skipped
    if (!testPlan || testPlan.commands.length === 0) {
      return {
        status: 'BASELINE_INCONCLUSIVE',
        details: 'No dedicated baseline reproduction command specified',
      };
    }

    const command = testPlan.commands[0];
    const res = await this.testRunner.runCommand(
      command,
      workspace.workspacePath,
      testPlan.timeoutSeconds
    );

    // If test failed in baseline, that confirms the bug reproduces!
    if (!res.passed) {
      return {
        status: 'BASELINE_REPRODUCED',
        details: `Original failure observed on unpatched workspace (${command} exited ${res.exitCode})`,
      };
    }

    return {
      status: 'BASELINE_NOT_REPRODUCED',
      details: `Baseline test passed without reproduction (${command} exited 0)`,
    };
  }

  /**
   * Runs targeted verification and regression checks on the patched workspace.
   */
  async runPostFixVerification(
    workspace: IsolatedWorkspaceManager,
    testPlan: TestCommandPlan,
    baselineStatus: BaselineStatus
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    const targetedResults: TestCommandResult[] = [];
    let allPassed = true;
    let anyTimedOut = false;

    for (const cmd of testPlan.commands) {
      const res = await this.testRunner.runCommand(
        cmd,
        workspace.workspacePath,
        testPlan.timeoutSeconds
      );
      targetedResults.push(res);

      if (!res.passed) {
        allPassed = false;
      }
      if (res.timedOut) {
        anyTimedOut = true;
      }
    }

    const durationMs = Date.now() - startTime;

    let status: VerificationStatus;
    let summary: string;

    if (anyTimedOut) {
      status = 'VERIFICATION_TIMEOUT';
      summary = 'Verification timed out during test execution';
    } else if (allPassed) {
      if (baselineStatus === 'BASELINE_REPRODUCED' || baselineStatus === 'BASELINE_INCONCLUSIVE') {
        status = 'VERIFIED_FIXED';
        summary = `Verified fixed: All ${targetedResults.length} test command(s) passed successfully`;
      } else {
        status = 'PARTIALLY_VERIFIED';
        summary = 'Tests passed, but baseline failure was not conclusively reproduced prior to patch';
      }
    } else {
      const passedCount = targetedResults.filter((r) => r.passed).length;
      if (passedCount > 0) {
        status = 'PARTIALLY_VERIFIED';
        summary = `Partially verified: ${passedCount}/${targetedResults.length} test command(s) passed`;
      } else {
        status = 'VERIFIED_NOT_FIXED';
        summary = `Verification failed: 0/${targetedResults.length} test command(s) passed`;
      }
    }

    return {
      status,
      baselineStatus,
      targetedCommandResults: targetedResults,
      regressionCommandResults: [],
      summary,
      durationMs,
      allPassed,
    };
  }
}
