// ==============================================================================
// Sculra Test Worker Entry Point (worker/src/index.ts)
// ==============================================================================

import 'dotenv/config';
import { BrowserRunner } from './runner';
import { JobExecutor } from './executor';
import { WorkerDaemon } from './daemon';
import { validateTargetUrl } from './security';
import { WorkerLogger } from './logger';
import { ProductionWorkerServer } from './server';
import { runBrowserSmokeTest } from './smoke-test';
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
export * from './campaign';
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
export * as credentials from './credentials';
export * from './credentials';
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
export * as observability from './observability';
export {
  AutonomousEventBuilder,
  AutonomousEventStore,
  DecisionManager,
  ExplanationGenerator,
  TimelineAssembler,
  EvidenceMapBuilder,
  ApprovalSecurityManager,
  ActionStateInspector,
  ConfidenceEvaluator,
  ObservabilityTelemetry,
  ObservabilityQueries,
  ObservabilityRedactor,
  OBSERVABILITY_POLICY,
} from './observability';
export type {
  ActorType,
  EventSource,
  FactCategory,
  ConfidenceLevel,
  AutonomousEventType,
  SkipReason,
  AutonomousEvent,
  DecisionType,
  DecisionRecord,
  HumanApprovalStatus,
  ApprovalActionType,
  HumanApprovalRecord,
  EvidenceNodeType,
  EvidenceNode,
  EvidenceEdge,
  EvidenceGraph,
  AutonomousHealthMetrics,
  TimelineFilter,
  TimelineItem,
} from './observability';

export * as sources from './sources';
export {
  SourceOrchestrator,
  SourceAdapterRegistry,
  SourceSnapshotManager,
  SourceHealthTracker,
  SourceFingerprinter,
  SourceCapabilityResolver,
  SourceRedactor,
  SourceCache,
  SourceEventEmitter,
  BoundedHttpClient,
  SOURCE_POLICY,
  WebsiteSourceAdapter,
  GitHubSourceAdapter,
  ApiSourceAdapter,
  ZipSourceAdapter,
  DesktopSourceAdapter,
} from './sources';
export type {
  SourceType,
  SourceStatus,
  SourceHealthState,
  CapabilityState,
  SourceCapabilityKey,
  SourceCapability,
  ProjectSource,
  SourceSnapshot,
  SourceHealthObservation,
  SourceFingerprint,
  SourceChangeType,
  SourceChange,
  SourceValidationError,
  SourceValidationResult,
  SourceValidationOptions,
  IngestSourceInput,
  IngestSourceResult,
} from './sources';

export * as authz from './authz';
export * from './authz';
export * from './config';
export * from './health';
export * from './server';
export * from './errors';
export * from './smoke-test';

// CLI Support:
// 1. Production Daemon mode (default): `pnpm worker` or `tsx src/index.ts`
// 2. Single Run mode: `pnpm worker <testRunId>` or `tsx src/index.ts <testRunId>`
// 3. Smoke Test mode: `tsx src/index.ts --smoke-test`
if (require.main === module) {
  const arg = process.argv[2];

  if (arg === '--smoke-test') {
    runBrowserSmokeTest()
      .then((res) => process.exit(res.success ? 0 : 1))
      .catch((err) => {
        console.error('[Worker CLI]: Smoke test failed:', err);
        process.exit(1);
      });
  } else if (arg && arg !== '--daemon' && !arg.startsWith('--')) {
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
    try {
      const server = new ProductionWorkerServer();
      console.log(`[Worker CLI]: Starting Sculra Production Worker Server (ID: ${server.config.workerId})...`);
      server.start().catch((err) => {
        console.error('[Worker CLI]: Worker server failed to start:', err.message);
        process.exit(1);
      });
    } catch (err: any) {
      console.error('[Worker CLI]: Fatal startup configuration error:', err.message);
      process.exit(1);
    }
  }
}
