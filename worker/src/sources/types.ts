// ==============================================================================
// Sculra Multi-Source Ingestion & Connection Intelligence Domain Types
// (worker/src/sources/types.ts)
// ==============================================================================

export type SourceType = 'WEBSITE' | 'GITHUB' | 'ZIP' | 'DESKTOP' | 'API';

export type SourceStatus =
  | 'CONFIGURED'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'NOT_READY'
  | 'DEGRADED';

export type SourceHealthState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNREACHABLE'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'MISCONFIGURED'
  | 'UNSUPPORTED'
  | 'NOT_READY'
  | 'UNKNOWN';

export type CapabilityState =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'RESTRICTED';

export type SourceCapabilityKey =
  | 'BROWSER_NAVIGATION'
  | 'DOM_DISCOVERY'
  | 'FUNCTIONAL_TESTING'
  | 'VISUAL_TESTING'
  | 'RESPONSIVE_TESTING'
  | 'ACCESSIBILITY_TESTING'
  | 'PERFORMANCE_TESTING'
  | 'BROWSER_NETWORK_OBSERVATION'
  | 'REPOSITORY_ANALYSIS'
  | 'CHANGE_DETECTION'
  | 'SOURCE_MAPPING'
  | 'RCA_CONTEXT'
  | 'REMEDIATION_CONTEXT'
  | 'CI_CONTEXT'
  | 'API_TESTING'
  | 'DESKTOP_TESTING'
  | 'SOURCE_ANALYSIS';

export interface SourceCapability {
  key: SourceCapabilityKey;
  state: CapabilityState;
  reason?: string;
}

export interface ProjectSource {
  id: string;
  projectId: string;
  organizationId?: string;
  type: SourceType;
  locator: string;
  branch?: string;
  environment: string;
  status: SourceStatus;
  configuration: Record<string, any>;
  capabilities: SourceCapability[];
  createdAt: string;
  updatedAt: string;
}

export interface SourceSnapshot {
  id: string;
  projectSourceId: string;
  projectId: string;
  organizationId?: string;
  fingerprint: string;
  revision?: string;
  environment?: string;
  capabilities: SourceCapability[];
  metadata: Record<string, any>;
  status: SourceStatus;
  observedAt: string;
}

export interface SourceHealthObservation {
  id: string;
  projectSourceId: string;
  status: SourceHealthState;
  latencyMs?: number;
  errorCode?: string;
  metadata: Record<string, any>;
  observedAt: string;
}

export interface SourceFingerprint {
  hash: string;
  components: Record<string, string>;
  observedAt: string;
}

export type SourceChangeType =
  | 'SOURCE_CONNECTED'
  | 'SOURCE_CHANGED'
  | 'SOURCE_UNCHANGED'
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_REVISION_CHANGED'
  | 'SOURCE_CONFIGURATION_CHANGED';

export interface SourceChange {
  type: SourceChangeType;
  sourceId: string;
  previousFingerprint?: string;
  currentFingerprint: string;
  details: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SourceValidationError {
  code: string;
  message: string;
  field?: string;
  fatal: boolean;
}

export interface SourceValidationResult {
  valid: boolean;
  status: SourceStatus;
  sourceType: SourceType;
  capabilities: SourceCapability[];
  health: SourceHealthState;
  snapshotId?: string;
  fingerprint?: string;
  revision?: string;
  latencyMs?: number;
  errors: SourceValidationError[];
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface SourceValidationOptions {
  allowLocalhost?: boolean;
  timeoutMs?: number;
  fetchLatestCommit?: boolean;
  skipNetworkChecks?: boolean;
}
