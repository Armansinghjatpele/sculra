// ==============================================================================
// Sculra Autonomous QA Observability & Control Center Domain Types
// (worker/src/observability/types.ts)
// ==============================================================================

export type ActorType = 'SYSTEM' | 'WORKER' | 'AI' | 'HUMAN' | 'GITHUB' | 'CI' | 'SOURCE_INGESTOR';

export type EventSource = 'DETERMINISTIC' | 'AI' | 'HUMAN' | 'EXTERNAL' | 'SOURCE';

export type FactCategory =
  | 'OBSERVED_FACT'
  | 'INFERRED_CONCLUSION'
  | 'AI_HYPOTHESIS'
  | 'RECOMMENDATION'
  | 'ACTION'
  | 'ACTION_RESULT'
  | 'HUMAN_DECISION';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE';

export type AutonomousEventType =
  // Campaign Lifecycle
  | 'CAMPAIGN_CREATED'
  | 'CAMPAIGN_STARTED'
  | 'CAMPAIGN_PAUSED'
  | 'CAMPAIGN_RESUMED'
  | 'CAMPAIGN_CANCELLED'
  | 'CAMPAIGN_COMPLETED'
  // Discovery
  | 'DISCOVERY_STARTED'
  | 'DISCOVERY_COMPLETED'
  | 'TARGET_DISCOVERED'
  | 'TARGET_SKIPPED'
  // Strategy
  | 'STRATEGY_GENERATED'
  | 'TARGET_PRIORITIZED'
  | 'TARGET_DEFERRED'
  // Test Execution
  | 'TEST_STARTED'
  | 'TEST_COMPLETED'
  | 'TEST_FAILED'
  | 'TEST_CANCELLED'
  // Issues & Findings
  | 'ISSUE_CREATED'
  | 'ISSUE_UPDATED'
  | 'ISSUE_REOPENED'
  | 'ISSUE_RECOVERED'
  | 'EVIDENCE_CAPTURED'
  // Security QA
  | 'SECURITY_CHECK_STARTED'
  | 'SECURITY_FINDING_CREATED'
  // Performance QA
  | 'PERFORMANCE_CHECK_STARTED'
  | 'PERFORMANCE_FINDING_CREATED'
  // Accessibility QA
  | 'ACCESSIBILITY_CHECK_STARTED'
  | 'ACCESSIBILITY_FINDING_CREATED'
  // Historical Comparison
  | 'HISTORICAL_COMPARISON_COMPLETED'
  | 'REGRESSION_DETECTED'
  | 'RECOVERY_DETECTED'
  // Release Readiness
  | 'RELEASE_SCORE_CALCULATED'
  | 'RELEASE_BLOCKER_CREATED'
  // AI Analysis
  | 'AI_ANALYSIS_STARTED'
  | 'AI_ANALYSIS_COMPLETED'
  | 'AI_ANALYSIS_FAILED'
  // Root Cause
  | 'ROOT_CAUSE_ANALYSIS_STARTED'
  | 'ROOT_CAUSE_ANALYSIS_COMPLETED'
  // Safe Fix Agent Remediation
  | 'FIX_REQUESTED'
  | 'FIX_AUTHORIZED'
  | 'FIX_BLOCKED'
  | 'PATCH_GENERATED'
  | 'PATCH_REJECTED'
  | 'PATCH_APPLIED'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_COMPLETED'
  | 'REMEDIATION_FAILED'
  | 'PR_CREATED'
  // CI/CD Integration
  | 'CI_STARTED'
  | 'CI_COMPLETED'
  | 'CI_GATE_EVALUATED'
  // Human Approval Governance
  | 'HUMAN_APPROVAL_REQUESTED'
  | 'HUMAN_APPROVED'
  | 'HUMAN_REJECTED'
  // Multi-Source Ingestion & Connection Intelligence
  | 'SOURCE_VALIDATION_STARTED'
  | 'SOURCE_VALIDATED'
  | 'SOURCE_VALIDATION_FAILED'
  | 'SOURCE_CONNECTED'
  | 'SOURCE_CHANGED'
  | 'SOURCE_UNCHANGED'
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_HEALTH_CHANGED'
  | 'SOURCE_SNAPSHOT_CREATED'
  | 'SOURCE_CAPABILITIES_RESOLVED';

export type SkipReason =
  | 'AUTH_REQUIRED'
  | 'POLICY_BLOCKED'
  | 'DESTRUCTIVE_ACTION'
  | 'DUPLICATE_TARGET'
  | 'BUDGET_EXHAUSTED'
  | 'LOW_PRIORITY'
  | 'ALREADY_COVERED'
  | 'UNSUPPORTED_SURFACE'
  | 'INSUFFICIENT_CONTEXT'
  | 'SECURITY_RESTRICTION'
  | 'CANCELLED'
  | 'ENVIRONMENT_UNAVAILABLE'
  | 'NO_CHANGES_DETECTED'
  | 'FLAKY_QUARANTINED';

export interface AutonomousEvent {
  id: string;
  organizationId?: string | null;
  projectId: string;
  campaignId?: string | null;
  testRunId?: string | null;
  issueId?: string | null;
  remediationId?: string | null;
  actorType: ActorType;
  actorId: string;
  eventType: AutonomousEventType;
  stage: string;
  status: string;
  summary: string;
  reason?: string | null;
  confidence?: ConfidenceLevel | null;
  source: EventSource;
  factCategory: FactCategory;
  evidenceIds: string[];
  relatedEntityIds: string[];
  metadata: Record<string, any>;
  createdAt: string;
}

export type DecisionType =
  | 'TARGET_SELECTION'
  | 'TARGET_SKIP'
  | 'STRATEGY_DECISION'
  | 'RELEASE_STATUS'
  | 'REMEDIATION_AUTHORIZATION'
  | 'FIX_BLOCK'
  | 'PR_CREATION'
  | 'CAMPAIGN_CANCELLATION'
  | 'HUMAN_APPROVAL';

export interface DecisionRecord {
  id: string;
  organizationId?: string | null;
  projectId: string;
  campaignId?: string | null;
  testRunId?: string | null;
  entityType: string;
  entityId: string;
  decisionType: DecisionType;
  actorType: ActorType;
  actorId: string;
  decision: string;
  reason: string;
  skipReason?: SkipReason | null;
  evidenceIds: string[];
  policyChecks: Array<{ policy: string; passed: boolean; message?: string }>;
  confidence: ConfidenceLevel;
  source: EventSource;
  result?: string | null;
  nextAction?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export type HumanApprovalStatus =
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export type ApprovalActionType =
  | 'APPLY_REMEDIATION'
  | 'CREATE_PR'
  | 'ENABLE_FIX_AGENT'
  | 'SECURITY_SENSITIVE_FIX'
  | 'AUTH_SENSITIVE_FIX'
  | 'DATABASE_MODIFICATION'
  | 'RELEASE_GATE_OVERRIDE';

export interface HumanApprovalRecord {
  id: string;
  organizationId?: string | null;
  projectId: string;
  remediationId?: string | null;
  actionType: ApprovalActionType;
  status: HumanApprovalStatus;
  sourceSha: string;
  fixPlanVersion: number;
  filesAffected: string[];
  diffPreview?: string | null;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  requestedBy: string;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  decisionReason?: string | null;
  policyContext: Record<string, any>;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceNodeType =
  | 'CAMPAIGN'
  | 'TARGET'
  | 'TEST'
  | 'OBSERVATION'
  | 'ISSUE'
  | 'HISTORICAL_COMPARISON'
  | 'ROOT_CAUSE'
  | 'FIX_PLAN'
  | 'PATCH'
  | 'VERIFICATION'
  | 'PR'
  | 'APPROVAL';

export interface EvidenceNode {
  id: string;
  type: EvidenceNodeType;
  title: string;
  status: string;
  exists: boolean;
  entityId?: string | null;
  url?: string | null;
  details?: Record<string, any>;
}

export interface EvidenceEdge {
  fromNodeId: string;
  toNodeId: string;
  relationship: string;
}

export interface EvidenceGraph {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  missingCount: number;
}

export interface AutonomousHealthMetrics {
  activeWorkersCount: number;
  queuedJobsCount: number;
  staleLeasesCount: number;
  failedJobsCount: number;
  activeCampaignsCount: number;
  blockedTasksCount: number;
  pendingApprovalsCount: number;
  openCriticalIssuesCount: number;
  recentRegressionsCount: number;
  recentRemediationsCount: number;
  updatedAt: string;
}

export interface TimelineFilter {
  actorType?: ActorType;
  factCategory?: FactCategory;
  eventType?: AutonomousEventType;
  stage?: string;
  source?: EventSource;
  limit?: number;
  offset?: number;
  since?: string;
  until?: string;
}

export interface TimelineItem {
  event: AutonomousEvent;
  formattedTime: string;
  timeAgo: string;
  badgeColor: string;
}
