// ==============================================================================
// Sculra Deterministic Release Gate Policy Engine (worker/src/release/gate-policy.ts)
//
// Invariants (Prompt 63 & Prompt 63A):
// - Release readiness scoring remains authoritative for category scores
// - Gate policy evaluates whether release/deployment can proceed (PASS, BLOCK, REVIEW, INSUFFICIENT_EVIDENCE)
// - NEVER convert INSUFFICIENT_EVIDENCE into PASS
// - NEVER convert missing evidence into zero failures or passing score
// - Default hasMeasuredEvidence = false (NO EVIDENCE -> NO INFERENCE)
// - Every dimension must distinguish: MEASURED | UNMEASURED | FAILED | PASSED | NOT_APPLICABLE
// - Missing evidence on enabled dimension => INSUFFICIENT_EVIDENCE (can never PASS)
// - Confirmed release-blocking regression => BLOCK
// - Critical workflow failure => BLOCK
// - Security blocker => BLOCK
// - Ambiguous correlation => REVIEW or INSUFFICIENT_EVIDENCE
// - Pure deterministic mathematical evaluation: identical inputs => identical output
// ==============================================================================

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ReleaseGatePolicy,
  ReleaseGateRule,
  ReleaseGateDecision,
  ReleaseGateDecisionType,
  ReleaseGateBlocker,
  ReleaseGateWarning,
  ReleaseGateDimension,
  DimensionEvaluation,
  DimensionEvaluationStatus,
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
  organizationId?: string | null;
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
      organizationId = null,
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
      hasMeasuredEvidence = false, // Strictly default to false: NO EVIDENCE -> NO INFERENCE
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
    const dimensionEvaluations: Record<string, DimensionEvaluation> = {};
    const missingEvidenceDimensions: ReleaseGateDimension[] = [];

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
        organizationId,
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
        dimensionEvaluations: {},
        missingEvidenceDimensions: [],
        evidence,
        confidence: 0.0,
        evaluatedAt,
        evaluatedBy,
        source,
      };
    }

    // 1. Evaluate Evidence Completeness / Confidence
    // If hasMeasuredEvidence is false, no QA tasks were completed: strictly INSUFFICIENT_EVIDENCE
    if (!hasMeasuredEvidence) {
      for (const rule of rules) {
        if (!rule.enabled || !matchesEnvScope(rule)) {
          dimensionEvaluations[rule.dimension] = {
            dimension: rule.dimension,
            status: 'NOT_APPLICABLE',
          };
        } else {
          dimensionEvaluations[rule.dimension] = {
            dimension: rule.dimension,
            status: 'UNMEASURED',
            threshold: rule.minScore,
            violations: ['Zero test runs or QA evidence collected. NO EVIDENCE -> NO INFERENCE.'],
          };
          missingEvidenceDimensions.push(rule.dimension);
        }
      }

      return {
        id: decisionId,
        releaseId,
        deploymentId,
        projectId,
        organizationId,
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
        dimensionEvaluations,
        missingEvidenceDimensions,
        evidence,
        confidence: 0.0,
        evaluatedAt,
        evaluatedBy,
        source,
      };
    }

    // 2. Iterate each gate rule and evaluate against factual measurements
    for (const rule of rules) {
      const dim = rule.dimension;

      if (!rule.enabled || !matchesEnvScope(rule)) {
        dimensionEvaluations[dim] = {
          dimension: dim,
          status: 'NOT_APPLICABLE',
        };
        continue;
      }

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
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'FAILED',
              score: newRegs.length,
              threshold: maxAllowed,
              violations: [reason],
              evidenceRef: newRegs[0]?.issueId,
            };
          } else {
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'PASSED',
              score: newRegs.length,
              threshold: maxAllowed,
            };
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
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'FAILED',
              score: totalCriticalFailures,
              threshold: maxAllowed,
              violations: [reason],
            };
          } else {
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'PASSED',
              score: totalCriticalFailures,
              threshold: maxAllowed,
            };
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
          const isMeasured = secScore !== undefined || testedDomains.includes('security') || secIssues.length > 0;

          if (!isMeasured) {
            missingEvidenceDimensions.push('SECURITY');
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'UNMEASURED',
              threshold: rule.minScore ?? 70,
              violations: ['Missing security audit evidence.'],
            };
          } else {
            const minScore = rule.minScore ?? 70;
            const failed = hasCriticalSec || (secScore !== undefined && secScore < minScore);
            if (failed) {
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
              dimensionEvaluations[dim] = {
                dimension: dim,
                status: 'FAILED',
                score: secScore,
                threshold: minScore,
                violations: [reason],
              };
            } else {
              dimensionEvaluations[dim] = {
                dimension: dim,
                status: 'PASSED',
                score: secScore,
                threshold: minScore,
              };
            }
          }
          break;
        }

        case 'RELEASE_READINESS': {
          const minScore = rule.minScore ?? 75;
          const score = overallReadinessScore ?? categoryScores?.overall;
          if (score === undefined) {
            missingEvidenceDimensions.push('RELEASE_READINESS');
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'UNMEASURED',
              threshold: minScore,
              violations: ['Missing release readiness score.'],
            };
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
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'FAILED',
              score,
              threshold: minScore,
              violations: [reason],
            };
          } else {
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'PASSED',
              score,
              threshold: minScore,
            };
          }
          break;
        }

        case 'FUNCTIONAL': {
          const score = categoryScores?.functional;
          const minScore = rule.minScore ?? 80;
          if (score === undefined) {
            missingEvidenceDimensions.push('FUNCTIONAL');
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'UNMEASURED',
              threshold: minScore,
              violations: ['Missing functional QA score.'],
            };
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
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'FAILED',
              score,
              threshold: minScore,
              violations: [reason],
            };
          } else {
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'PASSED',
              score,
              threshold: minScore,
            };
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
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'FAILED',
              score: Math.round(confidence * 100),
              threshold: Math.round(minConf * 100),
              violations: [reason],
            };
          } else {
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'PASSED',
              score: Math.round(confidence * 100),
              threshold: Math.round(minConf * 100),
            };
          }
          break;
        }

        // Domain scores: VISUAL, RESPONSIVE, AUTHORIZATION, API, PERFORMANCE, ACCESSIBILITY
        default: {
          const domainKey = dim.toLowerCase() as keyof CategoryScores;
          const score = categoryScores ? (categoryScores[domainKey] as number | undefined) : undefined;
          const isDomainTested = score !== undefined || testedDomains.includes(dim.toLowerCase());
          const minScore = rule.minScore;

          if (!isDomainTested || score === undefined) {
            // Unmeasured domain on enabled rule
            missingEvidenceDimensions.push(dim);
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'UNMEASURED',
              threshold: minScore,
              violations: [`Missing factual QA evidence for dimension ${dim}.`],
            };
          } else if (minScore !== undefined && score < minScore) {
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
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'FAILED',
              score,
              threshold: minScore,
              violations: [reason],
            };
          } else {
            dimensionEvaluations[dim] = {
              dimension: dim,
              status: 'PASSED',
              score,
              threshold: minScore,
            };
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
      // If factual evidence missing for any enabled dimension => strictly INSUFFICIENT_EVIDENCE
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
      organizationId,
      environmentId,
      policyId,
      policyVersion,
      decision,
      blockers,
      warnings,
      dimensionEvaluations,
      missingEvidenceDimensions,
      evidence,
      confidence,
      evaluatedAt,
      evaluatedBy,
      source,
    };
  }
}

/**
 * Persists release gate decision to public.release_gate_decisions with duplicate protection.
 */
export async function persistReleaseGateDecision(
  supabase: SupabaseClient,
  decision: ReleaseGateDecision
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    if (decision.deploymentId) {
      const { data: existing } = await supabase
        .from('release_gate_decisions')
        .select('id')
        .eq('deployment_id', decision.deploymentId)
        .eq('policy_id', decision.policyId)
        .eq('policy_version', decision.policyVersion)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('release_gate_decisions')
          .update({
            decision: decision.decision,
            blockers: decision.blockers,
            warnings: decision.warnings,
            dimension_evaluations: decision.dimensionEvaluations || {},
            missing_evidence_dimensions: decision.missingEvidenceDimensions || [],
            evidence: decision.evidence,
            confidence: decision.confidence,
            evaluated_by: decision.evaluatedBy,
            source: decision.source,
            evaluated_at: decision.evaluatedAt,
          })
          .eq('id', existing.id);
        return { success: true, id: existing.id };
      }
    }

    const { data, error } = await supabase
      .from('release_gate_decisions')
      .insert({
        id: decision.id,
        project_id: decision.projectId,
        organization_id: decision.organizationId || null,
        release_id: decision.releaseId,
        deployment_id: decision.deploymentId,
        environment_id: decision.environmentId,
        policy_id: decision.policyId,
        policy_version: decision.policyVersion,
        decision: decision.decision,
        blockers: decision.blockers,
        warnings: decision.warnings,
        dimension_evaluations: decision.dimensionEvaluations || {},
        missing_evidence_dimensions: decision.missingEvidenceDimensions || [],
        evidence: decision.evidence,
        confidence: decision.confidence,
        evaluated_by: decision.evaluatedBy,
        source: decision.source,
        evaluated_at: decision.evaluatedAt,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: true, id: decision.id };
      }
      return { success: false, id: decision.id, error: error.message };
    }
    return { success: true, id: data.id };
  } catch (err: any) {
    return { success: false, id: decision.id, error: err.message };
  }
}
