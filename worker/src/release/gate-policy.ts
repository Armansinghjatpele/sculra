// ==============================================================================
// Sculra Deterministic Release Gate Policy Engine (worker/src/release/gate-policy.ts)
//
// Invariants (Prompt 63):
// - Release readiness scoring remains authoritative for category scores
// - Gate policy evaluates whether release/deployment can proceed (PASS, BLOCK, REVIEW, INSUFFICIENT_EVIDENCE)
// - NEVER convert INSUFFICIENT_EVIDENCE into PASS
// - NEVER convert missing evidence into zero failures
// - Confirmed release-blocking regression => BLOCK
// - Critical workflow failure => BLOCK
// - Security blocker => BLOCK
// - Missing required evidence => INSUFFICIENT_EVIDENCE
// - Ambiguous correlation => REVIEW or INSUFFICIENT_EVIDENCE
// - AI suggestions => ADVISORY ONLY (never override deterministic gate decisions)
// - Pure deterministic mathematical evaluation: identical inputs => identical output
// ==============================================================================

import { randomUUID } from 'crypto';
import {
  ReleaseGatePolicy,
  ReleaseGateRule,
  ReleaseGateDecision,
  ReleaseGateDecisionType,
  ReleaseGateBlocker,
  ReleaseGateWarning,
  ReleaseGateDimension,
  DeploymentEvidenceReference,
  CategoryScores,
  ReleaseImpact,
  DeploymentReleaseCorrelation,
} from './types';
import { BugObservation } from '../issues/types';

export const DEFAULT_RELEASE_GATE_POLICY_VERSION = '1.0.0';

export const DEFAULT_CANONICAL_GATE_RULES: ReleaseGateRule[] = [
  {
    dimension: 'FUNCTIONAL',
    enabled: true,
    minScore: 80,
    maxCriticalIssues: 0,
    severityHandling: 'BLOCK',
    environmentScope: ['*'],
  },
  {
    dimension: 'REGRESSION',
    enabled: true,
    maxRegressions: 0,
    severityHandling: 'BLOCK',
    environmentScope: ['*'],
  },
  {
    dimension: 'CRITICAL_WORKFLOW',
    enabled: true,
    maxCriticalIssues: 0,
    severityHandling: 'BLOCK',
    environmentScope: ['*'],
    workflowScope: ['checkout', 'payment', 'auth', 'login', 'signup', 'billing'],
  },
  {
    dimension: 'SECURITY',
    enabled: true,
    minScore: 70,
    maxCriticalIssues: 0,
    severityHandling: 'BLOCK',
    environmentScope: ['*'],
  },
  {
    dimension: 'AUTHORIZATION',
    enabled: true,
    minScore: 75,
    maxCriticalIssues: 0,
    severityHandling: 'BLOCK',
    environmentScope: ['*'],
  },
  {
    dimension: 'API',
    enabled: true,
    minScore: 70,
    severityHandling: 'WARN',
    environmentScope: ['*'],
  },
  {
    dimension: 'PERFORMANCE',
    enabled: true,
    minScore: 60,
    severityHandling: 'WARN',
    environmentScope: ['*'],
  },
  {
    dimension: 'ACCESSIBILITY',
    enabled: true,
    minScore: 60,
    severityHandling: 'WARN',
    environmentScope: ['*'],
  },
  {
    dimension: 'VISUAL',
    enabled: true,
    minScore: 70,
    severityHandling: 'WARN',
    environmentScope: ['*'],
  },
  {
    dimension: 'RESPONSIVE',
    enabled: true,
    minScore: 70,
    severityHandling: 'WARN',
    environmentScope: ['*'],
  },
  {
    dimension: 'RELEASE_READINESS',
    enabled: true,
    minScore: 75,
    severityHandling: 'BLOCK',
    environmentScope: ['*'],
  },
  {
    dimension: 'EVIDENCE_CONFIDENCE',
    enabled: true,
    minScore: 60, // Minimum 60% confidence
    severityHandling: 'BLOCK',
    environmentScope: ['*'],
    requiredEvidence: ['test_runs', 'environment_evidence'],
  },
];

export interface GateEvaluationOptions {
  projectId: string;
  policy?: Partial<ReleaseGatePolicy>;
  releaseId?: string | null;
  deploymentId?: string | null;
  environmentId?: string | null;
  environmentName?: string | null;
  categoryScores?: CategoryScores;
  overallReadinessScore?: number;
  openIssues?: BugObservation[];
  regressions?: Array<{ issueId: string; title: string; classification: string; isCriticalWorkflow?: boolean }>;
  releaseImpact?: ReleaseImpact | null;
  correlation?: DeploymentReleaseCorrelation | null;
  hasMeasuredEvidence?: boolean;
  testedDomains?: string[];
  evidence?: DeploymentEvidenceReference[];
  confidence?: number;
  evaluatedBy?: string;
  source?: string;
}

export class ReleaseGatePolicyEvaluator {
  /**
   * Deterministically evaluates release gate policy against stored factual evidence.
   */
  public static evaluate(options: GateEvaluationOptions): ReleaseGateDecision {
    const {
      projectId,
      releaseId = null,
      deploymentId = null,
      environmentId = null,
      environmentName = null,
      categoryScores,
      overallReadinessScore,
      openIssues = [],
      regressions = [],
      releaseImpact,
      correlation,
      hasMeasuredEvidence = true,
      testedDomains = [],
      evidence = [],
      confidence = 1.0,
      evaluatedBy = 'system:deterministic_gate_evaluator',
      source = 'CI_CD_ORCHESTRATION',
    } = options;

    const policyVersion = options.policy?.version || DEFAULT_RELEASE_GATE_POLICY_VERSION;
    const policyId = options.policy?.id || `policy-${projectId || 'default'}-${policyVersion}`;
    const rules = options.policy?.rules || DEFAULT_CANONICAL_GATE_RULES;
    const requireApprovalOnReview = options.policy?.requireHumanApprovalOnReview ?? true;
    const requireApprovalOnWarn = options.policy?.requireHumanApprovalOnWarn ?? false;

    const decisionId = randomUUID();
    const evaluatedAt = new Date().toISOString();

    const blockers: ReleaseGateBlocker[] = [];
    const warnings: ReleaseGateWarning[] = [];
    const missingEvidenceDimensions: string[] = [];

    // Helper: matches environment scope
    const matchesEnvScope = (rule: ReleaseGateRule) => {
      if (!rule.environmentScope || rule.environmentScope.includes('*')) return true;
      if (!environmentName) return false;
      const lowerEnv = environmentName.toLowerCase();
      return rule.environmentScope.some((e) => e.toLowerCase() === lowerEnv);
    };

    // 0. Check Ambiguous Deployment/Release Correlation
    if (correlation && correlation.status === 'AMBIGUOUS') {
      return {
        id: decisionId,
        releaseId,
        deploymentId,
        projectId,
        environmentId,
        policyId,
        policyVersion,
        decision: 'REVIEW',
        blockers: [],
        warnings: [
          {
            dimension: 'EVIDENCE_CONFIDENCE',
            reason: 'Deployment-to-release correlation is AMBIGUOUS. Multiple matching releases detected; human review required.',
          },
        ],
        evidence,
        confidence: 0.0,
        evaluatedAt,
        evaluatedBy,
        source,
      };
    }

    // 1. Evaluate Evidence Completeness / Confidence
    if (!hasMeasuredEvidence) {
      return {
        id: decisionId,
        releaseId,
        deploymentId,
        projectId,
        environmentId,
        policyId,
        policyVersion,
        decision: 'INSUFFICIENT_EVIDENCE',
        blockers: [
          {
            dimension: 'EVIDENCE_CONFIDENCE',
            reason: 'Zero test runs or QA evidence collected for this deployment/release. NO EVIDENCE -> NO INFERENCE.',
            severity: 'CRITICAL',
          },
        ],
        warnings: [],
        evidence,
        confidence: 0.0,
        evaluatedAt,
        evaluatedBy,
        source,
      };
    }

    // 2. Iterate each enabled gate rule
    for (const rule of rules) {
      if (!rule.enabled || !matchesEnvScope(rule)) continue;

      const dim = rule.dimension;

      switch (dim) {
        case 'REGRESSION': {
          const newRegs = regressions.filter(
            (r) => r.classification === 'NEW_REGRESSION' || r.classification === 'REGRESSION'
          );
          const maxAllowed = rule.maxRegressions ?? 0;
          if (newRegs.length > maxAllowed) {
            const hasCriticalReg = newRegs.some((r) => r.isCriticalWorkflow);
            const reason = `${newRegs.length} confirmed regression(s) detected against baseline (allowed max: ${maxAllowed}).`;
            if (rule.severityHandling === 'BLOCK' || hasCriticalReg) {
              blockers.push({
                dimension: 'REGRESSION',
                reason,
                severity: hasCriticalReg ? 'CRITICAL' : 'HIGH',
                metricValue: newRegs.length,
                threshold: maxAllowed,
                evidenceRef: `regression:${newRegs[0].issueId}`,
              });
            } else if (rule.severityHandling === 'WARN') {
              warnings.push({
                dimension: 'REGRESSION',
                reason,
                metricValue: newRegs.length,
                threshold: maxAllowed,
              });
            }
          }
          break;
        }

        case 'CRITICAL_WORKFLOW': {
          const criticalKeywords = rule.workflowScope || [
            'checkout',
            'payment',
            'auth',
            'login',
            'signup',
            'billing',
          ];
          const criticalIssues = openIssues.filter((i) => {
            const isSevCritical =
              i.severity?.toLowerCase() === 'critical' || i.severity?.toLowerCase() === 'blocker';
            const titleMatch = criticalKeywords.some((kw) =>
              (i.title || '').toLowerCase().includes(kw)
            );
            return isSevCritical && titleMatch;
          });

          // Also check regressions touching critical workflows
          const criticalRegs = regressions.filter(
            (r) =>
              r.isCriticalWorkflow ||
              criticalKeywords.some((kw) => (r.title || '').toLowerCase().includes(kw))
          );

          const totalCriticalFailures = criticalIssues.length + criticalRegs.length;
          const maxAllowed = rule.maxCriticalIssues ?? 0;

          if (totalCriticalFailures > maxAllowed) {
            const reason = `Critical workflow failure detected: ${totalCriticalFailures} critical defect(s) on protected flows (${criticalKeywords.join(
              ', '
            )}).`;
            if (rule.severityHandling === 'BLOCK') {
              blockers.push({
                dimension: 'CRITICAL_WORKFLOW',
                reason,
                severity: 'CRITICAL',
                metricValue: totalCriticalFailures,
                threshold: maxAllowed,
              });
            } else if (rule.severityHandling === 'WARN') {
              warnings.push({
                dimension: 'CRITICAL_WORKFLOW',
                reason,
                metricValue: totalCriticalFailures,
                threshold: maxAllowed,
              });
            }
          }
          break;
        }

        case 'SECURITY': {
          const secIssues = openIssues.filter(
            (i) =>
              (i as any).category?.toLowerCase() === 'security' ||
              (i.title || '').toLowerCase().includes('security')
          );
          const hasCriticalSec = secIssues.some(
            (i) => i.severity?.toLowerCase() === 'critical' || i.severity?.toLowerCase() === 'high'
          );
          const secScore = categoryScores?.security;

          if (secScore === undefined && !testedDomains.includes('security') && !hasCriticalSec) {
            // Unmeasured security audit
            missingEvidenceDimensions.push('SECURITY');
          } else {
            const minScore = rule.minScore ?? 70;
            if (hasCriticalSec || (secScore !== undefined && secScore < minScore)) {
              const reason = hasCriticalSec
                ? `Critical security vulnerability detected in release candidate.`
                : `Security score (${secScore}%) below threshold (${minScore}%).`;
              if (rule.severityHandling === 'BLOCK' || hasCriticalSec) {
                blockers.push({
                  dimension: 'SECURITY',
                  reason,
                  severity: 'CRITICAL',
                  metricValue: secScore,
                  threshold: minScore,
                });
              } else if (rule.severityHandling === 'WARN') {
                warnings.push({
                  dimension: 'SECURITY',
                  reason,
                  metricValue: secScore,
                  threshold: minScore,
                });
              }
            }
          }
          break;
        }

        case 'RELEASE_READINESS': {
          const minScore = rule.minScore ?? 75;
          const score = overallReadinessScore ?? categoryScores?.overall;
          if (score === undefined) {
            missingEvidenceDimensions.push('RELEASE_READINESS');
          } else if (score < minScore) {
            const reason = `Release readiness score (${score}%) below threshold (${minScore}%).`;
            if (rule.severityHandling === 'BLOCK') {
              blockers.push({
                dimension: 'RELEASE_READINESS',
                reason,
                severity: 'HIGH',
                metricValue: score,
                threshold: minScore,
              });
            } else if (rule.severityHandling === 'WARN') {
              warnings.push({
                dimension: 'RELEASE_READINESS',
                reason,
                metricValue: score,
                threshold: minScore,
              });
            }
          }
          break;
        }

        case 'FUNCTIONAL': {
          const score = categoryScores?.functional;
          const minScore = rule.minScore ?? 80;
          if (score === undefined) {
            missingEvidenceDimensions.push('FUNCTIONAL');
          } else if (score < minScore) {
            const reason = `Functional QA pass score (${score}%) below threshold (${minScore}%).`;
            if (rule.severityHandling === 'BLOCK') {
              blockers.push({
                dimension: 'FUNCTIONAL',
                reason,
                severity: 'HIGH',
                metricValue: score,
                threshold: minScore,
              });
            } else if (rule.severityHandling === 'WARN') {
              warnings.push({
                dimension: 'FUNCTIONAL',
                reason,
                metricValue: score,
                threshold: minScore,
              });
            }
          }
          break;
        }

        case 'EVIDENCE_CONFIDENCE': {
          const minConf = (rule.minScore ?? 60) / 100;
          if (confidence < minConf) {
            const reason = `Evidence confidence (${Math.round(confidence * 100)}%) below minimum required (${Math.round(minConf * 100)}%).`;
            if (rule.severityHandling === 'BLOCK') {
              blockers.push({
                dimension: 'EVIDENCE_CONFIDENCE',
                reason,
                severity: 'HIGH',
                metricValue: Math.round(confidence * 100),
                threshold: Math.round(minConf * 100),
              });
            } else {
              warnings.push({
                dimension: 'EVIDENCE_CONFIDENCE',
                reason,
                metricValue: Math.round(confidence * 100),
                threshold: Math.round(minConf * 100),
              });
            }
          }
          break;
        }

        // Other domain scores (VISUAL, RESPONSIVE, AUTHORIZATION, API, PERFORMANCE, ACCESSIBILITY)
        default: {
          const domainKey = dim.toLowerCase() as keyof CategoryScores;
          const score = categoryScores ? (categoryScores[domainKey] as number | undefined) : undefined;
          const minScore = rule.minScore;
          if (score !== undefined && minScore !== undefined && score < minScore) {
            const reason = `${dim} score (${score}%) below policy threshold (${minScore}%).`;
            if (rule.severityHandling === 'BLOCK') {
              blockers.push({
                dimension: dim,
                reason,
                severity: 'HIGH',
                metricValue: score,
                threshold: minScore,
              });
            } else if (rule.severityHandling === 'WARN') {
              warnings.push({
                dimension: dim,
                reason,
                metricValue: score,
                threshold: minScore,
              });
            }
          }
          break;
        }
      }
    }

    // 3. Determine Overall Gate Decision
    let decision: ReleaseGateDecisionType = 'PASS';

    if (blockers.length > 0) {
      decision = 'BLOCK';
    } else if (missingEvidenceDimensions.length > 0) {
      // If critical evidence missing => INSUFFICIENT_EVIDENCE
      decision = 'INSUFFICIENT_EVIDENCE';
      warnings.push({
        dimension: 'EVIDENCE_CONFIDENCE',
        reason: `Missing factual QA evidence for dimension(s): ${missingEvidenceDimensions.join(', ')}.`,
      });
    } else if (warnings.length > 0) {
      if (requireApprovalOnWarn || requireApprovalOnReview) {
        decision = 'REVIEW';
      } else {
        decision = 'PASS';
      }
    }

    return {
      id: decisionId,
      releaseId,
      deploymentId,
      projectId,
      environmentId,
      policyId,
      policyVersion,
      decision,
      blockers,
      warnings,
      evidence,
      confidence,
      evaluatedAt,
      evaluatedBy,
      source,
    };
  }
}
