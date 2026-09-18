// ==============================================================================
// Sculra Test Worker Entry Point (worker/src/index.ts)
// ==============================================================================

import 'dotenv/config';
import { BrowserRunner } from './runner';
import { JobExecutor } from './executor';
import { WorkerDaemon } from './daemon';
import { validateTargetUrl } from './security';
import { WorkerLogger } from './logger';
import { SupabaseEvidenceStorage, LocalEvidenceStorage } from './storage';

export * from './types';
export * from './runner';
export * from './executor';
export * from './daemon';
export * from './discovery';
export * from './discoveryUtils';
export * from './journeys';
export * from './issues';
export * from './visual';
export * from './ai-qa';
export * from './strategy';
export * from './product';
export * from './auth';
export * from './api-qa';
export * from './release';
export * from './security';
export * from './performance';
export * from './accessibility';
export * from './logger';
export * from './storage';
export * from './execution';
export * from './cicd';
export * from './change-intelligence';
export * from './remediation';
export * as fixAgent from './fix-agent';
export {
  FixAgentOrchestrator,
  FixAgentStateMachine,
  FixAuthorizationManager,
  FixPlanValidator,
  FixPatchGenerator,
  FixPatchValidator,
  IsolatedWorkspaceManager,
  SafeGitOperations,
  PatchApplier,
  DiffReviewer,
  TestPlanner,
  TestRunner,
  VerificationManager,
  RollbackManager,
  GitHubPRCreator,
  FixSecurityScanner,
  FixTelemetryTracker,
  FIX_AGENT_POLICY,
  DEFAULT_PROJECT_FIX_POLICY,
} from './fix-agent';
export type {
  FixAgentMode,
  FixAgentState,
  FixBaselineStatus,
  FixVerificationStatus,
  FixVerificationResult,
  FixEvidenceType,
  ProjectFixPolicy,
  FixRequest,
  PatchEdit,
  StructuredPatch,
  PatchValidationResult,
  DiffReviewResult,
  TestCommandPlan,
  TestCommandResult,
  PullRequestResult,
  FixRemediationRecord,
  FixEvidenceRecord,
  FixTelemetry,
} from './fix-agent';

// CLI Support:
// 1. Daemon mode (default): `pnpm worker` or `tsx src/index.ts`
// 2. Single Run mode: `pnpm worker <testRunId>` or `tsx src/index.ts <testRunId>`
if (require.main === module) {
  const arg = process.argv[2];

  if (arg && arg !== '--daemon' && !arg.startsWith('--')) {
    const testRunId = arg;
    const executor = new JobExecutor();
    console.log(`[Worker CLI]: Executing single test run ${testRunId}...`);

    executor
      .executeTestRun(testRunId)
      .then((res) => {
        console.log(`[Worker CLI]: Execution finished with status "${res.status}". Result:`, res);
        process.exit(res.success ? 0 : 1);
      })
      .catch((err) => {
        console.error('[Worker CLI]: Fatal error during single execution:', err);
        process.exit(1);
      });
  } else {
    const daemon = new WorkerDaemon();
    console.log(`[Worker CLI]: Starting Sculra Test Worker Daemon (ID: ${daemon.identity.workerId})...`);
    daemon.start().catch((err) => {
      console.error('[Worker CLI]: Daemon failed to start:', err);
      process.exit(1);
    });

    const shutdown = async () => {
      console.log('\n[Worker CLI]: Termination signal received. Gracefully shutting down worker daemon...');
      await daemon.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}
