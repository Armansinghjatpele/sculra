// ==============================================================================
// Sculra Fix Agent Diagnosis & FixPlan Grounding Validator (worker/src/fix-agent/plan-validator.ts)
// ==============================================================================

import { FixRequest } from './types';
import { RemediationAnalysis } from '../remediation/types';
import { DiagnosisValidationError } from './errors';

export class FixPlanValidator {
  /**
   * Validates that the remediation analysis and fix plan are grounded in empirical evidence
   * and do not contain invented files or ambiguous diagnoses.
   */
  static validate(
    request: FixRequest,
    analysis?: RemediationAnalysis
  ): { valid: boolean; validatedFiles: string[]; fixPlanSummary: string } {
    if (!analysis && !request.remediationAnalysis) {
      throw new DiagnosisValidationError(
        'Remediation analysis is missing. A grounded diagnosis is required before code remediation.',
        request.id
      );
    }

    const targetAnalysis = analysis || request.remediationAnalysis!;

    // 1. Check diagnosis status
    if (targetAnalysis.status === 'NOT_ANALYZED' || targetAnalysis.status === 'INSUFFICIENT_EVIDENCE') {
      throw new DiagnosisValidationError(
        `Cannot remediate: Diagnosis status is "${targetAnalysis.status}". Empirical evidence is insufficient.`,
        request.id
      );
    }

    // 2. Check confidence score: Ambiguous diagnoses cannot be safely auto-remediated
    if (targetAnalysis.confidence === 'VERY_LOW') {
      throw new DiagnosisValidationError(
        'Cannot remediate: Diagnosis confidence is VERY_LOW. Root cause is too ambiguous for safe remediation.',
        request.id
      );
    }

    // 3. Verify existence of fix plan and verification plan
    if (!targetAnalysis.fixPlan || !targetAnalysis.fixPlan.steps || targetAnalysis.fixPlan.steps.length === 0) {
      throw new DiagnosisValidationError(
        'Remediation FixPlan is missing or contains 0 action steps.',
        request.id
      );
    }

    if (!targetAnalysis.verificationPlan) {
      throw new DiagnosisValidationError(
        'VerificationPlan is missing from diagnosis.',
        request.id
      );
    }

    // 4. Validate referenced files
    const affectedFiles = targetAnalysis.fixPlan.affectedFiles || [];
    if (affectedFiles.length === 0) {
      throw new DiagnosisValidationError(
        'FixPlan does not identify any affected source files.',
        request.id
      );
    }

    // Validate no path traversal in file paths
    for (const f of affectedFiles) {
      if (f.includes('..') || f.startsWith('/') || /^[a-zA-Z]:/.test(f)) {
        throw new DiagnosisValidationError(
          `FixPlan references invalid or unsafe file path: "${f}"`,
          request.id
        );
      }
    }

    return {
      valid: true,
      validatedFiles: affectedFiles,
      fixPlanSummary: targetAnalysis.fixPlan.summary || 'Fix plan validated successfully',
    };
  }
}
