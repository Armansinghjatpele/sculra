// ==============================================================================
// Sculra AI Product Understanding & Workflow Discovery Domain Models
// (worker/src/product/types.ts)
// ==============================================================================

import { JourneyActionType } from '../journeys/types';

export type ApplicationType =
  | 'SaaS'
  | 'marketplace'
  | 'ecommerce'
  | 'dashboard'
  | 'CRM'
  | 'project management'
  | 'analytics'
  | 'education'
  | 'finance'
  | 'developer tool'
  | 'content platform'
  | 'admin application'
  | 'unknown';

export type SemanticPageCategory =
  | 'LANDING'
  | 'AUTH'
  | 'SIGN_UP'
  | 'LOGIN'
  | 'DASHBOARD'
  | 'LIST'
  | 'DETAIL'
  | 'CREATE'
  | 'EDIT'
  | 'SETTINGS'
  | 'PROFILE'
  | 'ADMIN'
  | 'SEARCH'
  | 'ANALYTICS'
  | 'REPORT'
  | 'CHECKOUT'
  | 'PAYMENT'
  | 'CART'
  | 'PRODUCT'
  | 'CONTENT'
  | 'HELP'
  | 'UNKNOWN';

export type RoleType =
  | 'visitor'
  | 'customer'
  | 'member'
  | 'user'
  | 'administrator'
  | 'manager'
  | 'owner'
  | 'editor'
  | 'reviewer'
  | 'seller'
  | 'buyer'
  | string;

export type ProductEntityStatus =
  | 'OBSERVED'
  | 'INFERRED'
  | 'HYPOTHESIZED'
  | 'PARTIALLY_OBSERVED'
  | 'CONFIRMED'
  | 'DISPROVEN'
  | 'INCONCLUSIVE';

export type CriticalityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface ApplicationProfileTypeMatch {
  type: ApplicationType;
  confidence: number; // 0.0 - 1.0
  evidence: string[];
}

export interface ApplicationProfile {
  applicationTypes: ApplicationProfileTypeMatch[];
  primaryType: ApplicationType;
  detectedDomains: string[];
  authenticationPresent: boolean;
  multiRoleSignals: boolean;
  majorSections: string[];
  confidence: number; // 0.0 - 1.0
  evidenceReferences: string[];
}

export interface SemanticPageClassification {
  pageUrl: string;
  category: SemanticPageCategory;
  confidence: number; // 0.0 - 1.0
  evidence: string[];
  source: 'DETERMINISTIC' | 'AI';
  title?: string;
  depth: number;
}

export interface CriticalityAssessment {
  score: number; // 0 - 100
  level: CriticalityLevel;
  reasons: string[];
  evidence: string[];
  confidence: number; // 0.0 - 1.0
}

export interface ProductFeature {
  id: string;
  name: string;
  description: string;
  category?: string;
  relatedPages: string[];
  relatedControls: string[];
  relatedForms: string[];
  relatedRoutes: string[];
  relatedWorkflowIds: string[];
  confidence: number; // 0.0 - 1.0
  evidence: string[];
  criticality: CriticalityAssessment;
  status: ProductEntityStatus;
  isCoreCapability: boolean;
  availableRoles?: string[];
}

export interface ProductRole {
  id: string;
  name: RoleType;
  confidence: number; // 0.0 - 1.0
  evidence: string[];
  observedCapabilities: string[];
  relatedFeatureIds: string[];
  relatedWorkflowIds: string[];
  status: ProductEntityStatus;
}

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  actionType: JourneyActionType | 'NAVIGATE' | 'ASSERT' | 'TRANSITION';
  pageUrl: string;
  targetSelector?: string;
  targetDescription?: string;
  expectedTransition?: string;
  value?: string;
  evidence: string[];
  confidence: number; // 0.0 - 1.0
  assertion?: {
    type: string;
    expected: string;
  };
}

export type WorkflowExecutionStatus = 'TESTED' | 'PARTIALLY_TESTED' | 'UNTESTED' | 'FAILED';

export interface ProductWorkflow {
  id: string;
  name: string;
  goal: string;
  roleId?: string;
  roleName?: string;
  requiredRole?: string;
  authenticated?: boolean;
  roleConfidence?: number;
  steps: WorkflowStep[];
  entryPoint: string;
  exitPoint: string;
  relatedFeatureIds: string[];
  relatedRoutes: string[];
  confidence: number; // 0.0 - 1.0
  evidence: string[];
  criticality: CriticalityAssessment;
  status: ProductEntityStatus;
  executionStatus: WorkflowExecutionStatus;
  testedIterations?: number[];
  relatedIssueIds?: string[];
}

export type ProductRelationshipType =
  | 'EXECUTES'
  | 'ENABLES'
  | 'CONTAINS'
  | 'NAVIGATES_TO'
  | 'DEPENDS_ON'
  | 'AFFECTS';

export interface ProductRelationship {
  id: string;
  fromId: string;
  fromType: 'ROLE' | 'WORKFLOW' | 'FEATURE' | 'PAGE' | 'CONTROL' | 'API_ENDPOINT' | 'SECURITY_FINDING' | 'SECURITY_TARGET';
  toId: string;
  toType: 'ROLE' | 'WORKFLOW' | 'FEATURE' | 'PAGE' | 'CONTROL' | 'API_ENDPOINT' | 'SECURITY_FINDING' | 'SECURITY_TARGET';
  relationshipType: ProductRelationshipType;
  confidence: number; // 0.0 - 1.0
  evidence: string[];
}

export type ProductEvidenceSourceType =
  | 'URL'
  | 'HEADING'
  | 'FORM'
  | 'BUTTON'
  | 'LINK'
  | 'NAV'
  | 'JOURNEY'
  | 'OBSERVATION'
  | 'ERROR'
  | 'METADATA'
  | 'API'
  | 'API_ENDPOINT'
  | 'API_CONTRACT'
  | 'SECURITY_CHECK'
  | 'SECURITY_FINDING'
  | 'SECURITY_HEADER'
  | 'SECURITY_COOKIE';

export interface ProductEvidence {
  id: string;
  sourceType: ProductEvidenceSourceType;
  pageUrl: string;
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface CoverageAgainstProductModel {
  totalFeatures: number;
  testedFeatures: number;
  untestedFeatures: number;
  featureCoverageRatio: number; // 0.0 - 1.0
  totalWorkflows: number;
  testedWorkflows: number;
  partiallyTestedWorkflows: number;
  untestedWorkflows: number;
  workflowCoverageRatio: number; // 0.0 - 1.0
  totalRoles: number;
  rolesWithTestedWorkflows: number;
  highCriticalityWorkflowsTotal: number;
  highCriticalityWorkflowsTested: number;
  highCriticalityWorkflowsUntested: number;
  criticalWorkflowsWithFailures: number;
}

export interface ProductModel {
  id: string;
  version: string;
  generatedAt: string;
  testRunId?: string;
  targetUrl: string;
  applicationProfile: ApplicationProfile;
  pageClassifications: SemanticPageClassification[];
  features: ProductFeature[];
  roles: ProductRole[];
  workflows: ProductWorkflow[];
  relationships: ProductRelationship[];
  evidence: ProductEvidence[];
  coverage: CoverageAgainstProductModel;
}

export interface ProductModelComparison {
  addedFeatures: string[];
  removedFeatures: string[];
  changedWorkflows: Array<{
    id: string;
    name: string;
    change: 'ADDED' | 'REMOVED' | 'CRITICALITY_CHANGED' | 'STEPS_CHANGED' | 'STATUS_CHANGED';
    details: string;
  }>;
  changedCriticality: Array<{
    entityId: string;
    entityType: 'FEATURE' | 'WORKFLOW';
    oldScore: number;
    newScore: number;
  }>;
  changedRoles: string[];
}

export interface ProductAnalysisContext {
  testRunId: string;
  targetUrl: string;
  applicationProfile: ApplicationProfile;
  pageSummaries: Array<{
    url: string;
    title: string;
    category: SemanticPageCategory;
    headings: string[];
    buttonsCount: number;
    formsCount: number;
    linksCount: number;
  }>;
  discoveredFeatures: Array<{
    id: string;
    name: string;
    category?: string;
    routes: string[];
    criticality: CriticalityLevel;
  }>;
  candidateWorkflows: Array<{
    id: string;
    name: string;
    entryPoint: string;
    exitPoint: string;
    stepsCount: number;
  }>;
  candidateRoles: Array<{
    id: string;
    name: string;
    evidence: string[];
  }>;
  untrustedNotice: string;
}

export interface AIProductUnderstandingRecommendation {
  refinedApplicationType?: ApplicationType;
  additionalFeatures?: Array<{
    name: string;
    description: string;
    category: string;
    relatedRoutes: string[];
    confidence: number;
    criticality: CriticalityLevel;
  }>;
  additionalWorkflows?: Array<{
    name: string;
    goal: string;
    roleName?: string;
    entryRoute: string;
    exitRoute: string;
    steps: Array<{
      action: JourneyActionType | 'NAVIGATE' | 'CLICK' | 'FILL' | 'SELECT' | 'SUBMIT';
      route: string;
      targetDescription?: string;
      expectedTransition?: string;
    }>;
    confidence: number;
    criticality: CriticalityLevel;
  }>;
  roleHypotheses?: Array<{
    name: string;
    rationale: string;
    confidence: number;
    capabilities: string[];
  }>;
  suggestedRelationships?: Array<{
    fromId: string;
    toId: string;
    relationshipType: ProductRelationshipType;
    rationale: string;
  }>;
}

export interface ProductEngineOptions {
  maxFeatures?: number;
  maxRoles?: number;
  maxWorkflows?: number;
  maxWorkflowSteps?: number;
  maxRelationships?: number;
  maxAnalysisTimeMs?: number;
  enableAiEnhancement?: boolean;
}
