// ==============================================================================
// Sculra Test Command Planner (worker/src/fix-agent/test-planner.ts)
// ==============================================================================

import { VerificationPlan } from '../remediation/types';
import { TestCommandPlan, ProjectFixPolicy } from './types';
import { FIX_AGENT_POLICY } from './policy';
import { FixSecurityScanner } from './security';
import { PolicyBlockedError } from './errors';

const ALLOWED_COMMAND_PREFIXES: RegExp[] = [
  /^(npm|pnpm|yarn)\s+test\b/i,
  /^(npm|pnpm|yarn)\s+run\s+(test|typecheck|lint|build)\b/i,
  /^npx\s+(vitest|jest|playwright|tsc|eslint)\b/i,
  /^vitest\s+run\b/i,
  /^tsc\s+--noEmit\b/i,
];

export class TestPlanner {
  /**
   * Translates a VerificationPlan into a deterministic, policy-guarded test command plan.
   */
  static planTests(
    plan: VerificationPlan,
    policy: ProjectFixPolicy,
    customCommands?: string[]
  ): TestCommandPlan {
    const rawCommands: string[] = [];

    // 1. Incorporate custom commands if supplied
    if (customCommands && customCommands.length > 0) {
      rawCommands.push(...customCommands);
    } else {
      // 2. Derive commands from VerificationPlan regressionTests or defaults
      if (plan.regressionTests && plan.regressionTests.length > 0) {
        for (const testTarget of plan.regressionTests) {
          rawCommands.push(`npm test -- ${testTarget}`);
        }
      } else {
        // Safe default verification checks
        rawCommands.push('npm test');
      }
    }

    const validatedCommands: string[] = [];
    const maxCommands = Math.min(
      policy.fix_agent_max_test_commands || FIX_AGENT_POLICY.MAX_TEST_COMMANDS,
      FIX_AGENT_POLICY.MAX_TEST_COMMANDS
    );

    for (const cmd of rawCommands) {
      const trimmed = cmd.trim();
      if (!trimmed) continue;

      // Destructive command check
      if (FixSecurityScanner.containsDestructiveCommand(trimmed)) {
        throw new PolicyBlockedError(
          `Destructive command blocked: "${trimmed}"`,
          'DESTRUCTIVE_COMMAND_BLOCKED'
        );
      }

      // Allowlist verification
      const isAllowed = ALLOWED_COMMAND_PREFIXES.some((p) => p.test(trimmed));
      if (!isAllowed) {
        throw new PolicyBlockedError(
          `Command "${trimmed}" is not in the authorized test runner allowlist`,
          'COMMAND_NOT_ALLOWLISTED'
        );
      }

      validatedCommands.push(trimmed);
      if (validatedCommands.length >= maxCommands) break;
    }

    return {
      commands: validatedCommands,
      targetedDomains: (plan.suggestedDomains || []).map(String),
      timeoutSeconds: FIX_AGENT_POLICY.MAX_COMMAND_SECONDS,
    };
  }
}
