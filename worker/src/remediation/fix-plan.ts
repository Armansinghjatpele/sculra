// ==============================================================================
// Sculra Grounded Fix Planner & Safety Guard (worker/src/remediation/fix-plan.ts)
// ==============================================================================

import {
  FixPlan,
  FixStep,
  FixRiskAssessment,
  RootCauseHypothesis,
  FailureObservation,
  CodeContext,
} from './types';

const UNSAFE_FIX_PATTERNS = [
  /disable\s+(auth|authentication|authorization|security|csrf|cors)/i,
  /remove\s+(auth|authentication|authorization|security|validation|headers?)/i,
  /turn\s+off\s+(auth|validation|security)/i,
  /bypass\s+(auth|rate\s*limit|permissions?)/i,
  /ignore\s+(tls|ssl|errors?|exceptions?)/i,
  /hardcode\s+(token|secret|password|credential|key)/i,
  /silence\s+(errors?|exceptions?)/i,
  /catch\s*\([^)]*\)\s*\{\s*\}/i, // Empty catch block
];

export class FixPlanner {
  /**
   * Generates a grounded, high-level remediation plan based on the validated hypothesis.
   * DOES NOT modify repository files. DOES NOT generate code patches.
   */
  static generateFixPlan(
    hypothesis: RootCauseHypothesis | undefined,
    observation: FailureObservation,
    codeContext: CodeContext
  ): FixPlan {
    const affectedFiles = hypothesis?.filePaths?.length
      ? hypothesis.filePaths
      : codeContext.files.slice(0, 3).map((f) => f.path);

    const affectedSymbols = hypothesis?.symbols || [];

    const steps: FixStep[] = [];
    let counter = 1;

    // 1. Inspection step
    const targetFile = affectedFiles[0] || 'affected source file';
    steps.push({
      stepNumber: counter++,
      description: `Inspect ${targetFile} and review control flow around failure condition (${observation.bugType}).`,
      targetFile,
      targetSymbol: affectedSymbols[0],
      action: 'INSPECT',
      rationale: 'Verify the execution path that led to the observed failure condition.',
    });

    // 2. Logic / Error handling step
    if (hypothesis?.category === 'VALIDATION_LOGIC') {
      steps.push({
        stepNumber: counter++,
        description: 'Verify input parameters and add explicit branch handling for invalid or missing payload values.',
        targetFile,
        action: 'VALIDATE_INPUT',
        rationale: 'Prevent unhandled exceptions by checking required properties before processing.',
      });
    } else if (hypothesis?.category === 'AUTHENTICATION' || hypothesis?.category === 'AUTHORIZATION') {
      steps.push({
        stepNumber: counter++,
        description: 'Ensure session token propagation and verify role policy definitions for the protected route.',
        targetFile,
        action: 'HANDLE_ERROR',
        rationale: 'Provide graceful 401/403 responses with clear structured error responses without leaking credentials.',
        safetyNotes: 'Do NOT disable authentication or remove authorization checks.',
      });
    } else {
      steps.push({
        stepNumber: counter++,
        description: 'Implement explicit error handling and defensive checks in the target handler.',
        targetFile,
        action: 'HANDLE_ERROR',
        rationale: 'Catch failure states early and return structured error messages.',
      });
    }

    // 3. Regression test step
    steps.push({
      stepNumber: counter++,
      description: `Add automated regression test covering ${observation.url} under failure condition.`,
      targetFile,
      action: 'ADD_TEST',
      rationale: 'Prevent future regressions by testing boundary conditions.',
    });

    const summary = hypothesis?.statement
      ? `Remediate ${hypothesis.category.toLowerCase().replace(/_/g, ' ')}: ${hypothesis.statement}`
      : `Resolve ${observation.bugType} on ${observation.url}`;

    const expectedBehavior = `Endpoint or component handles request gracefully and satisfies expected QA criteria without throwing ${observation.bugType}.`;

    // Safety audit
    const securityHazards: string[] = [];
    let riskAssessment: FixRiskAssessment = 'LOW';

    for (const step of steps) {
      for (const pattern of UNSAFE_FIX_PATTERNS) {
        if (pattern.test(step.description) || (step.safetyNotes && pattern.test(step.safetyNotes))) {
          securityHazards.push(`Unsafe recommendation detected: "${step.description}". Modifying security controls is prohibited.`);
          riskAssessment = 'SECURITY_RISK';
        }
      }
    }

    return {
      summary,
      affectedFiles,
      affectedSymbols,
      steps,
      expectedBehavior,
      riskAssessment,
      securityHazards: securityHazards.length > 0 ? securityHazards : undefined,
      requiredTests: [
        `Verify ${observation.url} returns successful response under valid input.`,
        `Verify ${observation.url} returns graceful error under invalid input.`,
      ],
    };
  }

  /**
   * Audits an arbitrary FixPlan (e.g. from AI) and flags any security hazards.
   */
  static auditPlanSafety(plan: FixPlan): FixPlan {
    const hazards: string[] = [];
    let risk = plan.riskAssessment;

    const allText = [
      plan.summary,
      ...plan.steps.map((s) => s.description + ' ' + (s.safetyNotes || '')),
    ].join(' ');

    for (const pattern of UNSAFE_FIX_PATTERNS) {
      if (pattern.test(allText)) {
        hazards.push('Plan contains recommendations that may weaken or bypass security controls.');
        risk = 'SECURITY_RISK';
        break;
      }
    }

    return {
      ...plan,
      riskAssessment: risk,
      securityHazards: hazards.length > 0 ? hazards : plan.securityHazards,
    };
  }
}
