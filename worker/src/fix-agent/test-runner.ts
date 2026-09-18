// ==============================================================================
// Sculra Bounded Test Command Runner (worker/src/fix-agent/test-runner.ts)
// ==============================================================================

import { exec } from 'child_process';
import { TestCommandResult } from './types';
import { redactSecrets } from './redaction';
import { FIX_AGENT_POLICY } from './policy';

export type TestExecutionHandler = (
  command: string,
  cwd: string,
  timeoutMs: number
) => Promise<TestCommandResult>;

export class TestRunner {
  private customHandler?: TestExecutionHandler;

  constructor(customHandler?: TestExecutionHandler) {
    this.customHandler = customHandler;
  }

  /**
   * Executes a command inside the isolated workspace with timeout and bounded output capture.
   */
  async runCommand(command: string, cwd: string, timeoutSeconds = 120): Promise<TestCommandResult> {
    const timeoutMs = timeoutSeconds * 1000;

    if (this.customHandler) {
      return this.customHandler(command, cwd, timeoutMs);
    }

    const startTime = Date.now();

    return new Promise((resolve) => {
      let timedOut = false;
      const child = exec(
        command,
        {
          cwd,
          timeout: timeoutMs,
          maxBuffer: FIX_AGENT_POLICY.MAX_TEST_OUTPUT_BYTES * 2,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            CI: 'true',
          },
        },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - startTime;
          const exitCode = error ? (error as any).code || 1 : 0;
          timedOut = error?.killed || false;

          let cleanStdout = redactSecrets(stdout || '');
          let cleanStderr = redactSecrets(stderr || '');

          if (cleanStdout.length > FIX_AGENT_POLICY.MAX_TEST_OUTPUT_BYTES) {
            cleanStdout = cleanStdout.slice(0, FIX_AGENT_POLICY.MAX_TEST_OUTPUT_BYTES) + '\n...[TRUNCATED]';
          }

          if (cleanStderr.length > FIX_AGENT_POLICY.MAX_TEST_OUTPUT_BYTES) {
            cleanStderr = cleanStderr.slice(0, FIX_AGENT_POLICY.MAX_TEST_OUTPUT_BYTES) + '\n...[TRUNCATED]';
          }

          resolve({
            command,
            exitCode: timedOut ? 124 : exitCode,
            durationMs,
            passed: exitCode === 0 && !timedOut,
            stdoutSnippet: cleanStdout,
            stderrSnippet: cleanStderr,
            timedOut,
          });
        }
      );
    });
  }
}
