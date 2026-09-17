// ==============================================================================
// Sculra AI Output Validator & Grounding Enforcer
// (worker/src/remediation/ai-validator.ts)
// ==============================================================================

import {
  BugDiagnosis,
  RootCauseHypothesis,
  FixPlan,
  VerificationPlan,
  CodeContext,
  RootCauseEvidence,
} from './types';
import { FixPlanner } from './fix-plan';

export interface ValidatedAIOutput {
  diagnosis: BugDiagnosis;
  hypotheses: RootCauseHypothesis[];
  fixPlan: FixPlan;
  verificationPlan: VerificationPlan;
  wasGroundingAdjusted: boolean;
  unsupportedReferencesRemoved: string[];
}

export class AIOutputValidator {
  /**
   * Validates and normalizes raw AI output against empirical facts.
   * Strips any hallucinated files, symbols, routes, or evidence IDs.
   */
  static validate(
    rawOutput: any,
    codeContext: CodeContext,
    evidenceList: RootCauseEvidence[],
    existingTargets: string[]
  ): ValidatedAIOutput {
    const unsupportedReferencesRemoved: string[] = [];
    let wasGroundingAdjusted = false;

    const availableFiles = new Set(codeContext.files.map((f) => f.path.toLowerCase()));
    const availableSymbols = new Set(codeContext.symbols.map((s) => s.name.toLowerCase()));
    const availableEvidenceIds = new Set(evidenceList.map((e) => e.id));
    const targetSet = new Set(existingTargets.map((t) => t.toLowerCase()));

    // 1. Validate Hypotheses
    const rawHypotheses: any[] = Array.isArray(rawOutput.hypotheses) ? rawOutput.hypotheses : [];
    const validHypotheses: RootCauseHypothesis[] = [];

    for (let i = 0; i < rawHypotheses.length; i++) {
      const h = rawHypotheses[i];

      // Validate files
      const validFiles: string[] = [];
      for (const fp of h.filePaths || []) {
        if (availableFiles.has(fp.toLowerCase())) {
          validFiles.push(fp);
        } else {
          unsupportedReferencesRemoved.push(`File: ${fp}`);
          wasGroundingAdjusted = true;
        }
      }

      // Validate symbols
      const validSymbols: string[] = [];
      for (const sym of h.symbols || []) {
        if (availableSymbols.has(sym.toLowerCase())) {
          validSymbols.push(sym);
        } else {
          unsupportedReferencesRemoved.push(`Symbol: ${sym}`);
          wasGroundingAdjusted = true;
        }
      }

      // Validate evidence IDs
      const validSupportingIds: string[] = [];
      for (const id of h.supportingEvidenceIds || []) {
        if (availableEvidenceIds.has(id)) {
          validSupportingIds.push(id);
        } else {
          unsupportedReferencesRemoved.push(`Evidence ID: ${id}`);
          wasGroundingAdjusted = true;
        }
      }

      const validContradictingIds: string[] = [];
      for (const id of h.contradictingEvidenceIds || []) {
        if (availableEvidenceIds.has(id)) {
          validContradictingIds.push(id);
        } else {
          unsupportedReferencesRemoved.push(`Contradicting Evidence ID: ${id}`);
          wasGroundingAdjusted = true;
        }
      }

      validHypotheses.push({
        id: `ai-hypo-${i + 1}`,
        category: h.category || 'UNKNOWN',
        statement: h.statement || 'Candidate hypothesis',
        status: h.status || 'CANDIDATE',
        confidence: h.confidence || 'MEDIUM',
        supportingEvidenceIds: validSupportingIds,
        contradictingEvidenceIds: validContradictingIds,
        filePaths: validFiles,
        symbols: validSymbols,
        sourceReferences: ['AI_INFERENCE'],
      });
    }

    // 2. Validate Fix Plan
    const rawFix = rawOutput.fixPlan || {};
    const auditedFix = FixPlanner.auditPlanSafety({
      summary: rawFix.summary || 'Remediation plan',
      affectedFiles: (rawFix.steps || [])
        .map((s: any) => s.targetFile)
        .filter((f: string) => f && availableFiles.has(f.toLowerCase())),
      affectedSymbols: [],
      steps: (rawFix.steps || []).map((s: any, idx: number) => ({
        stepNumber: s.stepNumber || idx + 1,
        description: s.description || 'Inspect implementation',
        targetFile: s.targetFile,
        action: s.action || 'INSPECT',
        rationale: s.rationale || 'Address root cause',
      })),
      expectedBehavior: 'System operates correctly within expected QA criteria.',
      riskAssessment: 'LOW',
      requiredTests: [],
    });

    // 3. Validate Verification Plan
    const rawVerify = rawOutput.verificationPlan || {};
    const validVerificationTargets: string[] = [];
    for (const t of rawVerify.targets || []) {
      if (targetSet.has(t.toLowerCase())) {
        validVerificationTargets.push(t);
      } else {
        unsupportedReferencesRemoved.push(`Target: ${t}`);
        wasGroundingAdjusted = true;
      }
    }

    // Fall back to existing targets if AI generated hallucinated targets
    const finalTargets = validVerificationTargets.length > 0 ? validVerificationTargets : existingTargets;

    const verificationPlan: VerificationPlan = {
      suggestedDomains: (rawVerify.qaDomains || ['FUNCTIONAL']) as any,
      existingTargets: finalTargets,
      regressionTests: rawVerify.tests || [],
    };

    // 4. Validate Diagnosis
    const rawDiag = rawOutput.diagnosis || {};
    const limitations: string[] = [];
    if (wasGroundingAdjusted) {
      limitations.push(`AI hallucinated ${unsupportedReferencesRemoved.length} non-existent references which were stripped.`);
    }
    if (codeContext.isPartial) {
      limitations.push(`Analysis conducted with partial code context (${codeContext.partialReason || 'bounded'}).`);
    }

    const diagnosis: BugDiagnosis = {
      summary: rawDiag.summary || 'Root cause diagnosis',
      category: rawDiag.category || 'UNKNOWN',
      status: wasGroundingAdjusted && validHypotheses.length === 0 ? 'INSUFFICIENT_EVIDENCE' : (rawDiag.status || 'DIAGNOSED'),
      confidence: wasGroundingAdjusted ? 'MEDIUM' : (rawDiag.confidence || 'MEDIUM'),
      directLocations: [],
      explanation: rawDiag.explanation || rawDiag.summary || '',
      limitations,
      provenanceTrail: ['AI_INFERENCE', 'DIRECT_QA_EVIDENCE'],
    };

    return {
      diagnosis,
      hypotheses: validHypotheses,
      fixPlan: auditedFix,
      verificationPlan,
      wasGroundingAdjusted,
      unsupportedReferencesRemoved,
    };
  }
}
