// ==============================================================================
// Sculra Live Action & Current State Inspector
// (worker/src/observability/action.ts)
// ==============================================================================

export interface LiveActionState {
  headline: string;
  stage: string;
  status: string;
  targetIdentifier?: string | null;
  startedAt?: string | null;
  elapsedSeconds?: number;
  workerId?: string | null;
  isRunning: boolean;
}

export class ActionStateInspector {
  /**
   * Produces factual "What Sculra is doing" statements based on real campaign/worker state.
   */
  public static inspect(params: {
    campaignStatus?: string | null;
    campaignStage?: string | null;
    currentTaskKey?: string | null;
    currentTargetIdentifier?: string | null;
    workerStatus?: string | null;
    workerId?: string | null;
    taskStartedAt?: string | null;
    pendingApprovalCount?: number;
    remediationState?: string | null;
  }): LiveActionState {
    const {
      campaignStatus,
      campaignStage,
      currentTargetIdentifier,
      workerId,
      taskStartedAt,
      pendingApprovalCount = 0,
      remediationState,
    } = params;

    const isRunning =
      campaignStatus === 'RUNNING' ||
      campaignStatus === 'PLANNING' ||
      remediationState === 'VERIFICATION_RUNNING' ||
      remediationState === 'WORKSPACE_CREATED';

    const elapsedSeconds = taskStartedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(taskStartedAt).getTime()) / 1000))
      : 0;

    // 1. Pending Approval overrides if waiting
    if (pendingApprovalCount > 0 || remediationState === 'REQUESTED') {
      return {
        headline: 'Waiting for human approval before code modification',
        stage: 'HUMAN_GOVERNANCE',
        status: 'WAITING_APPROVAL',
        targetIdentifier: currentTargetIdentifier || null,
        startedAt: taskStartedAt || null,
        elapsedSeconds,
        workerId: workerId || null,
        isRunning: false,
      };
    }

    // 2. Fix Agent Active States
    if (remediationState) {
      switch (remediationState) {
        case 'WORKSPACE_CREATED':
        case 'BASELINE_VERIFIED':
          return {
            headline: 'Executing baseline reproduction in isolated scratch sandbox',
            stage: 'REMEDIATION_SANDBOX',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
        case 'VERIFICATION_RUNNING':
          return {
            headline: 'Running targeted post-fix verification tests',
            stage: 'REMEDIATION_VERIFICATION',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
        case 'DIFF_REVIEWED':
          return {
            headline: 'Conducting automated security and diff review',
            stage: 'DIFF_REVIEW',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
      }
    }

    // 3. Campaign Stages
    if (campaignStatus === 'RUNNING' || campaignStatus === 'PLANNING') {
      switch (campaignStage) {
        case 'DISCOVERY':
        case 'DISCOVERY_MAPPING':
          return {
            headline: 'Discovering application surfaces and route hierarchy',
            stage: 'DISCOVERY',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
        case 'PRODUCT':
        case 'PRODUCT_UNDERSTANDING':
          return {
            headline: 'Analyzing business criticality and critical workflows',
            stage: 'PRODUCT_ANALYSIS',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
        case 'STRATEGY':
        case 'STRATEGY_GENERATION':
          return {
            headline: 'Synthesizing autonomous test strategy and budget allocation',
            stage: 'STRATEGY',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
        case 'EXECUTION':
        case 'SURFACE_VERIFICATION':
          return {
            headline: currentTargetIdentifier
              ? `Testing target surface "${currentTargetIdentifier}"`
              : 'Executing scheduled QA test targets',
            stage: 'TEST_EXECUTION',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
        case 'HISTORICAL_CORRELATION':
          return {
            headline: 'Correlating observations with historical run memory',
            stage: 'HISTORICAL_ANALYSIS',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
        case 'ROOT_CAUSE':
        case 'ROOT_CAUSE_ANALYSIS':
          return {
            headline: 'Diagnosing root cause and grounding fix plan',
            stage: 'ROOT_CAUSE_ANALYSIS',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
        case 'RELEASE_EVALUATION':
          return {
            headline: 'Calculating multi-dimensional release readiness index',
            stage: 'RELEASE_EVALUATION',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
        default:
          return {
            headline: 'Executing autonomous QA campaign tasks',
            stage: campaignStage || 'CAMPAIGN_EXECUTION',
            status: 'RUNNING',
            targetIdentifier: currentTargetIdentifier,
            startedAt: taskStartedAt,
            elapsedSeconds,
            workerId,
            isRunning: true,
          };
      }
    }

    // Default Idle State
    return {
      headline: 'No autonomous QA activity is currently running.',
      stage: 'IDLE',
      status: 'IDLE',
      targetIdentifier: null,
      startedAt: null,
      elapsedSeconds: 0,
      workerId: null,
      isRunning: false,
    };
  }
}
