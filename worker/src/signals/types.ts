// ==============================================================================
// Sculra Production Signals & Post-Release QA Intelligence Domain Types
// (worker/src/signals/types.ts)
//
// Invariants (Prompt 64):
// - NO EVIDENCE -> NO INFERENCE
// - Temporal proximity is TEMPORAL_ONLY, never causality
// - Missing monitoring data is INSUFFICIENT_EVIDENCE, never HEALTHY
// - Empty string fields are normalized to null
// ==============================================================================

export type ProductionSignalType =
  | 'ERROR'
  | 'EXCEPTION'
  | 'PERFORMANCE_DEGRADATION'
  | 'AVAILABILITY_FAILURE'
  | 'USER_JOURNEY_FAILURE'
  | 'HTTP_ERROR'
  | 'API_FAILURE'
  | 'SECURITY_EVENT'
  | 'ACCESSIBILITY_REGRESSION'
  | 'VISUAL_REGRESSION'
  | 'RESOURCE_FAILURE'
  | 'CUSTOM_INCIDENT';

export type ProductionSignalSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ProductionSignalStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'CONFIRMED_REGRESSION'
  | 'POSSIBLE_REGRESSION'
  | 'RESOLVED'
  | 'SUPPRESSED'
  | 'IGNORED';

export type ProductionSignalProvider =
  | 'SENTRY'
  | 'POSTHOG'
  | 'GENERIC_WEBHOOK'
  | 'MANUAL'
  | 'CI_CD';

export type CorrelationState =
  | 'EXACT_MATCH'
  | 'STRONG_CORRELATION'
  | 'POSSIBLE_CORRELATION'
  | 'TEMPORAL_ONLY'
  | 'NO_CORRELATION'
  | 'INSUFFICIENT_EVIDENCE'
  | 'AMBIGUOUS';

export type PostReleaseHealthState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'REGRESSION_DETECTED'
  | 'INCIDENT_ACTIVE'
  | 'RECOVERY_OBSERVED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'UNKNOWN';

export type RecoveryState =
  | 'SIGNAL_DISAPPEARED'
  | 'WORKFLOW_RECOVERED'
  | 'REGRESSION_RESOLVED'
  | 'ROOT_CAUSE_FIXED'
  | 'NO_RECOVERY_OBSERVED'
  | 'INSUFFICIENT_EVIDENCE';

export type IssueMatchState =
  | 'MATCHED_EXISTING_ISSUE'
  | 'POSSIBLE_MATCH'
  | 'NEW_SIGNAL'
  | 'INSUFFICIENT_EVIDENCE';

export interface ProductionSignal {
  id: string;
  organizationId: string | null;
  projectId: string;
  environmentId: string | null;
  deploymentId: string | null;
  releaseId: string | null;
  provider: ProductionSignalProvider;
  providerSignalId: string | null;
  signalType: ProductionSignalType;
  severity: ProductionSignalSeverity;
  status: ProductionSignalStatus;
  title: string;
  description: string | null;
  fingerprint: string;
  firstObservedAt: string;
  lastObservedAt: string;
  resolvedAt: string | null;
  affectedUrl: string | null;
  affectedRoute: string | null;
  affectedService: string | null;
  affectedVersion: string | null;
  affectedCommit: string | null;
  affectedBranch: string | null;
  occurrenceCount: number;
  rawReference: Record<string, any>;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface SignalCorrelation {
  id: string;
  signalId: string;
  projectId: string;
  organizationId: string | null;
  deploymentId: string | null;
  releaseId: string | null;
  correlationState: CorrelationState;
  confidence: number;
  reasons: string[];
  evidenceDetails: Record<string, any>;
  evaluatedAt: string;
}

export interface PostReleaseVerification {
  id: string;
  projectId: string;
  organizationId: string | null;
  deploymentId: string;
  campaignId: string | null;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  targetWorkflows: string[];
  findings: Record<string, any>;
  healthState: PostReleaseHealthState;
  createdAt: string;
  updatedAt: string;
}

export interface QAFeedbackMemoryRecord {
  id: string;
  projectId: string;
  organizationId: string | null;
  entityType: string;
  entityId: string;
  relationshipType: string;
  signalId: string | null;
  deploymentId: string | null;
  evidenceSummary: Record<string, any>;
  confidence: number;
  createdAt: string;
}

export interface NormalizedSignalInput {
  organizationId?: string | null;
  projectId: string;
  environmentId?: string | null;
  deploymentId?: string | null;
  releaseId?: string | null;
  provider: ProductionSignalProvider;
  providerSignalId?: string | null;
  signalType: ProductionSignalType;
  severity: ProductionSignalSeverity;
  status?: ProductionSignalStatus;
  title: string;
  description?: string | null;
  fingerprint?: string | null;
  firstObservedAt?: string | null;
  lastObservedAt?: string | null;
  resolvedAt?: string | null;
  affectedUrl?: string | null;
  affectedRoute?: string | null;
  affectedService?: string | null;
  affectedVersion?: string | null;
  affectedCommit?: string | null;
  affectedBranch?: string | null;
  occurrenceCount?: number;
  rawReference?: Record<string, any>;
  confidence?: number;
}
