// ==============================================================================
// Sculra Code Change Intelligence Domain Models (worker/src/change-intelligence/types.ts)
// ==============================================================================

export type ChangeType =
  | 'ADDED'
  | 'MODIFIED'
  | 'DELETED'
  | 'RENAMED'
  | 'COPIED'
  | 'UNKNOWN';

export type ChangeSizeCategory = 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE';

export type ChangeClassification =
  | 'UI'
  | 'ROUTING'
  | 'API'
  | 'DATABASE'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'PAYMENT'
  | 'FORM'
  | 'SEARCH'
  | 'NAVIGATION'
  | 'PERFORMANCE'
  | 'ACCESSIBILITY'
  | 'SECURITY'
  | 'CONFIGURATION'
  | 'DEPENDENCY'
  | 'TEST'
  | 'DOCUMENTATION'
  | 'UNKNOWN';

export type ImpactConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export type ImpactTargetType =
  | 'ROUTE'
  | 'API'
  | 'FEATURE'
  | 'WORKFLOW'
  | 'ROLE'
  | 'QA_TARGET'
  | 'HISTORICAL_FINDING';

export type ImpactRelationshipType =
  | 'DIRECT_IMPACT'
  | 'TRANSITIVE_IMPACT'
  | 'HISTORICAL_ASSOCIATION'
  | 'UNKNOWN';

export interface ChangeHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
  header?: string;
}

export interface ChangedFile {
  path: string;
  previousPath?: string;
  status: ChangeType;
  additions: number;
  deletions: number;
  changes: number;
  hunks: ChangeHunk[];
  isBinary: boolean;
  isGeneratedOrMinified: boolean;
  isLockfile: boolean;
  isDocumentation: boolean;
  classifications: ChangeClassification[];
  patch?: string;
}

export interface ChangeSet {
  id: string;
  commitSha: string;
  baseSha?: string;
  branch?: string;
  pullRequestNumber?: number;
  files: ChangedFile[];
  totalAdditions: number;
  totalDeletions: number;
  sizeCategory: ChangeSizeCategory;
  isPartial: boolean;
  partialReason?: string;
  createdAt: string;
}

export interface ImpactNode {
  id: string;
  type: ImpactTargetType | 'FILE' | 'SYMBOL';
  name: string;
  metadata?: Record<string, any>;
}

export interface ImpactEdge {
  sourceId: string;
  targetId: string;
  relationship:
    | 'MODIFIES'
    | 'IMPORTS'
    | 'SERVES'
    | 'CALLS'
    | 'PART_OF'
    | 'AFFECTS'
    | 'USED_BY'
    | 'COVERS'
    | 'FAILED_BEFORE';
  reason: string;
  confidence: ImpactConfidence;
  source: string;
}

export interface ImpactGraph {
  nodes: Record<string, ImpactNode>;
  edges: ImpactEdge[];
  nodeCount: number;
  edgeCount: number;
  isTruncated: boolean;
}

export interface ChangeRiskFactor {
  factor: string;
  scoreAdjustment: number;
  reason: string;
}

export interface ChangeRisk {
  score: number; // 0 - 100
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  factors: ChangeRiskFactor[];
  explanation: string;
}

export type ChangeAnalysisStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'NOT_AVAILABLE';

export interface AffectedWorkflow {
  workflowId: string;
  workflowName: string;
  criticality: string;
  confidence: ImpactConfidence;
  reason: string;
}

export interface AffectedApi {
  path: string;
  method?: string;
  confidence: ImpactConfidence;
  reason: string;
}

export interface AffectedRoute {
  route: string;
  confidence: ImpactConfidence;
  reason: string;
}

export interface RecommendedDomain {
  domain: string;
  priority: number;
  reason: string;
}

export interface StrategyBoost {
  targetId: string;
  boostType:
    | 'CHANGE_DIRECT'
    | 'CHANGE_TRANSITIVE'
    | 'CHANGE_HISTORICAL'
    | 'CHANGE_BUSINESS_CRITICAL'
    | 'CHANGE_SECURITY';
  priorityBonus: number;
  reason: string;
}

export interface ChangeAnalysisResult {
  id: string;
  projectId: string;
  campaignId?: string;
  commitSha: string;
  baseSha?: string;
  branch?: string;
  pullRequestNumber?: number;
  status: ChangeAnalysisStatus;
  changeSet: ChangeSet;
  classifications: ChangeClassification[];
  impactGraph: ImpactGraph;
  risk: ChangeRisk;
  affectedWorkflows: AffectedWorkflow[];
  affectedApis: AffectedApi[];
  affectedRoutes: AffectedRoute[];
  recommendedDomains: RecommendedDomain[];
  strategyBoosts: StrategyBoost[];
  summary?: {
    headline: string;
    markdownSummary: string;
    riskScore: number;
    riskLevel: string;
  };
  isPartial?: boolean;
  analyzedAt: string;
  durationMs: number;
}
